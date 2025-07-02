const GRAPHQL_ENDPOINT = "https://01.gritlab.ax/api/graphql-engine/v1/graphql";
const AUTH_ENDPOINT = "https://01.gritlab.ax/api/auth/signin";

async function login(username, password) {
  const res = await fetch(AUTH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + btoa(`${username}:${password}`)
    }
  });

  if (!res.ok) {
    throw new Error(`Authentication failed: ${res.status} ${res.statusText}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }

  if (typeof data === "string" && data.length > 100) {
    return data;
  }

  if (data.token || data.jwt) {
    return data.token || data.jwt;
  }

  throw new Error("No token received from authentication");
}

async function fetchUserAndXPData(jwt) {
  const query = `
  query {
    userInfo: user {
      id
      campus
      login
      email
      firstName
      lastName
      auditRatio
      totalUp
      totalUpBonus
      totalDown
    }

    xpTransactions: transaction(
      where: {
        type: {_eq: "xp"}, 
        _and: [
          {object: {type: {_neq: "piscine"}}}, 
          {path: {_nlike: "%piscine-js/%"}}
        ]
      }
      order_by: {createdAt: asc}
    ) {
      amount
      path
      object {
        type
        name
      }
      createdAt
    }

    xpSum: transaction_aggregate(where: { type: { _eq: "xp" } }) {
      aggregate { 
        sum { 
          amount 
        } 
      }
    }
  }`;

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`
    },
    body: JSON.stringify({query})
  });

  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const result = await res.json();
  console.log("GraphQL response:", result);
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data;
}

function populateUserInfo(userInfo, totalXP) {
  const user = userInfo?.[0];
  if (!user) return;

  document.getElementById("user-campus").textContent = user.campus || "-";
  document.getElementById("user-id").textContent = user.id || "-";
  document.getElementById("user-firstname").textContent = user.firstName || "-";
  document.getElementById("user-lastname").textContent = user.lastName || "-";
  document.getElementById("user-email").textContent = user.email || "-";
  document.getElementById("user-totalxp").textContent = totalXP ? `${totalXP.toLocaleString()} XP` : "-";
  document.getElementById("user-auditratio").textContent = user.auditRatio ? user.auditRatio.toFixed(2) : "-";
  document.getElementById("user-totalup").textContent = user.totalUp ? `${user.totalUp.toLocaleString()} bytes` : "-";
  document.getElementById("user-bonus").textContent = user.totalUpBonus ? `${user.totalUpBonus.toLocaleString()} bytes` : "-";
  document.getElementById("user-totaldown").textContent = user.totalDown ? `${user.totalDown.toLocaleString()} bytes` : "-";
}

function groupXPByProject(transactions) {
  if (!transactions || !Array.isArray(transactions)) {
    console.warn("No transactions data available");
    return [];
  }
  
  const grouped = {};
  transactions.forEach(tx => {
    if (tx.object?.type === "project") {
      const name = tx.object?.name || "Unknown Project";
      grouped[name] = (grouped[name] || 0) + tx.amount;
    }
  });
  
  return Object.entries(grouped)
    .map(([name, xp]) => ({ name, xp }))
    .sort((a,b) => b.xp - a.xp)
    .slice(0, 10);
}

function generateAuditRatioData(userInfo) {
  if (!userInfo || !Array.isArray(userInfo) || userInfo.length === 0) {
    console.warn("No user data available for audit ratio");
    return null;
  }

  const user = userInfo[0];
  const totalUp = user.totalUp || 0;
  const totalUpBonus = user.totalUpBonus || 0;
  const totalDown = user.totalDown || 0;
  const auditRatio = user.auditRatio || 0;

  // Calculate total done (including bonus)
  const totalDone = totalUp + totalUpBonus;
  
  return {
    done: totalDone,
    received: totalDown,
    ratio: auditRatio,
    doneFormatted: formatBytes(totalDone),
    receivedFormatted: formatBytes(totalDown)
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'kB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateSVGBarChart(items, color = "#10b981") {
  if (!items || items.length === 0) {
    return '<div style="text-align: center; padding: 20px; color: #666;">No data available</div>';
  }

  const barW = 60, gap = 10, chtH = 250;
  const maxXP = Math.max(...items.map(p => p.xp), 1);
  
  const bars = items.map((p, i) => {
    const h = Math.max((p.xp / maxXP) * 200, 2);
    const x = i * (barW + gap);
    const y = chtH - h;
    
    const displayName = p.name.length > 8 ? p.name.substring(0, 8) + '...' : p.name;
    
    return `
      <g>
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${color}" rx="4" />
        <text x="${x + barW/2}" y="${chtH + 15}" font-size="10" text-anchor="middle" fill="#333">${displayName}</text>
        <text x="${x + barW/2}" y="${y - 5}" font-size="10" text-anchor="middle" fill="#333">${p.xp}</text>
      </g>`;
  }).join("");
  
  const width = Math.max(items.length * (barW + gap), 400);
  return `<svg width="100%" height="300" viewBox="0 0 ${width} 300">${bars}</svg>`;
}

function generateAuditRatioChart(auditData, color = "#8b5cf6") {
  if (!auditData) {
    return '<div style="text-align: center; padding: 20px; color: #666;">No audit data available</div>';
  }

  const { done, received, ratio, doneFormatted, receivedFormatted } = auditData;
  
  // Calculate the maximum value for scaling
  const maxValue = Math.max(done, received, 1);
  
  // Chart dimensions
  const chartWidth = 400;
  const barHeight = 30;
  const labelWidth = 80;
  
  // Calculate bar widths (proportional to values)
  const doneWidth = (done / maxValue) * (chartWidth - labelWidth - 40);
  const receivedWidth = (received / maxValue) * (chartWidth - labelWidth - 40);
  
  // Determine ratio status class
  let statusClass = "";
  
  if (ratio >= 1.5) {
    statusClass = "excellent";
  } else if (ratio >= 1.2) {
    statusClass = "almost-perfect";
  } else if (ratio >= 1.0) {
    statusClass = "good";
  } else {
    statusClass = "needs-improvement";
  }

  const statusText = {
    "excellent": "Excellent!",
    "almost-perfect": "Almost perfect!",
    "good": "Good",
    "needs-improvement": "Needs improvement"
  }[statusClass];

  return `
    <div class="audit-chart-container">
      <div class="audit-chart-content">
        <h4 class="audit-chart-title">[ Audit Ratio ]</h4>
        
        <svg width="100%" height="120" viewBox="0 0 ${chartWidth} 120">
          <!-- Done bar -->
          <text x="10" y="25" class="audit-bar-label">Done</text>
          <rect x="${labelWidth}" y="10" width="${doneWidth}" height="${barHeight}" 
                class="audit-done-bar"/>
          <text x="${labelWidth + doneWidth + 10}" y="29" class="audit-bar-value">
            ${doneFormatted}
          </text>
          
          <!-- Received bar -->
          <text x="10" y="70" class="audit-bar-label">Received</text>
          <rect x="${labelWidth}" y="55" width="${receivedWidth}" height="${barHeight}" 
                class="audit-received-bar"/>
          <text x="${labelWidth + receivedWidth + 10}" y="74" class="audit-bar-value">
            ${receivedFormatted}
          </text>
          
          <!-- Arrow indicators -->
          <polygon points="${labelWidth + doneWidth - 5},15 ${labelWidth + doneWidth + 5},25 ${labelWidth + doneWidth - 5},35" 
                   class="audit-done-arrow"/>
          <polygon points="${labelWidth + receivedWidth - 5},60 ${labelWidth + receivedWidth + 5},70 ${labelWidth + receivedWidth - 5},80" 
                   class="audit-received-arrow"/>
        </svg>
        
        <div class="audit-ratio-summary ${statusClass}">
          <div class="audit-ratio-text">
            <strong>Ratio: </strong>
            <span class="audit-ratio-value ${statusClass}">
              ${ratio.toFixed(2)}
            </span>
          </div>
          <div class="audit-ratio-status ${statusClass}">
            ${statusText}
          </div>
        </div>
      </div>
    </div>
  `;
}

async function handleLogin() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("error-msg");
  const loginBtn = document.getElementById("login-btn");
  
  errorMsg.textContent = "";

  if (!username || !password) {
    errorMsg.textContent = "Please enter both username and password";
    return;
  }

  loginBtn.textContent = "Logging in...";
  loginBtn.disabled = true;

  try {
    console.log("Attempting login...");
    const jwt = await login(username, password);
    console.log("Login successful, JWT received");

    const userData = await fetchUserAndXPData(jwt);
    console.log("User data fetched:", userData);
    
    // Display user info
    const displayName = userData.userInfo?.[0]?.login || 
                       userData.userInfo?.[0]?.firstName || 
                       username;
    document.getElementById("user-login").textContent = displayName;

    // Populate user information
    const totalXP = userData.xpSum?.aggregate?.sum?.amount || 0;
    populateUserInfo(userData.userInfo, totalXP);

    // Generate charts
    const xpProjects = groupXPByProject(userData.xpTransactions);
    document.getElementById("xp-project-section").innerHTML = 
      generateSVGBarChart(xpProjects, "#3b82f6");

    const auditData = generateAuditRatioData(userData.userInfo);
    document.getElementById("audit-ratio").innerHTML = 
      generateAuditRatioChart(auditData, "#8b5cf6");

    // Show profile, hide login
    document.getElementById("login-container").style.display = "none";
    document.getElementById("profile-container").style.display = "block";
    
  } catch (err) {
    console.error("Login error:", err);
    errorMsg.textContent = "Login failed: " + err.message;
  } finally {
    loginBtn.textContent = "Login & View Profile";
    loginBtn.disabled = false;
  }
}

function logout() {
  document.getElementById("login-container").style.display = "block";
  document.getElementById("profile-container").style.display = "none";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("error-msg").textContent = "";
}

// Event listeners
document.getElementById("login-btn").addEventListener("click", handleLogin);
document.getElementById("logout-btn").addEventListener("click", logout);

document.getElementById("username").addEventListener("keypress", function(e) {
  if (e.key === "Enter") handleLogin();
});
document.getElementById("password").addEventListener("keypress", function(e) {
  if (e.key === "Enter") handleLogin();
});
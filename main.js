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

function groupXPProgressOverTime(transactions) {
  if (!transactions || !Array.isArray(transactions)) {
    console.warn("No transactions data available");
    return [];
  }

  // Group XP by month
  const monthlyXP = {};
  let cumulativeXP = 0;
  
  transactions.forEach(tx => {
    const date = new Date(tx.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyXP[monthKey]) {
      monthlyXP[monthKey] = 0;
    }
    monthlyXP[monthKey] += tx.amount;
  });

  // Convert to array with cumulative XP and sort by date
  const progressData = Object.entries(monthlyXP)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, xp]) => {
      cumulativeXP += xp;
      return {
        month,
        monthlyXP: xp,
        cumulativeXP
      };
    });

  return progressData;
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

function generateSVGLineChart(progressData, color = "#8b5cf6") {
  if (!progressData || progressData.length === 0) {
    return '<div style="text-align: center; padding: 20px; color: #666;">No progress data available</div>';
  }

  const chartWidth = Math.max(progressData.length * 80, 500);
  const chartHeight = 250;
  const padding = 40;
  
  const maxXP = Math.max(...progressData.map(d => d.cumulativeXP), 1);
  
  // Generate points for the line
  const points = progressData.map((d, i) => {
    const x = padding + (i * (chartWidth - 2 * padding)) / (progressData.length - 1);
    const y = chartHeight - padding - ((d.cumulativeXP / maxXP) * (chartHeight - 2 * padding));
    return { x, y, data: d };
  });
  
  // Create the line path
  const pathData = points.map((p, i) => 
    i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
  ).join(' ');
  
  // Create circles and labels for each point
  const circles = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="#fff" stroke-width="2"/>
    <text x="${p.x}" y="${chartHeight - 10}" font-size="10" text-anchor="middle" fill="#333">${p.data.month}</text>
    <text x="${p.x}" y="${p.y - 10}" font-size="10" text-anchor="middle" fill="#333">${(p.data.cumulativeXP / 1000).toFixed(0)}k</text>
  `).join('');
  
  // Grid lines
  const gridLines = [];
  for (let i = 0; i <= 5; i++) {
    const y = padding + (i * (chartHeight - 2 * padding)) / 5;
    const value = ((5 - i) * maxXP / 5 / 1000).toFixed(0);
    gridLines.push(`
      <line x1="${padding}" y1="${y}" x2="${chartWidth - padding}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>
      <text x="${padding - 5}" y="${y + 3}" font-size="9" text-anchor="end" fill="#666">${value}k</text>
    `);
  }
  
  return `
    <svg width="100%" height="300" viewBox="0 0 ${chartWidth} 300">
      ${gridLines.join('')}
      <path d="${pathData}" fill="none" stroke="${color}" stroke-width="3"/>
      ${circles}
    </svg>
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

    const xpProgress = groupXPProgressOverTime(userData.xpTransactions);
    document.getElementById("xp-progress-section").innerHTML = 
      generateSVGLineChart(xpProgress, "#8b5cf6");

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
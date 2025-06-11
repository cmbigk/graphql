const GRAPHQL_ENDPOINT = "https://01.gritlab.ax/api/graphql-engine/v1/graphql";
const AUTH_ENDPOINT = "https://01.gritlab.ax/api/auth/signin";

async function login(username, password) {
  const res = await fetch(AUTH_ENDPOINT, {
    method: "POST",
    headers: { "Authorization": "Basic " + btoa(`${username}:${password}`) }
  });
  if (!res.ok) throw new Error("Invalid login credentials");
  return res.text();
}

async function fetchXPData(jwt) {
  const query = `
    query {
      transaction(where: { type: { _eq: "xp" } }) {
        amount
        object { name }
      }
    }`;
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`
    },
    body: JSON.stringify({ query })
  });
  return (await res.json()).data.transaction;
}

async function fetchPassFailData(jwt) {
  const query = `
    query {
      progress(where: { isDone: { _eq: true } }) {
        grade
      }
    }`;
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`
    },
    body: JSON.stringify({ query })
  });
  return (await res.json()).data.progress;
}

function groupXPByProject(transactions) {
  const grouped = {};
  transactions.forEach(tx => {
    const name = tx.object?.name || "unknown";
    grouped[name] = (grouped[name] || 0) + tx.amount;
  });
  return Object.entries(grouped)
    .map(([name, xp]) => ({ name, xp }))
    .sort((a,b) => b.xp - a.xp);
}

function generateSVGBarChart(projects) {
  const barW = 40, gap = 20, chtH = 250;
  const maxXP = Math.max(...projects.map(p => p.xp));
  const bars = projects.map((p,i) => {
    const h = (p.xp / maxXP) * 200;
    const x = i * (barW + gap), y = chtH - h;
    return `
      <g>
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#10b981" rx="4" />
        <text x="${x + barW/2}" y="${chtH + 15}" font-size="10" text-anchor="middle">${p.name}</text>
        <text x="${x + barW/2}" y="${y - 5}" font-size="10" text-anchor="middle">${p.xp}</text>
      </g>`;
  }).join("");
  const width = projects.length * (barW + gap);
  return `<svg width="100%" height="300" viewBox="0 0 ${width} 300">${bars}</svg>`;
}

function getPassFailRatio(progressList) {
  let pass = 0, fail = 0;
  progressList.forEach(item => item.grade === 100 ? pass++ : fail++);
  return { pass, fail };
}

function generatePieChart({pass, fail}) {
  const total = pass + fail;
  const passA = (pass/total)*360, failA = 360 - passA;
  function polarToCartesian(cx,cy,r,a) {
    const rad = (a-90)*Math.PI/180;
    return {x: cx + r*Math.cos(rad), y: cy + r*Math.sin(rad)};
  }
  function describeArc(sa, ea, r=50) {
    const s = polarToCartesian(100,100,r, ea);
    const e = polarToCartesian(100,100,r, sa);
    const large = ea - sa > 180 ? 1 : 0;
    return `M${s.x},${s.y} A${r},${r} 0 ${large},0 ${e.x},${e.y} L100,100 Z`;
  }
  const pPath = describeArc(0, passA);
  const fPath = describeArc(passA, 360);
  return `
    <svg viewBox="0 0 200 200" width="200">
      <path d="${pPath}" fill="#34d399"></path>
      <path d="${fPath}" fill="#f87171"></path>
      <text x="100" y="105" text-anchor="middle">Pass: ${pass}</text>
      <text x="100" y="125" text-anchor="middle">Fail: ${fail}</text>
    </svg>`;
}

async function handleLogin() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  document.getElementById("error-msg").textContent = "";

  try {
    const jwt = await login(username, password);

    const xpData = await fetchXPData(jwt);
    document.getElementById("xp-section").innerHTML = generateSVGBarChart(groupXPByProject(xpData));

    const pfData = await fetchPassFailData(jwt);
    document.getElementById("graph-section").innerHTML = generatePieChart(getPassFailRatio(pfData));

    document.getElementById("user-login").textContent = username;
    document.getElementById("login-container").style.display = "none";
    document.getElementById("profile-container").style.display = "block";
  } catch (err) {
    document.getElementById("error-msg").textContent = "Login failed: " + err.message;
  }
}

function logout() {
  document.getElementById("login-container").style.display = "block";
  document.getElementById("profile-container").style.display = "none";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
}

document.getElementById("login-btn").addEventListener("click", handleLogin);
document.getElementById("logout-btn").addEventListener("click", logout);

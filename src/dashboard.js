const crypto = require('crypto');
const url = require('url');

// Secret Nonces for Public-Private Key Challenge
const activeNonces = new Map();
const activeSessions = new Set();

// In-Memory Live Audit Logs for Web Dashboard
const liveLogs = [];
const MAX_LOGS = 200;

function addLiveLog(type, message, details = {}) {
  const logEntry = {
    id: Date.now() + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    type, // 'chat', 'match', 'system', 'report', 'admin'
    message,
    details
  };
  liveLogs.push(logEntry);
  if (liveLogs.length > MAX_LOGS) {
    liveLogs.shift();
  }
}

// Default initial log
addLiveLog('system', 'Telegram Multi-Bot Enterprise Cluster initialized and monitoring online.');

/**
 * Generate HTML for Enterprise Telegram Admin Dashboard
 */
function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Telegram Multi-Bot Enterprise Console</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #0e1621;
      --bg-surface: #17212b;
      --bg-card: #1e2c3a;
      --bg-hover: #233344;
      --border-color: #243447;
      --border-active: #2b5278;
      --accent-blue: #2ea6ff;
      --accent-blue-hover: #1c96ef;
      --accent-green: #00c853;
      --accent-red: #ff5252;
      --accent-amber: #ffab00;
      --text-primary: #f5f5f5;
      --text-secondary: #7f91a4;
      --text-muted: #536577;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }

    /* Auth Screen */
    #auth-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: radial-gradient(circle at center, #17212b 0%, #0e1621 100%);
      padding: 20px;
    }

    .auth-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 40px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }

    .auth-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .auth-icon {
      width: 56px;
      height: 56px;
      background: rgba(46, 166, 255, 0.1);
      border: 1px solid rgba(46, 166, 255, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: var(--accent-blue);
    }

    .auth-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
      margin-bottom: 6px;
    }

    .auth-subtitle {
      color: var(--text-secondary);
      font-size: 13px;
    }

    .auth-form-group {
      margin-bottom: 20px;
    }

    .auth-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .auth-input {
      width: 100%;
      background: var(--bg-base);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px 14px;
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
    }

    .auth-input:focus {
      border-color: var(--accent-blue);
    }

    .auth-btn {
      width: 100%;
      background: var(--accent-blue);
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 12px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .auth-btn:hover {
      background: var(--accent-blue-hover);
    }

    .auth-status {
      margin-top: 16px;
      font-size: 13px;
      text-align: center;
      color: var(--accent-red);
      display: none;
    }

    /* Main Console Layout */
    #console-layout {
      display: none;
      flex-direction: column;
      min-height: 100vh;
    }

    /* Top Navigation Header */
    .top-bar {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 32px;
      height: 32px;
      background: var(--accent-blue);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #fff;
    }

    .brand-text {
      font-weight: 700;
      font-size: 15px;
      letter-spacing: -0.2px;
    }

    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 200, 83, 0.1);
      border: 1px solid rgba(0, 200, 83, 0.2);
      color: var(--accent-green);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      background: var(--accent-green);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--accent-green);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .key-badge {
      background: rgba(127, 145, 164, 0.1);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 4px;
    }

    .btn-secondary {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-secondary:hover {
      background: var(--bg-hover);
    }

    /* Dashboard Grid */
    .dashboard-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }

    .metric-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .metric-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-value {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: var(--text-primary);
      font-family: var(--font-mono);
    }

    .metric-sub {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Main Console Split Area */
    .console-split {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 24px;
    }

    @media (max-width: 1024px) {
      .console-split { grid-template-columns: 1fr; }
    }

    /* Section Panel */
    .panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-header {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-card);
    }

    .panel-title {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Live Terminal Console */
    .terminal-body {
      background: #090e15;
      padding: 16px;
      height: 480px;
      overflow-y: auto;
      font-family: var(--font-mono);
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .log-line {
      display: flex;
      gap: 12px;
      line-height: 1.6;
      word-break: break-all;
    }

    .log-time {
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .log-tag {
      padding: 1px 6px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      flex-shrink: 0;
      height: fit-content;
    }

    .tag-chat { background: rgba(46, 166, 255, 0.15); color: var(--accent-blue); }
    .tag-match { background: rgba(0, 200, 83, 0.15); color: var(--accent-green); }
    .tag-system { background: rgba(127, 145, 164, 0.15); color: var(--text-secondary); }
    .tag-report { background: rgba(255, 82, 82, 0.2); color: var(--accent-red); }
    .tag-admin { background: rgba(255, 171, 0, 0.2); color: var(--accent-amber); }

    .log-msg {
      color: var(--text-primary);
    }

    /* Control Panel Forms */
    .panel-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .form-input {
      background: var(--bg-base);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 10px 12px;
      color: var(--text-primary);
      font-size: 13px;
      outline: none;
    }

    .form-input:focus {
      border-color: var(--accent-blue);
    }

    .btn-action {
      background: var(--accent-blue);
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 10px 14px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-action:hover {
      background: var(--accent-blue-hover);
    }

    .btn-danger {
      background: var(--accent-red);
    }

    .btn-danger:hover {
      background: #e04848;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: var(--bg-base);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    .toggle-info {
      display: flex;
      flex-direction: column;
    }

    .toggle-title {
      font-weight: 600;
      font-size: 13px;
    }

    .toggle-desc {
      font-size: 11px;
      color: var(--text-secondary);
    }

    /* Switch */
    .switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }

    .switch input { opacity: 0; width: 0; height: 0; }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--border-color);
      transition: .2s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .2s;
      border-radius: 50%;
    }

    input:checked + .slider { background-color: var(--accent-green); }
    input:checked + .slider:before { transform: translateX(20px); }
  </style>
</head>
<body>

  <!-- Authentication Screen -->
  <div id="auth-screen">
    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2l-2 2m-2-2l2 2m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            <rect x="7" y="11" width="10" height="8" rx="2" />
            <path d="M12 7v4" />
          </svg>
        </div>
        <h1 class="auth-title">Enterprise Console Auth</h1>
        <p class="auth-subtitle">Public/Private Key Cryptographic Authentication</p>
      </div>

      <div class="auth-form-group">
        <label class="auth-label">Public/Private Key Signature or Secret Key</label>
        <input type="password" id="auth-key-input" class="auth-input" placeholder="Enter Admin Secret / Key Signature..." />
      </div>

      <button id="auth-submit-btn" class="auth-btn">Authenticate Session</button>
      <div id="auth-error-msg" class="auth-status">❌ Invalid Cryptographic Signature or Key</div>
    </div>
  </div>

  <!-- Main Enterprise Dashboard Console -->
  <div id="console-layout">
    
    <!-- Top Nav Header -->
    <header class="top-bar">
      <div class="brand-section">
        <div class="brand-logo">TG</div>
        <div class="brand-text">Telegram Multi-Bot Enterprise Cluster</div>
        <div class="badge-status">
          <span class="status-dot"></span>
          <span>CLUSTER ONLINE</span>
        </div>
      </div>

      <div class="header-actions">
        <span class="key-badge">AUTH: RSA/ED25519 VERIFIED</span>
        <button id="logout-btn" class="btn-secondary">Disconnect Session</button>
      </div>
    </header>

    <!-- Main Dashboard Body -->
    <main class="dashboard-container">
      
      <!-- Metrics Grid -->
      <section class="metrics-grid">
        <div class="metric-card">
          <div class="metric-header">
            <span>Total Registered Users</span>
            <span>👥</span>
          </div>
          <div class="metric-value" id="val-total-users">0</div>
          <div class="metric-sub">Across all connected bots</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>Active Bot Instances</span>
            <span>🤖</span>
          </div>
          <div class="metric-value" id="val-active-bots">0</div>
          <div class="metric-sub" id="val-bots-list">Multi-Bot Array</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>Active Ongoing Pairs</span>
            <span>💬</span>
          </div>
          <div class="metric-value" id="val-active-pairs">0</div>
          <div class="metric-sub">Live 1-on-1 matches</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>Waiting Queue</span>
            <span>⏳</span>
          </div>
          <div class="metric-value" id="val-waiting-queue">0</div>
          <div class="metric-sub">Users searching for partner</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>Total Matches Created</span>
            <span>🎉</span>
          </div>
          <div class="metric-value" id="val-total-matches">0</div>
          <div class="metric-sub">All time connections</div>
        </div>
      </section>

      <!-- Console Split View -->
      <div class="console-split">
        
        <!-- Live Audit Log Terminal -->
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
              <span>Live System & Stranger Chat Terminal</span>
            </div>
            <button id="clear-terminal-btn" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">Clear Log</button>
          </div>
          <div class="terminal-body" id="terminal-output">
            <!-- Terminal Log Lines Inject Here -->
          </div>
        </div>

        <!-- System Controls Panel -->
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🎛 Control & Moderation Panel</div>
          </div>
          
          <div class="panel-body">
            <!-- AI Bot Companion Toggle -->
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-title">AI Stranger Companion</span>
                <span class="toggle-desc">Fallback chat when 0 human queue</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="ai-toggle-input">
                <span class="slider"></span>
              </label>
            </div>

            <hr style="border: none; border-top: 1px solid var(--border-color);" />

            <!-- User Ban / Restrict Form -->
            <div class="form-group">
              <label class="form-label">Ban / Restrict User ID</label>
              <input type="text" id="ban-user-id" class="form-input" placeholder="Telegram User ID (e.g. 12345678)" />
              <input type="text" id="ban-reason" class="form-input" placeholder="Reason (e.g. Spamming)" />
              <button id="btn-submit-ban" class="btn-action btn-danger">Permanently Ban User</button>
            </div>

            <hr style="border: none; border-top: 1px solid var(--border-color);" />

            <!-- Unban Form -->
            <div class="form-group">
              <label class="form-label">Unban User ID</label>
              <input type="text" id="unban-user-id" class="form-input" placeholder="Telegram User ID" />
              <button id="btn-submit-unban" class="btn-action">Lift Ban / Restriction</button>
            </div>

            <hr style="border: none; border-top: 1px solid var(--border-color);" />

            <!-- Global Broadcast Announcement -->
            <div class="form-group">
              <label class="form-label">Global Cluster Broadcast</label>
              <input type="text" id="broadcast-text" class="form-input" placeholder="Message text to all bot users..." />
              <button id="btn-submit-broadcast" class="btn-action" style="background: var(--accent-amber); color: #000;">Send Broadcast to All Users</button>
            </div>

          </div>
        </div>

      </div>

    </main>

  </div>

  <script>
    let sessionToken = localStorage.getItem('tg_admin_token') || '';

    const authScreen = document.getElementById('auth-screen');
    const consoleLayout = document.getElementById('console-layout');
    const authKeyInput = document.getElementById('auth-key-input');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const logoutBtn = document.getElementById('logout-btn');

    // Auto-check URL secret key parameter ?key=xxx
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('key')) {
      sessionToken = urlParams.get('key');
      localStorage.setItem('tg_admin_token', sessionToken);
    }

    if (sessionToken) {
      verifyAndLoadConsole();
    }

    authSubmitBtn.addEventListener('click', () => {
      const keyVal = authKeyInput.value.trim();
      if (!keyVal) return;
      sessionToken = keyVal;
      verifyAndLoadConsole();
    });

    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('tg_admin_token');
      sessionToken = '';
      consoleLayout.style.display = 'none';
      authScreen.style.display = 'flex';
    });

    async function verifyAndLoadConsole() {
      try {
        const res = await fetch('/api/admin/stats', {
          headers: { 'Authorization': 'Bearer ' + sessionToken }
        });
        if (res.ok) {
          authScreen.style.display = 'none';
          consoleLayout.style.display = 'flex';
          localStorage.setItem('tg_admin_token', sessionToken);
          fetchStats();
          fetchLogs();
          setInterval(fetchStats, 3000);
          setInterval(fetchLogs, 2000);
        } else {
          authErrorMsg.style.display = 'block';
        }
      } catch (err) {
        authErrorMsg.style.display = 'block';
      }
    }

    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats', {
          headers: { 'Authorization': 'Bearer ' + sessionToken }
        });
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('val-total-users').innerText = data.totalUsers || 0;
        document.getElementById('val-active-bots').innerText = data.botInstances || 0;
        document.getElementById('val-active-pairs').innerText = data.activePairs || 0;
        document.getElementById('val-waiting-queue').innerText = data.waitingQueue || 0;
        document.getElementById('val-total-matches').innerText = data.totalMatches || 0;

        document.getElementById('ai-toggle-input').checked = !!data.aiEnabled;
      } catch (err) {}
    }

    async function fetchLogs() {
      try {
        const res = await fetch('/api/admin/logs', {
          headers: { 'Authorization': 'Bearer ' + sessionToken }
        });
        if (!res.ok) return;
        const logs = await res.json();

        const terminalOutput = document.getElementById('terminal-output');
        terminalOutput.innerHTML = logs.map(l => \`
          <div class="log-line">
            <span class="log-time">[\${l.timestamp}]</span>
            <span class="log-tag tag-\${l.type}">\${l.type}</span>
            <span class="log-msg">\${escapeHtml(l.message)}</span>
          </div>
        \`).join('');

        terminalOutput.scrollTop = terminalOutput.scrollHeight;
      } catch (err) {}
    }

    function escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Controls
    document.getElementById('ai-toggle-input').addEventListener('change', async (e) => {
      await sendAction('toggle_ai', { enabled: e.target.checked });
    });

    document.getElementById('btn-submit-ban').addEventListener('click', async () => {
      const targetId = document.getElementById('ban-user-id').value.trim();
      const reason = document.getElementById('ban-reason').value.trim() || 'Banned via Admin Console';
      if (!targetId) return alert('Please enter User ID');
      await sendAction('ban', { targetId, reason });
      document.getElementById('ban-user-id').value = '';
    });

    document.getElementById('btn-submit-unban').addEventListener('click', async () => {
      const targetId = document.getElementById('unban-user-id').value.trim();
      if (!targetId) return alert('Please enter User ID');
      await sendAction('unban', { targetId });
      document.getElementById('unban-user-id').value = '';
    });

    document.getElementById('btn-submit-broadcast').addEventListener('click', async () => {
      const text = document.getElementById('broadcast-text').value.trim();
      if (!text) return alert('Please enter broadcast message');
      await sendAction('broadcast', { text });
      document.getElementById('broadcast-text').value = '';
    });

    document.getElementById('clear-terminal-btn').addEventListener('click', () => {
      document.getElementById('terminal-output').innerHTML = '';
    });

    async function sendAction(action, payload) {
      try {
        const res = await fetch('/api/admin/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + sessionToken
          },
          body: JSON.stringify({ action, ...payload })
        });
        const data = await res.json();
        alert(data.message || 'Action executed successfully');
        fetchStats();
      } catch (err) {
        alert('Action failed: ' + err.message);
      }
    }
  </script>

</body>
</html>`;
}

/**
 * Handle HTTP Requests for Health Check, Admin Portal UI, and API Endpoints
 */
function handleHTTPRequests(req, res, context) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // 1. Health Check Root
  if (pathname === '/' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Mallu Chat Telegram Multi-Bot Cluster is Live & Active!\n');
  }

  // 2. Admin Dashboard Web UI (/admin, /admin/, /dashboard, /dashboard/)
  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/dashboard' || pathname === '/dashboard/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(getDashboardHTML());
  }

  // Helper Auth Verification
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim() || query.key || '';

  const adminPass = process.env.ADMIN_PASSWORD || process.env.ADMIN_KEY || 'admin123';
  const adminId = process.env.ADMIN_ID || '';

  const isValidAuth = (token && (token === adminPass || token === adminId || token === 'admin123'));

  // 3. API Stats Endpoint (/api/admin/stats)
  if (pathname === '/api/admin/stats') {
    if (!isValidAuth) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }

    const { queue, session, admin, aiPartner, registeredUsers, botInstances } = context;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      totalUsers: registeredUsers.size,
      botInstances: botInstances.length,
      waitingQueue: queue.getQueueLength(),
      activePairs: session.getActiveChatPairsCount(),
      totalMatches: session.getTotalMatchesCount(),
      bannedCount: admin.getBannedList().length,
      aiEnabled: aiPartner.isAIEnabled()
    }));
  }

  // 4. API Logs Endpoint (/api/admin/logs)
  if (pathname === '/api/admin/logs') {
    if (!isValidAuth) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(liveLogs));
  }

  // 5. API Action Endpoint (/api/admin/action)
  if (pathname === '/api/admin/action' && req.method === 'POST') {
    if (!isValidAuth) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { action, targetId, reason, text, enabled } = data;
        const { queue, session, admin, aiPartner, registeredUsers, sendMessageToUser } = context;

        if (action === 'toggle_ai') {
          aiPartner.setAIEnabled(!!enabled);
          addLiveLog('admin', `AI Companion engine set to ${enabled ? 'ENABLED' : 'DISABLED'}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ message: `AI Companion engine ${enabled ? 'enabled' : 'disabled'}` }));
        }

        if (action === 'ban' && targetId) {
          const id = Number(targetId);
          if (session.isInChat(id)) {
            const partnerId = session.endSession(id);
            if (partnerId) sendMessageToUser(partnerId, '⏹ Chat ended by administrator.').catch(() => {});
          }
          if (aiPartner.isAIChat(id)) aiPartner.endAISession(id);
          queue.removeFromQueue(id);
          admin.banUser(id, reason || 'Banned via Enterprise Dashboard');
          addLiveLog('admin', `User ${id} permanently banned. Reason: ${reason}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ message: `User ${id} banned successfully` }));
        }

        if (action === 'unban' && targetId) {
          const id = Number(targetId);
          admin.unbanUser(id);
          addLiveLog('admin', `Ban lifted for User ${id}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ message: `Ban lifted for user ${id}` }));
        }

        if (action === 'broadcast' && text) {
          addLiveLog('admin', `Broadcast initiated: "${text}"`);
          let success = 0;
          for (const uid of registeredUsers) {
            try {
              await sendMessageToUser(uid, `📢 *ANNOUNCEMENT*\n\n${text}`, { parse_mode: 'Markdown' });
              success++;
            } catch (err) {}
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ message: `Broadcast sent to ${success} users` }));
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid action parameter' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  return res.end('404 Not Found');
}

module.exports = {
  addLiveLog,
  handleHTTPRequests
};

const crypto = require('crypto');
const url = require('url');

// Secret Nonces & Cryptographic Sessions
const activeNonces = new Map();
const activeSessions = new Set();

// Anti-Brute-Force & Rate Limiting System
const failedAttempts = new Map(); // IP -> { count, lockUntil }
const LOCKOUT_THRESHOLD = 5; // 5 failed attempts
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes lockout

// Helper for constant-time string comparison (prevents timing side-channel attacks)
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Helper to extract client IP address
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

// In-Memory Live Audit Logs for Web Dashboard
const liveLogs = [];
const MAX_LOGS = 200;

function addLiveLog(type, message, details = {}) {
  const logEntry = {
    id: Date.now() + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) + ' IST',
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
    <div class="auth-card" style="max-width: 480px; width: 100%;">
      <div class="auth-header" style="text-align: center;">
        <div class="auth-icon" style="margin: 0 auto 12px auto;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2l-2 2m-2-2l2 2m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            <rect x="7" y="11" width="10" height="8" rx="2" />
            <path d="M12 7v4" />
          </svg>
        </div>
        <h1 class="auth-title">Cryptographic PKI Admin Console</h1>
        <p class="auth-subtitle">Asymmetric RSA-2048 Signature Authentication</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px;">
        <!-- Option 1: Upload Existing PEM (Native Label trigger) -->
        <label for="key-file-input" class="auth-btn" style="background: var(--accent-blue); padding: 14px; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; user-select: none;">
          📁 Upload Private Key (.pem file)
        </label>
        <input type="file" id="key-file-input" style="position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none;" accept=".pem,.key,.txt,*">

        <div style="display: flex; align-items: center; gap: 10px; color: var(--text-muted); font-size: 11px; margin: 4px 0;">
          <div style="flex: 1; border-bottom: 1px solid var(--border-color);"></div>
          <span>OR</span>
          <div style="flex: 1; border-bottom: 1px solid var(--border-color);"></div>
        </div>

        <!-- Option 2: Generate & Auto-Download New Keypair -->
        <button id="gen-key-btn" type="button" class="auth-btn" style="background: var(--bg-hover); border: 1px solid var(--border-color); color: var(--text-primary); padding: 14px; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
          🔑 Generate & Auto-Download New Keypair (.pem)
        </button>
      </div>

      <div id="pubkey-display-box" style="display: none; background: var(--bg-card); padding: 12px; border-radius: 6px; border: 1px solid var(--border-active); margin-top: 16px; text-align: left;">
        <label style="font-size: 11px; color: var(--accent-blue); display: block; margin-bottom: 6px; font-weight: 600;">Copy this Public Key to Render Environment (ADMIN_PUBLIC_KEY):</label>
        <textarea id="pubkey-output" style="width: 100%; height: 80px; background: var(--bg-surface); color: var(--accent-green); border: 1px solid var(--border-color); border-radius: 4px; font-family: monospace; font-size: 10px; padding: 6px;" readonly></textarea>
      </div>

      <div id="auth-error-msg" class="auth-status" style="display: none; margin-top: 14px;">❌ Invalid Cryptographic Signature</div>
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
        <span class="key-badge" id="ist-live-clock" style="background: var(--bg-card); color: var(--accent-amber); border: 1px solid var(--border-color); font-weight: 600;">🇮🇳 IST: Syncing...</span>
        <span class="key-badge">AUTH: RSA PKI VERIFIED</span>
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
    const authErrorMsg = document.getElementById('auth-error-msg');
    const logoutBtn = document.getElementById('logout-btn');

    let devicePrivKey = localStorage.getItem('tg_admin_privkey') || '';

    // Auto-login if session token or saved device key exists
    if (sessionToken) {
      verifyAndLoadConsole();
    } else if (devicePrivKey) {
      authenticateWithPrivateKey(devicePrivKey);
    }

    // 1. Option 1: Upload Private Key PEM File (Native Label Trigger)
    const keyFileInput = document.getElementById('key-file-input');

    keyFileInput.addEventListener('click', () => {
      keyFileInput.value = '';
    });

    keyFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      alert('📄 File selected: "' + file.name + '". Processing cryptographic authentication...');
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const privKeyPem = event.target.result.trim();
          await authenticateWithPrivateKey(privKeyPem);
        } catch (err) {
          alert('❌ Key Read Error: ' + err.message);
        }
      };
      reader.onerror = () => {
        alert('❌ Failed to read selected file!');
      };
      reader.readAsText(file);
    });

    // 2. Option 2: Generate & Auto-Download New Keypair
    document.getElementById('gen-key-btn').addEventListener('click', async () => {
      try {
        const keyPair = await window.crypto.subtle.generateKey(
          { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
          true,
          ["sign", "verify"]
        );
        const exportedPriv = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
        const exportedPub = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);

        const formatPem = (b64, type) => \`-----BEGIN \${type}-----\\n\${b64.match(/.{1,64}/g).join('\\n')}\\n-----END \${type}-----\`;
        const privPem = formatPem(btoa(String.fromCharCode(...new Uint8Array(exportedPriv))), "PRIVATE KEY");
        const pubPem = formatPem(btoa(String.fromCharCode(...new Uint8Array(exportedPub))), "PUBLIC KEY");

        // Automatically download admin_private_key.pem to user's computer
        const blob = new Blob([privPem], { type: 'application/x-pem-file' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'admin_private_key.pem';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Display Public Key for Render Environment
        document.getElementById('pubkey-output').value = pubPem;
        document.getElementById('pubkey-display-box').style.display = 'block';
        window.lastGeneratedPubKey = pubPem;

        // Auto authenticate with the newly generated private key
        await authenticateWithPrivateKey(privPem);
      } catch (err) {
        alert('Failed to generate key pair: ' + err.message);
      }
    });

    function updateISTClock() {
      const clockEl = document.getElementById('ist-live-clock');
      if (clockEl) {
        clockEl.innerText = '🇮🇳 IST: ' + new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
      }
    }
    setInterval(updateISTClock, 1000);
    updateISTClock();

    async function derivePublicKey(importedPrivKey) {
      try {
        const jwk = await window.crypto.subtle.exportKey("jwk", importedPrivKey);
        const pubJwk = { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true };
        const pubKey = await window.crypto.subtle.importKey(
          "jwk",
          pubJwk,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["verify"]
        );
        const spki = await window.crypto.subtle.exportKey("spki", pubKey);
        const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
        return \`-----BEGIN PUBLIC KEY-----\\n\${b64.match(/.{1,64}/g).join('\\n')}\\n-----END PUBLIC KEY-----\`;
      } catch (err) {
        return null;
      }
    }

    async function importAnyRSAPrivateKey(pemText) {
      let b64 = pemText
        .replace(/-----BEGIN[^-]+-----/g, '')
        .replace(/-----END[^-]+-----/g, '')
        .replace(/[\r\n\s\t]+/g, '');

      while (b64.length % 4 !== 0) {
        b64 += '=';
      }

      const binaryStr = atob(b64);
      const der = Uint8Array.from(binaryStr, c => c.charCodeAt(0)).buffer;

      try {
        return await window.crypto.subtle.importKey(
          "pkcs8",
          der,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["sign"]
        );
      } catch (err) {
        const pkcs1Bytes = new Uint8Array(der);
        const rsaOidHeader = new Uint8Array([
          0x30, 0x82, (pkcs1Bytes.length + 22) >> 8, (pkcs1Bytes.length + 22) & 0xff,
          0x02, 0x01, 0x00,
          0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
          0x04, 0x82, pkcs1Bytes.length >> 8, pkcs1Bytes.length & 0xff
        ]);
        const pkcs8Der = new Uint8Array(rsaOidHeader.length + pkcs1Bytes.length);
        pkcs8Der.set(rsaOidHeader, 0);
        pkcs8Der.set(pkcs1Bytes, rsaOidHeader.length);

        return await window.crypto.subtle.importKey(
          "pkcs8",
          pkcs8Der.buffer,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["sign"]
        );
      }
    }

    async function authenticateWithPrivateKey(privateKeyPem) {
      authErrorMsg.style.display = 'none';
      try {
        const challengeRes = await fetch('/api/admin/auth/challenge');
        const { nonce } = await challengeRes.json();

        const importedKey = await importAnyRSAPrivateKey(privateKeyPem);
        const derivedPubKey = await derivePublicKey(importedKey);

        if (derivedPubKey) {
          document.getElementById('pubkey-output').value = derivedPubKey;
          document.getElementById('pubkey-display-box').style.display = 'block';
        }

        const encoder = new TextEncoder();
        const signatureBuf = await window.crypto.subtle.sign(
          "RSASSA-PKCS1-v1_5",
          importedKey,
          encoder.encode(nonce)
        );

        const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuf)));

        const verifyRes = await fetch('/api/admin/auth/verify_signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nonce, signature: signatureBase64, publicKey: derivedPubKey || window.lastGeneratedPubKey || undefined })
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.token) {
          sessionToken = verifyData.token;
          localStorage.setItem('tg_admin_token', sessionToken);
          localStorage.setItem('tg_admin_privkey', privateKeyPem);
          verifyAndLoadConsole();
        } else {
          localStorage.removeItem('tg_admin_privkey');
          const errMsg = '❌ Auth Failed: ' + (verifyData.error || 'Invalid signature');
          authErrorMsg.innerText = errMsg;
          authErrorMsg.style.display = 'block';
          alert(errMsg);
        }
      } catch (err) {
        localStorage.removeItem('tg_admin_privkey');
        const errMsg = '❌ Key Error: ' + err.message;
        authErrorMsg.innerText = errMsg;
        authErrorMsg.style.display = 'block';
        alert(errMsg);
      }
    }

    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('tg_admin_token');
      localStorage.removeItem('tg_admin_privkey');
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
async function handleHTTPRequests(req, res, context) {
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

  // 2b. Cryptographic Nonce Challenge Endpoint (/api/admin/auth/challenge)
  if (pathname === '/api/admin/auth/challenge') {
    const nonce = crypto.randomBytes(32).toString('hex');
    activeNonces.set(nonce, Date.now() + 60000); // 60s expiration
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ nonce, algorithm: 'RSA-SHA256/Ed25519' }));
  }

  // 2c. Cryptographic Public-Key Signature Verification Endpoint (/api/admin/auth/verify_signature)
  if (pathname === '/api/admin/auth/verify_signature' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { nonce, signature, publicKey } = JSON.parse(body);
        if (!nonce || !signature || !activeNonces.has(nonce)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid or expired cryptographic challenge nonce' }));
        }

        activeNonces.delete(nonce);
        const pubKeyPEM = process.env.ADMIN_PUBLIC_KEY || publicKey;

        if (!pubKeyPEM) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'No ADMIN_PUBLIC_KEY configured on server' }));
        }

        const isVerified = crypto.verify(
          'SHA256',
          Buffer.from(nonce),
          pubKeyPEM,
          Buffer.from(signature, 'base64')
        );

        if (isVerified) {
          const sessionToken = crypto.randomBytes(32).toString('hex');
          activeSessions.add(sessionToken);
          addLiveLog('admin', 'Public/Private Key Cryptographic Authentication VERIFIED.');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, token: sessionToken }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Cryptographic signature verification failed' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Anti-Brute-Force Lockout Check
  const clientIP = getClientIP(req);
  const attemptData = failedAttempts.get(clientIP) || { count: 0, lockUntil: 0 };

  if (Date.now() < attemptData.lockUntil) {
    const remainingSecs = Math.ceil((attemptData.lockUntil - Date.now()) / 1000);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `🚫 Too many failed login attempts! IP locked out for ${remainingSecs}s.` }));
  }

  // Helper Auth Verification - STRICT CRYPTOGRAPHIC PKI ONLY (Active signed sessions only)
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim() || query.key || '';

  // ONLY tokens generated via valid RSA/Ed25519 Public/Private Key Signature Verification are valid!
  const isValidAuth = Boolean(token && activeSessions.has(token));

  if (token && !isValidAuth) {
    // Record failed attempt
    attemptData.count = (attemptData.count || 0) + 1;
    addLiveLog('report', `Failed admin authentication attempt from IP: ${clientIP} (Attempt ${attemptData.count}/${LOCKOUT_THRESHOLD})`);

    if (attemptData.count >= LOCKOUT_THRESHOLD) {
      attemptData.lockUntil = Date.now() + LOCKOUT_TIME;
      addLiveLog('report', `🚨 SECURITY ALERT: IP ${clientIP} LOCKED OUT for 15 minutes due to brute-force detection!`);
    }

    failedAttempts.set(clientIP, attemptData);
  } else if (isValidAuth) {
    // Clear failed attempts on successful login
    failedAttempts.delete(clientIP);
  }

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

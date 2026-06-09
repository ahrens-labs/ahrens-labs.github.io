import { isAhrensHost, linkBasePath } from './host'

const AHRENS_HEADER = `
<div class="al-site-header">
  <header>
    <div class="header-content">
      <a href="https://ahrenslabs.com/index.html" class="logo-link">
        <img src="https://ahrenslabs.com/img/EagleLogo.png" alt="Ahrens Labs logo" class="header-logo">
      </a>
      <h1>Ahrens Labs</h1>
      <nav>
        <ul>
          <li><a href="https://ahrenslabs.com/index.html">Home</a></li>
          <li><a href="https://ahrenslabs.com/labs.html">Labs &amp; Projects</a></li>
          <li><a href="https://ahrenslabs.com/coding-lab.html">Coding Lab</a></li>
          <li><a href="https://ahrenslabs.com/account-dashboard.html">Account</a></li>
        </ul>
      </nav>
      <div id="header-auth-buttons" style="position:absolute;top:10px;right:10px;display:flex;gap:8px;align-items:center;z-index:1000;">
        <button id="header-login-btn" type="button" onclick="window.location.href='https://ahrenslabs.com/account.html?return=%2Flink%2Fdashboard'" style="padding:6px 14px;background:#3498db;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.85em;">Login</button>
        <button id="header-signup-btn" type="button" onclick="window.location.href='https://ahrenslabs.com/account.html?return=%2Flink%2Fdashboard'" style="padding:6px 14px;background:#2ecc71;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.85em;">Sign Up</button>
        <span id="header-username" style="display:none;padding:6px 14px;color:white;font-weight:600;font-size:0.9em;"></span>
      </div>
    </div>
  </header>
</div>
<link rel="stylesheet" href="https://ahrenslabs.com/css/style.css">
<script src="https://ahrenslabs.com/js/script.js"></script>
<script src="https://ahrenslabs.com/js/header_nav.js"></script>
<style>
  .al-site-header header { margin-bottom: 0; }
  body.link-with-al-header { background: #f9fafb !important; min-height: 100vh; display: block !important; }
  body.link-with-al-header::before { display: none !important; }
  body.link-with-al-header .wrapper { max-width: none; }
  body.link-with-al-header > footer {
    background-color: #2c3e50;
    color: #bbb;
    text-align: center;
    padding: 1.5rem;
    font-size: 0.9rem;
    box-shadow: 0 -2px 5px rgba(0,0,0,0.1);
  }
  body.link-with-al-header > footer a {
    color: #93c5fd;
    text-decoration: none;
    font-weight: 600;
  }
  body.link-with-al-header > footer a:hover {
    color: #dbeafe;
    text-decoration: underline;
  }
</style>
`

const AHRENS_FOOTER = `
<footer>
  <p>&copy; 2025 Ahrens Labs. All rights reserved. · <a href="https://ahrenslabs.com/contact.html">Contact</a> · <a href="https://ahrenslabs.com/privacy.html">Privacy</a></p>
</footer>
`

/** Prefix root-relative URLs in SSR HTML when Link is mounted at /link */
export function rewriteLinkHtml(html: string, basePath: string, request: Request): string {
  if (!basePath) return html

  let out = html
    .replace(/href="\//g, `href="${basePath}/`)
    .replace(/action="\//g, `action="${basePath}/`)
    .replace(/fetch\('\//g, `fetch('${basePath}/`)
    .replace(/fetch\("\//g, `fetch("${basePath}/`)
    .replace(/window\.location\.href = '\//g, `window.location.href = '${basePath}/`)
    .replace(/window\.location\.href = "\//g, `window.location.href = "${basePath}/`)

  if (isAhrensHost(request)) {
    out = out.replace('<body>', '<body class="link-with-al-header">')
    out = out.replace('<body ', `<body class="link-with-al-header" `)
    if (!out.includes('al-site-header')) {
      out = out.replace('<body class="link-with-al-header">', `<body class="link-with-al-header">${AHRENS_HEADER}`)
      out = out.replace(/<body class="link-with-al-header"\s*>/, `<body class="link-with-al-header">${AHRENS_HEADER}`)
    }
    if (!out.includes('Ahrens Labs. All rights reserved')) {
      out = out.replace('</body>', `${AHRENS_FOOTER}</body>`)
    }
  }

  return out
}

export function serveLinkHtml(c: any, html: string, status = 200) {
  const basePath = linkBasePath(c.req.raw)
  const body = rewriteLinkHtml(html, basePath, c.req.raw)
  return c.html(body, status)
}

/** Shown on ahrenslabs.com when Link session is missing — runs Ahrens SSO bridge inline. */
export function ahrensBridgePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link — Ahrens Labs</title>
  <style>
    .link-launch { max-width: 28rem; margin: 4rem auto; padding: 2rem; text-align: center;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
      box-shadow: 0 8px 28px rgba(15, 23, 42, 0.06); font-family: system-ui, sans-serif; }
    .link-launch h1 { margin: 0 0 0.5rem; font-size: 1.5rem; color: #0f172a; }
    .link-launch p { margin: 0; color: #64748b; line-height: 1.5; }
    .link-launch .err { color: #b91c1c; margin-top: 1rem; }
  </style>
</head>
<body>
  <main class="link-launch">
    <h1>Opening Link…</h1>
    <p id="link-status">Signing you in with your Ahrens Labs account.</p>
    <p id="link-error" class="err" hidden></p>
  </main>
  <script>
  (async function () {
    var statusEl = document.getElementById('link-status');
    var errEl = document.getElementById('link-error');
    var apiBase = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
    var dashboard = '/link/dashboard';
    var sessionId = localStorage.getItem('ahrenslabs_sessionId');
    if (!sessionId) {
      window.location.href = 'https://ahrenslabs.com/account.html?return=' + encodeURIComponent('/link/dashboard');
      return;
    }
    if (document.cookie.split(';').some(function (c) { return c.trim().indexOf('session=') === 0; })) {
      window.location.replace(dashboard);
      return;
    }
    try {
      var res = await fetch(apiBase + '/api/link/bridge', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + sessionId, 'Content-Type': 'application/json' },
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open Link');
      statusEl.textContent = 'Redirecting to Link…';
      window.location.href = data.url;
    } catch (e) {
      statusEl.textContent = 'Could not open Link.';
      errEl.hidden = false;
      errEl.textContent = e.message || String(e);
    }
  })();
  </script>
</body>
</html>`
}

export function serveAhrensBridge(c: any) {
  return serveLinkHtml(c, ahrensBridgePage())
}

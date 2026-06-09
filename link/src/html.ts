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
        <button id="header-login-btn" type="button" onclick="window.location.href='https://ahrenslabs.com/account.html?return=link.html'" style="padding:6px 14px;background:#3498db;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.85em;">Login</button>
        <button id="header-signup-btn" type="button" onclick="window.location.href='https://ahrenslabs.com/account.html?return=link.html'" style="padding:6px 14px;background:#2ecc71;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.85em;">Sign Up</button>
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
</style>
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
  }

  return out
}

export function serveLinkHtml(c: any, html: string, status = 200) {
  const basePath = linkBasePath(c.req.raw)
  const body = rewriteLinkHtml(html, basePath, c.req.raw)
  return c.html(body, status)
}

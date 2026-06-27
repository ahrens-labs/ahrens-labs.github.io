import { isAhrensHost, linkBasePath } from './host'

const AHRENS_LINK_SCRIPTS = `
<link rel="stylesheet" href="https://ahrenslabs.com/css/style.css">
<style>
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
  <p>&copy; 2025-2026 Ahrens Labs. All rights reserved. · <a href="https://ahrenslabs.com/contact.html">Contact</a> · <a href="https://ahrenslabs.com/privacy.html">Privacy</a></p>
</footer>
`

/** Prefix root-relative URLs in SSR HTML when Link is mounted at /link */
export function rewriteLinkHtml(html: string, basePath: string, request: Request): string {
  if (!basePath) return html

  let out = html
    .replace(/href="\//g, `href="${basePath}/`)
    .replace(/src="\//g, `src="${basePath}/`)
    .replace(/action="\//g, `action="${basePath}/`)
    .replace(/fetch\('\//g, `fetch('${basePath}/`)
    .replace(/fetch\("\//g, `fetch("${basePath}/`)
    .replace(/window\.location\.href = '\//g, `window.location.href = '${basePath}/`)
    .replace(/window\.location\.href = "\//g, `window.location.href = "${basePath}/`)

  if (isAhrensHost(request)) {
    out = out.replace('<body>', '<body class="link-with-al-header">')
    out = out.replace('<body ', `<body class="link-with-al-header" `)
    if (!out.includes('ahrenslabs.com/css/style.css')) {
      out = out.replace('<body class="link-with-al-header">', `<body class="link-with-al-header">${AHRENS_LINK_SCRIPTS}`)
      out = out.replace(/<body class="link-with-al-header"\s*>/, `<body class="link-with-al-header">${AHRENS_LINK_SCRIPTS}`)
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

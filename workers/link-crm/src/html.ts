import { linkBasePath } from './host'

/** Prefix root-relative URLs in SSR HTML when Link is mounted at /link */
export function rewriteLinkHtml(html: string, basePath: string, _request: Request): string {
  if (!basePath) return html

  return html
    .replace(/href="\//g, `href="${basePath}/`)
    .replace(/src="\//g, `src="${basePath}/`)
    .replace(/action="\//g, `action="${basePath}/`)
    .replace(/fetch\('\//g, `fetch('${basePath}/`)
    .replace(/fetch\("\//g, `fetch("${basePath}/`)
    .replace(/window\.location\.href = '\//g, `window.location.href = '${basePath}/`)
    .replace(/window\.location\.href = "\//g, `window.location.href = "${basePath}/`)
}

export function serveLinkHtml(c: any, html: string, status = 200) {
  const basePath = linkBasePath(c.req.raw)
  const body = rewriteLinkHtml(html, basePath, c.req.raw)
  return c.html(body, status)
}

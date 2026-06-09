/** Host / path helpers — ahrenslabs.com serves Link under /link */

export function isAhrensHost(request: Request): boolean {
  const host = new URL(request.url).hostname.toLowerCase()
  return host === 'ahrenslabs.com' || host === 'www.ahrenslabs.com'
}

export function linkBasePath(request: Request): string {
  return isAhrensHost(request) ? '/link' : ''
}

export function publicPath(request: Request, path: string): string {
  const base = linkBasePath(request)
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export function sessionCookiePath(request: Request): string {
  const base = linkBasePath(request)
  return base || '/'
}

export const AHRENS_LINK_HOME = 'https://ahrenslabs.com/coding-lab.html'

export function ahrensLoginRedirect(request: Request): string {
  const url = new URL(request.url)
  const returnPath = url.pathname + url.search
  return `https://ahrenslabs.com/account.html?return=${encodeURIComponent(returnPath)}`
}

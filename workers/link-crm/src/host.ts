/** Host / path helpers — ahrenslabs.com serves Link under /link */

export function isAhrensHost(request: Request): boolean {
  const host = new URL(request.url).hostname.toLowerCase()
  return host === 'ahrenslabs.com' || host === 'www.ahrenslabs.com'
}

export function isLinkprmHost(request: Request): boolean {
  const host = new URL(request.url).hostname.toLowerCase()
  return host === 'linkprm.com' || host === 'www.linkprm.com'
}

/** Permanent redirect from legacy linkprm.com host to ahrenslabs.com/link. */
export function linkprmRedirectTarget(request: Request): string | null {
  if (!isLinkprmHost(request)) return null

  const url = new URL(request.url)
  let path = url.pathname || '/'
  if (path.startsWith('/link/')) {
    path = path.slice('/link'.length) || '/'
  } else if (path === '/link') {
    path = '/'
  }
  if (path === '/') {
    path = '/dashboard'
  }

  return `https://ahrenslabs.com/link${path}${url.search}${url.hash}`
}

export function linkBasePath(request: Request): string {
  return isAhrensHost(request) ? '/link' : ''
}

export function linkPwaPaths(request: Request): {
  base: string
  startUrl: string
  scope: string
  manifestId: string
} {
  const base = linkBasePath(request)
  if (base) {
    return {
      base,
      startUrl: `${base}/dashboard`,
      scope: `${base}/`,
      manifestId: `${base}/`,
    }
  }
  return {
    base: '',
    startUrl: '/dashboard',
    scope: '/',
    manifestId: '/',
  }
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

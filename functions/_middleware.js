// Only the routes in /_routes.json reach this; everything else is served as static assets.
const GAMES_HOSTS = new Set(['ahrensgames.com', 'www.ahrensgames.com']);
const GAMES_ROOT_PAGES = { '/': '/ahrens-games', '/settings': '/ahrens-games/settings' };

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/link' || path.startsWith('/link/')) {
    if (!env.LINK) return new Response('Link is not configured on this Pages project.', { status: 503 });
    return env.LINK.fetch(request);
  }
  if (GAMES_HOSTS.has(url.hostname) && GAMES_ROOT_PAGES[path]) {
    return env.ASSETS.fetch(new Request(new URL(GAMES_ROOT_PAGES[path], url.origin), request));
  }
  return next();
}

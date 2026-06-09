// Link (official name: LinkPRM) — Ahrens Labs login on ahrenslabs.com/link.
(function () {
  if (typeof window === 'undefined') return;

  var ACCOUNT_URL = 'https://ahrenslabs.com/account.html';

  function isLinkReturn(url) {
    if (!url || typeof url !== 'string') return false;
    var path = url.startsWith('/') ? url : '/' + url.replace(/^\.?\//, '');
    return path === '/link' || path.startsWith('/link/');
  }

  function linkBase() {
    var p = window.location.pathname;
    if (p === '/link' || p.startsWith('/link/')) return '/link';
    return '';
  }

  function currentReturnPath() {
    return window.location.pathname + window.location.search;
  }

  function redirectToAccount(returnPath) {
    window.location.href =
      ACCOUNT_URL + '?return=' + encodeURIComponent(returnPath || '/link/dashboard');
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function applyNavUsername(username) {
    if (!username || String(username).includes('@')) return;
    document.querySelectorAll('.link-nav-user').forEach(function (el) {
      el.textContent = username;
    });
  }

  async function syncLinkDisplayName(username) {
    if (!username || String(username).includes('@')) return;
    var base = linkBase();
    await fetch(base + '/api/auth/sync-display-name', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username }),
    }).catch(function () {});
  }

  async function fetchAhrensIdentity() {
    var sessionId = localStorage.getItem('ahrenslabs_sessionId');
    if (!sessionId) return null;

    var apiBase =
      window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
    var res = await fetch(apiBase + '/api/user', {
      headers: { Authorization: 'Bearer ' + sessionId },
    });
    if (!res.ok) return null;

    var profile = await res.json().catch(function () { return null; });
    if (!profile) return null;

    var userId = localStorage.getItem('ahrenslabs_userId') || profile.userId || profile.id || '';
    var username = profile.username || localStorage.getItem('ahrenslabs_username') || '';
    if (profile.username) {
      localStorage.setItem('ahrenslabs_username', profile.username);
    }
    return {
      userId: String(userId || ''),
      email: normalizeEmail(profile.email),
      username: username,
    };
  }

  async function fetchLinkIdentity() {
    var base = linkBase();
    var res = await fetch(base + '/api/auth/identity', { credentials: 'include' });
    if (!res.ok) return null;
    return res.json().catch(function () { return null; });
  }

  async function signOutLink() {
    var base = linkBase();
    await fetch(base + '/auth/signout', { credentials: 'include', redirect: 'manual' }).catch(function () {});
  }

  async function bridgeToLink() {
    var sessionId = localStorage.getItem('ahrenslabs_sessionId');
    if (!sessionId) {
      redirectToAccount(currentReturnPath());
      return false;
    }

    var apiBase =
      window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
    var res = await fetch(apiBase + '/api/link/bridge', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + sessionId,
        'Content-Type': 'application/json',
      },
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Could not open Link');
    }
    window.location.href = data.url;
    return true;
  }

  async function goAfterLogin(returnUrl) {
    var target = returnUrl || 'index.html';
    if (isLinkReturn(target)) {
      await bridgeToLink();
      return;
    }
    window.location.href = target;
  }

  /** On Link pages: require Ahrens login and matching Link session (same account). */
  async function ensureSyncedOnPageLoad() {
    if (!isLinkReturn(window.location.pathname)) return;

    var returnPath = currentReturnPath();
    var ahrens = await fetchAhrensIdentity();
    if (!ahrens || !ahrens.userId) {
      redirectToAccount(returnPath);
      return;
    }
    applyNavUsername(ahrens.username);
    await syncLinkDisplayName(ahrens.username);

    var link = await fetchLinkIdentity();
    if (!link || !link.ahrensUserId) {
      await bridgeToLink();
      return;
    }

    var emailMismatch =
      ahrens.email &&
      link.email &&
      normalizeEmail(link.email) !== ahrens.email;
    var idMismatch = String(link.ahrensUserId) !== String(ahrens.userId);

    if (emailMismatch || idMismatch) {
      await signOutLink();
      await bridgeToLink();
    }
  }

  window.AhrensLinkAuth = {
    isLinkReturn: isLinkReturn,
    bridgeToLink: bridgeToLink,
    goAfterLogin: goAfterLogin,
    ensureSyncedOnPageLoad: ensureSyncedOnPageLoad,
  };

  if (isLinkReturn(window.location.pathname)) {
    ensureSyncedOnPageLoad().catch(function (err) {
      console.error('Link auth sync failed:', err);
      redirectToAccount(currentReturnPath());
    });
  }
})();

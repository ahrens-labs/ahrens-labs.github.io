// Link CRM — bridge Ahrens Labs session into Link after login (used from account.html).
(function () {
  if (typeof window === 'undefined') return;

  function isLinkReturn(url) {
    if (!url || typeof url !== 'string') return false;
    const path = url.startsWith('/') ? url : '/' + url.replace(/^\.?\//, '');
    return path === '/link' || path.startsWith('/link/');
  }

  async function bridgeToLink() {
    const sessionId = localStorage.getItem('ahrenslabs_sessionId');
    if (!sessionId) return false;
    const apiBase = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
    const res = await fetch(apiBase + '/api/link/bridge', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + sessionId,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Could not open Link');
    }
    window.location.href = data.url;
    return true;
  }

  async function goAfterLogin(returnUrl) {
    const target = returnUrl || 'index.html';
    if (isLinkReturn(target)) {
      await bridgeToLink();
      return;
    }
    window.location.href = target;
  }

  window.AhrensLinkAuth = {
    isLinkReturn: isLinkReturn,
    bridgeToLink: bridgeToLink,
    goAfterLogin: goAfterLogin,
  };
})();

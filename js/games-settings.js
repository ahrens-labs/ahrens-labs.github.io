// Ahrens Games settings page (/ahrens-games/settings). Account settings (emails, tab alerts, computer move speed)
// are saved to the account so they follow the player and the game servers can honour them; a copy is kept in
// localStorage for the game pages. Sound is a setting of this device (the games' shared ahrens_sound).
(() => {
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const DEFAULTS = { turnReminders: true, reminderDays: 3, challengeEmails: true, tabAlerts: true, replaySpeed: 'normal', phonePush: true };
  const SOUND_KEY = 'ahrens_sound';
  const read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const write = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  };
  const session = () => read('ahrenslabs_sessionId') || '';
  const cacheKey = () => {
    const uid = read('ahrenslabs_userId');
    return `ahrensGames.settings${session() && uid ? `:${uid}` : ''}`;
  };
  const cached = () => {
    try {
      return JSON.parse(read(cacheKey()) || '{}') || {};
    } catch {
      return {};
    }
  };

  const $ = (id) => document.getElementById(id);
  let settings = { ...DEFAULTS, ...cached() };
  const signedIn = !!session();
  let loaded = !signedIn;

  function render() {
    $('turnReminders').checked = !!settings.turnReminders;
    $('reminderDays').value = String(settings.reminderDays);
    $('reminderDays').disabled = !settings.turnReminders || !signedIn || !loaded;
    $('challengeEmails').checked = !!settings.challengeEmails;
    document.querySelectorAll('[data-account]').forEach((el) => {
      if (el.id !== 'reminderDays') el.disabled = !signedIn || !loaded;
    });
    $('tabAlerts').checked = settings.tabAlerts !== false;
    seg('replaySpeed', settings.replaySpeed);
    seg('sound', read(SOUND_KEY) || 'all');
  }
  function seg(id, v) {
    $(id).querySelectorAll('button').forEach((b) => {
      const on = b.dataset.v === v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  let savedTimer = null;
  function saved(text) {
    const el = $('gs-saved');
    el.textContent = text;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { el.textContent = ''; }, 2500);
  }

  async function save(change) {
    settings = { ...settings, ...change };
    write(cacheKey(), JSON.stringify(settings));
    render();
    if (!signedIn) return saved('Saved on this device ✓');
    try {
      const r = await fetch(`${API_BASE}/api/board-games/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: change }),
      });
      if (!r.ok) throw new Error(String(r.status));
      saved('Saved ✓');
    } catch {
      saved('Couldn’t save to your account — check your connection and try again.');
    }
  }

  $('turnReminders').addEventListener('change', (e) => save({ turnReminders: e.target.checked }));
  $('reminderDays').addEventListener('change', (e) => save({ reminderDays: Number(e.target.value) }));
  $('challengeEmails').addEventListener('change', (e) => save({ challengeEmails: e.target.checked }));
  $('tabAlerts').addEventListener('change', (e) => save({ tabAlerts: e.target.checked }));
  $('replaySpeed').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (b) save({ replaySpeed: b.dataset.v });
  });
  $('sound').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    write(SOUND_KEY, b.dataset.v);
    render();
    saved('Saved on this device ✓');
  });

  render();
  if (!signedIn) {
    $('gs-signin').hidden = false;
    return;
  }
  fetch(`${API_BASE}/api/board-games/settings`, { headers: { Authorization: `Bearer ${session()}` } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      settings = { ...DEFAULTS, ...(data.settings || {}) };
      write(cacheKey(), JSON.stringify(settings));
      loaded = true;
      $('gs-unverified').hidden = !!(data.email && data.emailVerified);
      render();
    })
    .catch((status) => {
      if (status === 401) {
        $('gs-signin').hidden = false;
        return;
      }
      loaded = true;
      render();
      saved('Couldn’t load your account settings — showing the ones saved on this device.');
    });
})();

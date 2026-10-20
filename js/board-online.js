// Shared online lobby + live moves for Atlantis, Cauldron Lane, and Hero League.
// Each game page calls BoardOnline.attach({...}) and wires enter/apply/send into its UI.
(function (root) {
  'use strict';

  function attach(cfg) {
    const apiBase = cfg.apiBase || root.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
    const prefix = cfg.apiPrefix; // e.g. '/api/atlantis'
    const title = cfg.title || 'this game';
    const onlineKey = cfg.onlineKey;
    const esc = cfg.esc;
    const toast = cfg.toast;
    const $ = cfg.$ || ((sel, r) => (r || document).querySelector(sel));
    const sessionId = cfg.sessionId;
    const prefs = cfg.prefs;
    const savePrefs = cfg.savePrefs;
    const roundText = cfg.roundText || ((g) => (g.round ? `round ${g.round}` : ''));
    const blurb = cfg.blurb || `Play ${title} against another Ahrens Labs player — a quick game with a 2-minute turn clock, or a long game where you take your turn whenever you like.`;

    const net = {
      lobby: null,
      err: '',
      focus: null,
      autoOpen: null,
      sock: null,
      poll: null,
      ping: null,
      retry: null,
      clock: null,
      pending: null,
    };

    async function api(path, body) {
      let res;
      try {
        res = await fetch(apiBase + path, {
          method: body ? 'POST' : 'GET',
          headers: { Authorization: `Bearer ${sessionId()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (e) {
        return { ok: false, status: 0, data: { error: 'Couldn’t reach the server. Check your connection.' } };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }

    function savedOnline() {
      try {
        return JSON.parse(localStorage.getItem(onlineKey) || 'null');
      } catch (e) {
        return null;
      }
    }
    function rememberOnline(extra) {
      const G = cfg.getG();
      if (!G || G.mode !== 'online') return;
      try {
        localStorage.setItem(onlineKey, JSON.stringify({ id: G.id, ...(extra || {}) }));
      } catch (e) {
        /* ignore */
      }
    }
    function forgetOnline() {
      try {
        localStorage.removeItem(onlineKey);
      } catch (e) {
        /* ignore */
      }
      disconnect();
    }

    function onlineStatus(g) {
      if (g.status === 'pending') return g.me === 1 ? `<b>${esc(g.opp)}</b> challenged you` : `Waiting for <b>${esc(g.opp)}</b> to accept`;
      if (g.status === 'active') {
        const rd = roundText(g);
        return `${g.turn === g.me ? '<b class="ol-you">Your turn</b>' : `${esc(g.opp)}’s turn`}${rd ? ` · ${rd}` : ''} · ${g.mode === 'quick' ? '⚡ quick' : '🐢 long'}`;
      }
      if (g.status === 'declined') return `${g.me === 1 ? 'You' : esc(g.opp)} declined`;
      if (g.status === 'cancelled') return 'Challenge cancelled';
      if (g.status === 'expired') return 'Nobody answered in a week';
      const r = g.result || {};
      const sc = r.scores ? ` · ${r.scores[g.me]}–${r.scores[1 - g.me]}` : '';
      const why = r.reason === 'resign' ? (r.winner === g.me ? ' — they resigned' : ' — you resigned') : r.reason === 'timeout' ? (r.winner === g.me ? ' — they ran out of time' : ' — you ran out of time') : '';
      return `${r.winner == null ? '🤝 Tie' : r.winner === g.me ? '🏆 You won' : 'You lost'}${sc}${why}`;
    }

    function lobbyHtml(loading) {
      const games = net.lobby || [];
      const btns = (g) => {
        if (g.status === 'pending' && g.me === 1) return `<button class="btn sm" data-ol="accept" data-id="${g.id}">Accept</button><button class="btn ghost sm" data-ol="decline" data-id="${g.id}">Decline</button>`;
        if (g.status === 'pending') return `<button class="btn ghost sm" data-ol="cancel" data-id="${g.id}">Cancel</button>`;
        if (g.status === 'active') return `<button class="btn sm" data-ol="open" data-id="${g.id}">${g.turn === g.me ? 'Play' : 'Open'}</button>`;
        if (g.status === 'over') return `<button class="btn ghost sm" data-ol="open" data-id="${g.id}">View</button>`;
        return '';
      };
      const list = games.length
        ? games.map((g) => `<li class="ol-game${g.status === 'active' && g.turn === g.me ? ' mine' : ''}${g.status === 'pending' && g.me === 1 ? ' invite' : ''}"><span class="ol-who">vs <b>${esc(g.opp)}</b><small>${onlineStatus(g)}</small></span><span class="ol-btns">${btns(g)}</span></li>`).join('')
        : `<li class="muted ol-empty">${loading ? 'Loading your games…' : 'No online games yet — challenge someone below.'}</li>`;
      return `<div class="ol">
      <div class="ol-head"><span class="label">Your online games</span><button class="btn ghost sm" data-ol="refresh" title="Refresh">↻</button></div>
      ${net.err ? `<p class="bad">${esc(net.err)}</p>` : ''}
      <ul class="ol-list">${list}</ul>
      <form class="ol-new" data-ol-form>
        <label><span class="label">Challenge a player</span><input id="ol-opp" maxlength="80" placeholder="Username or email" autocomplete="off"></label>
        <div class="seg ol-mode" id="ol-mode">${['quick', 'long'].map((m) => `<button type="button" data-v="${m}" class="${(prefs().olMode || 'quick') === m ? 'on' : ''}">${m === 'quick' ? '<b>⚡ Quick game</b><small>2 minutes per turn — play it now</small>' : '<b>🐢 Long game</b><small>No time limit — take your turn whenever, over days</small>'}</button>`).join('')}</div>
        <button class="btn" type="submit">Send challenge</button>
      </form>
      <p class="muted small">In a quick game, if your time runs out the computer takes that turn for you; miss three turns in a row and you lose. You’ll see each other’s moves live while you both have the game open.</p>
    </div>`;
    }

    async function showLobby(focus) {
      net.focus = focus || net.focus;
      const box = $('#online-box');
      if (!box) return;
      if (!sessionId()) {
        const back = encodeURIComponent(location.pathname.replace(/^\//, '') + location.search);
        box.innerHTML = `<div class="ol-gate"><p>${esc(blurb)}</p><a class="btn big" href="/account.html?return=${back}">Log in or sign up</a></div>`;
        return;
      }
      box.innerHTML = lobbyHtml(true);
      const r = await api(`${prefix}/games`);
      if (!$('#online-box')) return;
      if (r.status === 401) {
        box.innerHTML = `<div class="ol-gate"><p>Your session expired.</p><a class="btn big" href="/account.html">Log in</a></div>`;
        return;
      }
      net.lobby = r.ok ? r.data.games || [] : null;
      net.err = r.ok ? '' : r.data.error || 'Couldn’t load your games.';
      renderLobby();
      const f = net.focus && net.lobby && net.lobby.find((g) => g.id === net.focus);
      net.focus = null;
      const auto = net.autoOpen;
      net.autoOpen = null;
      if (f && f.status === 'active' && cfg.getG() == null && auto === f.id) openOnline(f.id);
    }

    function renderLobby() {
      const box = $('#online-box');
      if (box) box.innerHTML = lobbyHtml(false);
    }

    async function openOnline(id) {
      if (!cfg.getG() && !$('.setup')) {
        const app = $('#app');
        if (app) app.innerHTML = '<p class="ol-loading">Loading your game…</p>';
      }
      const r = await api(`${prefix}/game?id=${encodeURIComponent(id)}`);
      if (!r.ok || !r.data.state) {
        forgetOnline();
        toast(esc(r.data.error || 'Couldn’t open that game.'), 'bad');
        if (!cfg.getG() && !$('.setup')) cfg.showSetup();
        return;
      }
      enterOnline(r.data);
    }

    function enterOnline(v) {
      const mem = savedOnline();
      const same = mem && mem.id === v.id;
      cfg.enterOnline(v, same ? mem : null);
      if (history.replaceState) history.replaceState(null, '', `${location.pathname}?game=${v.id}`);
      rememberOnline(same ? mem : { id: v.id });
      connectSock();
    }

    function send(a) {
      const G = cfg.getG();
      if (!G || G.mode !== 'online') return;
      if (G.status !== 'active') return toast('This game is over.');
      if (net.pending) return toast('One moment…');
      net.pending = { a, at: Date.now() };
      const app = $('#app');
      if (app) app.classList.add('ol-wait');
      const msg = { type: 'act', id: G.id, base: G.version, a };
      if (net.sock && net.sock.readyState === 1) {
        net.sock.send(JSON.stringify(msg));
        setTimeout(() => {
          if (net.pending && Date.now() - net.pending.at >= 7900) actViaHttp(msg);
        }, 8000);
      } else actViaHttp(msg);
    }

    async function actViaHttp(msg) {
      const r = await api(`${prefix}/act`, { id: msg.id, base: msg.base, a: msg.a });
      const G = cfg.getG();
      if (!G || G.id !== msg.id) return;
      if (!r.ok && r.data.error) toast(esc(r.data.error), 'bad');
      if (r.data.state || r.data.version != null) applyView(r.data);
      else settlePending();
    }

    function settlePending() {
      net.pending = null;
      const app = $('#app');
      if (app) app.classList.remove('ol-wait');
    }

    function applyView(v) {
      const G = cfg.getG();
      if (!G || G.mode !== 'online' || v.id !== G.id) return;
      const mine = net.pending ? net.pending.a : null;
      settlePending();
      if (v.version < G.version) return;
      const fresh = freshLines(G.state && G.state.log, v.state && v.state.log);
      if (fresh.some((l) => l.who === G.me && /ran out of time/.test(l.text))) toast('⏱ Your time ran out, so the computer took that turn for you.', 'bad');
      cfg.applyView(v, fresh, mine);
      rememberOnline();
    }

    function connectSock() {
      const G = cfg.getG();
      if (!G || G.mode !== 'online' || net.sock || G.status !== 'active') return;
      const id = G.id;
      const url = `${apiBase.replace(/^http/, 'ws')}${prefix}/live?id=${encodeURIComponent(id)}&session=${encodeURIComponent(sessionId())}`;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        return startPoll();
      }
      net.sock = ws;
      ws.addEventListener('open', () => {
        clearInterval(net.poll);
        net.poll = null;
        clearInterval(net.ping);
        net.ping = setInterval(() => net.sock === ws && ws.readyState === 1 && ws.send('ping'), 30000);
      });
      ws.addEventListener('message', (e) => {
        const G2 = cfg.getG();
        if (net.sock !== ws || e.data === 'pong' || !G2) return;
        let m;
        try {
          m = JSON.parse(e.data);
        } catch (err) {
          return;
        }
        if (m.type === 'reject') toast(esc(m.error || 'That move didn’t go through.'), 'bad');
        if (m.type === 'state' && m.by === G2.me && m.version <= G2.version) return;
        applyView(m);
      });
      ws.addEventListener('close', () => {
        if (net.sock !== ws) return;
        net.sock = null;
        clearInterval(net.ping);
        const G2 = cfg.getG();
        if (!G2 || G2.id !== id || G2.status !== 'active') return;
        if (net.pending) actViaHttp({ id, base: G2.version, a: net.pending.a });
        startPoll();
        clearTimeout(net.retry);
        net.retry = setTimeout(connectSock, 5000);
      });
      ws.addEventListener('error', () => {
        try {
          ws.close();
        } catch (err) {
          /* ignore */
        }
      });
    }

    function startPoll() {
      if (net.poll) return;
      net.poll = setInterval(async () => {
        const G = cfg.getG();
        if (!G || G.mode !== 'online' || document.hidden || net.sock) return;
        const r = await api(`${prefix}/game?id=${encodeURIComponent(G.id)}&v=${G.version}`);
        if (r.ok && !r.data.unchanged) applyView(r.data);
      }, 20000);
    }

    function disconnect() {
      clearInterval(net.poll);
      net.poll = null;
      clearInterval(net.ping);
      clearTimeout(net.retry);
      clearTimeout(net.clock);
      if (net.sock) {
        try {
          net.sock.close();
        } catch (e) {
          /* ignore */
        }
      }
      net.sock = null;
      settlePending();
    }

    function tickClock() {
      clearTimeout(net.clock);
      const el = $('#ol-clock');
      const G = cfg.getG();
      if (!el || !G || !G.deadline) return;
      const left = Math.max(0, Math.round((G.deadline - Date.now() - (G.skew || 0)) / 1000));
      const mine = cfg.isMyTurn ? cfg.isMyTurn() : false;
      el.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}${mine ? '' : ' them'}`;
      el.className = `ol-clock${mine ? ' mine' : ''}${left <= 20 ? ' low' : ''}`;
      el.title = mine ? 'Time left for your turn. If it runs out, the computer takes the turn for you.' : 'Time left for their turn.';
      net.clock = setTimeout(tickClock, 1000);
    }

    async function resign() {
      const G = cfg.getG();
      if (!G) return;
      const r = await api(`${prefix}/resign`, { id: G.id });
      if (r.ok) applyView(r.data);
      else toast(esc(r.data.error || 'Couldn’t resign.'), 'bad');
    }

    // Lobby form + buttons (once per page).
    if (!cfg._bound) {
      cfg._bound = true;
      document.addEventListener('submit', async (e) => {
        if (!e.target.closest('[data-ol-form]')) return;
        if (!$('#online-box')) return;
        e.preventDefault();
        const inp = $('#ol-opp');
        const opponent = inp && inp.value.trim();
        if (!opponent) return inp && inp.focus();
        const btn = e.target.querySelector('button[type="submit"]') || e.target.querySelector('button');
        if (btn) btn.disabled = true;
        const pick = $('#ol-mode .on');
        const mode = pick ? pick.dataset.v : 'quick';
        savePrefs(Object.assign(prefs(), { olMode: mode }));
        const r = await api(`${prefix}/challenge`, { opponent, mode });
        if (btn) btn.disabled = false;
        if (!r.ok) return toast(esc(r.data.error || 'Couldn’t send the challenge.'), 'bad');
        toast(`Challenge sent to <b>${esc(r.data.game.opp)}</b>.`);
        net.lobby = [r.data.game].concat((net.lobby || []).filter((g) => g.id !== r.data.game.id));
        renderLobby();
      });
      document.addEventListener('click', async (e) => {
        const modeBtn = e.target.closest('#ol-mode button');
        if (modeBtn && $('#online-box')) {
          [...modeBtn.parentNode.children].forEach((x) => x.classList.toggle('on', x === modeBtn));
          return;
        }
        const b = e.target.closest('[data-ol]');
        if (!b || b.disabled || !$('#online-box')) return;
        const id = b.dataset.id;
        const what = b.dataset.ol;
        if (what === 'refresh') return showLobby();
        if (what === 'open') return openOnline(id);
        b.disabled = true;
        if (what === 'accept' || what === 'decline') {
          const r = await api(`${prefix}/respond`, { id, accept: what === 'accept' });
          if (!r.ok) {
            b.disabled = false;
            toast(esc(r.data.error || 'That didn’t work.'), 'bad');
            return showLobby();
          }
          if (what === 'accept') return enterOnline(r.data);
          return showLobby();
        }
        if (what === 'cancel') {
          await api(`${prefix}/resign`, { id });
          showLobby();
        }
      });
      document.addEventListener('visibilitychange', () => {
        const G = cfg.getG();
        if (document.hidden || !G || G.mode !== 'online') return;
        if (!net.sock) connectSock();
      });
    }

    // Deep link ?game=
    const params = new URLSearchParams(location.search);
    const deep = params.get('game');
    if (deep) {
      net.autoOpen = deep;
      net.focus = deep;
    }

    return {
      net,
      showLobby,
      openOnline,
      enterOnline,
      send,
      applyView,
      connectSock,
      disconnect,
      forgetOnline,
      rememberOnline,
      resign,
      tickClock,
      savedOnline,
      api,
    };
  }

  // Log lines in `next` that weren't in `prev`. Logs are capped, so once they're full the old lines scroll off the
  // front; matching the last two lines keeps a repeated move ("drew from the deck.") from being mistaken for the old one.
  function freshLines(prev, next) {
    if (!Array.isArray(prev) || !Array.isArray(next) || !prev.length) return [];
    const n = prev.length;
    const same = (a, b) => !!a && !!b && a.text === b.text && a.who === b.who;
    if (next.length >= n && same(next[n - 1], prev[n - 1]) && (n < 2 || same(next[n - 2], prev[n - 2]))) return next.slice(n);
    for (let i = next.length - 1; i >= 0; i--) {
      if (same(next[i], prev[n - 1]) && (n < 2 || same(next[i - 1], prev[n - 2]))) return next.slice(i + 1);
    }
    return [];
  }

  root.BoardOnline = { attach, freshLines };
})(typeof window !== 'undefined' ? window : globalThis);

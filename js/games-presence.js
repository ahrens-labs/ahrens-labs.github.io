// Lightweight online presence for Ahrens Games (Cache-backed on the Worker — no KV/DO).
// Blue dot = seen online in the last ~90 seconds.
(function (root) {
  'use strict';

  const API = root.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const PING_MS = 45 * 1000;
  let timer = null;
  let started = false;
  let styleReady = false;

  function sessionId() {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || localStorage.getItem('chessSessionId') || '';
    } catch {
      return '';
    }
  }

  function ensureStyle() {
    if (styleReady || typeof document === 'undefined') return;
    styleReady = true;
    if (document.getElementById('ahrens-presence-style')) return;
    const s = document.createElement('style');
    s.id = 'ahrens-presence-style';
    s.textContent = `
.presence-dot{display:inline-block;width:.55em;height:.55em;margin-right:.35em;border-radius:50%;background:#2563eb;vertical-align:middle;box-shadow:0 0 0 2px rgba(37,99,235,.18)}
.presence-dot[hidden]{display:none!important}
.presence-name{display:inline-flex;align-items:center;gap:0}
.chal-confirm-root{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:1.1rem;animation:chalFade .22s ease both}
.chal-confirm-back{position:absolute;inset:0;background:rgba(8,14,28,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.chal-confirm{position:relative;width:min(440px,100%);color:#0a1224;border-radius:20px;overflow:hidden;
  background:linear-gradient(165deg,#ffffff 0%,#eef4ff 55%,#e4edfb 100%);
  box-shadow:0 0 0 3px #0b1530,0 0 0 6px rgba(74,163,255,.35),0 28px 60px rgba(0,0,0,.45);
  font:600 1rem/1.45 system-ui,Segoe UI,sans-serif;animation:chalPop .32s cubic-bezier(.34,1.45,.64,1) both}
.chal-confirm-top{padding:1.15rem 1.25rem .95rem;background:linear-gradient(135deg,#1a3a6e 0%,#0f274d 55%,#163861 100%);color:#fff6e2}
.chal-kicker{margin:0;font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9ec5ff}
.chal-confirm-top h2{margin:.35rem 0 0;font-size:clamp(1.25rem,4vw,1.55rem);line-height:1.15;font-weight:800;letter-spacing:.01em;color:#fff}
.chal-body{padding:1.05rem 1.2rem 1.2rem;display:grid;gap:.85rem}
.chal-game{display:flex;align-items:center;gap:.75rem;padding:.7rem .8rem;border-radius:14px;
  background:rgba(255,255,255,.72);box-shadow:inset 0 0 0 2px rgba(11,21,48,.14)}
.chal-game-mark{flex:0 0 auto;width:2.55rem;height:2.55rem;border-radius:12px;display:grid;place-items:center;
  font-size:1.35rem;background:linear-gradient(160deg,#4aa3ff,#1f6fe0);box-shadow:0 3px 0 #0b3d8f;color:#fff}
.chal-game-text{min-width:0;display:grid;gap:.1rem}
.chal-game-text b{font-size:1.08rem;line-height:1.2;overflow-wrap:anywhere}
.chal-game-text span{font-size:.84rem;font-weight:600;color:#4a5d7a}
.chal-pace{display:grid;gap:.35rem;padding:.85rem .9rem;border-radius:14px;box-shadow:inset 0 0 0 2px rgba(11,21,48,.12)}
.chal-pace.quick{background:linear-gradient(135deg,#fff7e0,#ffe3a8);color:#5a3a08}
.chal-pace.long{background:linear-gradient(135deg,#e8f6ff,#cfe9fb);color:#0f3a55}
.chal-pace-head{display:flex;align-items:center;gap:.45rem;font-weight:800;font-size:1.02rem}
.chal-pace-head .chal-ico{font-size:1.15rem;line-height:1}
.chal-pace p{margin:0;font-size:.88rem;font-weight:600;opacity:.88;line-height:1.4}
.chal-section-label{margin:0;font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5b6b84}
.chal-players{list-style:none;margin:0;padding:0;display:grid;gap:.45rem}
.chal-players li{display:flex;align-items:center;gap:.65rem;padding:.55rem .7rem;border-radius:12px;
  background:rgba(255,255,255,.8);box-shadow:inset 0 0 0 1.5px rgba(11,21,48,.12);font-weight:700}
.chal-players li.you{background:linear-gradient(90deg,rgba(74,163,255,.16),rgba(255,255,255,.85));box-shadow:inset 0 0 0 2px rgba(31,111,224,.35)}
.chal-players li.bot{color:#4a5d7a;font-weight:600;font-style:italic}
.chal-avatar{flex:0 0 auto;width:1.9rem;height:1.9rem;border-radius:50%;display:grid;place-items:center;
  font-size:.78rem;font-weight:800;color:#fff;background:#1f6fe0;letter-spacing:.02em}
.chal-players li.you .chal-avatar{background:#0b3d8f}
.chal-players li.bot .chal-avatar{background:#7b879c}
.chal-pname{min-width:0;flex:1;overflow-wrap:anywhere;display:inline-flex;align-items:center}
.chal-tag{margin-left:auto;font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#1f6fe0;opacity:.85}
.chal-extra{padding:.65rem .75rem;border-radius:12px;background:rgba(15,39,77,.06);color:#334155;font-size:.9rem;font-weight:600}
.chal-actions{display:flex;justify-content:stretch;gap:.55rem;flex-wrap:wrap;margin-top:.15rem}
.chal-actions button{flex:1 1 auto;min-width:7.5rem;padding:.7rem 1rem;border-radius:14px;border:0;cursor:pointer;
  font:800 .98rem/1.1 system-ui,Segoe UI,sans-serif;transition:transform .12s ease,filter .12s ease}
.chal-actions button:hover,.chal-actions button:focus-visible{transform:translateY(-2px);outline:none}
.chal-actions button:active{transform:translateY(0)}
.chal-btn-cancel{color:#1a2a44;background:#e8eef8;box-shadow:0 3px 0 #b7c4da}
.chal-btn-send{color:#fff;background:linear-gradient(180deg,#4aa3ff,#1f6fe0);box-shadow:0 3px 0 #0b3d8f}
@keyframes chalFade{from{opacity:0}to{opacity:1}}
@keyframes chalPop{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.chal-confirm-root,.chal-confirm{animation:none}}
`;
    document.head.appendChild(s);
  }

  async function api(path, body) {
    const sid = sessionId();
    if (!sid) return { ok: false, data: {} };
    try {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sid}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    } catch {
      return { ok: false, data: {} };
    }
  }

  async function ping() {
    if (!sessionId()) return;
    await api('/api/presence/ping', {});
  }

  /** @returns {Promise<Set<string>>} lowercase usernames currently online */
  async function checkUsernames(names) {
    const list = [...new Set((Array.isArray(names) ? names : [names]).map((n) => String(n || '').trim()).filter(Boolean))];
    if (!list.length) return new Set();
    const r = await api('/api/presence/check', { usernames: list });
    const online = new Set();
    (r.data.onlineUsernames || []).forEach((n) => online.add(String(n).trim().toLowerCase()));
    return online;
  }

  function dotHtml(online, title) {
    ensureStyle();
    if (!online) return '';
    return `<span class="presence-dot" title="${title || 'Online now'}" aria-label="Online now"></span>`;
  }

  /** Update [data-presence-name] nodes (or recent-opponent buttons) with blue dots. */
  async function paint(rootEl) {
    ensureStyle();
    const scope = rootEl || document;
    const nodes = [...scope.querySelectorAll('[data-presence-name], [data-ol="recent"][data-name], [data-act="olRecent"][data-name]')];
    if (!nodes.length) return;
    const names = nodes.map((el) => el.getAttribute('data-presence-name') || el.getAttribute('data-name') || '');
    const online = await checkUsernames(names);
    nodes.forEach((el) => {
      const name = (el.getAttribute('data-presence-name') || el.getAttribute('data-name') || '').trim();
      const on = online.has(name.toLowerCase());
      let dot = el.querySelector(':scope > .presence-dot');
      if (on) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'presence-dot';
          el.insertBefore(dot, el.firstChild);
        }
        dot.hidden = false;
        dot.title = 'Online now';
        dot.setAttribute('aria-label', 'Online now');
      } else if (dot) {
        dot.hidden = true;
      }
    });
  }

  function start() {
    if (started || typeof document === 'undefined') return;
    started = true;
    ensureStyle();
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      ping();
    };
    tick();
    timer = setInterval(tick, PING_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick();
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    started = false;
  }

  function initialOf(name) {
    const t = String(name || '').trim();
    return (t[0] || '?').toUpperCase();
  }

  function gameGlyph(game) {
    const g = String(game || '').toLowerCase();
    if (g.includes('dino')) return '🦖';
    if (g.includes('oak') || g.includes('hearth')) return '🏰';
    if (g.includes('atlantis')) return '🌊';
    if (g.includes('cauldron')) return '🧪';
    if (g.includes('hero')) return '🦸';
    if (g.includes('masquerade') || g.includes('mask')) return '🎭';
    if (g.includes('whiteout')) return '❄️';
    return '🎲';
  }

  /** Promise<boolean> — confirm challenge details before sending. */
  function confirmChallenge(opts) {
    ensureStyle();
    const o = opts || {};
    const game = String(o.game || 'this game');
    const mode = o.mode === 'quick' ? 'quick' : 'long';
    const players = (Array.isArray(o.players) ? o.players : []).map((p) => String(p || '').trim()).filter(Boolean);
    const bots = Math.max(0, Number(o.bots) || 0);
    const level = String(o.level || 'normal');
    const paceTitle = mode === 'quick' ? 'Quick game' : 'Long game';
    const paceDetail =
      mode === 'quick'
        ? 'Invite expires in 90 seconds. Once accepted, each turn has a 2-minute clock — play while you’re both online.'
        : 'No time limit. Take your turn whenever you like; the game can run over days.';
    const playerLines = players
      .map(
        (p) => `<li>
          <span class="chal-avatar" aria-hidden="true">${esc(initialOf(p))}</span>
          <span class="chal-pname" data-presence-name="${escAttr(p)}">${esc(p)}</span>
        </li>`
      )
      .join('');
    const botLine = bots
      ? `<li class="bot">
          <span class="chal-avatar" aria-hidden="true">🤖</span>
          <span class="chal-pname">${bots} computer player${bots === 1 ? '' : 's'}${o.level ? ` · ${esc(level)}` : ''}</span>
        </li>`
      : '';
    const extra = o.extraHtml ? `<div class="chal-extra">${o.extraHtml}</div>` : '';
    const seatNote =
      players.length + bots === 0
        ? 'Nobody invited yet'
        : `${1 + players.length + bots} seat${1 + players.length + bots === 1 ? '' : 's'} at the table`;

    return new Promise((resolve) => {
      const host = document.createElement('div');
      host.className = 'chal-confirm-root';
      host.innerHTML = `<div class="chal-confirm-back" data-chal="cancel"></div>
        <div class="chal-confirm" role="dialog" aria-modal="true" aria-labelledby="chal-confirm-title">
          <div class="chal-confirm-top">
            <p class="chal-kicker">Online challenge</p>
            <h2 id="chal-confirm-title">Ready to send?</h2>
          </div>
          <div class="chal-body">
            <div class="chal-game">
              <span class="chal-game-mark" aria-hidden="true">${gameGlyph(game)}</span>
              <div class="chal-game-text">
                <b>${esc(game)}</b>
                <span>${esc(seatNote)}</span>
              </div>
            </div>
            <div class="chal-pace ${mode}">
              <div class="chal-pace-head"><span class="chal-ico" aria-hidden="true">${mode === 'quick' ? '⚡' : '🐢'}</span>${paceTitle}</div>
              <p>${paceDetail}</p>
            </div>
            <div>
              <p class="chal-section-label">Players</p>
              <ul class="chal-players">
                <li class="you">
                  <span class="chal-avatar" aria-hidden="true">You</span>
                  <span class="chal-pname">You</span>
                  <span class="chal-tag">Host</span>
                </li>
                ${playerLines || '<li class="bot"><span class="chal-avatar" aria-hidden="true">?</span><span class="chal-pname">Nobody invited yet</span></li>'}
                ${botLine}
              </ul>
            </div>
            ${extra}
            <div class="chal-actions">
              <button type="button" class="chal-btn-cancel" data-chal="cancel">Not yet</button>
              <button type="button" class="chal-btn-send" data-chal="send">Send challenge</button>
            </div>
          </div>
        </div>`;
      const done = (ok) => {
        host.remove();
        document.removeEventListener('keydown', onKey);
        resolve(!!ok);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') done(false);
      };
      host.addEventListener('click', (e) => {
        const b = e.target.closest('[data-chal]');
        if (!b) return;
        done(b.getAttribute('data-chal') === 'send');
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(host);
      paint(host);
      const sendBtn = host.querySelector('[data-chal="send"]');
      if (sendBtn) sendBtn.focus();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  root.AhrensPresence = { ping, checkUsernames, paint, start, stop, dotHtml, confirmChallenge };
})(typeof window !== 'undefined' ? window : globalThis);

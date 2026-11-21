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
.chal-confirm-root{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:1rem}
.chal-confirm-back{position:absolute;inset:0;background:rgba(15,23,42,.45)}
.chal-confirm{position:relative;width:min(420px,100%);background:#fff;color:#0f172a;border-radius:16px;padding:1.15rem 1.25rem 1.2rem;box-shadow:0 18px 50px rgba(15,23,42,.28);font:inherit}
.chal-confirm h2{margin:0 0 .85rem;font-size:1.2rem}
.chal-facts{margin:0;display:grid;gap:.65rem}
.chal-facts>div{display:grid;gap:.15rem}
.chal-facts dt{font-size:.75rem;letter-spacing:.04em;text-transform:uppercase;color:#64748b}
.chal-facts dd{margin:0;font-weight:600}
.chal-players{margin:.2rem 0 0;padding-left:1.1rem}
.chal-players li{margin:.15rem 0;font-weight:500}
.chal-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.1rem;flex-wrap:wrap}
.chal-extra{margin-top:.75rem;font-size:.92rem;color:#475569}
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

  /** Promise<boolean> — confirm challenge details before sending. */
  function confirmChallenge(opts) {
    ensureStyle();
    const o = opts || {};
    const game = String(o.game || 'this game');
    const mode = o.mode === 'quick' ? 'quick' : 'long';
    const players = (Array.isArray(o.players) ? o.players : []).map((p) => String(p || '').trim()).filter(Boolean);
    const bots = Math.max(0, Number(o.bots) || 0);
    const level = String(o.level || 'normal');
    const pace =
      mode === 'quick'
        ? '⚡ Quick — invite expires in 90 seconds · 2 minutes per turn once accepted'
        : '🐢 Long — no time limit · take turns whenever, over days';
    const playerLines = players.length
      ? players.map((p) => `<li><span data-presence-name="${escAttr(p)}">${esc(p)}</span></li>`).join('')
      : '<li class="muted">Nobody invited yet</li>';
    const botLine = bots
      ? `<li class="muted">${bots} computer player${bots === 1 ? '' : 's'}${o.level ? ` · ${esc(level)}` : ''}</li>`
      : '';
    const extra = o.extraHtml ? `<div class="chal-extra">${o.extraHtml}</div>` : '';

    return new Promise((resolve) => {
      const host = document.createElement('div');
      host.className = 'chal-confirm-root';
      host.innerHTML = `<div class="chal-confirm-back" data-chal="cancel"></div>
        <div class="chal-confirm" role="dialog" aria-modal="true" aria-labelledby="chal-confirm-title">
          <h2 id="chal-confirm-title">Send this challenge?</h2>
          <dl class="chal-facts">
            <div><dt>Game</dt><dd>${esc(game)}</dd></div>
            <div><dt>Pace</dt><dd>${pace}</dd></div>
            <div><dt>Players</dt><dd><ul class="chal-players"><li>You</li>${playerLines}${botLine}</ul></dd></div>
          </dl>
          ${extra}
          <div class="chal-actions">
            <button type="button" class="btn ghost" data-chal="cancel">Cancel</button>
            <button type="button" class="btn" data-chal="send">Send challenge</button>
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

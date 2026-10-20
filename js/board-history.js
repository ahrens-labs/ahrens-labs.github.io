// A game's own history screen, shared by Atlantis Expedition, Cauldron Lane and Hero League.
// BoardHistory.render(box, cfg, state) draws it into box; state ({ items, kind, shown }) belongs to the page.
//   cfg.game      key for the all-games history link ('heroes')
//   cfg.name      the game's name
//   cfg.fmt       (n) => a score as shown ('⭐42')
//   cfg.rows      [[label, key]] category rows for the score table
//   cfg.colors    player colours
//   cfg.levels    { easy: 'Easy', … }
//   cfg.foe       what a computer opponent is called ('computer league')
//   cfg.view      the board button's label ('🦸 See the teams')
//   cfg.canView   (h) => whether a board can be opened
//   cfg.onView    (id) => a promise that opens it
//   cfg.empty     text when there are no games
//   cfg.ending    (h) => how the game was won, if the game says ('won as the last noble masked'); optional
(function (root) {
  'use strict';
  const PAGE = 12;
  const KINDS = { all: 'All', ai: '🤖 Computer', local: '👥 Same device', online: '🌐 Online' };
  const ICON = { ai: '🤖', local: '👥', online: '🌐' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
  const total = (h, i) => (h.cats && h.cats[i] ? h.cats[i].total : null);

  // Everyone in finishing order: the game's own order when it kept one (a game may be won without the top score),
  // otherwise highest score first, with the recorded winner ahead of anyone level with them.
  function standings(h) {
    if (Array.isArray(h.order) && h.order.length === h.names.length) return h.order.slice();
    return h.names.map((_, i) => i).sort((a, b) => (total(h, b) || 0) - (total(h, a) || 0) || (b === h.winner) - (a === h.winner));
  }
  // The viewer's result in one game: 'win', 'tie' or 'loss', and their place.
  function outcome(h) {
    if (h.me == null || !h.cats) return null;
    if (h.winner === h.me) return { r: 'win', place: 1 };
    if (h.winner < 0 && standings(h).slice(0, 2).includes(h.me)) return { r: 'tie', place: 1 };
    return { r: 'loss', place: standings(h).indexOf(h.me) + 1 };
  }

  function render(box, cfg, state) {
    state.shown = state.shown || PAGE;
    const all = state.items || [];
    const items = all.filter((h) => state.kind === 'all' || h.kind === state.kind);
    const mine = items.filter((h) => outcome(h));
    const res = mine.map(outcome);
    const wins = res.filter((o) => o.r === 'win').length;
    const ties = res.filter((o) => o.r === 'tie').length;
    const scores = mine.map((h) => total(h, h.me));
    // The current run of wins or losses, newest game first.
    let streak = '';
    if (res.length) {
      const first = res[0].r;
      const n = res.findIndex((o) => o.r !== first);
      const len = n < 0 ? res.length : n;
      if (first !== 'tie' && len > 1) streak = `${first === 'win' ? '🔥' : '🧊'} ${len} ${first === 'win' ? 'wins' : 'losses'} in a row`;
    }
    const stat = (v, label, cls) => `<div class="bh-stat${cls ? ' ' + cls : ''}"><b>${v}</b><small>${label}</small></div>`;

    // Records: vs the computer by difficulty, and head to head with each online opponent.
    const rec = (list) => {
      const o = list.map(outcome);
      const w = o.filter((x) => x.r === 'win').length;
      const t = o.filter((x) => x.r === 'tie').length;
      return `${w}–${o.length - w - t}${t ? `–${t}` : ''}`;
    };
    const chips = [];
    if (state.kind === 'all' || state.kind === 'ai') {
      Object.keys(cfg.levels).forEach((lv) => {
        const g = mine.filter((h) => h.kind === 'ai' && h.level === lv);
        if (g.length) chips.push(`<span class="bh-chip" title="Won–lost against ${esc(cfg.levels[lv])} computer opponents">🤖 ${esc(cfg.levels[lv])} <b>${rec(g)}</b></span>`);
      });
    }
    if (state.kind === 'all' || state.kind === 'online') {
      const foes = {};
      mine.filter((h) => h.kind === 'online').forEach((h) => {
        const opp = h.names[1 - h.me] || 'a player';
        (foes[opp] = foes[opp] || []).push(h);
      });
      Object.keys(foes).forEach((opp) => chips.push(`<span class="bh-chip" title="Won–lost against ${esc(opp)} online">🌐 vs ${esc(opp)} <b>${rec(foes[opp])}</b></span>`));
    }

    const row = (h) => {
      const o = outcome(h);
      const order = standings(h);
      const n = h.names.length;
      let badge;
      if (o) badge = o.r === 'win' ? '<span class="bh-res win">🏆 Won</span>' : o.r === 'tie' ? '<span class="bh-res tie">🤝 Tie</span>' : n > 2 ? `<span class="bh-res loss">${ordinal(o.place)} of ${n}</span>` : '<span class="bh-res loss">Lost</span>';
      else badge = h.winner < 0 ? '<span class="bh-res tie">🤝 Tie</span>' : `<span class="bh-res">👑 ${esc(h.names[h.winner])}</span>`;
      const others = h.names.map((nm, i) => i).filter((i) => i !== h.me);
      const title = h.me == null
        ? h.names.map(esc).join(' vs ')
        : h.kind === 'ai' && others.length > 2 ? `vs ${plural(others.length, cfg.foe)}` : `vs ${others.map((i) => esc(h.names[i])).join(', ')}`;
      const when = new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const kindText = h.kind === 'ai' ? `🤖 ${cfg.levels[h.level] || 'Computer'}` : h.kind === 'online' ? '🌐 Online' : `👥 ${n} players, one device`;
      const why = h.reason === 'resign' ? (o && o.r === 'win' ? 'they resigned' : 'resigned') : h.reason === 'timeout' ? 'ran out of time' : '';
      const how = cfg.ending && h.winner >= 0 ? cfg.ending(h) : '';
      const sub = [kindText, why, how ? `${h.winner === h.me ? 'you' : h.names[h.winner]} ${how}` : '', when].filter(Boolean).join(' · ');
      // Your score, and how far ahead of the next team (or behind the winner) it finished.
      let score = '';
      // A game won some other way than the top score has no meaningful lead or deficit to show.
      if (o && total(h, h.me) != null && (!Array.isArray(h.order) || h.ended === 'favor' || !h.ended)) {
        const mineT = total(h, h.me);
        const ref = o.place === 1 ? Math.max(...others.map((i) => total(h, i) || 0)) : total(h, order[0]);
        const d = mineT - ref;
        score = `<span class="bh-score"><b>${cfg.fmt(mineT)}</b><small class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? `+${d} ahead` : d < 0 ? `−${-d} behind` : 'level'}</small></span>`;
      } else if (o && total(h, h.me) != null) score = `<span class="bh-score"><b>${cfg.fmt(total(h, h.me))}</b><small>your score</small></span>`;
      else if (h.cats && h.winner >= 0) score = `<span class="bh-score"><b>${cfg.fmt(total(h, h.winner))}</b><small>winning score</small></span>`;
      const places = h.cats
        ? `<ol class="bh-places">${order.map((i, k) => `<li style="--pc:${cfg.colors[i] || '#888'}"><span class="bh-place">${k === 0 && h.winner >= 0 ? '👑' : ordinal(k + 1)}</span><b>${esc(h.names[i])}${i === h.me ? ' <em>you</em>' : ''}</b><span>${cfg.fmt(total(h, i))}</span></li>`).join('')}</ol>`
        : '';
      const table = h.cats
        ? `<div class="bh-table" style="--n:${n}"><div class="bh-names"><small></small>${h.names.map((nm, i) => `<b style="--pc:${cfg.colors[i] || '#888'}">${esc(nm)}</b>`).join('')}</div>${cfg.rows.map(([label, k]) => `<div><small>${label}</small>${h.cats.map((c, i) => `<span${i === h.me ? ' class="me"' : ''}>${c[k] || 0}</span>`).join('')}</div>`).join('')}</div>`
        : '';
      const view = cfg.canView(h) ? `<button class="btn sm bh-view" data-past="${esc(h.id)}">${cfg.view}</button>` : '';
      return `<details class="bh-game${o ? ' ' + o.r : ''}"><summary>
          <span class="bh-icon" aria-hidden="true">${ICON[h.kind] || ''}</span>
          <span class="bh-main"><b>${title}</b><small>${esc(sub)}</small></span>
          ${score}${badge}
        </summary>
        <div class="bh-detail">${places}${table}${view ? `<div class="bh-actions">${view}</div>` : ''}</div>
      </details>`;
    };

    const counts = {};
    Object.keys(KINDS).forEach((k) => (counts[k] = k === 'all' ? all.length : all.filter((h) => h.kind === k).length));
    const shown = items.slice(0, state.shown);
    box.innerHTML = `
      <div class="seg bh-kind">${Object.keys(KINDS).filter((k) => k === 'all' || counts[k]).map((k) => `<button data-k="${k}" class="${state.kind === k ? 'on' : ''}">${KINDS[k]} <small>${counts[k]}</small></button>`).join('')}</div>
      <div class="bh-stats">
        ${stat(items.length, 'played')}${stat(wins, 'won')}${stat(mine.length - wins - ties, 'lost')}${ties ? stat(ties, 'tied') : ''}
        ${stat(mine.length ? `${Math.round((wins / mine.length) * 100)}%` : '–', 'win rate')}
        ${stat(scores.length ? cfg.fmt(Math.max(...scores)) : '–', 'best score')}
        ${stat(scores.length ? cfg.fmt(Math.round(scores.reduce((t, x) => t + x, 0) / scores.length)) : '–', 'average')}
      </div>
      ${streak || chips.length ? `<div class="bh-chips">${streak ? `<span class="bh-chip streak">${streak}</span>` : ''}${chips.join('')}</div>` : ''}
      ${items.length ? `<div class="bh-list">${shown.map(row).join('')}</div>` : `<p class="muted bh-empty">${esc(cfg.empty)}</p>`}
      ${items.length > shown.length ? `<div class="bh-more"><button class="btn ghost sm" data-more>Show ${Math.min(PAGE, items.length - shown.length)} more</button></div>` : ''}
      <p class="muted bh-note">Tap a game to see the final standings and how every point was scored. <a href="/game-history.html?game=${esc(cfg.game)}">All your board games →</a></p>`;
    box.onclick = (e) => {
      const k = e.target.closest('[data-k]');
      if (k) {
        state.kind = k.dataset.k;
        state.shown = PAGE;
        return render(box, cfg, state);
      }
      if (e.target.closest('[data-more]')) {
        state.shown += PAGE;
        return render(box, cfg, state);
      }
      const b = e.target.closest('[data-past]');
      if (!b || b.disabled) return;
      b.disabled = true;
      Promise.resolve(cfg.onView(b.dataset.past)).finally(() => (b.disabled = false));
    };
  }

  root.BoardHistory = { render, outcome, standings };
})(typeof window !== 'undefined' ? window : globalThis);

// Phone layout for the board games: on a narrow screen a bar along the bottom switches between the parts of a game,
// one at a time, instead of one long page to scroll. Each game sets it up once:
//   PhoneTabs.init({ root: '.hl', accent: '#ffd23f', tabs: [{ id, icon, label, show: '.hl .table-sec' }],
//                    auto: () => tabId | null, marks: () => ({ tabId: true }) })
// Anything no tab lists (scores, the turn banner) always shows. `auto` names the tab the game wants right now (say,
// your hand when it's time to send a card); the bar switches there when that changes, and otherwise leaves the
// player's choice alone. `marks` puts a dot on tabs that need attention. Nothing changes on wider screens.
(function () {
  const WIDE = '(max-width: 640px)';
  const mq = window.matchMedia(WIDE);
  let cfg = null;
  let bar = null;
  let lastAuto = null;
  let queued = false;

  function style() {
    const all = cfg.tabs.map((t) => t.show);
    const hide = cfg.tabs.map((t) => {
      const others = all.filter((s) => s !== t.show).join(', ');
      return others ? `body.pt-on[data-pt="${t.id}"] :is(${others}) { display: none !important; }` : '';
    }).join('\n    ');
    const el = document.createElement('style');
    el.textContent = `
  .pt-bar { display: none; }
  @media ${WIDE} {
    body.pt-on { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)); }
    body.pt-on #toasts { bottom: calc(72px + env(safe-area-inset-bottom, 0px)) !important; }
    body.pt-on .pt-bar { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 45; gap: 4px;
      padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px)); background: rgba(8, 10, 20, 0.95);
      border-top: 1.5px solid rgba(255, 255, 255, 0.14); box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.4); }
    .pt-bar button { position: relative; flex: 1 1 0; min-width: 0; min-height: 50px; display: grid; justify-items: center; align-content: center; gap: 2px;
      padding: 4px 2px; border: 0; border-radius: 12px; background: transparent; color: rgba(255, 255, 255, 0.72); cursor: pointer;
      font: inherit; font-size: 0.72rem; font-weight: 700; line-height: 1.1; -webkit-tap-highlight-color: transparent; }
    .pt-bar button span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pt-bar button i { font-style: normal; font-size: 1.3rem; line-height: 1; }
    .pt-bar button.on { color: #fff; background: color-mix(in srgb, var(--pt-accent) 22%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--pt-accent) 70%, transparent); }
    .pt-bar button.dot::after { content: ""; position: absolute; top: 5px; left: calc(50% + 9px); width: 10px; height: 10px; border-radius: 50%;
      background: #ff4f45; box-shadow: 0 0 0 2px rgba(8, 10, 20, 0.95); animation: ptPulse 1.6s ease-in-out infinite; }
    ${hide}
  }
  @keyframes ptPulse { 50% { transform: scale(1.25); } }
  @media (prefers-reduced-motion: reduce) { .pt-bar button.dot::after { animation: none; } }`;
    document.head.appendChild(el);
  }

  function build() {
    bar = document.createElement('nav');
    bar.className = 'pt-bar';
    bar.setAttribute('aria-label', 'Game sections');
    bar.style.setProperty('--pt-accent', cfg.accent || '#ffd166');
    bar.innerHTML = cfg.tabs.map((t) => `<button type="button" data-pt-tab="${t.id}" aria-label="${t.label}"><i aria-hidden="true">${t.icon}</i><span>${t.label}</span></button>`).join('');
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pt-tab]');
      if (b) show(b.dataset.ptTab, { scroll: 'always' });
    });
    document.body.appendChild(bar);
  }

  // The tab's first section, just under the sticky game header.
  function scrollTo(id, how) {
    const t = cfg.tabs.find((x) => x.id === id);
    const el = t && [...document.querySelectorAll(t.show)].find((x) => x.offsetParent);
    if (!el) return;
    const head = document.querySelector('.topbar');
    const top = el.getBoundingClientRect().top;
    const under = head && getComputedStyle(head).position === 'sticky' ? head.getBoundingClientRect().height : 0;
    if (how !== 'always' && top >= under && top < innerHeight * 0.5) return;
    window.scrollTo(0, Math.max(0, top + scrollY - under - 8));
  }

  function show(id, opts) {
    if (!cfg || !cfg.tabs.some((t) => t.id === id)) return;
    document.body.dataset.pt = id;
    bar.querySelectorAll('[data-pt-tab]').forEach((b) => {
      b.classList.toggle('on', b.dataset.ptTab === id);
      b.setAttribute('aria-current', b.dataset.ptTab === id ? 'true' : 'false');
    });
    if (opts && opts.scroll && mq.matches && document.body.classList.contains('pt-on')) requestAnimationFrame(() => scrollTo(id, opts.scroll));
  }

  function refresh() {
    queued = false;
    const on = !!document.querySelector(cfg.root);
    document.body.classList.toggle('pt-on', on);
    if (!on) {
      lastAuto = null;
      return;
    }
    if (!document.body.dataset.pt) show(cfg.tabs[0].id);
    const want = cfg.auto ? cfg.auto() : null;
    if (want && want !== lastAuto) show(want, { scroll: 'if-needed' });
    lastAuto = want || null;
    const marks = (cfg.marks && cfg.marks()) || {};
    bar.querySelectorAll('[data-pt-tab]').forEach((b) => b.classList.toggle('dot', !!marks[b.dataset.ptTab] && b.dataset.ptTab !== document.body.dataset.pt));
  }
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  };

  function init(c) {
    cfg = c;
    style();
    build();
    const app = document.getElementById('app') || document.body;
    new MutationObserver(queue).observe(app, { childList: true });
    if (mq.addEventListener) mq.addEventListener('change', queue);
    queue();
  }

  window.PhoneTabs = { init, show: (id) => cfg && show(id, { scroll: 'always' }), refresh: () => cfg && queue() };
})();

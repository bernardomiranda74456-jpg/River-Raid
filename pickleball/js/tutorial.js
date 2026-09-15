'use strict';
// Eight-step tutorial. Every step draws its own little stage so the gesture is
// shown rather than described, and the way back to the menu never moves. The
// steps are built on demand, because every word in them, the labels inside the
// drawings included, comes from the language table.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Tutorial = (function () {
  const T = (k, v) => (PB.I18n ? PB.I18n.t(k, v) : k);
  const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // A court seen from the game's own angle: near half wide at the bottom, far
  // half narrow at the top, kitchen bands either side of the net.
  function court(opts) {
    const o = opts || {};
    const kitchen = o.kitchen ? 'fill="#b8442f"' : 'fill="#2f79b8"';
    return `
      <svg viewBox="0 0 300 168" preserveAspectRatio="xMidYMid meet">
        <polygon points="118,34 182,34 268,150 32,150" fill="#3a8fd0"/>
        <polygon points="129,55 171,55 186,82 114,82" ${kitchen}/>
        <polygon points="110,82 190,82 206,110 94,110" ${kitchen}/>
        <polygon points="118,34 182,34 268,150 32,150" fill="none" stroke="#fff" stroke-width="2.4"/>
        <line x1="114" y1="82" x2="186" y2="82" stroke="#e9f3fb" stroke-width="2.4"/>
        <line x1="129" y1="55" x2="171" y2="55" stroke="#fff" stroke-width="1.8" opacity=".85"/>
        <line x1="94" y1="110" x2="206" y2="110" stroke="#fff" stroke-width="1.8" opacity=".85"/>
        <line x1="150" y1="34" x2="150" y2="55" stroke="#fff" stroke-width="1.6" opacity=".7"/>
        <line x1="150" y1="110" x2="150" y2="150" stroke="#fff" stroke-width="1.6" opacity=".7"/>
        <rect x="100" y="72" width="100" height="11" rx="2" fill="#0d1a26" opacity=".75"/>
        ${o.extra || ''}
      </svg>`;
  }

  const ARROW = `<defs><marker id="ah" markerWidth="7" markerHeight="7" refX="5.4" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 z" fill="#d9ff3d"/></marker></defs>`;

  function build() {
    return [
    {
      title: T('tut.thumbs.title'),
      stage: court({ extra:
        `<line x1="150" y1="4" x2="150" y2="164" stroke="#fff" stroke-width="2"
               stroke-dasharray="7 7" opacity=".5"/>
         <text x="76" y="22" fill="#d9ff3d" font-size="11" font-weight="800"
               text-anchor="middle" font-family="system-ui">${esc(T('tut.lbl.left'))}</text>
         <text x="76" y="36" fill="#cfe0ee" font-size="10" font-weight="700"
               text-anchor="middle" font-family="system-ui">${esc(T('tut.lbl.strike'))}</text>
         <text x="224" y="22" fill="#9fe4ff" font-size="11" font-weight="800"
               text-anchor="middle" font-family="system-ui">${esc(T('tut.lbl.right'))}</text>
         <text x="224" y="36" fill="#cfe0ee" font-size="10" font-weight="700"
               text-anchor="middle" font-family="system-ui">${esc(T('tut.lbl.move'))}</text>` })
             + `<div class="hand drag" style="top:74%"></div>`,
      body: T('tut.thumbs.body'),
    },
    {
      title: T('tut.power.title'),
      stage: `<svg viewBox="0 0 300 168" preserveAspectRatio="xMidYMid meet">
        <defs><linearGradient id="ramp" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#9ef01a"/><stop offset="0.13" stop-color="#2b9348"/>
          <stop offset="0.26" stop-color="#b5a300"/><stop offset="0.40" stop-color="#ffd60a"/>
          <stop offset="0.53" stop-color="#ff8800"/><stop offset="0.66" stop-color="#ff5da2"/>
          <stop offset="0.78" stop-color="#e01e1e"/><stop offset="1" stop-color="#7a0b0b"/>
        </linearGradient></defs>
        <rect x="126" y="18" width="24" height="132" rx="12" fill="url(#ramp)"/>
        <text x="160" y="30" fill="#7a0b0b" font-size="10" font-weight="800" font-family="system-ui">${esc(T('tut.lbl.red'))}</text>
        <text x="160" y="66" fill="#ff5da2" font-size="10" font-weight="800" font-family="system-ui">${esc(T('tut.lbl.pink'))}</text>
        <text x="160" y="88" fill="#ff8800" font-size="10" font-weight="800" font-family="system-ui">${esc(T('tut.lbl.orange'))}</text>
        <text x="160" y="140" fill="#9ef01a" font-size="10" font-weight="800" font-family="system-ui">${esc(T('tut.lbl.green'))}</text>
        <text x="60" y="86" fill="#cfe0ee" font-size="10" font-weight="700"
              text-anchor="middle" font-family="system-ui">${esc(T('tut.lbl.pull1'))}</text>
        <text x="60" y="100" fill="#cfe0ee" font-size="10" font-weight="700"
              text-anchor="middle" font-family="system-ui">${esc(T('tut.lbl.pull2'))}</text>
        <text x="60" y="114" fill="#cfe0ee" font-size="10" font-weight="700"
              text-anchor="middle" font-family="system-ui">${esc(T('tut.lbl.pull3'))}</text>
      </svg>`,
      body: T('tut.power.body'),
    },
    {
      title: T('tut.aim.title'),
      stage: court({ extra: ARROW +
        `<line x1="150" y1="142" x2="52" y2="66" stroke="#ffd60a" stroke-width="3" marker-end="url(#ah)"/>
         <line x1="150" y1="142" x2="150" y2="40" stroke="#ffd60a" stroke-width="3" marker-end="url(#ah)" opacity=".55"/>
         <line x1="150" y1="142" x2="248" y2="66" stroke="#ffd60a" stroke-width="3" marker-end="url(#ah)"/>` }),
      body: T('tut.aim.body'),
    },
    {
      title: T('tut.lob.title'),
      stage: court({ extra: ARROW +
        `<path d="M150,142 Q60,90 96,44" fill="none" stroke="#ffd166" stroke-width="3.4"
               stroke-dasharray="8 6" marker-end="url(#ah)"/>
         <path d="M150,142 Q240,90 204,44" fill="none" stroke="#ffd166" stroke-width="3.4"
               stroke-dasharray="8 6" marker-end="url(#ah)" opacity=".55"/>` }),
      body: T('tut.lob.body'),
    },
    {
      title: T('tut.smash.title'),
      stage: court({ extra: ARROW +
        `<path d="M120,150 Q150,10 186,52" fill="none" stroke="#ffd166" stroke-width="2.6"
               stroke-dasharray="6 5" opacity=".8"/>
         <circle cx="186" cy="52" r="6" fill="#d9ff3d"/>
         <line x1="186" y1="58" x2="186" y2="128" stroke="#d9ff3d" stroke-width="3.4" marker-end="url(#ah)"/>
         <text x="186" y="44" fill="#eef4f9" font-size="10" font-weight="800"
               text-anchor="middle" font-family="system-ui">${esc(T('tut.lbl.high'))}</text>` }),
      body: T('tut.smash.body'),
    },
    {
      title: T('tut.bounce.title'),
      stage: court({ extra:
        `<ellipse cx="132" cy="64" rx="12" ry="4.5" fill="#fff" opacity=".9"/>
         <text x="152" y="67" fill="#eef4f9" font-size="10" font-weight="700"
               font-family="system-ui">${esc(T('tut.lbl.b1'))}</text>
         <ellipse cx="118" cy="134" rx="15" ry="5.5" fill="#fff" opacity=".9"/>
         <text x="142" y="137" fill="#eef4f9" font-size="10" font-weight="700"
               font-family="system-ui">${esc(T('tut.lbl.b2'))}</text>` })
             + `<div class="ball-dot hop"></div>`,
      body: T('tut.bounce.body'),
    },
    {
      title: T('tut.kitchen.title'),
      stage: court({ kitchen: true, extra:
        `<text x="150" y="98" fill="#ffe0d6" font-size="11" font-weight="800"
               text-anchor="middle" font-family="system-ui" letter-spacing="1">${esc(T('tut.lbl.kitchen'))}</text>` }),
      body: T('tut.kitchen.body'),
    },
    {
      title: T('tut.score.title'),
      stage: `<svg viewBox="0 0 300 168" preserveAspectRatio="xMidYMid meet">
        `+`<rect x="66" y="46" width="168" height="74" rx="8" fill="#0c1622" stroke="#1e3346"/>
         <rect x="66" y="46" width="4" height="74" fill="#d9ff3d"/>
         <text x="82" y="72" fill="#d9ff3d" font-size="13" font-weight="800" font-family="system-ui">${esc(T('name.you'))}</text>
         <text x="82" y="104" fill="#eef4f9" font-size="13" font-weight="800" font-family="system-ui">REIS</text>
         <circle cx="172" cy="67" r="7" fill="#d9ff3d" stroke="rgba(0,0,0,.35)"/>
         <circle cx="190" cy="67" r="7" fill="#d9ff3d" stroke="rgba(0,0,0,.35)"/>
         <rect x="200" y="54" width="30" height="26" fill="#1b3552"/>
         <rect x="200" y="86" width="30" height="26" fill="#b4303f"/>
         <text x="215" y="72" fill="#fff" font-size="15" font-weight="800"
               text-anchor="middle" font-family="system-ui">0</text>
         <text x="215" y="104" fill="#fff" font-size="15" font-weight="800"
               text-anchor="middle" font-family="system-ui">0</text>
         <text x="150" y="140" fill="#7f9ab1" font-size="9.5" font-weight="700"
               text-anchor="middle" font-family="system-ui" letter-spacing="1">${esc(T('hud.call'))}  0 - 0 - 2</text>
      </svg>`,
      body: T('tut.score.body'),
    },
    ];
  }

  // Rebuilt on every call, so switching language repaints the whole tutorial.
  return { steps: build, get STEPS() { return build(); } };
})();

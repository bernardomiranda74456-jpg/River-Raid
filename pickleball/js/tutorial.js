'use strict';
// Ten-step tutorial. Every step draws its own little stage so the gesture is
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
  // The court as the game draws it: a darker apron around a blue court, red
  // kitchens either side of the net, white lines, and a net with posts and
  // mesh. Seen from the game's own angle, near half wide at the bottom, far
  // half narrow at the top. Later steps draw on top of it, so its corners are
  // fixed: far baseline y=34 (x 118..182), near baseline y=150 (x 32..268),
  // net y=82, kitchen lines y=55 and y=110.
  function court(opts) {
    const o = opts || {};
    const kit = o.kitchen ? '#d5553a' : '#b8442f';
    const kitGlow = o.kitchen
      ? `<polygon points="129,55 171,55 186,82 114,82" fill="none" stroke="#ffb09c" stroke-width="1.6" opacity=".8"/>
         <polygon points="110,82 190,82 206,110 94,110" fill="none" stroke="#ffb09c" stroke-width="1.6" opacity=".8"/>`
      : '';
    return `
      <svg viewBox="0 0 300 168" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="mesh" width="3" height="3" patternUnits="userSpaceOnUse">
            <path d="M0,0 L3,3 M3,0 L0,3" stroke="#6f8597" stroke-width=".5" opacity=".7"/>
          </pattern>
          <linearGradient id="apron" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1f4f78"/><stop offset="1" stop-color="#2a6c9c"/>
          </linearGradient>
        </defs>
        <!-- apron and court -->
        <polygon points="96,20 204,20 300,168 0,168" fill="url(#apron)"/>
        <polygon points="118,34 182,34 268,150 32,150" fill="#3a8fd0"/>
        <!-- kitchens, the red bands either side of the net -->
        <polygon points="129,55 171,55 186,82 114,82" fill="${kit}"/>
        <polygon points="110,82 190,82 206,110 94,110" fill="${kit}"/>
        ${kitGlow}
        <!-- lines -->
        <polygon points="118,34 182,34 268,150 32,150" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
        <line x1="129" y1="55" x2="171" y2="55" stroke="#fff" stroke-width="1.9"/>
        <line x1="94" y1="110" x2="206" y2="110" stroke="#fff" stroke-width="2.1"/>
        <line x1="150" y1="34" x2="150" y2="55" stroke="#fff" stroke-width="1.5" opacity=".9"/>
        <line x1="150" y1="110" x2="150" y2="150" stroke="#fff" stroke-width="1.7" opacity=".9"/>
        <!-- net: posts just outside the sidelines, dark mesh, white tape -->
        <line x1="107" y1="68" x2="107" y2="86" stroke="#d6dee8" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="193" y1="68" x2="193" y2="86" stroke="#d6dee8" stroke-width="2.4" stroke-linecap="round"/>
        <rect x="107" y="70" width="86" height="13" fill="#141d27" opacity=".92"/>
        <rect x="107" y="70" width="86" height="13" fill="url(#mesh)"/>
        <line x1="107" y1="70" x2="193" y2="70" stroke="#f2f6fa" stroke-width="2.2"/>
        <path d="M107,86 L193,86 L196,88 L104,88 z" fill="#000" opacity=".25"/>
        ${o.extra || ''}
      </svg>`;
  }

  // A small figure in the yellow kit, the one the player controls. Drawn as
  // HTML so it can be animated with the finger that moves it.
  const PLAYER = `<div class="tut-player walk"><svg viewBox="0 0 26 40">
      <ellipse cx="13" cy="38" rx="9" ry="2" fill="#000" opacity=".3"/>
      <rect x="7.5" y="28" width="4" height="9" rx="1.6" fill="#b07a4e"/>
      <rect x="14.5" y="28" width="4" height="9" rx="1.6" fill="#b07a4e"/>
      <rect x="6.6" y="35" width="5.6" height="3.2" rx="1.4" fill="#f4f4f4"/>
      <rect x="13.8" y="35" width="5.6" height="3.2" rx="1.4" fill="#f4f4f4"/>
      <rect x="6.5" y="22" width="13" height="8" rx="2" fill="#27405a"/>
      <rect x="5" y="11" width="16" height="13" rx="4" fill="#f3c623"/>
      <rect x="2.2" y="12.5" width="3.6" height="9" rx="1.8" fill="#b07a4e"/>
      <rect x="20.2" y="12.5" width="3.6" height="9" rx="1.8" fill="#b07a4e"/>
      <circle cx="13" cy="7" r="5.6" fill="#c58c5b"/>
      <path d="M7.4,6.6 A5.6,5.6 0 0 1 18.6,6.6 L18.6,5.4 A5.6,5.6 0 0 0 7.4,5.4 z" fill="#3a2a22"/>
    </svg></div>`;

  const ARROW = `<defs><marker id="ah" markerWidth="7" markerHeight="7" refX="5.4" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 z" fill="#d9ff3d"/></marker></defs>`;

  function build() {
    return [
    {
      title: T('tut.move.title'),
      // the strike zone sits faint on the left; the player on the near court
      // slides where the right thumb drags, with the four ways marked
      stage: court({ extra:
        `<defs><marker id="ahm" markerWidth="8" markerHeight="8" refX="5.5" refY="4" orient="auto"
                 markerUnits="userSpaceOnUse"><path d="M0,0 L7,4 L0,8 z" fill="#9fe4ff"/></marker></defs>
         <rect x="8" y="62" width="62" height="98" rx="8" fill="#08101a" fill-opacity=".16"/>
         <g stroke="#9fe4ff" stroke-width="2.2" stroke-linecap="round" opacity=".75" marker-end="url(#ahm)">
           <line x1="150" y1="88" x2="150" y2="74"/>
           <line x1="150" y1="140" x2="150" y2="156"/>
           <line x1="134" y1="130" x2="106" y2="130"/>
           <line x1="166" y1="130" x2="194" y2="130"/>
         </g>
         <text x="292" y="162" fill="#cfe0ee" font-size="9" font-weight="800" letter-spacing="1"
               text-anchor="end" font-family="system-ui" opacity=".8">${esc(T('tut.lbl.move'))}</text>` })
             + PLAYER + `<div class="hand walk"></div>`,
      body: T('tut.move.body'),
    },
    {
      title: T('tut.thumbs.title'),
      stage: court({ extra:
        `<rect x="8" y="62" width="62" height="98" rx="8" fill="#08101a" fill-opacity=".22"/>
         <text x="15" y="78" fill="#9fe4ff" font-size="9" font-weight="800" letter-spacing="1.5"
               text-anchor="start" font-family="system-ui">${esc(T('tut.lbl.strike'))}</text>
         <g transform="translate(22 94) rotate(-30)" fill="#9fe4ff" fill-opacity=".4">
           <ellipse cx="0" cy="-5" rx="4.5" ry="6"/><rect x="-1.2" y="1" width="2.4" height="8"/></g>
         <line x1="30" y1="150" x2="48" y2="96" stroke="#d9ff3d" stroke-width="4" stroke-linecap="round"
               opacity=".9"/>
         <circle cx="48" cy="96" r="5" fill="#ff8800"/>` }),
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
      title: T('tut.slice.title'),
      // arrowheads sized in drawing units, so a thick line does not inflate them
      stage: court({ kitchen: true, extra:
        `<defs><marker id="ahs" markerWidth="9" markerHeight="9" refX="6" refY="4.5" orient="auto"
                 markerUnits="userSpaceOnUse"><path d="M0,0 L8,4.5 L0,9 z" fill="#9ef01a"/></marker></defs>
         <path d="M150,142 Q141,94 137,66" fill="none" stroke="#9ef01a" stroke-width="2.2"
               stroke-dasharray="6 5" marker-end="url(#ahs)"/>
         <path d="M150,142 Q159,94 163,66" fill="none" stroke="#9ef01a" stroke-width="2.2"
               stroke-dasharray="6 5" marker-end="url(#ahs)"/>
         <line x1="38" y1="72" x2="20" y2="108" stroke="#9ef01a" stroke-width="3" stroke-linecap="round" marker-end="url(#ahs)"/>
         <line x1="42" y1="72" x2="60" y2="108" stroke="#9ef01a" stroke-width="3" stroke-linecap="round" marker-end="url(#ahs)"/>
         <text x="40" y="62" fill="#9ef01a" font-size="10" font-weight="800"
               text-anchor="middle" font-family="system-ui">${esc(T('tut.lbl.slice'))}</text>` })
             + `<div class="hand slice"></div>`,
      body: T('tut.slice.body'),
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
      </svg>`,
      body: T('tut.score.body'),
    },
    ];
  }

  // Rebuilt on every call, so switching language repaints the whole tutorial.
  return { steps: build, get STEPS() { return build(); } };
})();

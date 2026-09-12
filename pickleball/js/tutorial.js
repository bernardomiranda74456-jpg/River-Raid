'use strict';
// Eight-step tutorial. Every step draws its own little stage so the gesture is
// shown rather than described, and the way back to the menu never moves.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Tutorial = (function () {
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

  const STEPS = [
    {
      title: 'Mover',
      stage: court({ extra: `<ellipse cx="150" cy="132" rx="17" ry="6" fill="#0b1a26" opacity=".45"/>` })
             + `<div class="hand drag"></div>`,
      body: `<p>Arraste o dedo em <b>qualquer lugar da sua metade da tela</b>. O jogador
             acompanha o dedo, então você não precisa tocar nele.</p>
             <p>Não existe botão de correr. Quanto mais longe você leva o dedo, mais longe
             o jogador vai.</p>`,
    },
    {
      title: 'Golpear',
      stage: court({ extra: ARROW +
        `<line x1="150" y1="140" x2="150" y2="70" stroke="#d9ff3d" stroke-width="3"
               stroke-dasharray="7 6" marker-end="url(#ah)" opacity=".9"/>` })
             + `<div class="hand flick"></div>`,
      body: `<p>Na hora da bola, dê um <b>deslize para cima</b>. É o mesmo dedo, só que
             num movimento curto e decidido.</p>
             <p>A <b>direção</b> do deslize é para onde a bola vai. Deslizar na diagonal
             manda a bola na diagonal.</p>`,
    },
    {
      title: 'Os quatro golpes',
      stage: court({ extra:
        `<defs>
           <marker id="a1" markerWidth="7" markerHeight="7" refX="5.4" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#d9ff3d"/></marker>
           <marker id="a2" markerWidth="7" markerHeight="7" refX="5.4" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#9fe4ff"/></marker>
           <marker id="a3" markerWidth="7" markerHeight="7" refX="5.4" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#ffd166"/></marker>
           <marker id="a4" markerWidth="7" markerHeight="7" refX="5.4" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#ff9db1"/></marker>
         </defs>
         <line x1="150" y1="142" x2="126" y2="42" stroke="#d9ff3d" stroke-width="2.6" marker-end="url(#a1)"/>
         <line x1="150" y1="142" x2="196" y2="90" stroke="#9fe4ff" stroke-width="2.6" marker-end="url(#a2)"/>
         <path d="M150,142 Q206,26 178,50" fill="none" stroke="#ffd166" stroke-width="2.6"
               stroke-dasharray="6 5" marker-end="url(#a3)"/>
         <line x1="150" y1="142" x2="124" y2="74" stroke="#ff9db1" stroke-width="2.6" marker-end="url(#a4)"/>` }),
      body: `<p>A <b>velocidade</b> e o <b>tamanho</b> do deslize escolhem o golpe sozinhos.
             Durante a partida o <b>rastro da bola sai nesta mesma cor</b>, então dá para
             ver qual golpe está vindo.</p>
             <div class="tut-grid">
               <div><b><i style="background:#d9ff3d"></i>Rápido e longo</b>Drive no fundo</div>
               <div><b><i style="background:#9fe4ff"></i>Rápido e curto</b>Voleio firme</div>
               <div><b><i style="background:#ffd166"></i>Lento e longo</b>Lob por cima</div>
               <div><b><i style="background:#ff9db1"></i>Lento e curto</b>Dink na cozinha</div>
             </div>`,
    },
    {
      title: 'Sacar',
      stage: court({ extra: ARROW +
        `<line x1="112" y1="142" x2="178" y2="62" stroke="#d9ff3d" stroke-width="3"
               stroke-dasharray="7 6" marker-end="url(#ah)" opacity=".9"/>` })
             + `<div class="hand tap"></div>`,
      body: `<p>No saque, <b>um toque simples já serve</b>. Um deslize para cima também saca,
             e aí não precisa ser rápido.</p>
             <p>O saque é por baixo e sai na <b>diagonal</b>. Ele tem que passar da cozinha,
             senão é falta.</p>`,
    },
    {
      title: 'Regra dos dois quiques',
      stage: court({ extra:
        `<ellipse cx="132" cy="64" rx="12" ry="4.5" fill="#fff" opacity=".9"/>
         <text x="152" y="67" fill="#eef4f9" font-size="10" font-weight="700"
               font-family="system-ui">1º quique</text>
         <ellipse cx="118" cy="134" rx="15" ry="5.5" fill="#fff" opacity=".9"/>
         <text x="142" y="137" fill="#eef4f9" font-size="10" font-weight="700"
               font-family="system-ui">2º quique</text>` })
             + `<div class="ball-dot hop"></div>`,
      body: `<p>O <b>saque precisa quicar</b> antes de ser devolvido. A <b>devolução também</b>.</p>
             <p>Só a partir do terceiro golpe alguém pode bater na bola sem deixar quicar.
             Antes disso, voleio é falta.</p>`,
    },
    {
      title: 'A cozinha',
      stage: court({ kitchen: true, extra:
        `<text x="150" y="98" fill="#ffe0d6" font-size="11" font-weight="800"
               text-anchor="middle" font-family="system-ui" letter-spacing="1">COZINHA</text>` }),
      body: `<p>A faixa vermelha junto à rede tem <b>2,13 m</b> e é a zona de não-voleio.</p>
             <p>Dentro dela você <b>não pode bater na bola antes do quique</b>. Depois do
             quique, pode. E se você voleia perto da linha, o impulso não pode te levar
             para dentro.</p>`,
    },
    {
      title: 'Placar e saque',
      stage: `<svg viewBox="0 0 300 168" preserveAspectRatio="xMidYMid meet">
        `+`<rect x="66" y="46" width="168" height="74" rx="8" fill="#0c1622" stroke="#1e3346"/>
         <rect x="66" y="46" width="4" height="74" fill="#d9ff3d"/>
         <text x="82" y="72" fill="#d9ff3d" font-size="13" font-weight="800" font-family="system-ui">VOCÊ</text>
         <text x="82" y="104" fill="#eef4f9" font-size="13" font-weight="800" font-family="system-ui">REIS</text>
         <circle cx="186" cy="67" r="11" fill="#d9ff3d"/>
         <text x="186" y="72" fill="#12202c" font-size="14" font-weight="800"
               text-anchor="middle" font-family="system-ui">2</text>
         <rect x="200" y="54" width="30" height="26" fill="#1b3552"/>
         <rect x="200" y="86" width="30" height="26" fill="#b4303f"/>
         <text x="215" y="72" fill="#fff" font-size="15" font-weight="800"
               text-anchor="middle" font-family="system-ui">0</text>
         <text x="215" y="104" fill="#fff" font-size="15" font-weight="800"
               text-anchor="middle" font-family="system-ui">0</text>
         <text x="150" y="140" fill="#7f9ab1" font-size="9.5" font-weight="700"
               text-anchor="middle" font-family="system-ui" letter-spacing="1">CHAMADA  0 - 0 - 2</text>
      </svg>`,
      body: `<p><b>Só quem saca pontua.</b> Perdeu o ponto sacando, o saque passa, mas o
             placar não muda.</p>
             <p>O disco amarelo diz se é o <b>primeiro ou o segundo sacador</b> da dupla, e o
             nome aceso é quem está com a bola. Nas duplas os dois parceiros sacam antes de
             o saque passar, e por isso o jogo começa em <b>0-0-2</b>.</p>`,
    },
    {
      title: 'Dois no mesmo aparelho',
      stage: court({ extra:
        `<line x1="150" y1="10" x2="150" y2="158" stroke="#d9ff3d" stroke-width="2"
               stroke-dasharray="6 6" opacity=".8"/>
         <text x="96" y="24" fill="#d9ff3d" font-size="12" font-weight="800"
               text-anchor="middle" font-family="system-ui">P1</text>
         <text x="204" y="24" fill="#d9ff3d" font-size="12" font-weight="800"
               text-anchor="middle" font-family="system-ui">P2</text>` }),
      body: `<p>Em <b>um contra o outro</b>, a tela divide em duas e cada um joga com a sua
             própria visão da quadra.</p>
             <p>Em <b>jogar juntos</b>, vocês dividem a mesma tela: quem toca a metade
             esquerda controla o jogador da esquerda.</p>`,
    },
  ];

  return { STEPS };
})();

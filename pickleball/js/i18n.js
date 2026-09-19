'use strict';
// Three languages, one flat table. Every string the player can read lives here:
// the menus, the scoreboard, the calls the umpire makes and the tutorial. Keys
// are asked for by name, so a missing translation falls back to English and
// never to a blank screen.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.I18n = (function () {
  const LANGS = ['pt', 'en', 'es'];

  const PT = {
    // a language is always named in its own tongue, whatever is selected
    'lang.name.pt': 'Português',
    'lang.name.en': 'English',
    'lang.name.es': 'Español',
    'ui.tag': 'Simples ou duplas contra a CPU. Regras oficiais, cozinha e tudo.',
    'ui.tutorial': 'TUTORIAL',
    'ui.play': 'JOGAR',
    'ui.sound': 'Som',
    'ui.tip': 'Dica: vire o celular na horizontal para uma visão mais ampla',
    'ui.language': 'Idioma',
    'ui.pauseBtn': 'Pausar',

    'ui.setup': 'Configurar partida',
    'ui.format': 'Formato',
    'ui.format.singles': 'Simples',
    'ui.format.singles.sub': '1 contra 1',
    'ui.format.doubles': 'Duplas',
    'ui.format.doubles.sub': '2 contra 2',
    'ui.chars': 'Desenho dos jogadores',
    'ui.chars.boneco': 'Boneco',
    'ui.chars.boneco.sub': 'estilo Wii, com rosto',
    'ui.chars.atletico': 'Atlético',
    'ui.chars.atletico.sub': 'proporção real',
    'ui.chars.vetor': 'Vetor',
    'ui.chars.vetor.sub': 'contorno, cor chapada',
    'ui.chars.arcade': 'Arcade',
    'ui.chars.arcade.sub': 'cabeçudo, traço grosso',
    'ui.diff': 'Dificuldade',
    'ui.diff.facil': 'Fácil',
    'ui.diff.facil.sub': 'golpe automático',
    'ui.diff.normal': 'Normal',
    'ui.diff.normal.sub': 'faltas assistidas',
    'ui.diff.dificil': 'Difícil',
    'ui.diff.dificil.sub': 'regras sem perdão',
    'ui.upto': 'Partida até',
    'ui.points': '{n} pontos',
    'ui.start': 'COMEÇAR',
    'ui.back': 'Voltar',

    'ui.tut.step': 'PASSO {a} DE {b}',
    'ui.tut.home': 'Menu principal',
    'ui.tut.prev': 'Voltar',
    'ui.tut.next': 'Próximo',
    'ui.tut.playnow': 'Jogar agora',

    'ui.pause': 'Pausa',
    'ui.resume': 'Continuar',
    'ui.restart': 'Reiniciar partida',
    'ui.quit': 'Sair para o menu',

    'ui.over': 'Fim de jogo',
    'ui.over.win': 'Você venceu!',
    'ui.over.lose': 'Você perdeu',
    'ui.over.sub': '{format} • até {n} pontos • {diff}',
    'ui.rematch': 'Revanche',
    'ui.menu': 'Menu',

    'name.you': 'VOCÊ',
    'hud.singles': 'SIMPLES',
    'hud.doubles': 'DUPLAS',
    'hud.title': '{format}: ATÉ {n} PONTOS',
    'hud.call': 'CHAMADA',
    'prompt.serve': 'DESLIZE PARA SACAR',
    'prompt.serve.sub': 'comprimento = força  •  lado = direção',
    'prompt.letbounce': 'DEIXE O SAQUE QUICAR',
    'banner.sideout': 'Troca de saque',
    'banner.point': 'Ponto {team}',
    'team.1': 'Time 1',
    'team.2': 'Time 2',

    'reason.fora': 'Bola fora',
    'reason.na_rede': 'Na rede',
    'reason.nao_passou': 'Não passou da rede',
    'reason.dois_golpes': 'Dois golpes da mesma dupla',
    'reason.saque_fora': 'Saque fora',
    'reason.saque_cozinha': 'Saque na cozinha',
    'reason.dois_quiques': 'Dois quiques',
    'reason.cozinha': 'Voleio na cozinha',
    'reason.voleio_saque': 'Voleio antes do quique',
    'reason.recebedor': 'Recebedor errado',
    'reason.impulso': 'Impulso na cozinha',
    'reason.pe_no_saque': 'Pé na linha no saque',
    'reason.ponto': 'Ponto',

    'hint.kitchen': 'Saia da cozinha para dar voleio!',
    'hint.receiver': 'O saque é do seu parceiro!',
    'hint.letbounce': 'Deixe quicar (regra dos dois quiques)!',
    'hint.momentum': 'Impulso: não entre na cozinha após o voleio!',
    'hint.servehalf': 'Saque sai da sua metade da quadra',
    'hint.servebehind': 'Fique atrás da linha de fundo para sacar',
    'hint.partnerhit': 'Seu parceiro já bateu: a bola tem que cruzar a rede!',

    'tut.thumbs.title': 'Dois dedos',
    'tut.thumbs.body': '<p>A tela se divide em duas. O <b>dedo direito corre</b> e o <b>dedo esquerdo golpeia</b>.</p><p>Nada é lido como as duas coisas, então o golpe nunca empurra o jogador e correr nunca dispara um golpe.</p>',
    'tut.lbl.left': 'ESQUERDO',
    'tut.lbl.strike': 'golpe',
    'tut.lbl.right': 'DIREITO',
    'tut.lbl.move': 'mover',

    'tut.power.title': 'A força é o tamanho do deslize',
    'tut.power.body': '<p>O <b>traçado do seu dedo aparece na tela</b> e muda de cor conforme cresce. A cor é a força que a bola vai levar.</p><p>Laranja é uma bola bem funda. Rosa pinta a linha de fundo. <b>No vermelho você passou do ponto</b> e a bola sai.</p>',
    'tut.lbl.red': 'vermelho: sai',
    'tut.lbl.pink': 'rosa: na linha',
    'tut.lbl.orange': 'laranja: bem funda',
    'tut.lbl.green': 'verde: bola curta',
    'tut.lbl.pull1': 'quanto mais',
    'tut.lbl.pull2': 'você puxa,',
    'tut.lbl.pull3': 'mais forte',

    'tut.aim.title': 'A direção é a inclinação do deslize',
    'tut.aim.body': '<p>Deslize <b>reto para cima</b> e a bola vai reta para a frente. Incline o deslize e ela vira: <b>quanto mais deitado, mais fechado o ângulo</b>, até quase na horizontal, que manda a bola no canto.</p><p>A direção sozinha nunca põe a bola fora pela lateral. É o mesmo deslize: o comprimento dá a força e a inclinação dá o lado.</p>',

    'tut.lob.title': 'Lob é um arco',
    'tut.lob.body': '<p>Um deslize <b>em arco acentuado</b> vira lob. Arco para a esquerda é lob para a esquerda, arco para a direita é lob para a direita.</p><p>O tamanho do arco também conta: arco maior joga o lob mais para o fundo.</p>',

    'tut.smash.title': 'Smash se conquista',
    'tut.smash.body': '<p>Não existe botão de smash. Ele se conquista de dois jeitos, e os dois são sobre <b>altura</b>.</p><p>Um: o adversário <b>tenta um lob e você pega a bola no alto</b>, antes dela quicar. Dois: você está <b>na rede e a bola sobe acima dela</b>, e aí dá para bater para baixo.</p><p>Com a bola na altura da rede ou abaixo não sai smash, por mais que você puxe: para passar a rede ela teria que subir. A força e a direção do seu deslize valem igual, e no vermelho ela sai igual.</p>',
    'tut.lbl.high': 'pegou no alto',

    'tut.bounce.title': 'Regra dos dois quiques',
    'tut.bounce.body': '<p>O <b>saque precisa quicar</b> antes de ser devolvido. A <b>devolução também</b>.</p><p>Só a partir do terceiro golpe alguém pode bater na bola sem deixar quicar. Antes disso, voleio é falta.</p>',
    'tut.lbl.b1': '1º quique',
    'tut.lbl.b2': '2º quique',

    'tut.kitchen.title': 'A cozinha',
    'tut.kitchen.body': '<p>A faixa vermelha junto à rede tem <b>2,13 m</b> e é a zona de não-voleio.</p><p>Dentro dela você <b>não pode bater na bola antes do quique</b>. Depois do quique, pode. E se você voleia perto da linha, o impulso não pode te levar para dentro.</p>',
    'tut.lbl.kitchen': 'COZINHA',

    'tut.score.title': 'Placar e saque',
    'tut.score.body': '<p>O saque usa o mesmo deslize do dedo esquerdo, com força e direção. Um toque simples também saca, fraco e no meio.</p><p><b>Só quem saca pontua.</b> Perdeu o ponto sacando, o saque passa, mas o placar não muda.</p><p>As bolinhas dizem quem saca: <b>uma bola é o primeiro sacador</b> da dupla, <b>duas bolas é o segundo</b>. O nome aceso é quem está com a bola. Os dois parceiros sacam antes de o saque passar, e por isso o jogo começa em <b>0-0-2</b>.</p>',
  };

  const EN = {
    // a language is always named in its own tongue, whatever is selected
    'lang.name.pt': 'Português',
    'lang.name.en': 'English',
    'lang.name.es': 'Español',
    'ui.tag': 'Singles or doubles against the CPU. Official rules, kitchen and all.',
    'ui.tutorial': 'TUTORIAL',
    'ui.play': 'PLAY',
    'ui.sound': 'Sound',
    'ui.tip': 'Tip: turn the phone sideways for a wider view',
    'ui.language': 'Language',
    'ui.pauseBtn': 'Pause',

    'ui.setup': 'Match setup',
    'ui.format': 'Format',
    'ui.format.singles': 'Singles',
    'ui.format.singles.sub': '1 against 1',
    'ui.format.doubles': 'Doubles',
    'ui.format.doubles.sub': '2 against 2',
    'ui.chars': 'Player look',
    'ui.chars.boneco': 'Figure',
    'ui.chars.boneco.sub': 'Wii style, with a face',
    'ui.chars.atletico': 'Athletic',
    'ui.chars.atletico.sub': 'real proportions',
    'ui.chars.vetor': 'Vector',
    'ui.chars.vetor.sub': 'outline, flat colour',
    'ui.chars.arcade': 'Arcade',
    'ui.chars.arcade.sub': 'big head, thick line',
    'ui.diff': 'Difficulty',
    'ui.diff.facil': 'Easy',
    'ui.diff.facil.sub': 'automatic swing',
    'ui.diff.normal': 'Normal',
    'ui.diff.normal.sub': 'faults forgiven',
    'ui.diff.dificil': 'Hard',
    'ui.diff.dificil.sub': 'rules with no mercy',
    'ui.upto': 'Game to',
    'ui.points': '{n} points',
    'ui.start': 'START',
    'ui.back': 'Back',

    'ui.tut.step': 'STEP {a} OF {b}',
    'ui.tut.home': 'Main menu',
    'ui.tut.prev': 'Back',
    'ui.tut.next': 'Next',
    'ui.tut.playnow': 'Play now',

    'ui.pause': 'Paused',
    'ui.resume': 'Resume',
    'ui.restart': 'Restart match',
    'ui.quit': 'Quit to menu',

    'ui.over': 'Game over',
    'ui.over.win': 'You won!',
    'ui.over.lose': 'You lost',
    'ui.over.sub': '{format} • to {n} points • {diff}',
    'ui.rematch': 'Rematch',
    'ui.menu': 'Menu',

    'name.you': 'YOU',
    'hud.singles': 'SINGLES',
    'hud.doubles': 'DOUBLES',
    'hud.title': '{format}: TO {n} POINTS',
    'hud.call': 'CALL',
    'prompt.serve': 'SWIPE TO SERVE',
    'prompt.serve.sub': 'length = power  •  tilt = direction',
    'prompt.letbounce': 'LET THE SERVE BOUNCE',
    'banner.sideout': 'Side out',
    'banner.point': 'Point {team}',
    'team.1': 'Team 1',
    'team.2': 'Team 2',

    'reason.fora': 'Ball out',
    'reason.na_rede': 'Into the net',
    'reason.nao_passou': 'Did not clear the net',
    'reason.dois_golpes': 'Two hits by the same team',
    'reason.saque_fora': 'Serve out',
    'reason.saque_cozinha': 'Serve in the kitchen',
    'reason.dois_quiques': 'Two bounces',
    'reason.cozinha': 'Volley in the kitchen',
    'reason.voleio_saque': 'Volley before the bounce',
    'reason.recebedor': 'Wrong receiver',
    'reason.impulso': 'Momentum into the kitchen',
    'reason.pe_no_saque': 'Foot fault on the serve',
    'reason.ponto': 'Point',

    'hint.kitchen': 'Step out of the kitchen to volley!',
    'hint.receiver': 'This serve is your partner’s!',
    'hint.letbounce': 'Let it bounce (two-bounce rule)!',
    'hint.momentum': 'Momentum: do not step into the kitchen after a volley!',
    'hint.servehalf': 'Serve from your own half of the court',
    'hint.servebehind': 'Stay behind the baseline to serve',
    'hint.partnerhit': 'Your partner already hit it: the ball must cross the net!',

    'tut.thumbs.title': 'Two thumbs',
    'tut.thumbs.body': '<p>The screen splits in two. The <b>right thumb runs</b> and the <b>left thumb strikes</b>.</p><p>Nothing is read as both, so a stroke never shoves the player and running never fires a shot.</p>',
    'tut.lbl.left': 'LEFT',
    'tut.lbl.strike': 'strike',
    'tut.lbl.right': 'RIGHT',
    'tut.lbl.move': 'move',

    'tut.power.title': 'Power is how far you swipe',
    'tut.power.body': '<p>The <b>path of your thumb shows on screen</b> and changes colour as it grows. The colour is the power the ball will carry.</p><p>Orange is a deep ball. Pink paints the baseline. <b>On red you have overdone it</b> and the ball goes out.</p>',
    'tut.lbl.red': 'red: out',
    'tut.lbl.pink': 'pink: on the line',
    'tut.lbl.orange': 'orange: deep',
    'tut.lbl.green': 'green: short ball',
    'tut.lbl.pull1': 'the further',
    'tut.lbl.pull2': 'you pull,',
    'tut.lbl.pull3': 'the harder',

    'tut.aim.title': 'Direction is the tilt of the swipe',
    'tut.aim.body': '<p>Swipe <b>straight up</b> and the ball goes straight ahead. Tilt the swipe and it turns: <b>the flatter the swipe, the sharper the angle</b>, until almost horizontal, which sends the ball into the corner.</p><p>Direction alone never sends the ball wide. It is one swipe: its length gives the power, its tilt gives the side.</p>',

    'tut.lob.title': 'A lob is an arc',
    'tut.lob.body': '<p>A swipe with a <b>pronounced arc</b> becomes a lob. Arc to the left is a lob to the left, arc to the right is a lob to the right.</p><p>The size of the arc counts too: a bigger arc throws the lob deeper.</p>',

    'tut.smash.title': 'A smash is earned',
    'tut.smash.body': '<p>There is no smash button. It is earned in two ways, and both are about <b>height</b>.</p><p>One: your opponent <b>tries a lob and you take the ball high</b>, before it bounces. Two: you are <b>at the net and the ball sits above it</b>, so you can hit down on it.</p><p>With the ball level with the net or below it there is no smash, however hard you pull: to clear the net it would have to go up. Power and direction of your swipe count the same, and on red it still goes out.</p>',
    'tut.lbl.high': 'taken high',

    'tut.bounce.title': 'The two-bounce rule',
    'tut.bounce.body': '<p>The <b>serve must bounce</b> before it is returned. So must the <b>return</b>.</p><p>Only from the third shot on may anyone hit the ball out of the air. Before that, a volley is a fault.</p>',
    'tut.lbl.b1': '1st bounce',
    'tut.lbl.b2': '2nd bounce',

    'tut.kitchen.title': 'The kitchen',
    'tut.kitchen.body': '<p>The red band beside the net is <b>7 ft</b> deep and it is the non-volley zone.</p><p>Inside it you <b>cannot hit the ball before it bounces</b>. After the bounce, you can. And if you volley near the line, your momentum may not carry you in.</p>',
    'tut.lbl.kitchen': 'KITCHEN',

    'tut.score.title': 'Score and serve',
    'tut.score.body': '<p>The serve uses the same left-thumb swipe, with power and direction. A plain tap serves too, softly and down the middle.</p><p><b>Only the serving side scores.</b> Lose the rally while serving and the serve passes on, but the score does not change.</p><p>The balls say who is serving: <b>one ball is the first server</b> of the pair, <b>two balls is the second</b>. The lit name is the one holding the ball. Both partners serve before the serve passes over, which is why the game starts at <b>0-0-2</b>.</p>',
  };

  const ES = {
    // a language is always named in its own tongue, whatever is selected
    'lang.name.pt': 'Português',
    'lang.name.en': 'English',
    'lang.name.es': 'Español',
    'ui.tag': 'Individual o dobles contra la CPU. Reglas oficiales, cocina y todo.',
    'ui.tutorial': 'TUTORIAL',
    'ui.play': 'JUGAR',
    'ui.sound': 'Sonido',
    'ui.tip': 'Consejo: gira el móvil en horizontal para una vista más amplia',
    'ui.language': 'Idioma',
    'ui.pauseBtn': 'Pausar',

    'ui.setup': 'Configurar partida',
    'ui.format': 'Formato',
    'ui.format.singles': 'Individual',
    'ui.format.singles.sub': '1 contra 1',
    'ui.format.doubles': 'Dobles',
    'ui.format.doubles.sub': '2 contra 2',
    'ui.chars': 'Aspecto de los jugadores',
    'ui.chars.boneco': 'Muñeco',
    'ui.chars.boneco.sub': 'estilo Wii, con cara',
    'ui.chars.atletico': 'Atlético',
    'ui.chars.atletico.sub': 'proporción real',
    'ui.chars.vetor': 'Vector',
    'ui.chars.vetor.sub': 'contorno, color plano',
    'ui.chars.arcade': 'Arcade',
    'ui.chars.arcade.sub': 'cabezón, trazo grueso',
    'ui.diff': 'Dificultad',
    'ui.diff.facil': 'Fácil',
    'ui.diff.facil.sub': 'golpe automático',
    'ui.diff.normal': 'Normal',
    'ui.diff.normal.sub': 'faltas perdonadas',
    'ui.diff.dificil': 'Difícil',
    'ui.diff.dificil.sub': 'reglas sin perdón',
    'ui.upto': 'Partida a',
    'ui.points': '{n} puntos',
    'ui.start': 'EMPEZAR',
    'ui.back': 'Volver',

    'ui.tut.step': 'PASO {a} DE {b}',
    'ui.tut.home': 'Menú principal',
    'ui.tut.prev': 'Volver',
    'ui.tut.next': 'Siguiente',
    'ui.tut.playnow': 'Jugar ahora',

    'ui.pause': 'Pausa',
    'ui.resume': 'Continuar',
    'ui.restart': 'Reiniciar partida',
    'ui.quit': 'Salir al menú',

    'ui.over': 'Fin del juego',
    'ui.over.win': '¡Ganaste!',
    'ui.over.lose': 'Perdiste',
    'ui.over.sub': '{format} • a {n} puntos • {diff}',
    'ui.rematch': 'Revancha',
    'ui.menu': 'Menú',

    'name.you': 'TÚ',
    'hud.singles': 'INDIVIDUAL',
    'hud.doubles': 'DOBLES',
    'hud.title': '{format}: A {n} PUNTOS',
    'hud.call': 'CANTO',
    'prompt.serve': 'DESLIZA PARA SACAR',
    'prompt.serve.sub': 'largo = fuerza  •  inclinación = dirección',
    'prompt.letbounce': 'DEJA BOTAR EL SAQUE',
    'banner.sideout': 'Cambio de saque',
    'banner.point': 'Punto {team}',
    'team.1': 'Equipo 1',
    'team.2': 'Equipo 2',

    'reason.fora': 'Bola fuera',
    'reason.na_rede': 'A la red',
    'reason.nao_passou': 'No pasó la red',
    'reason.dois_golpes': 'Dos golpes de la misma pareja',
    'reason.saque_fora': 'Saque fuera',
    'reason.saque_cozinha': 'Saque en la cocina',
    'reason.dois_quiques': 'Dos botes',
    'reason.cozinha': 'Volea en la cocina',
    'reason.voleio_saque': 'Volea antes del bote',
    'reason.recebedor': 'Restador equivocado',
    'reason.impulso': 'Impulso hacia la cocina',
    'reason.pe_no_saque': 'Pie en la línea al sacar',
    'reason.ponto': 'Punto',

    'hint.kitchen': '¡Sal de la cocina para volear!',
    'hint.receiver': '¡Ese saque es de tu compañero!',
    'hint.letbounce': '¡Déjala botar (regla de los dos botes)!',
    'hint.momentum': 'Impulso: ¡no entres en la cocina tras la volea!',
    'hint.servehalf': 'Saca desde tu propia mitad de la pista',
    'hint.servebehind': 'Quédate detrás de la línea de fondo para sacar',
    'hint.partnerhit': 'Tu compañero ya golpeó: ¡la bola tiene que cruzar la red!',

    'tut.thumbs.title': 'Dos dedos',
    'tut.thumbs.body': '<p>La pantalla se divide en dos. El <b>dedo derecho corre</b> y el <b>dedo izquierdo golpea</b>.</p><p>Nada se lee como las dos cosas, así que el golpe nunca empuja al jugador y correr nunca lanza un golpe.</p>',
    'tut.lbl.left': 'IZQUIERDO',
    'tut.lbl.strike': 'golpe',
    'tut.lbl.right': 'DERECHO',
    'tut.lbl.move': 'mover',

    'tut.power.title': 'La fuerza es el largo del deslizamiento',
    'tut.power.body': '<p>El <b>trazo de tu dedo aparece en pantalla</b> y cambia de color según crece. El color es la fuerza que llevará la bola.</p><p>Naranja es una bola muy profunda. Rosa pinta la línea de fondo. <b>En rojo te pasaste</b> y la bola sale.</p>',
    'tut.lbl.red': 'rojo: sale',
    'tut.lbl.pink': 'rosa: en la línea',
    'tut.lbl.orange': 'naranja: profunda',
    'tut.lbl.green': 'verde: bola corta',
    'tut.lbl.pull1': 'cuanto más',
    'tut.lbl.pull2': 'estiras,',
    'tut.lbl.pull3': 'más fuerte',

    'tut.aim.title': 'La dirección es la inclinación',
    'tut.aim.body': '<p>Desliza <b>recto hacia arriba</b> y la bola va recta al frente. Inclina el deslizamiento y gira: <b>cuanto más tumbado, más cerrado el ángulo</b>, hasta casi horizontal, que manda la bola a la esquina.</p><p>La dirección por sí sola nunca saca la bola por el lateral. Es el mismo gesto: el largo da la fuerza y la inclinación da el lado.</p>',

    'tut.lob.title': 'El globo es un arco',
    'tut.lob.body': '<p>Un deslizamiento <b>en arco marcado</b> sale como globo. Arco a la izquierda es globo a la izquierda, arco a la derecha es globo a la derecha.</p><p>El tamaño del arco también cuenta: un arco mayor manda el globo más al fondo.</p>',

    'tut.smash.title': 'El remate se gana',
    'tut.smash.body': '<p>No hay botón de remate. Se gana de dos maneras, y las dos son cuestión de <b>altura</b>.</p><p>Una: el rival <b>intenta un globo y tú coges la bola arriba</b>, antes de que bote. Dos: estás <b>en la red y la bola queda por encima de ella</b>, y entonces puedes golpear hacia abajo.</p><p>Con la bola a la altura de la red o por debajo no sale remate, por mucho que estires: para pasar la red tendría que subir. La fuerza y la dirección de tu deslizamiento valen igual, y en rojo sale igual.</p>',
    'tut.lbl.high': 'cogida arriba',

    'tut.bounce.title': 'La regla de los dos botes',
    'tut.bounce.body': '<p>El <b>saque tiene que botar</b> antes de ser devuelto. El <b>resto también</b>.</p><p>Solo a partir del tercer golpe alguien puede darle a la bola sin dejarla botar. Antes de eso, volear es falta.</p>',
    'tut.lbl.b1': '1er bote',
    'tut.lbl.b2': '2º bote',

    'tut.kitchen.title': 'La cocina',
    'tut.kitchen.body': '<p>La franja roja junto a la red mide <b>2,13 m</b> y es la zona de no volea.</p><p>Dentro de ella <b>no puedes golpear la bola antes del bote</b>. Después del bote, sí. Y si voleas cerca de la línea, el impulso no puede meterte dentro.</p>',
    'tut.lbl.kitchen': 'COCINA',

    'tut.score.title': 'Marcador y saque',
    'tut.score.body': '<p>El saque usa el mismo deslizamiento del dedo izquierdo, con fuerza y dirección. Un toque simple también saca, flojo y al medio.</p><p><b>Solo puntúa quien saca.</b> Si pierdes el punto sacando, el saque pasa, pero el marcador no cambia.</p><p>Las bolitas dicen quién saca: <b>una bola es el primer sacador</b> de la pareja, <b>dos bolas es el segundo</b>. El nombre encendido es quien tiene la bola. Los dos compañeros sacan antes de que el saque pase, y por eso el juego empieza en <b>0-0-2</b>.</p>',
  };

  const DICT = { pt: PT, en: EN, es: ES };
  let lang = 'en';

  function t(key, vars) {
    const table = DICT[lang] || EN;
    let s = table[key];
    if (s === undefined) s = EN[key];
    if (s === undefined) return key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  // The phone's own language wins on a first visit; anything unknown gets
  // English, which is the fallback table anyway.
  function detect() {
    const list = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    for (const raw of list) {
      const code = String(raw || '').slice(0, 2).toLowerCase();
      if (LANGS.indexOf(code) >= 0) return code;
    }
    return 'en';
  }

  function setLang(l) {
    lang = DICT[l] ? l : 'en';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang === 'pt' ? 'pt-BR' : lang);
      apply();
    }
    return lang;
  }

  // Walks the page once per change: text, inner HTML and the labels a screen
  // reader announces.
  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    scope.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    scope.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
    // "11 points" and friends: the number lives in the markup, the word here
    scope.querySelectorAll('[data-i18n-points]').forEach(el => { el.textContent = t('ui.points', { n: el.getAttribute('data-i18n-points') }); });
  }

  return { t, setLang, apply, detect, LANGS, DICT, get lang() { return lang; } };
})();

'use strict';
// Who the players look like: the skin tones, hair colours and hair styles the
// menu offers, the default pick, and the fixed cast around the human. The
// renderer turns these names into paint; the match hands them to each player.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Looks = (function () {
  // skin, light to dark: fair, golden, brown, dark
  const SKIN = { claro: '#f3d3b4', dourado: '#e3b382', moreno: '#b3784b', escuro: '#6b4228' };
  const SKIN_ORDER = ['claro', 'dourado', 'moreno', 'escuro'];
  const HAIR = { loiro: '#d9b35a', castanho: '#6a4222', preto: '#1b130e' };
  const HAIR_ORDER = ['loiro', 'castanho', 'preto'];
  // short hair, or long hair tied in a ponytail
  const STYLE = ['curto', 'rabo'];
  // The shirt is the human's alone: the partner keeps the team's yellow and
  // the rivals always wear their pink, so the away team is never mistaken.
  // None of these is close to that pink.
  const SHIRT = { amarelo: '#ffd24a', azul: '#3b9cff', verde: '#3ddc84', branco: '#f2f5f8' };
  const SHIRT_ORDER = ['amarelo', 'azul', 'verde', 'branco'];
  // The lower garment, a skirt with long hair and shorts otherwise, in one of
  // these; navy is the team's own shorts colour.
  const BOTTOM = { marinho: '#1b2634', branco: '#f2f5f8', azul: '#2f6fd6', vermelho: '#c8323a' };
  const BOTTOM_ORDER = ['marinho', 'branco', 'azul', 'vermelho'];
  const DEFAULT = { skin: 'dourado', hair: 'castanho', style: 'curto' };
  const DEFAULT_SHIRT = 'amarelo';
  const DEFAULT_BOTTOM = 'marinho';

  // The cast: the partner is a woman with a dark skin tone; the rivals are a
  // light-skinned man and a dark-skinned woman.
  const CAST = {
    mate: { skin: 'escuro', hair: 'preto', style: 'rabo' },
    rivals: [
      { skin: 'claro', hair: 'loiro', style: 'curto' },
      { skin: 'escuro', hair: 'castanho', style: 'rabo' },
    ],
  };

  // A look read from storage, or from anywhere else, is trusted key by key:
  // whatever is not on offer falls back to the default. A shirt that is not
  // on offer is no shirt at all (null), which means the team's own kit.
  function normalize(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
      skin: SKIN[r.skin] ? r.skin : DEFAULT.skin,
      hair: HAIR[r.hair] ? r.hair : DEFAULT.hair,
      style: STYLE.indexOf(r.style) >= 0 ? r.style : DEFAULT.style,
      shirt: SHIRT[r.shirt] ? r.shirt : null,
      bottom: BOTTOM[r.bottom] ? r.bottom : null,
    };
  }

  return { SKIN, SKIN_ORDER, HAIR, HAIR_ORDER, STYLE, SHIRT, SHIRT_ORDER, BOTTOM, BOTTOM_ORDER,
           DEFAULT, DEFAULT_SHIRT, DEFAULT_BOTTOM, CAST, normalize };
})();

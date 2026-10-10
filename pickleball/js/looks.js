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
  const DEFAULT = { skin: 'dourado', hair: 'castanho', style: 'curto' };

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
  // whatever is not on offer falls back to the default.
  function normalize(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
      skin: SKIN[r.skin] ? r.skin : DEFAULT.skin,
      hair: HAIR[r.hair] ? r.hair : DEFAULT.hair,
      style: STYLE.indexOf(r.style) >= 0 ? r.style : DEFAULT.style,
    };
  }

  return { SKIN, SKIN_ORDER, HAIR, HAIR_ORDER, STYLE, DEFAULT, CAST, normalize };
})();

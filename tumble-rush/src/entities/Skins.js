/** Original character skins: colors, body pattern, accent and head accessory. */
export const PATTERNS = ['solid', 'stripes', 'dots', 'chevrons', 'checker', 'twotone', 'star', 'plaid'];
export const HATS = ['none', 'cap', 'crown', 'antenna', 'horns', 'propeller', 'tophat', 'headband'];

export const SKINS = [
  { name: 'Tangerina',  colA: '#ff6b35', colB: '#ffd23f', pattern: 1, accent: '#2b2d42', hat: 'cap',       eye: '#2d7bd6' },
  { name: 'Glacial',    colA: '#3fa7ff', colB: '#dff6ff', pattern: 2, accent: '#ffffff', hat: 'headband',  eye: '#1b4d8a' },
  { name: 'Limão',      colA: '#8fd14f', colB: '#2e7d32', pattern: 3, accent: '#ffeb3b', hat: 'antenna',   eye: '#5a3d1a' },
  { name: 'Realeza',    colA: '#7b2cbf', colB: '#ffd23f', pattern: 4, accent: '#ffd23f', hat: 'crown',     eye: '#3a1b6b' },
  { name: 'Diabrete',   colA: '#d7263d', colB: '#2b2d42', pattern: 5, accent: '#ffb703', hat: 'horns',     eye: '#1a1a1a' },
  { name: 'Hélice',     colA: '#ffbe0b', colB: '#fb5607', pattern: 6, accent: '#3a86ff', hat: 'propeller', eye: '#2d7bd6' },
  { name: 'Cavalheiro', colA: '#2b2d42', colB: '#8d99ae', pattern: 7, accent: '#edf2f4', hat: 'tophat',    eye: '#4a6fa5' },
  { name: 'Menta',      colA: '#06d6a0', colB: '#118ab2', pattern: 0, accent: '#ef476f', hat: 'none',      eye: '#073b4c' },
  { name: 'Carbono',    colA: '#1f2430', colB: '#ff6b35', pattern: 1, accent: '#ff6b35', hat: 'cap',       eye: '#ff6b35' },
  { name: 'Algodão',    colA: '#ffafcc', colB: '#bde0fe', pattern: 2, accent: '#ffffff', hat: 'antenna',   eye: '#7a4b8a' },
  { name: 'Abelha',     colA: '#ffd23f', colB: '#1a1a1a', pattern: 1, accent: '#1a1a1a', hat: 'antenna',   eye: '#1a1a1a' },
  { name: 'Lava',       colA: '#ff3b00', colB: '#ffb100', pattern: 3, accent: '#2b0a00', hat: 'horns',     eye: '#ffb100' },
];

/** Random skin for bots (deterministic with a seed function). */
export function randomSkin(rnd) {
  const base = SKINS[Math.floor(rnd() * SKINS.length)];
  const hue = () => `hsl(${Math.floor(rnd() * 360)}, ${60 + Math.floor(rnd() * 35)}%, ${45 + Math.floor(rnd() * 20)}%)`;
  return { ...base, name: base.name, colA: rnd() < 0.5 ? base.colA : hue(), colB: rnd() < 0.5 ? base.colB : hue(), pattern: Math.floor(rnd() * PATTERNS.length), hat: HATS[Math.floor(rnd() * HATS.length)] };
}

export const BOT_NAMES = ['Zig', 'Pipoca', 'Bolota', 'Trovão', 'Faísca', 'Cacau', 'Pudim', 'Noodle', 'Tico', 'Bagunça', 'Pimenta', 'Jujuba', 'Biscoito', 'Moca', 'Dado', 'Rabisco', 'Foguete', 'Mingau', 'Brisa', 'Tufão', 'Garoa', 'Xereta', 'Fubá', 'Caramelo', 'Tampinha', 'Pirueta', 'Sardinha', 'Marola', 'Cafuné', 'Tempero', 'Bolinha', 'Zumbido', 'Batata', 'Guri', 'Sereno'];

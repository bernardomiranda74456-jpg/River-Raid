// Utilitários de notação compartilhados pelas faixas (não é motor de áudio; só monta strings).
/** Máscara rítmica: 'x' = ataca a nota, '.' = sustenta, '=' = solta. O primeiro 'x' recebe :inst (se dado). */
export const rhy = (mask, note, inst) => {
  let first = true;
  return mask.replace(/\s+/g, '').split('').map((ch) => {
    if (ch === 'x') { const t = inst && first ? `${note}:${inst}` : note; first = false; return t; }
    return ch === '=' ? '==' : '.';
  }).join(' ');
};
/** Máscara com lista de notas consumidas em ordem (linhas de baixo, ostinatos). */
export const seq = (mask, notes, inst) => {
  let i = 0;
  return mask.replace(/\s+/g, '').split('').map((ch) => {
    if (ch === 'x') { const n = notes[i % notes.length]; const t = inst && i === 0 ? `${n}:${inst}` : n; i++; return t; }
    return ch === '=' ? '==' : '.';
  }).join(' ');
};
export const bar = (A, B, C, N) => ({ A, B, C, N });

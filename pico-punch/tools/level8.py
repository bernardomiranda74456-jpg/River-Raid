# Gera levels/l8-caverna-brasa.json (220×16). Desenho manual por trechos: cada chamada abaixo é uma
# decisão de design explícita (nada aleatório). O ASCII final é validado e impresso para conferência.
import json
W, H = 220, 16
g = [['.'] * W for _ in range(H)]   # mapa (colisão + entidades)
d = [['.'] * W for _ in range(H)]   # decoração (fundo, sem colisão)

def fill(x0, x1, y0, y1, ch, grid=g):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): grid[y][x] = ch
def put(x, y, ch, grid=g): grid[y][x] = ch
def hrow(y, x0, x1, ch, grid=g): fill(x0, x1, y, y, ch, grid)
def vcol(x, y0, y1, ch, grid=g): fill(x, x, y0, y1, ch, grid)
def lava(x0, x1): fill(x0, x1, 14, 15, 'L')          # rio de lava de 2 tiles de profundidade (galeria baixa)
def pit(x0, x1):                                      # poço da galeria alta: fosso de 4 tiles e lava no fundo
    fill(x0, x1, 7, 11, '.'); fill(x0, x1, 12, 13, 'L')

# ---- Casca: teto, chão da galeria baixa (GB, pés na linha 13) e bordas ----------------------------
hrow(0, 0, W - 1, '#'); fill(0, W - 1, 14, 15, '#'); vcol(0, 0, H - 1, '#'); vcol(W - 1, 0, H - 1, '#')

# ---- Trecho 1 (cols 1–65): entrada da caverna. Teto espesso (linhas 0–6), galeria de 7 tiles de altura.
fill(1, 65, 0, 6, '#')
fill(21, 23, 7, 7, '#'); fill(44, 45, 7, 7, '#')         # estalactites (reduzem o pé-direito para 6)
put(2, 13, 'P')
hrow(11, 8, 10, 'S')                                       # veio de blocos-estrela acima da cabeça (soco p/ cima)
put(18, 13, 'u')                                           # 1ª lesma, 16 tiles do início
lava(26, 27)                                               # 1º rio de lava (2 tiles)
put(34, 7, 't')                                            # morcego pendurado na estalactite/teto
put(38, 13, '$')
lava(42, 53)                                               # lago de lava com 3 tábuas (saltos de 2 tiles)
hrow(13, 44, 45, '='); hrow(13, 48, 49, '='); hrow(13, 52, 53, '=')
put(49, 11, '$')                                           # saco sobre a tábua do meio
hrow(13, 54, 56, '#')                                      # degrau no nível das tábuas (desce para a lesma)
put(60, 13, 'C')                                           # checkpoint 1
put(66, 13, 'u')

# ---- Trecho 2 (cols 66–140): galeria alta (GA, pés na linha 6, piso na 7) sobre rocha maciça ------
hrow(7, 66, 140, '#')                                      # piso da GA
fill(73, 140, 8, 15, '#')                                  # rocha sob a GA (GB bloqueada)
fill(66, 72, 8, 13, '.'); put(72, 13, '&')                 # bolso sem saída na GB com saco grande
vcol(70, 4, 13, 'V')                                       # trepadeira 1: sobe da GB para a GA (atravessa o piso)
fill(80, 81, 1, 1, '#'); put(96, 1, '#'); fill(110, 112, 1, 1, '#'); put(126, 1, '#')   # estalactites da GA
put(74, 4, '?')                                            # ? (saco)
hrow(5, 83, 84, '='); hrow(3, 87, 88, '='); put(88, 2, '&')   # escadinha de tábuas até o saco grande
put(78, 1, 't'); put(98, 1, 't'); put(130, 1, 't')        # morcegos no teto da GA
pit(90, 91)                                                # poço 1 (2 tiles) com lava no fundo
hrow(4, 100, 102, 'S')                                     # veio de estrelas (pulo + soco p/ cima), fora dos arcos
pit(108, 109)                                              # poço 2
hrow(6, 110, 112, '#')                                     # degrau após o poço 2 (a lesma fica no nível de baixo)
put(116, 4, '?')                                           # ? com coração
put(118, 6, 'u')                                           # lesma entre os poços 2 e 3
pit(124, 125)                                              # poço 3
put(131, 6, '$')
# descida: trepadeira 2 na col 136 e buraco de 2 tiles (136–137) até a GB
vcol(136, 4, 13, 'V'); put(137, 7, '.'); fill(134, 140, 8, 13, '.')
fill(139, 140, 1, 7, '#')                                  # parede que fecha a GA à direita

# ---- Trecho 3 (cols 141–195): galeria baixa final sob rocha (teto na linha 7) -------------------------
fill(141, 195, 0, 7, '#')
put(142, 13, 'C')                                          # checkpoint 2
lava(146, 147)
hrow(13, 148, 152, '#')                                    # degrau de pouso após a lava
put(158, 13, 'u')                                          # lesma confinada entre o degrau e a lava
hrow(11, 156, 158, 'S')                                    # veio de estrelas acima da cabeça
lava(164, 166); put(165, 13, '=')                          # rio de 3 tiles com tábua central de apoio
put(172, 8, 't')
put(178, 11, '?')                                          # ? com coração antes do chefe
lava(180, 181)
hrow(13, 182, 184, '#')                                    # degrau de pouso
put(190, 8, 't')
put(188, 13, '$')
put(193, 13, 'G')                                          # portão da arena

# ---- Arena do Morcegão (cols 194–213, teto alto: linhas 1–13 livres) + saída ----------------------------
put(198, 1, '#'); put(206, 1, '#'); put(212, 1, '#')       # pontas de estalactite (decorativas, 12 tiles acima do chão)
put(204, 13, 'B')
fill(214, 218, 12, 15, '#'); put(216, 11, 'E')             # cornija de saída (2 tiles) e bandeira

# ---- Decoração (base na linha logo acima do apoio) -----------------------------------------------------
for x in (5, 9, 24, 37, 58, 67, 71): put(x, 13, 'c', d)     # cristais no chão da GB (entrada)
for x in (14, 46, 61): put(x, 13, 's', d)                  # caveiras
for x in (30, 40, 56): put(x, 13, 'p', d)
for x in (76, 85, 98, 114, 120, 133): put(x, 6, 'c', d)    # cristais na GA
for x in (92, 106, 128): put(x, 6, 's', d)
for x in (144, 154, 162, 168, 176, 184, 190): put(x, 13, 'c', d)   # GB final
for x in (148, 160, 183): put(x, 13, 's', d)
for x in (196, 200, 208, 211): put(x, 13, 'c', d)          # arena iluminada por cristais
put(215, 11, 'c', d); put(218, 11, 's', d)

rows = [''.join(r) for r in g]; decor = [''.join(r) for r in d]
for i, r in enumerate(rows): assert len(r) == W, (i, len(r))
for i, r in enumerate(decor): assert len(r) == W, ('decor', i, len(r))
assert len(rows) == len(decor) == H
level = {
  "id": "l8", "name": "Caverna Brasa", "theme": "cave", "music": "cave", "time": "cave",
  "map": rows, "decor": decor,
  "qcontents": { "74,4": "moneybag", "116,4": "heart", "178,11": "heart" },
  "entities": [], "cameraZones": [],
  "boss": { "type": "firebat", "name": "Morcegão Brasa" },
  # caminho do bot (coluna, linha dos pés)
  "botPath": [ [10, 13], [24, 13], [30, 13], [41, 13], [44, 12], [48, 12], [52, 12], [55, 12], [60, 13], [68, 13],
               [70, 4], [74, 6], [88, 6], [94, 6], [106, 6], [111, 5], [122, 6], [128, 6], [134, 6], [138, 13],
               [142, 13], [150, 12], [160, 13], [170, 13], [178, 13], [183, 12], [186, 13], [193, 13], [200, 13] ]
}
json.dump(level, open('levels/l8-caverna-brasa.json', 'w'), indent=0, ensure_ascii=False)
if __name__ == '__main__':
    import sys
    if '-v' in sys.argv:
        for i, r in enumerate(rows): print(f'{i:2d} {r}')
    print("ok", W, H)

# Gera levels/l10-castelo-kazmar.json (260×16). Castelo final: fosso com ponte, portaria, salão com
# mezanino, torre de subida, ameias com buracos sobre a masmorra, torre de descida, cripta de lava,
# portão e arena do Vizir. Cada chamada é uma decisão de design explícita (nada aleatório).
import json
W, H = 260, 16
g = [['.'] * W for _ in range(H)]
d = [['.'] * W for _ in range(H)]

def fill(x0, x1, y0, y1, ch, grid=g):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): grid[y][x] = ch
def put(x, y, ch, grid=g): grid[y][x] = ch
def hrow(y, x0, x1, ch, grid=g): fill(x0, x1, y, y, ch, grid)
def vcol(x, y0, y1, ch, grid=g): fill(x, x, y0, y1, ch, grid)
def lava(x0, x1): fill(x0, x1, 14, 15, 'L')                  # fosso de lava (2 de profundidade)
def spikepit(x0, x1): fill(x0, x1, 14, 14, '.'); hrow(15, x0, x1, '^')   # poço de 2 com espinhos no fundo
def pillar(x, y0, y1): vcol(x, y0, y1, 'i', d)
def torches(y, xs):
    for x in xs: put(x, y, 'T', d)

# ---- Casca: chão (linhas 14–15), bordas ---------------------------------------------------------------
fill(0, W - 1, 14, 15, '#'); vcol(0, 0, H - 1, '#'); vcol(W - 1, 0, H - 1, '#')
put(2, 13, 'P')

# ---- A. Aproximação (1–29): fosso com ponte levadiça e portaria com morcego ----------------------------
lava(16, 18); hrow(13, 15, 18, 'b')                          # ponte sobre o fosso
fill(24, 29, 0, 10, '#')                                     # portaria (túnel nas linhas 11–13)
for x in (24, 26, 28): put(x, 0, '#')                        # (ameias ficam dentro da massa; topo plano)
put(27, 11, 't')                                             # morcego sob o arco da portaria (1º inimigo, 25 tiles)
put(10, 13, '$')
for x in (5, 9, 21): put(x, 13, 'p', d)
torches(12, (25, 28))

# ---- B. Salão (30–81): teto baixo (0–5), pilares, estandartes, poço de espinhos, mezanino com guarda ---
fill(30, 81, 0, 5, '#')
for x in (36, 48, 60, 72): pillar(x, 7, 13)
for x in (42, 54, 66): put(x, 6, 'n', d)
spikepit(40, 41)
put(44, 11, '?'); put(46, 11, '?')                           # ? acima da cabeça: coração × fantasma
hrow(9, 50, 62, '='); put(56, 8, 'n'); put(52, 8, '&')       # mezanino com guarda (5 linhas acima do chão)
vcol(63, 7, 13, '|')                                         # escada do mezanino
hrow(11, 56, 57, 'S')
put(68, 13, '^')                                             # faixa de espinhos de 1 tile (pulinho)
put(67, 12, 'g')                                             # fantasma do salão (encontro sob o mezanino)
put(78, 13, 'C')                                             # checkpoint 1
torches(12, (33, 79))

# ---- C. Torre de subida (82–89): escada até as ameias ---------------------------------------------------
fill(82, 89, 0, 2, '#'); vcol(89, 6, 13, '#')                        # saída da torre nas linhas 3–5
vcol(88, 3, 13, '|')
hrow(10, 83, 85, '='); hrow(7, 83, 85, '='); put(84, 6, '&')  # cornijas internas com saco grande
torches(12, (83,)); torches(9, (86,))

# ---- D. Ameias (90–150) sobre a masmorra (teto na 7, pés na 13) -----------------------------------------
fill(90, 150, 6, 7, '#')                                     # piso das ameias (pés na 5)
for x in (95, 103, 111, 128, 146): put(x, 5, '#')            # merlões (degraus de 1 tile), fora dos arcos de salto
fill(99, 100, 6, 7, '.')                                     # buraco 1: cai na masmorra
fill(115, 117, 6, 7, '.'); lava(115, 117)                    # buraco 2: lava no fundo
fill(132, 133, 6, 7, '.')                                    # buraco 3: cai na masmorra
hrow(0, 121, 126, '#'); put(123, 1, 't')                     # galeria suspensa com morcego (4 linhas acima da cabeça)
hrow(0, 139, 144, '#'); put(140, 1, 't')
put(107, 3, '?'); put(109, 3, '?')                           # fantasma × coração (fora dos arcos dos merlões)
hrow(3, 142, 143, 'S')
put(119, 5, 'C')                                             # checkpoint 2 (sem sólido à esquerda: o renascimento usa x-8)
put(98, 5, '$'); put(131, 5, '$'); put(113, 5, '*')
# masmorra (rota alternativa, para quem cai pelos buracos 1 e 3): guardas, espinhos, tochas
for x in (105, 125, 140): put(x, 13, 'n')
put(110, 13, '^'); put(130, 13, '^')
put(96, 13, '$'); put(147, 13, '&')
torches(12, (92, 118, 148));
for x in (101, 134): put(x, 13, 's', d)

# ---- E. Torre de descida (151–158) ------------------------------------------------------------------------
fill(151, 158, 0, 2, '#'); vcol(158, 3, 11, '#')             # porta inferior nas linhas 12–13
vcol(151, 3, 13, 'V')                                        # trepadeira para voltar às ameias
torches(12, (157,))

# ---- F. Cripta de lava (159–228): teto baixo até 190, depois salão alto -----------------------------------
fill(159, 190, 0, 9, '#')
fill(191, 228, 0, 2, '#')
lava(165, 166)
put(170, 10, 't')
lava(176, 178); put(177, 12, '=')                            # fosso de 3 com tábua de apoio
put(182, 11, '?')                                            # fantasma
put(185, 10, 't')
put(194, 12, 'g')                                            # fantasma do corredor (encontro após o fosso de 3)
put(194, 11, '?')                                            # coração
lava(198, 199)
spikepit(203, 204)
hrow(9, 207, 210, '='); put(208, 8, 'n'); put(209, 8, '&')   # alcova alta com guarda e saco
vcol(211, 7, 13, '|')
hrow(11, 216, 217, 'S')
put(220, 13, 'C')                                            # checkpoint 3
put(229, 13, 'G')                                            # portão da arena
for x in (195, 203, 213, 224): pillar(x, 3, 13)
for x in (199, 208, 218, 227): put(x, 3, 'n', d)
torches(12, (161, 189, 192, 228));
for x in (163, 173, 186, 201): put(x, 13, 's', d)

# ---- G. Arena do Vizir (230–249) e saída ------------------------------------------------------------------
fill(230, 257, 0, 2, '#')
put(240, 13, 'B')
for x in (233, 239, 245): pillar(x, 3, 13)
for x in (236, 242, 248): put(x, 3, 'n', d)
fill(250, 258, 12, 15, '#'); put(254, 11, 'E')               # estrado do trono (2 tiles) e bandeira
torches(12, (231, 249)); torches(10, (252, 256))

rows = [''.join(r) for r in g]; decor = [''.join(r) for r in d]
for i, r in enumerate(rows): assert len(r) == W, (i, len(r))
for i, r in enumerate(decor): assert len(r) == W, ('decor', i, len(r))
assert len(rows) == len(decor) == H
level = {
  "id": "l10", "name": "Castelo Kazmar", "theme": "castle", "music": "castle", "time": "castle", "final": True,
  "map": rows, "decor": decor,
  "qcontents": { "44,11": "heart", "46,11": "ghost", "107,3": "ghost", "109,3": "heart", "182,11": "ghost", "194,11": "heart" },
  "entities": [], "cameraZones": [],
  "boss": { "type": "vizier", "name": "Vizir Kazmar" },
  # caminho do bot (coluna, linha dos pés): fosso → portaria → salão → torre → ameias → torre → cripta → portão
  "botPath": [ [8, 13], [14, 13], [16, 12], [20, 13], [32, 13], [38, 13], [43, 13], [50, 13], [66, 13], [70, 13],
               [78, 13], [85, 13], [88, 3], [92, 5], [97, 5], [102, 5], [106, 5], [114, 5], [119, 5], [126, 5],
               [131, 5], [135, 5], [140, 5], [148, 5], [153, 13], [160, 13], [164, 13], [168, 13], [175, 13],
               [180, 13], [190, 13], [197, 13], [201, 13], [206, 13], [214, 13], [220, 13], [229, 13], [236, 13] ]
}
json.dump(level, open('levels/l10-castelo-kazmar.json', 'w'), indent=0, ensure_ascii=False)
if __name__ == '__main__':
    import sys
    if '-v' in sys.argv:
        for i, r in enumerate(rows): print(f'{i:2d} {r}')
    print("ok", W, H)

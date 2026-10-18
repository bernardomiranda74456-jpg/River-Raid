# Gera levels/l9-cidade-lanterna.json (240×14). Cidade noturna em "corte": prédios de lajes `#` com
# interiores atravessáveis (janelas na decoração), escadas entre andares, telhados com tábuas `=`.
# Cada chamada é uma decisão de design explícita (nada aleatório); o ASCII final é validado.
import json
W, H = 240, 14
g = [['.'] * W for _ in range(H)]
d = [['.'] * W for _ in range(H)]

def fill(x0, x1, y0, y1, ch, grid=g):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): grid[y][x] = ch
def put(x, y, ch, grid=g): grid[y][x] = ch
def hrow(y, x0, x1, ch, grid=g): fill(x0, x1, y, y, ch, grid)
def vcol(x, y0, y1, ch, grid=g): fill(x, x, y0, y1, ch, grid)
STREET = 11                                                  # linha dos pés na rua (chão nas linhas 12–13)

def building(x0, x1, roof, slab=None, lopen=True, ropen=True):
    """Prédio em corte: laje do telhado em `roof`, laje intermediária opcional em `slab`, paredes
    laterais até a rua; `lopen`/`ropen` abrem uma porta de 2 tiles (linhas 10–11) na parede."""
    hrow(roof, x0, x1, '#')
    if slab is not None: hrow(slab, x0, x1, '#')
    vcol(x0, roof + 1, STREET, '#'); vcol(x1, roof + 1, STREET, '#')
    if lopen: vcol(x0, 10, 11, '.')
    if ropen: vcol(x1, 10, 11, '.')
def ladder(x, y0, y1): vcol(x, y0, y1, '|')             # sobrescreve a laje: vira o vão da escada
def windows(y, xs, pattern='wW'):
    for i, x in enumerate(xs): put(x, y, pattern[i % len(pattern)], d)

# ---- Casca ------------------------------------------------------------------------------------------
fill(0, W - 1, 12, 13, '#'); vcol(0, 0, H - 1, '#'); vcol(W - 1, 0, H - 1, '#')
put(2, STREET, 'P')

# ---- Rua 1 (1–13) -------------------------------------------------------------------------------------
hrow(STREET, 5, 8, 'F', d); put(11, STREET, 'S', d)

# ---- B1 "Loja" (14–30): térreo atravessável, telhado baixo com guarda e toldo ------------------------
building(14, 30, roof=8)
windows(10, (17, 20, 23, 26))
ladder(29, 5, 11)                                            # escada da loja ao telhado (térreo → pés na 7)
put(22, 7, 'n')                                              # guarda patrulha o telhado (4 linhas acima da rua)
hrow(6, 18, 20, '='); put(19, 5, '&')                        # toldo com saco grande
put(16, 7, '$')
put(15, 7, 'g', d); put(27, 7, 'S', d)

# ---- Rua 2 (31–40): primeiro caranguejo e drone alto --------------------------------------------------
put(36, STREET, 'a')
put(35, 4, 'r')                                              # drone alto: só acerta quem para embaixo
put(33, STREET, 'g', d); put(39, STREET, 'S', d)

# ---- B2 "Torre" (41–60): sobe pelo interior até o telhado (lado direito fechado) ---------------------
building(41, 60, roof=4, slab=8, ropen=False)
windows(10, (45, 48, 51, 54), 'wWww'); windows(6, (46, 50, 54), 'WwW')
ladder(58, 5, 11)                                            # escada A: térreo → 2º andar (pés na 7)
ladder(43, 1, 7)                                             # escada B: 2º andar → telhado (pés na 3)
put(50, 7, 'a')                                              # caranguejo no 2º andar
put(44, 7, '$')
put(50, 3, '&'); put(55, 3, 'S', d); put(47, 3, 'g', d)      # telhado: saco grande, letreiro, engrenagem

# ---- Beco 1 (61–62) com escada de incêndio; B3 (63–80) ------------------------------------------------
ladder(62, 2, 11)
building(63, 80, roof=5, slab=8)
windows(10, (66, 70, 74, 78)); windows(7, (65, 69, 73, 77), 'Www')
ladder(79, 6, 11)                                            # térreo → 2º andar (2 linhas de pé-direito)
put(72, 7, 'n')                                              # guarda no 2º andar; o telhado passa 3 linhas acima
put(75, 7, '&')                                              # saco grande na janela alta, atrás do guarda
put(68, STREET, 'a')
hrow(2, 70, 72, '='); put(71, 1, '$')                        # caixa d'água no telhado

# ---- Beco 2 (81–82) com drone baixo; B4 (83–91), telhado 1 acima do B3 ------------------------------
put(81, 8, 'r')
building(83, 91, roof=4, slab=8)
windows(10, (85, 88)); windows(6, (85, 89), 'Ww')
ladder(84, 6, 11)
put(88, STREET, 'a')
put(87, 3, '$')

# ---- Praça (92–125): rua aberta, drones altos (faixa limitada pelas lajes de B4 e B5) ---------------
put(94, STREET, 'C')                                         # checkpoint 1
hrow(STREET, 97, 99, 'F', d); put(101, STREET, 'S', d); hrow(STREET, 110, 112, 'F', d); put(118, STREET, 'g', d); put(122, STREET, 'p', d)
put(100, 4, 'r'); put(115, 4, 'r')
hrow(10, 106, 108, '='); put(107, 9, '$')                    # banco da praça com saco
put(104, STREET, '$'); put(119, STREET, '$')

# ---- B5 "Galeria" (126–150): blocos no teto do térreo, sobe até o telhado (lado direito fechado) ------
building(126, 150, roof=4, slab=8, ropen=False)
windows(10, (129, 136, 143), 'Www'); windows(6, (131, 137, 143, 147))
hrow(9, 132, 133, 'S'); put(140, 9, '?')                     # ? com coração, presos sob a laje do 2º andar
put(135, STREET, 'a')
ladder(148, 5, 11)                                           # térreo → 2º andar
put(140, 7, 'a')
ladder(128, 1, 7)                                            # 2º andar → telhado
put(145, 3, '$'); put(136, 3, 'S', d)

# ---- B6 (153–175): telhado com tábua, checkpoint 2; guarda no 2º andar -----------------------------
building(153, 175, roof=5, slab=8)
windows(10, (156, 162, 168, 173)); windows(7, (157, 163, 169), 'wWw')
ladder(174, 6, 11)
put(158, 4, 'C')                                             # checkpoint 2 (no telhado)
hrow(3, 160, 162, '='); put(161, 2, '&')
put(165, 7, 'n'); put(169, 7, '&')
put(160, STREET, 'a')

# ---- Beco 3 (176–177) com drone; B7 (178–205): jardim no telhado com chaminés -------------------------
put(176, 8, 'r')
building(178, 205, roof=5, slab=8)
windows(10, (181, 187, 193, 199), 'Www'); windows(7, (183, 190, 197, 203))
ladder(204, 6, 11)
put(190, 4, '#'); put(198, 4, '#')                           # chaminés (degraus de 1 tile)
hrow(3, 185, 187, '='); put(186, 2, '$')
put(201, 4, '$')
put(192, STREET, 'n')                                        # guarda do térreo (rota alternativa pela rua)
put(185, STREET, 'a')

# ---- Rua final (206–238) -------------------------------------------------------------------------------
put(214, STREET, 'a'); put(226, STREET, 'a')
hrow(7, 220, 223, '='); put(221, 6, 'n'); put(222, 6, '&')   # guarda numa marquise alta com saco (5 linhas acima)
ladder(224, 5, 11)                                           # escada até a marquise
hrow(STREET, 209, 211, 'F', d); put(217, STREET, 'S', d); put(230, STREET, 'g', d); put(233, STREET, 'p', d)
put(236, STREET, 'E')

rows = [''.join(r) for r in g]; decor = [''.join(r) for r in d]
for i, r in enumerate(rows): assert len(r) == W, (i, len(r))
for i, r in enumerate(decor): assert len(r) == W, ('decor', i, len(r))
assert len(rows) == len(decor) == H
level = {
  "id": "l9", "name": "Cidade Lanterna", "theme": "city", "music": "city", "time": "night",
  "map": rows, "decor": decor,
  "qcontents": { "140,9": "heart" },
  "entities": [], "cameraZones": [],
  # caminho do bot (coluna, linha dos pés): rua → interior da torre → telhados → praça → galeria → telhados → rua
  "botPath": [ [12, 11], [31, 11], [40, 11], [50, 11], [58, 5], [50, 7], [45, 7], [43, 1], [48, 3], [59, 3],
               [66, 4], [79, 4], [85, 3], [90, 3], [96, 11], [110, 11], [124, 11], [132, 11], [146, 11],
               [148, 5], [140, 7], [130, 7], [128, 1], [134, 3], [149, 3], [156, 4], [170, 4], [174, 4],
               [181, 4], [195, 4], [204, 4], [210, 11], [222, 11], [236, 11] ]
}
json.dump(level, open('levels/l9-cidade-lanterna.json', 'w'), indent=0, ensure_ascii=False)
if __name__ == '__main__':
    import sys
    if '-v' in sys.argv:
        for i, r in enumerate(rows): print(f'{i:2d} {r}')
    print("ok", W, H)

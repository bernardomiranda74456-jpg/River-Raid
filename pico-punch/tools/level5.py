# Gera levels/l5-ruinas-de-areia.json — "Ruínas de Areia" (deserto, 230×14, chefe Escorpião Dunar).
# Desenho à mão por segmentos: dunas em degraus de 1 tile, poços de espinhos (2 de fundo, espinhos no
# fundo para o bot detectar o buraco), dois templos com teto e blocos S/? escondidos, arena do chefe.
import json
W, H = 230, 14
g = [['.'] * W for _ in range(H)]
d = [['.'] * W for _ in range(H)]

def put(x, y, ch): g[y][x] = ch
def dec(x, y, ch): d[y][x] = ch
def ground(x0, x1, top):            # chão sólido da linha `top` até o fundo
    for x in range(x0, x1 + 1):
        for y in range(top, H): g[y][x] = '#'
def pit(x0, x1):                    # poço de 2 de fundo com espinhos (chão em volta na linha 11)
    for x in range(x0, x1 + 1):
        for y in range(0, H): g[y][x] = '.'
        g[13][x] = '#'; g[12][x] = '^'
def pillar(x, y0, y1):              # pilar decorativo empilhado (sem colisão)
    for y in range(y0, y1 + 1): d[y][x] = 'i'

# ---- parede esquerda / direita
ground(0, 0, 0); ground(229, 229, 0)

# ---- Seção A: dunas iniciais (1–62) --------------------------------------------------------
ground(1, 14, 11); put(3, 10, 'P')
dec(6, 10, 'k'); dec(9, 10, 't'); dec(12, 10, 'p')
ground(15, 18, 10); ground(19, 24, 9); ground(25, 28, 10); ground(29, 32, 11)
dec(17, 9, 'p'); dec(21, 8, 'k'); dec(23, 8, 't'); dec(27, 9, 's')
pit(33, 34)
ground(35, 46, 11)
put(42, 10, 'c')                    # primeiro inimigo (escorpião), >6 tiles do início
for x in (38, 39, 40): put(x, 8, 'S')   # fileira sobre a cabeça: pular + soco para cima
put(44, 10, '$'); dec(36, 10, 's'); dec(45, 10, 'k')
pit(47, 48)
ground(49, 58, 11); put(56, 8, 'e'); put(52, 10, '$'); dec(50, 10, 't'); dec(54, 10, 'p')
ground(59, 60, 10); ground(61, 66, 9); put(65, 8, 'c'); dec(63, 8, 'k')

# ---- Seção B: Templo 1 (67–90) ------------------------------------------------------------
ground(67, 90, 9)
for x in range(68, 85): put(x, 5, '#')          # teto
for x in (68, 72, 76, 80, 84): pillar(x, 6, 8)   # pilares
put(70, 7, 'S'); put(71, 7, 'S')                  # muro de blocos na altura do peito
put(74, 6, '?')                                   # bloco ? sobre a cabeça (saco)
put(77, 7, 'S'); put(77, 6, 'S')                  # coluna de 2
put(79, 8, '$'); put(83, 7, 'S')
dec(73, 8, 's'); dec(86, 8, 't')
put(88, 8, 'C')                                   # checkpoint 1
ground(91, 92, 10); ground(93, 96, 11); dec(94, 10, 's')
pit(97, 98)

# ---- Seção C: dunas das gralhas (99–154) --------------------------------------------------
ground(99, 110, 11); put(101, 10, '$'); put(102, 10, '$'); dec(107, 10, 'k'); dec(100, 10, 'p')
pit(111, 112)
ground(113, 122, 11); put(119, 4, 'v'); dec(116, 10, 't'); dec(121, 10, 's')
ground(123, 124, 10); ground(125, 128, 9); ground(129, 132, 8); put(131, 7, '&'); dec(126, 8, 'k'); dec(130, 7, 't')
ground(133, 136, 9); put(136, 7, 'e'); ground(137, 140, 10); ground(141, 150, 11)
put(144, 10, 'c'); put(148, 9, 'S'); put(149, 8, 'S'); dec(135, 8, 'p'); dec(143, 10, 'k'); dec(139, 9, 's')
ground(151, 154, 10); dec(152, 9, 't')

# ---- Seção D: Templo 2 (155–196) ----------------------------------------------------------
ground(155, 196, 9); put(157, 8, 'C')             # checkpoint 2
for x in range(160, 191): put(x, 4, '#')          # teto alto
for x in range(168, 176): put(x, 2, '#')          # cúpula sobre o estrado
put(168, 3, '#'); put(175, 3, '#')
for x in range(169, 175): put(x, 4, '.')
for x in (160, 165, 176, 181, 186, 190): pillar(x, 5, 8)
put(163, 7, 'S'); put(164, 7, 'S')
put(167, 6, 'S'); put(168, 6, 'S')
ground(170, 173, 7)                               # estrado (2 degraus)
put(172, 4, '?')                                  # coração escondido sob a cúpula (soco para cima, no estrado)
put(193, 8, 'c'); put(181, 7, 'S'); put(182, 6, 'S'); put(185, 6, '?'); put(188, 6, 'e')
dec(162, 8, 's'); dec(175, 8, 's'); dec(189, 8, 's'); dec(172, 6, 'p'); dec(194, 8, 'k')
ground(197, 198, 10)

# ---- Seção E: arena do chefe (199–228) -----------------------------------------------------
ground(199, 219, 11)
put(204, 10, 'G')                                 # portão (≥11 tiles antes de B: duelo dispara a 140 px)
put(216, 10, 'B')
pillar(206, 10, 10); pillar(218, 10, 10); dec(209, 10, 's'); dec(213, 10, 's'); dec(201, 10, 'p')
ground(220, 228, 9); put(226, 8, 'E'); dec(223, 8, 'k'); dec(228, 8, 't')

rows = [''.join(r) for r in g]; decor = [''.join(r) for r in d]
for i, r in enumerate(rows): assert len(r) == W, (i, len(r))
for i, r in enumerate(decor): assert len(r) == W, ('decor', i, len(r))
assert len(rows) == len(decor) == H
level = {
  "id": "l5", "name": "Ruínas de Areia", "theme": "desert", "music": "desert", "time": "sunset",
  "map": rows, "decor": decor,
  "qcontents": { "74,6": "moneybag", "172,4": "heart", "185,6": "bigbag" },
  "entities": [], "cameraZones": [],
  "boss": { "type": "dunescorp", "name": "Escorpião Dunar" },
  # Caminho do bot (coluna, linha dos pés): termina na arena — o bot não luta com o chefe.
  "botPath": [ [14, 10], [16, 9], [20, 8], [24, 8], [26, 9], [30, 10], [32, 10], [38, 10], [46, 10], [52, 10], [58, 10],
               [60, 9], [62, 8], [69, 8], [73, 8], [76, 8], [79, 8], [86, 8], [90, 8], [92, 9], [95, 10], [102, 10], [109, 10],
               [118, 10], [122, 10], [124, 9], [127, 8], [131, 7], [134, 8], [138, 9], [142, 10], [150, 10], [153, 9], [157, 8],
               [162, 8], [166, 8], [169, 8], [172, 6], [175, 8], [180, 8], [184, 8], [192, 8], [196, 8], [198, 9], [201, 10],
               [210, 10], [216, 10] ]
}
json.dump(level, open('levels/l5-ruinas-de-areia.json', 'w'), indent=0, ensure_ascii=False)
if __name__ == '__main__':
    import sys
    if '-v' in sys.argv:
        for i, r in enumerate(rows): print(f'{i:2d} {r}')
    print("ok", W, H)

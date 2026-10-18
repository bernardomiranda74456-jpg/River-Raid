# Gera levels/l7-ceu-de-vantura.json — "Céu de Vantura" (fase de HELICÓPTERO, 260×16).
# Helipé (vehicles.js): segurar pulo sobe (~95 px/s), soltar desce devagar (70 px/s), anda a 110 px/s,
# quebra S/?/R na linha do corpo e PARA (não é destruído) em paredes; um toque de inimigo o destrói.
# O bot só "pedala" em rajadas de 0,32 s quando está no chão (buraco à frente ou waypoint acima) e, se
# fica parado 2,5 s contra uma parede, pedala 1,5 s (sobe ~7 tiles). Logo a rota do bot é:
#  * ilhas no mesmo nível ou 1 tile abaixo separadas por ≤5 tiles (salto);
#  * descidas por planeio (queda ≈ 0,64 tile por tile andado): buraco de 4 → ilha ≥3 abaixo;
#  * subidas por degraus de 1 tile (waypoint logo após o degrau) ou paredes de 3–4 tiles (modo "travado");
#  * sacos no ar colocados no arco do salto; áreas altas opcionais para quem pilota de verdade.
import json
W, H = 260, 16
g = [['.'] * W for _ in range(H)]
d = [['.'] * W for _ in range(H)]

def put(x, y, ch): g[y][x] = ch
def dec(x, y, ch): d[y][x] = ch
def block(x0, x1, y0, y1, ch='#'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = ch
def island(x0, x1, top, bottom=H - 1): block(x0, x1, top, bottom)
def col(x, y0, y1, ch): block(x, x, y0, y1, ch)
def row(x0, x1, y, ch): block(x0, x1, y, y, ch)

island(0, 0, 0); island(259, 259, 0)                      # limites laterais

# ---- Ilha A (largada, com chão) e ilha B --------------------------------------------------
island(1, 14, 12); put(3, 11, 'P'); dec(6, 11, 'S'); dec(9, 11, 'f'); dec(12, 11, 't')
row(18, 19, 9, '$')                                        # no arco do salto sobre o buraco 15–18
island(19, 32, 12); row(24, 26, 11, 'S'); dec(21, 11, 'f'); dec(30, 11, 'b')
row(26, 30, 6, '#'); row(27, 29, 5, '$'); put(28, 3, 'e')   # ilhota alta opcional (guardada por abelhão)
put(35, 15, 'v')                                           # gralha no abismo (entre B e C)
# ---- Ilha C (1 abaixo) e Torre T1 (subida de 4: modo travado) -----------------------------
island(38, 50, 13); dec(41, 12, 'b'); dec(47, 12, 'f'); put(35, 6, '&')
island(51, 58, 9); dec(52, 8, 'F'); dec(53, 8, 'F'); col(55, 6, 8, 'S'); row(57, 58, 8, '$')
# ---- Ilha D (checkpoint 1) e ilha E ---------------------------------------------------------
island(62, 75, 10); put(66, 9, 'C'); put(69, 7, 'K'); dec(64, 9, 'f'); dec(72, 9, 't'); put(73, 5, '&')
row(70, 74, 5, '#'); col(72, 2, 4, 'R'); put(74, 4, '$')     # ilhota alta com coluna de pedra
row(79, 80, 7, '$')                                          # arco do salto sobre 76–79
island(80, 92, 10); col(81, 7, 9, 'R'); put(88, 8, 'r'); dec(85, 9, 'b'); dec(90, 9, 'f')
col(95, 0, 8, '#'); col(96, 0, 8, '#')                       # pilar suspenso: fecha o corredor do drone
# ---- Descida (planeio de 4) para a ilha F; pilar suspenso grande --------------------------
island(97, 122, 14); dec(100, 13, 'f'); dec(105, 13, 't'); dec(120, 13, 'b'); row(104, 106, 11, '$')
block(111, 113, 0, 11); put(112, 11, 'S')                    # ponta do pilar é um bloco-estrela
put(118, 13, 'e')
# ---- Escadaria de ilhas (degraus de 1) até o planalto G ----------------------------------
island(123, 125, 13); island(126, 128, 12); island(129, 131, 11); island(132, 134, 10)
island(135, 150, 10); put(139, 9, 'C'); put(142, 7, 'K'); row(145, 148, 9, 'S'); dec(137, 9, 'f'); dec(150, 9, 't')
row(141, 146, 4, '#'); col(144, 1, 3, 'S'); row(142, 143, 3, '$'); put(148, 5, '&')
row(154, 155, 7, '$')                                        # arco do salto sobre 151–155
# ---- Ilha H (1 abaixo) → planeio de 3 para a ilha I ----------------------------------------
island(156, 168, 11); put(164, 10, 'e'); dec(159, 10, 'b'); dec(166, 10, 'f')
put(170, 15, 'v')                                            # gralha no abismo 169–172
island(173, 190, 14); put(182, 13, 'e'); row(177, 179, 11, '$'); dec(175, 13, 'f'); dec(188, 13, 't')
block(185, 186, 0, 11)                                       # pilar suspenso
# ---- Torre T2 (subida de 3) → ilha J (checkpoint 3, drone) ---------------------------------
island(191, 198, 11); row(193, 194, 10, '$'); dec(196, 10, 'F'); dec(197, 10, 'F')
row(202, 203, 8, '$')                                        # arco do salto sobre 199–203
island(204, 218, 12); col(205, 9, 11, 'R'); put(208, 11, 'C'); put(211, 9, 'K'); put(214, 11, 'r'); dec(210, 11, 'f'); dec(217, 11, 'b')
# ---- Ilha K (lombada + 1 abaixo) e ilha L (bandeira) ---------------------------------------
island(222, 224, 11); island(225, 236, 13); row(228, 231, 12, 'S'); put(234, 12, 'e'); dec(226, 12, 't'); dec(235, 12, 'f')
row(228, 232, 7, '#'); put(230, 6, '&'); put(229, 4, 'e')    # ilhota alta opcional
row(240, 241, 10, '$')                                       # arco do salto sobre 237–240
island(241, 258, 13); put(252, 12, 'E'); dec(244, 12, 'f'); dec(248, 12, 't'); dec(256, 12, 'b'); put(250, 8, '&')

rows = [''.join(r) for r in g]; decor = [''.join(r) for r in d]
for i, r in enumerate(rows): assert len(r) == W, (i, len(r))
for i, r in enumerate(decor): assert len(r) == W, ('decor', i, len(r))
assert len(rows) == len(decor) == H
level = {
  "id": "l7", "name": "Céu de Vantura", "theme": "sky", "music": "sky", "time": "day",
  "vehicle": "heli",
  "map": rows, "decor": decor, "qcontents": {}, "entities": [], "cameraZones": [],
  # Waypoints (coluna, linha dos pés): em cada ilha, logo após degraus (dispara o salto) e ≥7 tiles depois
  # do início de cada buraco (o helicóptero ainda está no ar antes disso); ≤2 tiles após cada checkpoint.
  "botPath": [ [8, 11], [26, 11], [46, 12], [52, 8], [57, 8], [68, 9], [73, 9], [88, 9], [104, 13], [117, 13],
               [124, 12], [127, 11], [130, 10], [133, 9], [140, 9], [149, 9], [163, 10], [180, 13], [189, 13],
               [192, 10], [197, 10], [210, 11], [217, 11], [223, 10], [231, 12], [250, 12], [252, 12] ]
}
json.dump(level, open('levels/l7-ceu-de-vantura.json', 'w'), indent=0, ensure_ascii=False)
if __name__ == '__main__':
    import sys
    if '-v' in sys.argv:
        for i, r in enumerate(rows): print(f'{i:2d} {r}')
    print("ok", W, H)

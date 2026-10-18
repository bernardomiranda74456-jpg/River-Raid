# Gera levels/l6-estrada-do-trovao.json — "Estrada do Trovão" (fase de MOTO, 320×12).
# Regras da moto (vehicles.js): corre sozinha ~150–195 px/s, pulo fixo (~2,4 tiles de altura, ~7 tiles
# de alcance), quebra S/?/R na linha do corpo, e é DESTRUÍDA ao bater em parede. Por isso:
#  * nunca há degrau sólido para cima no caminho — subidas de nível só por buraco de 2 tiles (a moto
#    e o herói a pé pulam e aterrissam 1 tile acima) e plataformas `=` (mão única, sem colisão lateral);
#  * fileiras de blocos têm 1 tile de altura e ficam longe das zonas de aterrissagem dos pulos;
#  * buracos têm 2–3 tiles (também pulável a pé se a moto for destruída);
#  * inimigos ficam a ≥6 tiles dos buracos/fileiras R para o bot a pé não travar.
import json
W, H = 320, 12
g = [['.'] * W for _ in range(H)]
d = [['.'] * W for _ in range(H)]

def put(x, y, ch): g[y][x] = ch
def dec(x, y, ch): d[y][x] = ch
def ground(x0, x1, top):
    for x in range(x0, x1 + 1):
        for y in range(top, H): g[y][x] = '#'
def row(x0, x1, y, ch):
    for x in range(x0, x1 + 1): g[y][x] = ch
def fence(x0, x1, y):
    for x in range(x0, x1 + 1): d[y][x] = 'F'

ground(0, 0, 0); ground(319, 319, 0)            # limites laterais

# ---- Trecho 1 (1–40): largada, primeira fileira de blocos ---------------------------------
ground(1, 40, 10); put(2, 9, 'P')
fence(4, 9, 9); dec(11, 9, 't'); put(14, 9, 'a')
row(20, 25, 9, 'S'); dec(28, 9, 'p'); put(33, 9, 'h'); dec(39, 9, 'S')   # placa antes do buraco
# buraco A (2)
ground(43, 72, 10); row(52, 57, 9, 'R'); put(62, 9, 'a'); fence(64, 68, 9); dec(71, 9, 'S')
# buraco B (3)
ground(76, 107, 10); put(84, 9, 'C'); put(86, 7, 'M')      # checkpoint 1 + moto reserva (pular a pé)
row(92, 99, 9, 'S'); put(100, 9, 'h'); dec(79, 9, 't'); dec(89, 9, 'p'); dec(106, 9, 'S')
# buraco C (2): sobe 1 nível
ground(110, 130, 9); put(112, 8, 'a'); row(120, 124, 8, 'R'); fence(113, 118, 8); dec(129, 8, 'S')
# buraco D (3): desce 1 nível; plataforma-bônus sobre o buraco
row(133, 142, 8, '='); row(135, 140, 7, '$')
ground(134, 171, 10); put(150, 9, 'a'); row(152, 157, 9, 'S'); put(164, 9, 'C'); put(166, 7, 'M')   # checkpoint 2
fence(144, 148, 9); dec(160, 9, 't'); dec(170, 9, 'S')
# buraco E (3)
ground(175, 205, 10); put(179, 9, 'a'); put(186, 9, 'h'); row(196, 203, 9, 'R'); dec(178, 9, 'p'); dec(204, 9, 'S')
# buraco F (2): desce para a estrada baixa; plataforma alta com sacos
ground(208, 231, 11); row(210, 219, 9, '='); row(212, 218, 8, '$'); row(224, 229, 10, 'S'); dec(221, 10, 't'); dec(230, 10, 'S')
# buraco G (2): sobe de volta
ground(234, 247, 10); put(238, 9, 'C'); put(240, 7, 'M'); put(242, 9, 'a'); dec(246, 9, 'S')   # checkpoint 3
# buraco H (3): plataforma-bônus
row(250, 262, 8, '='); row(252, 260, 7, '$')
ground(251, 295, 10); put(270, 9, 'a'); row(276, 283, 9, 'S'); put(288, 9, 'h'); fence(263, 268, 9); dec(286, 9, 't'); dec(294, 9, 'S')
# buraco I (3): reta final
ground(299, 318, 10); row(306, 309, 9, 'R'); put(314, 9, 'E'); dec(301, 9, 'p'); fence(311, 313, 9); dec(317, 9, 't')

rows = [''.join(r) for r in g]; decor = [''.join(r) for r in d]
for i, r in enumerate(rows): assert len(r) == W, (i, len(r))
for i, r in enumerate(decor): assert len(r) == W, ('decor', i, len(r))
assert len(rows) == len(decor) == H
level = {
  "id": "l6", "name": "Estrada do Trovão", "theme": "road", "music": "vehicle", "time": "day",
  "vehicle": "moto",
  "map": rows, "decor": decor, "qcontents": {}, "entities": [], "cameraZones": [],
  # Waypoints só em chão plano, ≥8 tiles depois de cada buraco (a moto ainda está no ar antes disso),
  # nunca sobre plataformas (o bot pode passar por baixo delas) e sempre ≤2 tiles após cada checkpoint
  # (o bot retoma do waypoint visitado a <48 px do ponto de renascimento).
  "botPath": [ [20, 9], [36, 9], [50, 9], [68, 9], [86, 9], [104, 9], [118, 8], [128, 8], [150, 9], [166, 9],
               [184, 9], [200, 9], [230, 10], [240, 9], [266, 9], [286, 9], [308, 9], [314, 9] ]
}
json.dump(level, open('levels/l6-estrada-do-trovao.json', 'w'), indent=0, ensure_ascii=False)
if __name__ == '__main__':
    import sys
    if '-v' in sys.argv:
        for i, r in enumerate(rows): print(f'{i:2d} {r}')
    print("ok", W, H)

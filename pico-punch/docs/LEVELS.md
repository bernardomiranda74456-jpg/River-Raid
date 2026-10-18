# Formato de fase (levels/*.json)

Cada fase é um JSON desenhado à mão. Gere-o de preferência com um script Python em `tools/levelN.py`
(veja `tools/level1.py`): o script valida que todas as linhas têm a mesma largura.

```json
{
  "id": "l2", "name": "Bosque Sussurro", "theme": "forest", "music": "forest", "time": "day",
  "map": ["....", "...."],        // camada principal: tiles de colisão + entidades (1 char = 1 tile de 16 px)
  "decor": ["....", "...."],      // opcional, mesmo tamanho: decoração de fundo (sem colisão)
  "qcontents": { "x,y": "heart" }, // conteúdo de blocos "?" por coordenada de tile (padrão: moneybag)
  "entities": [ { "type": "roller", "x": 38, "y": 23, "dir": 1 } ], // entidades extras com propriedades
  "cameraZones": [ { "x": 0, "w": 800, "y": 0, "h": 192, "zoom": 1 } ], // opcional (em px de mundo)
  "boss": { "type": "frogking", "name": "Rã-Rei Bufo" },     // opcional: chefe no marcador B
  "vehicle": "moto",               // opcional: herói começa montado (moto | heli | boat)
  "botPath": [[12, 39], [18, 39]]  // caminho do bot de teste (coordenadas de tile: coluna, linha dos PÉS)
}
```

* `time`: `morning | day | sunset | night | cave | underwater | castle` (controla luz/grading no HD).
* `theme`: `mountain | forest | lake | village | desert | road | sky | cave | city | castle` (paleta + arte dos tiles).
* Altura da tela: 12 tiles (192 px). Largura típica: 200–320 tiles para fases horizontais; fases verticais podem ter 40+ linhas.
* O mapa deve ter paredes ou limites: o herói morre ao cair abaixo da última linha.

## Legenda do mapa (`map`)

| char | significado |
|---|---|
| `.` | vazio |
| `#` | sólido (autotile: recebe grama/areia/neve no topo conforme o tema) |
| `%` | sólido com superfície alternativa (neve na montanha; gelo) |
| `=` | plataforma de mão única (tábua) |
| `b` | ponte (mão única, fina) |
| `S` | bloco-estrela (soco → saco de dinheiro) |
| `?` | bloco-interrogação (soco → item de `qcontents`: `moneybag`, `bigbag`, `heart`, `star`, `capsule`, `ghost` (fantasma que persegue), `nothing`) |
| `H` | bloco escondido (aparece com cabeçada por baixo; vira bloco usado e dá moeda) |
| `U` | bloco usado (sólido) |
| `R` | bloco de pedra (só veículo quebra) |
| `\|` | escada (topo caminhável) |
| `V` | trepadeira (idem) |
| `^` | espinhos (morte) |
| `~` | superfície da água (nado) |
| `w` | água |
| `L` | lava (morte) |
| `X` | parede invisível |
| `I` | gelo (sólido) |

Entidades no mapa (âncora = pé no tile):

| char | entidade |
|---|---|
| `P` | ponto inicial do herói (obrigatório) |
| `E` | bandeira de fim de fase |
| `C` | sino de checkpoint |
| `D` | porta da loja (32×32; o jogador aperta ↑) |
| `$` | saco de dinheiro (+10) · `&` saco grande (+50) · `*` coração (vida) |
| `h` saltão (pula) · `v` gralha (voa e mergulha) · `o` rolão (pedra que rola; 2 socos) · `c` escorpião · `t` morcego (caverna) · `f` peixe (água) · `j` água-viva (água) · `g` fantasma · `n` guarda (escudo frontal) · `e` abelhão · `u` lesma de lava · `r` drone (atira para baixo) · `a` caranguejo |
| `B` | marcador do chefe (`boss` no JSON) — o duelo pedra-papel-tesoura acontece ao se aproximar |
| `G` | portão que fecha a arena do chefe |
| `M` `K` `O` | pickup de veículo: moto, helicóptero, barco |

## Legenda da decoração (`decor`)

`b` arbusto · `f` flor · `t` tufo · `p` pedra · `m` cogumelo · `c` cristal · `s` caveira · `w` janela acesa · `W` janela escura · `k` cacto · `T` tocha de parede · `n` estandarte · `i` pilar · `F` cerca · `a`/`A` algas · `o` coral · `g` engrenagem · `S` placa

Decorações são desenhadas por trás dos tiles, com a base no fundo do tile indicado — coloque-as na linha
imediatamente acima do chão.

## Regras de design (medidas do herói)

* Pulo: ~2,7 tiles de altura; ~4 tiles de distância correndo (buracos de 2–3 tiles são seguros).
* Soco para frente acerta o tile na altura do peito (bloco 1 tile acima do chão onde o herói está) e o tile
  em frente aos pés quando agachado; soco para cima acerta o tile sobre a cabeça; no ar com ↓, acerta abaixo.
* Escadas precisam subir 2 tiles acima da cornija onde terminam.
* Não coloque blocos `?`/`S` no arco de um pulo obrigatório (o herói bate a cabeça e cai).
* Checkpoint a cada ~1/3 da fase; o primeiro inimigo nunca a menos de 6 tiles do início.
* Rolões devem rolar numa superfície delimitada por paredes ou visivelmente em direção ao jogador.
* Arena de chefe: o duelo dispara quando o herói chega a 140 px (≈9 tiles) do marcador `B`; coloque o portão `G` pelo menos 10 tiles antes de `B` e piso plano até ~10 tiles depois de `B` (o Vizir teleporta até lá). Arena efetiva ≈ 20 tiles.
* `botPath`: waypoints a cada mudança de direção/altura; o bot anda, pula buracos/degraus, escala escadas
  quando o próximo ponto está acima e soca inimigos/blocos. Teste com `node test/e2e.mjs <n> retro 4`.

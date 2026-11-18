-- Tabela de fatores v1 (30 fatores). Referência: caminhada no plano a 5 km/h = 1,00 ponto/min.
-- Para ajustar fatores no futuro, crie uma nova versão (nova linha em factor_tables, novas
-- linhas em factors) e mova is_active. Treinos antigos guardam a versão e o fator usados.

insert into public.factor_tables (version, is_active, notes)
values ('v1', true, 'Tabela inicial do piloto. Fatores de beach tennis são provisórios.');

with t as (select id from public.factor_tables where version = 'v1')
insert into public.factors (table_id, code, modality, modality_label, variant_label, factor, provisional, sort_order)
select t.id, v.code, v.modality, v.modality_label, v.variant_label, v.factor, v.provisional, v.sort_order
from t, (values
  -- Caminhada
  ('caminhada_5kmh',        'caminhada',   'Caminhada',    'No plano, 5 km/h',                      1.00, false, 10),
  ('caminhada_6kmh',        'caminhada',   'Caminhada',    'No plano, 6 km/h',                      1.36, false, 11),
  -- Corrida (min/km)
  ('corrida_731_800',       'corrida',     'Corrida',      '7:31–8:00 /km',                         2.55, false, 20),
  ('corrida_630_730',       'corrida',     'Corrida',      '6:30–7:30 /km',                         2.80, false, 21),
  ('corrida_600_629',       'corrida',     'Corrida',      '6:00–6:29 /km',                         3.00, false, 22),
  ('corrida_530_559',       'corrida',     'Corrida',      '5:30–5:59 /km',                         3.40, false, 23),
  ('corrida_500_529',       'corrida',     'Corrida',      '5:00–5:29 /km',                         3.70, false, 24),
  ('corrida_sub_500',       'corrida',     'Corrida',      'Mais rápido que 5:00 /km',              4.00, false, 25),
  -- Ciclismo
  ('ciclismo_passeio',      'ciclismo',    'Ciclismo',     'Passeio, abaixo de 16 km/h',            1.07, false, 30),
  ('ciclismo_18kmh',        'ciclismo',    'Ciclismo',     'Aproximadamente 18 km/h',               2.07, false, 31),
  ('ciclismo_20kmh',        'ciclismo',    'Ciclismo',     'Aproximadamente 20 km/h',               2.50, false, 32),
  ('ciclismo_24kmh',        'ciclismo',    'Ciclismo',     'Aproximadamente 24 km/h',               3.21, false, 33),
  ('ciclismo_ergometrica',  'ciclismo',    'Ciclismo',     'Ergométrica, 90–100 W',                 1.79, false, 34),
  -- Natação
  ('natacao_crawl_lento',   'natacao',     'Natação',      'Crawl lento',                           1.71, false, 40),
  ('natacao_crawl_211',     'natacao',     'Natação',      'Crawl, aprox. 2:11 /100 m',             2.50, false, 41),
  ('natacao_crawl_128',     'natacao',     'Natação',      'Crawl, aprox. 1:28 /100 m',             3.39, false, 42),
  ('natacao_hidro',         'natacao',     'Natação',      'Hidroginástica',                        1.61, false, 43),
  -- Musculação
  ('musculacao_8_15',       'musculacao',  'Musculação',   'Séries de 8–15 repetições',             0.89, false, 50),
  ('musculacao_vigorosa',   'musculacao',  'Musculação',   'Vigorosa',                              1.79, false, 51),
  -- Outras modalidades
  ('circuito_moderado',     'circuito',    'Circuito',     'Moderado',                              1.43, false, 60),
  ('eliptico_moderado',     'eliptico',    'Elíptico',     'Moderado',                              1.43, false, 61),
  ('pilates_geral',         'pilates',     'Pilates',      'Geral',                                 0.64, false, 62),
  ('futebol_recreativo',    'futebol',     'Futebol',      'Recreativo',                            2.14, false, 63),
  ('zumba',                 'zumba',       'Zumba',        'Aula',                                  1.96, false, 64),
  -- Surfe e remada
  ('surfe_geral',           'surfe',       'Surfe',        'Sessão geral',                          0.71, false, 70),
  ('surfe_competitivo',     'surfe',       'Surfe',        'Competitivo',                           1.43, false, 71),
  ('sup_remada',            'sup',         'Stand up paddle', 'Remada na prancha (só o tempo remando)', 2.07, false, 72),
  -- Raquete (beach tennis provisório)
  ('beach_tennis_duplas',   'beach_tennis','Beach tennis', 'Duplas',                                2.20, true,  80),
  ('beach_tennis_individual','beach_tennis','Beach tennis','Individual',                            2.80, true,  81),
  ('pickleball_duplas',     'pickleball',  'Pickleball',   'Duplas',                                1.11, false, 82)
) as v(code, modality, modality_label, variant_label, factor, provisional, sort_order);

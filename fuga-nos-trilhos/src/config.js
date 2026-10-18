// Constantes de gameplay, presets gráficos e detecção de GPU.
import { isMobile, urlParams } from './utils.js';

export const LANE_W = 2.6;
export const LANES = [-LANE_W, 0, LANE_W];
export const CHUNK_LEN = 60;
export const CHUNK_COUNT = 8;              // 480 m visíveis
export const WORLD_REBASE = 2000;          // desloca o mundo a cada 2000 m (precisão de float)
export const GRAVITY = 30;
export const JUMP_V = 10;                  // altura ~1.67 m
export const SUPER_JUMP_V = 15.5;          // altura ~4.0 m (sobe em trens)
export const ROLL_TIME = 0.65;
export const LANE_CHANGE_TIME = 0.2;
export const PLAYER_RADIUS = 0.36;
export const PLAYER_HEIGHT = 1.72;
export const ROLL_HEIGHT = 0.9;
export const SPEED_START = 12;
export const SPEED_MAX = 32;
export const SPEED_ACCEL = 0.075;          // m/s por segundo (≈4.5 min até o máximo)
export const TRAIN_W = 2.45;
export const TRAIN_H = 3.3;
export const TRAIN_CAR_LEN = 18;
export const JET_HEIGHT = 4.6;              // acima dos trens (3.3) e abaixo dos fios (6.6)
export const STUMBLE_WINDOW = 5.5;         // segundos: 2 tropeços nesta janela = capturado
export const FIXED_DT = 1 / 60;

export const POWERUP_TIME = { magnet: 14, jetpack: 11, sneakers: 14, multiplier: 15, hoverboard: 22 };

/** Presets gráficos. */
export const PRESETS = {
  low: {
    label: 'Baixo', pixelRatio: 1, shadowMap: 1024, shadowRadius: 1, ao: false, bloom: false,
    smaa: false, msaa: 0, motionBlur: false, chroma: false, flare: false, particles: 0.35,
    buildings: 0.5, anisotropy: 2, envUpdate: 6, rain: 0.4, lights: 2, textureSize: 512,
  },
  medium: {
    label: 'Médio', pixelRatio: 1.5, shadowMap: 2048, shadowRadius: 2, ao: false, bloom: true,
    smaa: true, msaa: 0, motionBlur: true, chroma: false, flare: true, particles: 0.7,
    buildings: 0.8, anisotropy: 4, envUpdate: 4, rain: 0.7, lights: 4, textureSize: 1024,
  },
  high: {
    label: 'Alto', pixelRatio: 2, shadowMap: 2048, shadowRadius: 3, ao: true, bloom: true,
    smaa: true, msaa: 0, motionBlur: true, chroma: true, flare: true, particles: 1,
    buildings: 1, anisotropy: 8, envUpdate: 3, rain: 1, lights: 6, textureSize: 1024,
  },
  ultra: {
    label: 'Ultra', pixelRatio: 2, shadowMap: 4096, shadowRadius: 4, ao: true, bloom: true,
    smaa: true, msaa: 4, motionBlur: true, chroma: true, flare: true, particles: 1.4,
    buildings: 1.2, anisotropy: 16, envUpdate: 2, rain: 1.3, lights: 8, textureSize: 2048,
  },
};

/**
 * Escolhe o preset automaticamente a partir do nome da GPU e do tipo de
 * dispositivo. Um ajuste dinâmico em `main.js` ainda pode rebaixar o preset se
 * os primeiros segundos ficarem abaixo de 45 fps.
 */
export function detectPreset() {
  const params = urlParams();
  if (params.quality && PRESETS[params.quality]) return params.quality;
  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
    }
  } catch (e) { /* noop */ }
  gpu = gpu.toLowerCase();
  const mobile = isMobile();
  if (/swiftshader|llvmpipe|software/.test(gpu)) return 'low';
  if (mobile) {
    if (/apple gpu|apple a1[5-9]|apple m|adreno \(tm\) (7|8)|mali-g(7|8|9)|immortalis|xclipse/.test(gpu)) return 'medium';
    if (/adreno \(tm\) 6[5-9]|mali-g(5|6)/.test(gpu)) return 'medium';
    return 'low';
  }
  if (/rtx|radeon rx|arc\(tm\) a|arc\(tm\) b|apple m[2-9]|geforce gtx 1[6-9]|geforce gtx 20|radeon pro/.test(gpu)) return 'ultra';
  if (/geforce|radeon|apple m1|apple gpu|nvidia|amd/.test(gpu)) return 'high';
  if (/iris|uhd|intel|mesa/.test(gpu)) return 'medium';
  return 'high';
}

export const GPU_INFO = { name: '' };

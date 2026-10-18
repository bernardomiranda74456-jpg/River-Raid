/**
 * Entry point: loads Rapier (WASM), detects GPU, builds Settings/UI/Game.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { Settings } from './core/Settings.js';
import { detectGPU } from './core/GPUDetect.js';
import { UI } from './ui/UI.js';
import { Game } from './core/Game.js';

async function boot() {
  const settings = new Settings();
  const ui = new UI(settings);
  ui.setLoading(0.1, 'Inicializando física (Rapier)…');
  await RAPIER.init();
  ui.setLoading(0.45, 'Detectando GPU…');
  const gpu = detectGPU();
  const fresh = !localStorage.getItem('wobblerush.settings.v1');
  if (fresh) settings.applyPreset(gpu.preset);
  ui.setGpuInfo(`GPU: ${gpu.renderer.slice(0, 60)} · preset sugerido: ${gpu.preset}`);
  ui.setLoading(0.6, 'Gerando texturas procedurais…');
  await new Promise((r) => setTimeout(r, 30));
  const canvas = document.getElementById('game');
  const game = new Game({ RAPIER, canvas, settings, ui, gpu });
  ui.attach(game); game.applySettings();
  ui.setLoading(1, 'Pronto!');
  setTimeout(() => { ui.hideLoading(); ui.show('menu'); }, 250);
  game.start();
  window.__game = game; // handy for debugging / automated tests
}
boot().catch((e) => { console.error(e); document.getElementById('loading-text').textContent = 'Erro ao carregar: ' + e.message; });

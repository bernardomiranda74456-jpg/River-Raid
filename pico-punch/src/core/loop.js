// Loop com passo fixo de 60 Hz e interpolação para o render.
export class GameLoop {
  constructor({ update, render, hz = 60 }) {
    this.update = update; this.render = render;
    this.step = 1 / hz; this.acc = 0; this.last = 0; this.running = false;
    this.maxFrame = 0.25; this.frameId = 0; this.timeScale = 1; this.fps = 60; this._fpsAcc = 0; this._fpsN = 0;
    this._tick = (t) => this._frame(t);
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); this.frameId = requestAnimationFrame(this._tick); }
  stop() { this.running = false; cancelAnimationFrame(this.frameId); }
  _frame(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > this.maxFrame) dt = this.maxFrame; // aba em segundo plano: não acumula
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc >= 0.5) { this.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; }
    this.acc += dt * this.timeScale;
    let n = 0; const maxN = 5 * this.timeScale;
    while (this.acc >= this.step && n < maxN) { this.update(this.step); this.acc -= this.step; n++; }
    if (n >= maxN) this.acc = 0;
    this.render(this.acc / this.step, dt);
    this.frameId = requestAnimationFrame(this._tick);
  }
}

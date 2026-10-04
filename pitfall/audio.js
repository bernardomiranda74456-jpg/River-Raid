// Pitfall! sound effects, synthesized with Web Audio in the style of the
// Atari 2600 TIA chip: square-wave tones and LFSR-like noise, no samples.
(function (root) {
  'use strict';

  // TIA pure-tone pitch: 31400 Hz / 2 / (AUDF + 1) for AUDC = 4.
  function tia(audf) { return 31400 / 2 / (audf + 1); }

  function createAudio(ContextCtor) {
    let ctx = null, master = null, noiseBuf = null, logNode = null;
    let muted = false;

    function ensure() {
      if (ctx) return ctx;
      const Ctor = ContextCtor ||
        (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.18;
      master.connect(ctx.destination);
      // 2600-style noise: a 4-bit polynomial counter stepped at audio rate
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let poly = 0xF, hold = 0, v = 1;
      for (let i = 0; i < len; i++) {
        if (++hold >= 12) {
          hold = 0;
          const bit = ((poly >> 3) ^ (poly >> 2)) & 1;
          poly = ((poly << 1) | bit) & 0xF;
          v = (poly & 1) ? 1 : -1;
        }
        d[i] = v;
      }
      return ctx;
    }

    // Schedules a sequence of [audf, frames] square-wave notes (frames at 60 Hz).
    function tones(seq, type) {
      const c = ensure();
      if (!c) return 0;
      let t = c.currentTime + 0.01;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'square';
      gain.gain.setValueAtTime(0, t);
      for (const [audf, frames] of seq) {
        const dur = frames / 60;
        if (audf === null) {
          gain.gain.setValueAtTime(0, t);
        } else {
          osc.frequency.setValueAtTime(tia(audf), t);
          gain.gain.setValueAtTime(1, t);
        }
        t += dur;
      }
      gain.gain.setValueAtTime(0, t);
      osc.connect(gain);
      gain.connect(master);
      osc.start(c.currentTime);
      osc.stop(t + 0.02);
      return seq.length;
    }

    function noise(seconds, rate, vol) {
      const c = ensure();
      if (!c) return null;
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      src.playbackRate.value = rate;
      const gain = c.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(master);
      src.start();
      if (seconds) src.stop(c.currentTime + seconds);
      return src;
    }

    const sfx = {
      // Tarzan yell when Harry catches the vine: a warbling "aah-ee-aah-ee-aah".
      vine() {
        const seq = [];
        const hi = [9, 8, 9, 8, 9, 8, 9, 8], lo = [13, 14, 13, 14];
        seq.push([17, 6], [15, 4]);
        for (let i = 0; i < 4; i++) { seq.push([hi[i * 2], 3], [lo[i], 3], [hi[i * 2 + 1], 3]); }
        seq.push([11, 6], [14, 8], [18, 12]);
        return tones(seq);
      },
      // Treasure pickup: rising chime.
      treasure() {
        return tones([[23, 3], [19, 3], [15, 3], [11, 3], [9, 3], [7, 6], [null, 2], [7, 10]], 'square');
      },
      // Falling down a hole into the tunnel: descending whistle.
      hole() {
        const seq = [];
        for (let f = 4; f <= 30; f += 2) seq.push([f, 2]);
        return tones(seq);
      },
      // Death: tumbling, slowly descending tones.
      death() {
        const seq = [];
        for (let i = 0; i < 12; i++) seq.push([8 + i * 2, 4], [12 + i * 2, 4]);
        seq.push([31, 16]);
        return tones(seq, 'square');
      },
      // Jumping is silent on the cartridge.
      jump() { return 0; },
      gameOver() { return tones([[20, 15], [24, 15], [28, 15], [31, 30]]); },
      win() { return tones([[15, 8], [12, 8], [9, 8], [7, 8], [9, 8], [7, 24]]); },
      // Continuous rumble while a log is rolling over Harry.
      log(on) {
        if (on && !logNode) logNode = noise(0, 0.35, 0.8);
        else if (!on && logNode) { try { logNode.stop(); } catch (e) { /* already stopped */ } logNode = null; }
        return !!logNode;
      },
    };

    return Object.assign(sfx, {
      unlock() {
        const c = ensure();
        if (c && c.state === 'suspended' && c.resume) c.resume();
        return !!c;
      },
      setMuted(m) {
        muted = m;
        if (master) master.gain.value = m ? 0 : 0.18;
      },
      isMuted() { return muted; },
      // Plays the sounds for one frame's engine events.
      handle(events, logContact) {
        for (const e of events) {
          if (e === 'vine') sfx.vine();
          else if (e === 'treasure') sfx.treasure();
          else if (e === 'hole') sfx.hole();
          else if (e === 'death') sfx.death();
          else if (e === 'gameover') sfx.gameOver();
          else if (e === 'win') sfx.win();
        }
        sfx.log(!!logContact);
      },
      tia,
    });
  }

  const api = { createAudio, tia };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PitfallAudio = api;
})(this);

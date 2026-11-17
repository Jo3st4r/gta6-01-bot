// Synthesized music and sound effects (WebAudio, no audio files). Everything is lazy and
// guarded: with no user gesture yet (or no AudioContext at all, as in a screenshot run)
// every call is a silent no-op, so the game never depends on sound to run.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let beat = 0;
  let sirenOsc = null;
  let sirenGain = null;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure() || !ctx || !master) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch { /* sound is never fatal */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure() || !ctx || !master) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* sound is never fatal */ }
  }

  // A lazy bassline loop: A minor groove, one step per 140 ms.
  const BASS = [110, 0, 130.8, 0, 98, 0, 130.8, 146.8, 110, 0, 130.8, 0, 164.8, 146.8, 130.8, 98];
  function stepMusic() {
    if (!ctx) return;
    const f = BASS[beat % BASS.length];
    if (f) tone(f, 0.16, 'triangle', 0.16);
    if (beat % 4 === 2) noiseBurst(0.05, 0.05, 6000);
    beat++;
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    startMusic() {
      if (!ensure() || musicTimer !== null) return;
      musicTimer = window.setInterval(stepMusic, 140);
    },
    stopMusic() {
      if (musicTimer !== null) { window.clearInterval(musicTimer); musicTimer = null; }
    },
    gunshot() { noiseBurst(0.12, 0.5, 1800); tone(160, 0.08, 'square', 0.2, 0, 60); },
    pickup() { tone(660, 0.09, 'sine', 0.25); tone(990, 0.12, 'sine', 0.25, 0.09); },
    missionDone() {
      tone(523, 0.12, 'triangle', 0.3);
      tone(659, 0.12, 'triangle', 0.3, 0.12);
      tone(784, 0.2, 'triangle', 0.3, 0.24);
    },
    crash() { noiseBurst(0.25, 0.4, 900); },
    siren(on) {
      if (!ensure() || !ctx || !master) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.03;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.5;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 300;
          lfo.connect(lfoGain);
          lfoGain.connect(sirenOsc.frequency);
          sirenOsc.type = 'sawtooth';
          sirenOsc.frequency.value = 800;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          lfo.start();
        } else if (!on && sirenOsc) {
          sirenOsc.stop();
          sirenOsc = null;
          sirenGain = null;
        }
      } catch { /* sound is never fatal */ }
    },
    engine(speed01) {
      if (!ensure() || !ctx || !master) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineGain.gain.value = 0;
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 60;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(60 + speed01 * 140, ctx.currentTime, 0.1);
      } catch { /* sound is never fatal */ }
    },
  };
}

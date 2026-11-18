// Procedural sound, all synthesized with WebAudio: engine hum, police sirens,
// gunshots, punches, pickup jingles, mission stings and a small bassline loop.
// Nothing is loaded from a file. The context starts on the first user gesture;
// until then every call is a safe no-op, so headless runs stay silent and error-free.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    engine: null,
    engineGain: null,
    siren: null,
    sirenGain: null,
    musicTimer: 0,
    musicStep: 0,
    started: false,
  };
}

function ensure(audio) {
  if (audio.ctx || audio.muted) return audio.ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.started = true;
  } catch {
    audio.ctx = null;
  }
  return audio.ctx;
}

function tone(audio, freq, dur, type, vol, slideTo) {
  const ctx = ensure(audio);
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(audio.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  } catch {
    // Audio is decoration: never let it break the game.
  }
}

function noise(audio, dur, vol, filterFreq) {
  const ctx = ensure(audio);
  if (!ctx) return;
  try {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start();
  } catch {
    // Audio is decoration.
  }
}

export function playSound(audio, name) {
  if (audio.muted) return;
  switch (name) {
    case 'shot': noise(audio, 0.14, 0.5, 3200); tone(audio, 160, 0.1, 'square', 0.18, 60); break;
    case 'shotFar': noise(audio, 0.1, 0.2, 1800); break;
    case 'punch': noise(audio, 0.08, 0.35, 900); break;
    case 'hurt': tone(audio, 220, 0.18, 'sawtooth', 0.22, 90); break;
    case 'crash': noise(audio, 0.3, 0.5, 700); tone(audio, 90, 0.25, 'sine', 0.3, 40); break;
    case 'pickup': tone(audio, 660, 0.09, 'sine', 0.25); tone(audio, 990, 0.14, 'sine', 0.22); break;
    case 'mission': tone(audio, 523, 0.12, 'triangle', 0.25); tone(audio, 659, 0.12, 'triangle', 0.25); tone(audio, 784, 0.2, 'triangle', 0.25); break;
    case 'pass': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(audio, f, 0.16, 'triangle', 0.24), i * 90)); break;
    case 'down': tone(audio, 330, 0.12, 'square', 0.16, 180); break;
    case 'siren': break; // the siren loop handles itself
    case 'enter': tone(audio, 440, 0.08, 'square', 0.15, 660); break;
    case 'busted': tone(audio, 392, 0.2, 'sawtooth', 0.2, 196); tone(audio, 311, 0.3, 'sawtooth', 0.2, 155); break;
    default: break;
  }
}

function startEngine(audio) {
  const ctx = ensure(audio);
  if (!ctx || audio.engine) return;
  try {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    o.start();
    audio.engine = o;
    audio.engineGain = g;
  } catch {
    audio.engine = null;
  }
}

function startSiren(audio) {
  const ctx = ensure(audio);
  if (!ctx || audio.siren) return;
  try {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 720;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(audio.master);
    o.start();
    audio.siren = o;
    audio.sirenGain = g;
  } catch {
    audio.siren = null;
  }
}

// A four-bar bassline loop, scheduled a bar at a time: A minor, driving eighth notes.
const BASS = [55, 0, 55, 65.4, 55, 0, 49, 55, 55, 0, 55, 65.4, 82.4, 0, 73.4, 65.4];
const HAT = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1];

export function stepAudio(audio, world, dt) {
  if (audio.muted) {
    if (audio.engineGain) audio.engineGain.gain.value = 0;
    if (audio.sirenGain) audio.sirenGain.gain.value = 0;
    return;
  }
  const ctx = ensure(audio);
  if (!ctx) return;
  const p = world.entities.player;
  // Engine hum follows the player's car speed.
  if (p.car) {
    startEngine(audio);
    if (audio.engine && audio.engineGain) {
      const rev = 0.4 + Math.abs(p.car.speed) / 430;
      audio.engine.frequency.setTargetAtTime(52 + rev * 95, ctx.currentTime, 0.05);
      audio.engineGain.gain.setTargetAtTime(0.05 + rev * 0.05, ctx.currentTime, 0.08);
    }
  } else if (audio.engineGain) {
    audio.engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }
  // Siren wails while police are close and the wanted level is up.
  const nearPolice = world.entities.policeCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 700);
  if (p.wanted > 0 && nearPolice) {
    startSiren(audio);
    if (audio.siren && audio.sirenGain) {
      const t = world.time;
      const twoTone = Math.sin(t * 3.4) > 0 ? 720 : 950;
      audio.siren.frequency.setTargetAtTime(twoTone, ctx.currentTime, 0.06);
      audio.sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
    }
  } else if (audio.sirenGain) {
    audio.sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  }
  // Music: one eighth note per step, only while playing.
  audio.musicTimer -= dt;
  if (audio.musicTimer <= 0 && world.screen === 'play') {
    audio.musicTimer = 0.21;
    const step = audio.musicStep % 16;
    const bass = BASS[step];
    if (bass) tone(audio, bass, 0.2, 'triangle', 0.16);
    if (HAT[step]) noise(audio, 0.03, 0.05, 8000);
    audio.musicStep += 1;
  }
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) {
    try { audio.master.gain.value = muted ? 0 : 0.5; } catch { /* ignore */ }
  }
}

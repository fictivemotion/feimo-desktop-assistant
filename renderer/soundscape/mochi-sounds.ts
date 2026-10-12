/**
 * Animal Island — UI sound effect library.
 * All sounds are synthesized in the browser with Web Audio API.
 * No audio files needed; copy the play function into your app.
 */

let _ctx: AudioContext | null = null;
let _volume = 0.8;
let _unlocked = false;
const activeSources = new Set<AudioScheduledSourceNode>();
function trackSource(source:AudioScheduledSourceNode,dispose:()=>void){activeSources.add(source);source.addEventListener('ended',()=>{activeSources.delete(source);dispose();},{once:true});}
export function stopSounds(){for(const source of activeSources){try{source.stop();source.disconnect();}catch{}}activeSources.clear();}

export function setSoundVolume(volume: number) {
  _volume = Math.min(1, Math.max(0, volume));
}

function tryGetCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (_ctx?.state === "closed") _ctx = null;

  if (!_ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;

    try {
      _ctx = new Ctor();
    } catch {
      return null;
    }
  }

  if (_ctx.state === "suspended") {
    try {
      void _ctx.resume().catch(() => {
        // Audio unlock can be blocked by the browser; UI interactions must keep working.
      });
    } catch {
      // Some browser implementations can reject resume synchronously.
    }
  }

  return _ctx;
}

export function getCtx(): AudioContext {
  const ctx = tryGetCtx();
  if (!ctx) throw new Error("AudioContext is not available in this browser");
  return ctx;
}

export function unlockSound(): AudioContext | null {
  if (_unlocked && _ctx?.state === "running") return _ctx;

  const ctx = tryGetCtx();
  if (!ctx) return null;

  try {
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    source.connect(ctx.destination);
    source.start(0);
    _unlocked = true;
  } catch {
    // Do not let audio setup cancel the click/tap that triggered it.
  }

  return ctx;
}

export function playWhenReady(play: () => void) {
  const ctx = unlockSound();
  const run = () => {
    try {
      play();
    } catch {
      // Sound preview should never block the UI action that triggered it.
    }
  };

  if (!ctx || ctx.state === "running") {
    run();
    return;
  }

  try {
    void ctx.resume().then(run).catch(run);
  } catch {
    run();
  }
}

type Wave = OscillatorType;
const TYPE_SCALE = [880, 988, 1108.73, 1174.66, 1318.51, 1479.98, 1661.22, 1760];

function typeFreq(step = 0, octave = 1) {
  const note = TYPE_SCALE[Math.abs(step) % TYPE_SCALE.length];
  const octaveOffset = Math.floor(Math.abs(step) / TYPE_SCALE.length);
  return note * octave * 2 ** Math.min(octaveOffset, 1);
}

function tone(opts: {
  freq: number;
  duration: number;
  type?: Wave;
  gain?: number;
  attack?: number;
  release?: number;
  glideTo?: number;
  delay?: number;
}) {
  if (_volume <= 0) return;
  const ctx = tryGetCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.glideTo) {
      osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + opts.duration);
    }
    const peak = (opts.gain ?? 0.18) * _volume;
    const a = Math.min(opts.attack ?? 0.005, opts.duration * 0.4);
    const r = Math.min(opts.release ?? 0.08, opts.duration - a);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.linearRampToValueAtTime(peak, t0 + opts.duration - r);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
    osc.connect(g).connect(ctx.destination);
    trackSource(osc,()=>{osc.disconnect();g.disconnect();});
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.02);
  } catch {
    // Keep UI controls responsive if Web Audio rejects a scheduled node.
  }
}

function noiseBurst(duration: number, gain = 0.08, lp = 2000, delay = 0) {
  if (_volume <= 0) return;
  const ctx = tryGetCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  try {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lp;
    const g = ctx.createGain();
    const attack = Math.min(0.012, duration * 0.35);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain * _volume, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(ctx.destination);
    trackSource(src,()=>{src.disconnect();filter.disconnect();g.disconnect();});
    src.start(t0);
    src.stop(t0 + duration);
  } catch {
    // Keep UI controls responsive if Web Audio rejects a scheduled node.
  }
}

/* ===== Library ===== */

export const sounds = {
  click: () => tone({ freq: 880, duration: 0.06, type: "triangle", gain: 0.2 }),

  pop: () => {
    tone({ freq: 180, glideTo: 360, duration: 0.08, type: "sine", gain: 0.16, release: 0.045 });
    tone({ freq: 920, duration: 0.045, type: "sine", gain: 0.1, delay: 0.055, release: 0.025 });
  },

  tap: () => tone({ freq: 1200, duration: 0.04, type: "square", gain: 0.12 }),

  toggleOn: () => {
    tone({ freq: 660, duration: 0.08, type: "triangle", gain: 0.18 });
    tone({ freq: 990, duration: 0.1, type: "triangle", gain: 0.18, delay: 0.06 });
  },

  toggleOff: () => {
    tone({ freq: 660, duration: 0.08, type: "triangle", gain: 0.18 });
    tone({ freq: 440, duration: 0.1, type: "triangle", gain: 0.18, delay: 0.06 });
  },

  hover: () => tone({ freq: 1760, duration: 0.05, type: "sine", gain: 0.08 }),

  success: () => {
    tone({ freq: 523.25, duration: 0.12, type: "triangle", gain: 0.18 }); // C5
    tone({ freq: 659.25, duration: 0.12, type: "triangle", gain: 0.18, delay: 0.1 }); // E5
    tone({ freq: 783.99, duration: 0.2, type: "triangle", gain: 0.2, delay: 0.2 }); // G5
  },

  error: () => {
    tone({ freq: 220, duration: 0.14, type: "sawtooth", gain: 0.16 });
    tone({ freq: 165, duration: 0.18, type: "sawtooth", gain: 0.16, delay: 0.1 });
  },

  notify: () => {
    tone({ freq: 880, duration: 0.18, type: "sine", gain: 0.2 });
    tone({ freq: 1318.5, duration: 0.22, type: "sine", gain: 0.18, delay: 0.12 });
  },

  message: () => {
    tone({ freq: 700, glideTo: 1100, duration: 0.14, type: "triangle", gain: 0.18 });
    tone({ freq: 1100, glideTo: 1400, duration: 0.14, type: "triangle", gain: 0.16, delay: 0.1 });
  },

  coin: () => {
    tone({ freq: 1318.51, duration: 0.045, type: "triangle", gain: 0.16, release: 0.02 });
    tone({ freq: 2637.02, duration: 0.16, type: "sine", gain: 0.12, delay: 0.035, release: 0.12 });
  },

  levelUp: () => {
    const notes = [392, 523.25, 659.25, 987.77, 1318.51];
    notes.forEach((f, i) =>
      tone({ freq: f, duration: 0.11, type: "triangle", gain: 0.14, delay: i * 0.055, release: 0.07 }),
    );
  },

  whoosh: () => noiseBurst(0.35, 0.1, 1400),

  open: () => {
    tone({ freq: 440, glideTo: 880, duration: 0.18, type: "sine", gain: 0.18 });
    noiseBurst(0.12, 0.05, 3000);
  },

  close: () =>
    tone({ freq: 880, glideTo: 330, duration: 0.18, type: "sine", gain: 0.18 }),

  unlock: () => {
    noiseBurst(0.08, 0.06, 4000);
    tone({ freq: 1318, duration: 0.16, type: "triangle", gain: 0.2, delay: 0.08 });
  },

  type: () => tone({ freq: 1400, duration: 0.025, type: "square", gain: 0.1 }),

  slider: () => {
    tone({ freq: 620, glideTo: 700, duration: 0.045, type: "triangle", gain: 0.035 });
    noiseBurst(0.025, 0.008, 1600);
  },

  snap: () => {
    tone({ freq: 880, duration: 0.035, type: "triangle", gain: 0.12 });
    tone({ freq: 1320, duration: 0.06, type: "sine", gain: 0.08, delay: 0.025 });
  },

  check: () => {
    tone({ freq: 660, duration: 0.06, type: "triangle", gain: 0.12 });
    tone({ freq: 990, duration: 0.1, type: "triangle", gain: 0.12, delay: 0.045 });
  },

  uncheck: () =>
    tone({ freq: 780, glideTo: 420, duration: 0.12, type: "triangle", gain: 0.11 }),

  radio: () => tone({ freq: 920, duration: 0.07, type: "sine", gain: 0.1, release: 0.05 }),

  rate: (step = 3) => {
    const sparkle = 880 + Math.max(0, Math.min(step, 5)) * 88;
    tone({ freq: sparkle, duration: 0.045, type: "sine", gain: 0.09, release: 0.03 });
    tone({ freq: sparkle * 1.5, duration: 0.16, type: "sine", gain: 0.065, delay: 0.035, release: 0.13 });
  },

  tab: () => {
    tone({ freq: 620, duration: 0.04, type: "triangle", gain: 0.1 });
    tone({ freq: 820, duration: 0.05, type: "triangle", gain: 0.08, delay: 0.035 });
  },

  menuOpen: () => {
    tone({ freq: 360, glideTo: 720, duration: 0.14, type: "sine", gain: 0.1 });
    noiseBurst(0.08, 0.025, 2600);
  },

  select: () => tone({ freq: 1040, duration: 0.065, type: "triangle", gain: 0.11 }),

  drop: () => {
    tone({ freq: 980, glideTo: 160, duration: 0.34, type: "triangle", gain: 0.16, release: 0.18 });
    noiseBurst(0.055, 0.018, 900);
  },

  castRod: () => {
    noiseBurst(0.035, 0.032, 2600, 0.02);
    tone({ freq: 220, glideTo: 96, duration: 0.16, type: "sine", gain: 0.085, delay: 0.055, release: 0.11 });
    noiseBurst(0.075, 0.105, 900, 0.06);
    tone({ freq: 780, duration: 0.035, type: "sine", gain: 0.034, delay: 0.13, release: 0.025 });
    tone({ freq: 520, glideTo: 260, duration: 0.11, type: "sine", gain: 0.035, delay: 0.18, release: 0.08 });
    noiseBurst(0.24, 0.035, 760, 0.18);
  },

  bubble: () => {
    tone({ freq: 520, glideTo: 980, duration: 0.055, type: "sine", gain: 0.035, attack: 0.006, release: 0.032 });
    tone({ freq: 780, glideTo: 1240, duration: 0.075, type: "sine", gain: 0.026, attack: 0.008, delay: 0.052, release: 0.045 });
  },

  chime: () => {
    [880, 1174.66, 1568, 2093].forEach((f, i) =>
      tone({ freq: f, duration: 0.85, type: "sine", gain: 0.075, release: 0.72, delay: i * 0.06 }),
    );
  },

  gachaReveal: () => {
    tone({ freq: 392, glideTo: 1174.66, duration: 0.26, type: "sine", gain: 0.052, attack: 0.012, delay: 0.01, release: 0.17 });
    [1174.66, 1568, 2093].forEach((freq, index) =>
      tone({ freq, duration: 0.12 + index * 0.035, type: "sine", gain: 0.045 - index * 0.005, attack: 0.01, delay: 0.21 + index * 0.055, release: 0.09 }),
    );
    tone({ freq: 2637.02, duration: 0.26, type: "sine", gain: 0.03, attack: 0.012, delay: 0.38, release: 0.22 });
    tone({ freq: 1318.51, duration: 0.42, type: "sine", gain: 0.028, attack: 0.015, delay: 0.42, release: 0.34 });
  },

  victory: () => {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((freq, index) =>
      tone({ freq, duration: index < 4 ? 0.1 : 0.18, type: "triangle", gain: 0.115, delay: index * 0.065, release: 0.09 }),
    );
  },

  settlement: () => {
    [659.25, 783.99, 987.77, 1174.66].forEach((freq, index) =>
      tone({ freq, duration: 0.055, type: "triangle", gain: 0.095, delay: index * 0.075, release: 0.03 }),
    );
    noiseBurst(0.045, 0.018, 1800, 0.31);
    tone({ freq: 392, duration: 0.08, type: "triangle", gain: 0.08, delay: 0.33, release: 0.04 });
    tone({ freq: 1046.5, duration: 0.22, type: "sine", gain: 0.09, delay: 0.39, release: 0.16 });
    tone({ freq: 1568, duration: 0.28, type: "sine", gain: 0.055, delay: 0.43, release: 0.22 });
  },

  portal: () => {
    noiseBurst(0.32, 0.045, 2600);
    tone({ freq: 110, glideTo: 880, duration: 0.38, type: "sine", gain: 0.1, release: 0.22 });
    tone({ freq: 1760, glideTo: 660, duration: 0.3, type: "sine", gain: 0.055, delay: 0.1, release: 0.18 });
  },

  damage: () => {
    noiseBurst(0.09, 0.075, 1300);
    tone({ freq: 180, glideTo: 72, duration: 0.18, type: "sawtooth", gain: 0.13, release: 0.08 });
  },

  powerUp: () => {
    [330, 495, 742.5, 1113.75].forEach((freq, index) =>
      tone({ freq, duration: 0.075, type: "triangle", gain: 0.09, delay: index * 0.055, release: 0.05 }),
    );
  },

  rain: () => {
    noiseBurst(0.65, 0.045, 1800);
    noiseBurst(0.28, 0.018, 5200);
  },

  wind: () => {
    noiseBurst(0.72, 0.04, 760);
    tone({ freq: 180, glideTo: 260, duration: 0.5, type: "sine", gain: 0.045, release: 0.32 });
  },

  storm: () => {
    noiseBurst(0.72, 0.055, 1200);
    tone({ freq: 86, glideTo: 48, duration: 0.42, type: "sawtooth", gain: 0.075, release: 0.28 });
    tone({ freq: 172, glideTo: 92, duration: 0.28, type: "triangle", gain: 0.05, delay: 0.08, release: 0.18 });
  },
} as const;

export type SoundName = keyof typeof sounds;

function playTypeNote(theme: SoundThemeName, step = 0) {
  if (theme === "pixel") {
    tone({ freq: typeFreq(step, 1.15), duration: 0.018, type: "square", gain: 0.06, release: 0.008 });
    return;
  }

  if (theme === "clearChime") {
    tone({ freq: typeFreq(step, 1.05), duration: 0.045, type: "sine", gain: 0.055, release: 0.03 });
    return;
  }

  tone({ freq: typeFreq(step, 0.72), duration: 0.032, type: "triangle", gain: 0.07, release: 0.018 });
}

function playSoftFeedback(name: SoundName, step?: number) {
  switch (name) {
    case "click":
      tone({ freq: 340, glideTo: 520, duration: 0.08, type: "sine", gain: 0.18, release: 0.05 });
      noiseBurst(0.035, 0.025, 900);
      break;
    case "tap":
      tone({ freq: 760, duration: 0.035, type: "triangle", gain: 0.1, release: 0.02 });
      break;
    case "pop":
      tone({ freq: 170, glideTo: 380, duration: 0.075, type: "sine", gain: 0.14, release: 0.04 });
      tone({ freq: 980, duration: 0.04, type: "sine", gain: 0.075, delay: 0.052, release: 0.025 });
      break;
    case "hover":
      tone({ freq: 1120, duration: 0.055, type: "sine", gain: 0.055, release: 0.04 });
      break;
    case "toggleOn":
      tone({ freq: 360, duration: 0.07, type: "triangle", gain: 0.13 });
      tone({ freq: 720, duration: 0.13, type: "triangle", gain: 0.14, delay: 0.055, release: 0.1 });
      break;
    case "toggleOff":
      tone({ freq: 640, duration: 0.065, type: "triangle", gain: 0.12 });
      tone({ freq: 300, duration: 0.14, type: "triangle", gain: 0.12, delay: 0.055, release: 0.1 });
      break;
    case "unlock":
      noiseBurst(0.06, 0.05, 3400);
      tone({ freq: 580, duration: 0.06, type: "triangle", gain: 0.12, delay: 0.035 });
      tone({ freq: 1040, duration: 0.16, type: "sine", gain: 0.13, delay: 0.09, release: 0.13 });
      break;
    case "success":
      [392, 523.25, 659.25, 880].forEach((freq, index) =>
        tone({ freq, duration: 0.13, type: "triangle", gain: 0.13, delay: index * 0.075, release: 0.1 }),
      );
      break;
    case "error":
      tone({ freq: 880, glideTo: 740, duration: 0.075, type: "triangle", gain: 0.095, release: 0.045 });
      tone({ freq: 622.25, duration: 0.1, type: "triangle", gain: 0.085, delay: 0.075, release: 0.065 });
      noiseBurst(0.035, 0.012, 4200);
      break;
    case "notify":
      tone({ freq: 880, duration: 0.11, type: "sine", gain: 0.12, release: 0.08 });
      tone({ freq: 1320, duration: 0.16, type: "sine", gain: 0.09, delay: 0.12, release: 0.12 });
      break;
    case "message":
      tone({ freq: 620, duration: 0.055, type: "triangle", gain: 0.12 });
      tone({ freq: 780, duration: 0.055, type: "triangle", gain: 0.1, delay: 0.075 });
      tone({ freq: 620, duration: 0.08, type: "triangle", gain: 0.08, delay: 0.15 });
      break;
    case "open":
      tone({ freq: 300, glideTo: 760, duration: 0.2, type: "sine", gain: 0.14, release: 0.14 });
      noiseBurst(0.12, 0.035, 3200);
      break;
    case "close":
      tone({ freq: 760, glideTo: 260, duration: 0.2, type: "sine", gain: 0.14, release: 0.13 });
      break;
    case "whoosh":
      noiseBurst(0.34, 0.09, 1100);
      break;
    case "bubble":
      [420, 620].forEach((freq, index) =>
        tone({ freq, glideTo: freq * 1.8, duration: 0.055 + index * 0.018, type: "sine", gain: 0.038 - index * 0.008, attack: 0.006, delay: index * 0.05, release: 0.034 }),
      );
      break;
    case "coin":
      tone({ freq: 1318.51, duration: 0.04, type: "triangle", gain: 0.13, release: 0.02 });
      tone({ freq: 2637.02, duration: 0.15, type: "sine", gain: 0.085, delay: 0.034, release: 0.11 });
      break;
    case "levelUp":
      [392, 523.25, 659.25, 987.77, 1318.51].forEach((freq, index) =>
        tone({ freq, duration: 0.09, type: "triangle", gain: 0.095, delay: index * 0.055, release: 0.06 }),
      );
      break;
    case "chime":
      [880, 1174.66, 1568, 2093].forEach((freq, index) =>
        tone({ freq, duration: 0.82, type: "sine", gain: 0.06, delay: index * 0.07, release: 0.68 }),
      );
      break;
    case "drop":
      tone({ freq: 940, glideTo: 150, duration: 0.34, type: "triangle", gain: 0.13, release: 0.19 });
      noiseBurst(0.06, 0.018, 850);
      break;
    case "castRod":
      noiseBurst(0.035, 0.028, 2600, 0.02);
      tone({ freq: 210, glideTo: 92, duration: 0.16, type: "sine", gain: 0.075, delay: 0.055, release: 0.11 });
      noiseBurst(0.075, 0.09, 900, 0.06);
      tone({ freq: 760, duration: 0.035, type: "sine", gain: 0.03, delay: 0.13, release: 0.025 });
      tone({ freq: 500, glideTo: 250, duration: 0.11, type: "sine", gain: 0.032, delay: 0.18, release: 0.08 });
      noiseBurst(0.24, 0.032, 760, 0.18);
      break;
    case "gachaReveal":
      tone({ freq: 392, glideTo: 1174.66, duration: 0.26, type: "sine", gain: 0.048, attack: 0.012, delay: 0.01, release: 0.17 });
      [1174.66, 1568, 2093].forEach((freq, index) =>
        tone({ freq, duration: 0.11 + index * 0.035, type: "sine", gain: 0.04 - index * 0.004, attack: 0.01, delay: 0.21 + index * 0.055, release: 0.085 }),
      );
      tone({ freq: 2637.02, duration: 0.24, type: "sine", gain: 0.027, attack: 0.012, delay: 0.38, release: 0.2 });
      tone({ freq: 1318.51, duration: 0.4, type: "sine", gain: 0.025, attack: 0.015, delay: 0.42, release: 0.32 });
      break;
    case "victory":
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1318.51].forEach((freq, index) =>
        tone({ freq, duration: index < 4 ? 0.09 : 0.16, type: "triangle", gain: 0.095, delay: index * 0.06, release: 0.08 }),
      );
      break;
    case "settlement":
      [523.25, 659.25, 783.99, 987.77].forEach((freq, index) =>
        tone({ freq, duration: 0.055, type: "triangle", gain: 0.08, delay: index * 0.075, release: 0.03 }),
      );
      noiseBurst(0.04, 0.015, 1800, 0.3);
      tone({ freq: 392, duration: 0.08, type: "triangle", gain: 0.065, delay: 0.32, release: 0.04 });
      tone({ freq: 1046.5, duration: 0.22, type: "sine", gain: 0.075, delay: 0.38, release: 0.16 });
      tone({ freq: 1568, duration: 0.26, type: "sine", gain: 0.045, delay: 0.42, release: 0.2 });
      break;
    case "portal":
      noiseBurst(0.32, 0.04, 2600);
      tone({ freq: 110, glideTo: 880, duration: 0.38, type: "sine", gain: 0.085, release: 0.22 });
      tone({ freq: 1760, glideTo: 660, duration: 0.28, type: "sine", gain: 0.045, delay: 0.1, release: 0.17 });
      break;
    case "damage":
      noiseBurst(0.08, 0.06, 1300);
      tone({ freq: 180, glideTo: 72, duration: 0.16, type: "sawtooth", gain: 0.105, release: 0.075 });
      break;
    case "powerUp":
      [330, 495, 742.5, 1113.75].forEach((freq, index) =>
        tone({ freq, duration: 0.07, type: "triangle", gain: 0.075, delay: index * 0.05, release: 0.045 }),
      );
      break;
    case "slider":
      noiseBurst(0.04, 0.008, 1500);
      tone({ freq: 500, glideTo: 580, duration: 0.06, type: "triangle", gain: 0.032, release: 0.035 });
      break;
    case "snap":
      tone({ freq: 760, duration: 0.04, type: "triangle", gain: 0.105, release: 0.018 });
      tone({ freq: 1140, duration: 0.075, type: "sine", gain: 0.07, delay: 0.035, release: 0.055 });
      break;
    case "check":
      tone({ freq: 480, duration: 0.06, type: "triangle", gain: 0.095, release: 0.035 });
      tone({ freq: 840, duration: 0.12, type: "triangle", gain: 0.1, delay: 0.05, release: 0.09 });
      break;
    case "uncheck":
      tone({ freq: 780, glideTo: 360, duration: 0.13, type: "triangle", gain: 0.09, release: 0.08 });
      break;
    case "radio":
      tone({ freq: 660, duration: 0.085, type: "sine", gain: 0.08, release: 0.06 });
      tone({ freq: 990, duration: 0.075, type: "sine", gain: 0.055, delay: 0.04, release: 0.05 });
      break;
    case "rate": {
      const sparkle = 760 + Math.max(0, Math.min(step ?? 3, 5)) * 72;
      tone({ freq: sparkle, duration: 0.045, type: "sine", gain: 0.075, release: 0.03 });
      tone({ freq: sparkle * 1.5, duration: 0.14, type: "sine", gain: 0.06, delay: 0.035, release: 0.11 });
      break;
    }
    case "tab":
      tone({ freq: 520, duration: 0.045, type: "triangle", gain: 0.08, release: 0.025 });
      tone({ freq: 700, duration: 0.07, type: "triangle", gain: 0.075, delay: 0.04, release: 0.045 });
      break;
    case "menuOpen":
      tone({ freq: 300, glideTo: 680, duration: 0.18, type: "sine", gain: 0.095, release: 0.13 });
      noiseBurst(0.09, 0.024, 3000);
      break;
    case "select":
      tone({ freq: 620, duration: 0.04, type: "triangle", gain: 0.09, release: 0.02 });
      tone({ freq: 930, duration: 0.085, type: "triangle", gain: 0.075, delay: 0.04, release: 0.06 });
      break;
    case "type":
      playTypeNote("softFeedback", step);
      break;
    case "rain":
      sounds.rain();
      break;
    case "wind":
      sounds.wind();
      break;
    case "storm":
      sounds.storm();
      break;
  }
}

function playPixel(name: SoundName, step?: number) {
  switch (name) {
    case "click":
      tone({ freq: 720, duration: 0.026, type: "square", gain: 0.14, release: 0.012 });
      tone({ freq: 360, duration: 0.018, type: "square", gain: 0.06, delay: 0.012, release: 0.009 });
      break;
    case "tap":
      tone({ freq: 1240, duration: 0.018, type: "square", gain: 0.08, release: 0.008 });
      break;
    case "pop":
      tone({ freq: 220, duration: 0.022, type: "square", gain: 0.09, release: 0.01 });
      tone({ freq: 880, duration: 0.026, type: "square", gain: 0.085, delay: 0.025, release: 0.012 });
      break;
    case "hover":
      tone({ freq: 1840, duration: 0.014, type: "square", gain: 0.045, release: 0.006 });
      break;
    case "toggleOn":
      tone({ freq: 520, duration: 0.036, type: "square", gain: 0.095, release: 0.014 });
      tone({ freq: 1040, duration: 0.052, type: "square", gain: 0.105, delay: 0.038, release: 0.025 });
      break;
    case "toggleOff":
      tone({ freq: 1040, duration: 0.032, type: "square", gain: 0.09, release: 0.014 });
      tone({ freq: 390, duration: 0.06, type: "square", gain: 0.08, delay: 0.036, release: 0.03 });
      break;
    case "unlock":
      noiseBurst(0.045, 0.055, 3600);
      tone({ freq: 660, duration: 0.025, type: "square", gain: 0.08, delay: 0.035, release: 0.012 });
      tone({ freq: 1560, duration: 0.07, type: "square", gain: 0.1, delay: 0.07, release: 0.035 });
      break;
    case "success":
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) =>
        tone({ freq, duration: 0.04, type: "square", gain: 0.085, delay: index * 0.045, release: 0.018 }),
      );
      break;
    case "error":
      tone({ freq: 1046.5, duration: 0.028, type: "square", gain: 0.075, release: 0.012 });
      tone({ freq: 783.99, duration: 0.032, type: "square", gain: 0.07, delay: 0.045, release: 0.014 });
      tone({ freq: 622.25, duration: 0.04, type: "square", gain: 0.06, delay: 0.09, release: 0.018 });
      break;
    case "notify":
      tone({ freq: 1175, duration: 0.038, type: "square", gain: 0.085, release: 0.018 });
      tone({ freq: 1175, duration: 0.06, type: "square", gain: 0.075, delay: 0.13, release: 0.03 });
      break;
    case "message":
      tone({ freq: 740, duration: 0.022, type: "square", gain: 0.075, release: 0.01 });
      tone({ freq: 980, duration: 0.022, type: "square", gain: 0.07, delay: 0.045, release: 0.01 });
      tone({ freq: 740, duration: 0.03, type: "square", gain: 0.065, delay: 0.09, release: 0.014 });
      break;
    case "open":
      tone({ freq: 330, glideTo: 1320, duration: 0.14, type: "square", gain: 0.09, release: 0.05 });
      noiseBurst(0.08, 0.025, 2800);
      break;
    case "close":
      tone({ freq: 1320, glideTo: 260, duration: 0.13, type: "square", gain: 0.085, release: 0.05 });
      break;
    case "whoosh":
      noiseBurst(0.24, 0.085, 1800);
      break;
    case "bubble":
      tone({ freq: 960, duration: 0.014, type: "square", gain: 0.035, attack: 0.003, release: 0.006 });
      tone({ freq: 1280, duration: 0.018, type: "square", gain: 0.025, attack: 0.003, delay: 0.026, release: 0.008 });
      break;
    case "coin":
      tone({ freq: 1568, duration: 0.022, type: "square", gain: 0.1, release: 0.009 });
      tone({ freq: 3136, duration: 0.065, type: "square", gain: 0.075, delay: 0.025, release: 0.026 });
      break;
    case "levelUp":
      [330, 440, 660, 880, 1320].forEach((freq, index) =>
        tone({ freq, duration: 0.024, type: "square", gain: 0.07, delay: index * 0.03, release: 0.01 }),
      );
      break;
    case "chime":
      [1046.5, 1568, 2093].forEach((freq, index) =>
        tone({ freq, duration: 0.09, type: "square", gain: 0.045, delay: index * 0.11, release: 0.05 }),
      );
      break;
    case "drop":
      tone({ freq: 1320, glideTo: 110, duration: 0.16, type: "square", gain: 0.08, release: 0.06 });
      tone({ freq: 90, duration: 0.028, type: "square", gain: 0.055, delay: 0.13, release: 0.012 });
      break;
    case "castRod":
      noiseBurst(0.025, 0.03, 2200, 0.018);
      tone({ freq: 180, duration: 0.045, type: "square", gain: 0.05, delay: 0.052, release: 0.02 });
      noiseBurst(0.06, 0.078, 880, 0.055);
      tone({ freq: 720, duration: 0.018, type: "square", gain: 0.032, delay: 0.12, release: 0.008 });
      tone({ freq: 340, duration: 0.035, type: "square", gain: 0.026, delay: 0.18, release: 0.015 });
      break;
    case "gachaReveal":
      [740, 1040, 1480, 2093].forEach((freq, index) =>
        tone({ freq, duration: 0.03 + index * 0.008, type: "square", gain: 0.045 - index * 0.004, attack: 0.004, delay: 0.035 + index * 0.05, release: 0.014 }),
      );
      tone({ freq: 2637.02, duration: 0.08, type: "triangle", gain: 0.032, attack: 0.006, delay: 0.28, release: 0.04 });
      tone({ freq: 1760, duration: 0.13, type: "triangle", gain: 0.026, attack: 0.006, delay: 0.34, release: 0.065 });
      break;
    case "victory":
      [392, 523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, index) =>
        tone({ freq, duration: index < 4 ? 0.026 : 0.045, type: "square", gain: 0.068, delay: index * 0.032, release: 0.014 }),
      );
      break;
    case "settlement":
      [520, 620, 740, 880, 1040].forEach((freq, index) =>
        tone({ freq, duration: 0.02, type: "square", gain: 0.062, delay: index * 0.04, release: 0.009 }),
      );
      noiseBurst(0.035, 0.018, 1800, 0.22);
      tone({ freq: 392, duration: 0.03, type: "square", gain: 0.055, delay: 0.24, release: 0.012 });
      tone({ freq: 1568, duration: 0.07, type: "square", gain: 0.06, delay: 0.29, release: 0.03 });
      tone({ freq: 2093, duration: 0.09, type: "square", gain: 0.042, delay: 0.34, release: 0.04 });
      break;
    case "portal":
      noiseBurst(0.14, 0.04, 2200);
      tone({ freq: 160, glideTo: 2200, duration: 0.16, type: "square", gain: 0.07, release: 0.05 });
      tone({ freq: 2200, duration: 0.035, type: "square", gain: 0.05, delay: 0.12, release: 0.015 });
      break;
    case "damage":
      noiseBurst(0.05, 0.055, 1300);
      tone({ freq: 180, duration: 0.03, type: "square", gain: 0.09, release: 0.012 });
      tone({ freq: 72, duration: 0.055, type: "square", gain: 0.075, delay: 0.025, release: 0.022 });
      break;
    case "powerUp":
      [440, 660, 990, 1485].forEach((freq, index) =>
        tone({ freq, duration: 0.022, type: "square", gain: 0.065, delay: index * 0.026, release: 0.01 }),
      );
      break;
    case "slider":
      tone({ freq: 620, duration: 0.014, type: "square", gain: 0.025, release: 0.006 });
      break;
    case "snap":
      tone({ freq: 880, duration: 0.018, type: "square", gain: 0.095, release: 0.008 });
      tone({ freq: 1760, duration: 0.035, type: "square", gain: 0.075, delay: 0.018, release: 0.014 });
      break;
    case "check":
      tone({ freq: 660, duration: 0.025, type: "square", gain: 0.08, release: 0.01 });
      tone({ freq: 1320, duration: 0.055, type: "square", gain: 0.085, delay: 0.03, release: 0.024 });
      break;
    case "uncheck":
      tone({ freq: 1320, duration: 0.022, type: "square", gain: 0.075, release: 0.01 });
      tone({ freq: 520, duration: 0.05, type: "square", gain: 0.065, delay: 0.028, release: 0.022 });
      break;
    case "radio":
      tone({ freq: 980, duration: 0.028, type: "square", gain: 0.075, release: 0.012 });
      tone({ freq: 1220, duration: 0.028, type: "square", gain: 0.055, delay: 0.026, release: 0.012 });
      break;
    case "rate": {
      const sparkle = 980 + Math.max(0, Math.min(step ?? 3, 5)) * 90;
      tone({ freq: sparkle, duration: 0.018, type: "square", gain: 0.065, release: 0.008 });
      tone({ freq: sparkle * 2, duration: 0.036, type: "square", gain: 0.052, delay: 0.024, release: 0.015 });
      break;
    }
    case "tab":
      tone({ freq: 740, duration: 0.02, type: "square", gain: 0.07, release: 0.009 });
      tone({ freq: 1040, duration: 0.024, type: "square", gain: 0.065, delay: 0.028, release: 0.011 });
      break;
    case "menuOpen":
      [420, 620, 880].forEach((freq, index) =>
        tone({ freq, duration: 0.025, type: "square", gain: 0.065, delay: index * 0.028, release: 0.011 }),
      );
      noiseBurst(0.055, 0.024, 2600);
      break;
    case "select":
      tone({ freq: 1040, duration: 0.032, type: "square", gain: 0.085, release: 0.014 });
      tone({ freq: 1560, duration: 0.04, type: "square", gain: 0.06, delay: 0.028, release: 0.018 });
      break;
    case "type":
      playTypeNote("pixel", step);
      break;
    case "rain":
      noiseBurst(0.48, 0.045, 1800);
      tone({ freq: 1800, duration: 0.018, type: "square", gain: 0.035, release: 0.008 });
      tone({ freq: 2400, duration: 0.018, type: "square", gain: 0.03, delay: 0.075, release: 0.008 });
      break;
    case "wind":
      noiseBurst(0.5, 0.035, 760);
      tone({ freq: 240, duration: 0.04, type: "square", gain: 0.035, release: 0.018 });
      tone({ freq: 320, duration: 0.05, type: "square", gain: 0.032, delay: 0.11, release: 0.02 });
      break;
    case "storm":
      noiseBurst(0.55, 0.05, 900);
      tone({ freq: 90, duration: 0.08, type: "square", gain: 0.07, release: 0.04 });
      tone({ freq: 55, duration: 0.09, type: "square", gain: 0.055, delay: 0.07, release: 0.05 });
      break;
  }
}

function playClearChime(name: SoundName, step?: number) {
  switch (name) {
    case "click":
      tone({ freq: 554.37, duration: 0.09, type: "sine", gain: 0.12, release: 0.07 });
      tone({ freq: 831.61, duration: 0.16, type: "sine", gain: 0.07, delay: 0.035, release: 0.13 });
      break;
    case "tap":
      tone({ freq: 1046.5, duration: 0.055, type: "sine", gain: 0.075, release: 0.04 });
      break;
    case "pop":
      tone({ freq: 246.94, glideTo: 739.99, duration: 0.105, type: "sine", gain: 0.08, release: 0.06 });
      tone({ freq: 1479.98, duration: 0.1, type: "sine", gain: 0.045, delay: 0.075, release: 0.075 });
      break;
    case "hover":
      tone({ freq: 1396.91, duration: 0.07, type: "sine", gain: 0.045, release: 0.055 });
      break;
    case "toggleOn":
      tone({ freq: 493.88, duration: 0.09, type: "sine", gain: 0.09, release: 0.07 });
      tone({ freq: 987.77, duration: 0.18, type: "sine", gain: 0.1, delay: 0.075, release: 0.14 });
      break;
    case "toggleOff":
      tone({ freq: 987.77, duration: 0.08, type: "sine", gain: 0.085, release: 0.06 });
      tone({ freq: 369.99, duration: 0.17, type: "sine", gain: 0.075, delay: 0.07, release: 0.13 });
      break;
    case "unlock":
      noiseBurst(0.06, 0.035, 4600);
      tone({ freq: 739.99, duration: 0.07, type: "sine", gain: 0.09, delay: 0.045, release: 0.05 });
      tone({ freq: 1479.98, duration: 0.24, type: "sine", gain: 0.095, delay: 0.105, release: 0.2 });
      break;
    case "success":
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) =>
        tone({ freq, duration: 0.2, type: "sine", gain: 0.085, delay: index * 0.095, release: 0.16 }),
      );
      break;
    case "error":
      tone({ freq: 987.77, glideTo: 830.61, duration: 0.12, type: "sine", gain: 0.075, release: 0.08 });
      tone({ freq: 659.25, duration: 0.16, type: "sine", gain: 0.065, delay: 0.09, release: 0.11 });
      break;
    case "notify":
      tone({ freq: 880, duration: 0.14, type: "sine", gain: 0.09, release: 0.11 });
      tone({ freq: 1318.51, duration: 0.22, type: "sine", gain: 0.08, delay: 0.15, release: 0.18 });
      break;
    case "message":
      tone({ freq: 587.33, duration: 0.075, type: "sine", gain: 0.08, release: 0.055 });
      tone({ freq: 739.99, duration: 0.075, type: "sine", gain: 0.075, delay: 0.08, release: 0.055 });
      tone({ freq: 587.33, duration: 0.12, type: "sine", gain: 0.065, delay: 0.16, release: 0.1 });
      break;
    case "open":
      tone({ freq: 349.23, glideTo: 1046.5, duration: 0.28, type: "sine", gain: 0.095, release: 0.2 });
      noiseBurst(0.12, 0.025, 5200);
      break;
    case "close":
      tone({ freq: 1046.5, glideTo: 329.63, duration: 0.25, type: "sine", gain: 0.09, release: 0.18 });
      break;
    case "whoosh":
      noiseBurst(0.36, 0.07, 2600);
      break;
    case "bubble":
      [880, 1174.66].forEach((freq, index) =>
        tone({ freq, duration: 0.075 + index * 0.035, type: "sine", gain: 0.03 - index * 0.006, attack: 0.01, delay: index * 0.06, release: 0.055 }),
      );
      break;
    case "coin":
      tone({ freq: 1568, duration: 0.06, type: "sine", gain: 0.085, release: 0.035 });
      tone({ freq: 3136, duration: 0.2, type: "sine", gain: 0.055, delay: 0.045, release: 0.16 });
      break;
    case "levelUp":
      [392, 587.33, 783.99, 1174.66, 1568].forEach((freq, index) =>
        tone({ freq, duration: 0.13, type: "sine", gain: 0.055, delay: index * 0.065, release: 0.1 }),
      );
      break;
    case "chime":
      [739.99, 987.77, 1318.51, 1975.53].forEach((freq, index) =>
        tone({ freq, duration: 1.05, type: "sine", gain: 0.045, delay: index * 0.09, release: 0.92 }),
      );
      break;
    case "drop":
      tone({ freq: 1046.5, glideTo: 196, duration: 0.42, type: "sine", gain: 0.075, release: 0.24 });
      noiseBurst(0.06, 0.014, 1100);
      break;
    case "castRod":
      noiseBurst(0.035, 0.02, 3200, 0.02);
      tone({ freq: 246.94, glideTo: 123.47, duration: 0.18, type: "sine", gain: 0.052, delay: 0.06, release: 0.13 });
      noiseBurst(0.075, 0.065, 1100, 0.065);
      tone({ freq: 987.77, duration: 0.06, type: "sine", gain: 0.026, delay: 0.14, release: 0.04 });
      tone({ freq: 587.33, glideTo: 293.66, duration: 0.14, type: "sine", gain: 0.028, delay: 0.2, release: 0.1 });
      noiseBurst(0.26, 0.025, 1200, 0.22);
      break;
    case "gachaReveal":
      tone({ freq: 523.25, glideTo: 1568, duration: 0.32, type: "sine", gain: 0.036, attack: 0.014, delay: 0.02, release: 0.22 });
      [1568, 1975.53, 2637.02, 3136].forEach((freq, index) =>
        tone({ freq, duration: 0.16 + index * 0.035, type: "sine", gain: 0.032 - index * 0.0035, attack: 0.012, delay: 0.25 + index * 0.065, release: 0.14 }),
      );
      tone({ freq: 2093, duration: 0.46, type: "sine", gain: 0.024, attack: 0.018, delay: 0.52, release: 0.38 });
      break;
    case "victory":
      [523.25, 659.25, 783.99, 1046.5, 1318.51, 1568].forEach((freq, index) =>
        tone({ freq, duration: index < 4 ? 0.13 : 0.24, type: "sine", gain: 0.052, delay: index * 0.075, release: 0.15 }),
      );
      break;
    case "settlement":
      [659.25, 783.99, 987.77, 1174.66].forEach((freq, index) =>
        tone({ freq, duration: 0.075, type: "sine", gain: 0.052, delay: index * 0.09, release: 0.05 }),
      );
      noiseBurst(0.035, 0.01, 2600, 0.35);
      tone({ freq: 523.25, duration: 0.12, type: "sine", gain: 0.045, delay: 0.37, release: 0.08 });
      tone({ freq: 1318.51, duration: 0.34, type: "sine", gain: 0.055, delay: 0.45, release: 0.28 });
      tone({ freq: 1975.53, duration: 0.42, type: "sine", gain: 0.032, delay: 0.5, release: 0.36 });
      break;
    case "portal":
      noiseBurst(0.28, 0.02, 4200);
      tone({ freq: 196, glideTo: 1568, duration: 0.46, type: "sine", gain: 0.055, release: 0.3 });
      tone({ freq: 2349.32, glideTo: 880, duration: 0.32, type: "sine", gain: 0.032, delay: 0.16, release: 0.22 });
      break;
    case "damage":
      noiseBurst(0.07, 0.04, 1500);
      tone({ freq: 246.94, glideTo: 98, duration: 0.18, type: "triangle", gain: 0.065, release: 0.1 });
      break;
    case "powerUp":
      [493.88, 739.99, 1108.73, 1661.22].forEach((freq, index) =>
        tone({ freq, duration: 0.105, type: "sine", gain: 0.048, delay: index * 0.06, release: 0.085 }),
      );
      break;
    case "slider":
      noiseBurst(0.04, 0.006, 3200);
      tone({ freq: 587.33, glideTo: 659.25, duration: 0.07, type: "sine", gain: 0.026, release: 0.045 });
      break;
    case "snap":
      tone({ freq: 987.77, duration: 0.05, type: "sine", gain: 0.08, release: 0.03 });
      tone({ freq: 1479.98, duration: 0.12, type: "sine", gain: 0.06, delay: 0.04, release: 0.09 });
      break;
    case "check":
      tone({ freq: 587.33, duration: 0.07, type: "sine", gain: 0.075, release: 0.05 });
      tone({ freq: 987.77, duration: 0.16, type: "sine", gain: 0.08, delay: 0.06, release: 0.12 });
      break;
    case "uncheck":
      tone({ freq: 987.77, glideTo: 440, duration: 0.17, type: "sine", gain: 0.07, release: 0.12 });
      break;
    case "radio":
      tone({ freq: 739.99, duration: 0.09, type: "sine", gain: 0.065, release: 0.07 });
      tone({ freq: 1108.73, duration: 0.11, type: "sine", gain: 0.045, delay: 0.05, release: 0.09 });
      break;
    case "rate": {
      const sparkle = 1046.5 + Math.max(0, Math.min(step ?? 3, 5)) * 98;
      tone({ freq: sparkle, duration: 0.075, type: "sine", gain: 0.055, release: 0.055 });
      tone({ freq: sparkle * 1.5, duration: 0.22, type: "sine", gain: 0.045, delay: 0.055, release: 0.18 });
      break;
    }
    case "tab":
      tone({ freq: 659.25, duration: 0.08, type: "sine", gain: 0.065, release: 0.055 });
      tone({ freq: 880, duration: 0.1, type: "sine", gain: 0.06, delay: 0.065, release: 0.075 });
      break;
    case "menuOpen":
      tone({ freq: 392, glideTo: 1174.66, duration: 0.24, type: "sine", gain: 0.075, release: 0.18 });
      noiseBurst(0.1, 0.018, 5200);
      break;
    case "select":
      tone({ freq: 880, duration: 0.055, type: "sine", gain: 0.075, release: 0.035 });
      tone({ freq: 1318.51, duration: 0.12, type: "sine", gain: 0.06, delay: 0.05, release: 0.09 });
      break;
    case "type":
      playTypeNote("clearChime", step);
      break;
    case "rain":
      noiseBurst(0.7, 0.032, 3600);
      tone({ freq: 1174.66, duration: 0.18, type: "sine", gain: 0.04, release: 0.14 });
      tone({ freq: 1568, duration: 0.22, type: "sine", gain: 0.032, delay: 0.12, release: 0.18 });
      break;
    case "wind":
      noiseBurst(0.76, 0.026, 1600);
      tone({ freq: 392, glideTo: 587.33, duration: 0.48, type: "sine", gain: 0.042, release: 0.34 });
      break;
    case "storm":
      noiseBurst(0.72, 0.04, 1400);
      tone({ freq: 146.83, glideTo: 98, duration: 0.45, type: "triangle", gain: 0.065, release: 0.3 });
      tone({ freq: 880, duration: 0.1, type: "sine", gain: 0.035, delay: 0.08, release: 0.08 });
      break;
  }
}

export const soundThemes = {
  softFeedback: { play: playSoftFeedback },
  pixel: { play: playPixel },
  clearChime: { play: playClearChime },
} as const;

export type SoundThemeName = keyof typeof soundThemes;

export function sourceForTheme(theme: SoundThemeName): string {
  const fn = soundThemes[theme].play.toString();
  return `// Game UI sound theme — ${theme}
const ctx = new (window.AudioContext || window.webkitAudioContext)();

function tone(o) {
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + o.duration);
  const peak = o.gain ?? 0.18, a = o.attack ?? 0.005, r = o.release ?? 0.08;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.linearRampToValueAtTime(peak, t0 + o.duration - r);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + o.duration + 0.02);
}

function noiseBurst(duration, gain = 0.08, lp = 2000, delay = 0) {
  const t0 = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = ctx.createGain();
  const attack = Math.min(0.012, duration * 0.35);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0); src.stop(t0 + duration);
}

export const playThemeSound = ${fn};
`;
}

/** Source snippet used in the "Copy code" action — single sound playable standalone. */
function playFunctionName(name: SoundName) {
  return `play${name[0].toUpperCase()}${name.slice(1)}`;
}

export function sourceForNames(names: readonly SoundName[]): string {
  const uniqueNames = Array.from(new Set(names));
  const fns = uniqueNames
    .map((name) => `export const ${playFunctionName(name)} = ${sounds[name].toString()};`)
    .join("\n\n");

  return `// Mochi UI Sounds — ${uniqueNames.join(", ")}
const ctx = new (window.AudioContext || window.webkitAudioContext)();

function tone(o) {
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + o.duration);
  const peak = o.gain ?? 0.18, a = o.attack ?? 0.005, r = o.release ?? 0.08;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.linearRampToValueAtTime(peak, t0 + o.duration - r);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + o.duration + 0.02);
}

function noiseBurst(duration, gain = 0.08, lp = 2000, delay = 0) {
  const t0 = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = ctx.createGain();
  const attack = Math.min(0.012, duration * 0.35);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0); src.stop(t0 + duration);
}

${fns}
`;
}

/** Source snippet used in the "Copy code" action — single sound playable standalone. */
export function sourceFor(name: SoundName): string {
  return sourceForNames([name]);
}

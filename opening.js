(() => {
  "use strict";

  window.addEventListener("error", (event) => {
    document.body.dataset.runtimeError = `${event.message} @ ${event.lineno}:${event.colno}`;
  });

  window.addEventListener("unhandledrejection", (event) => {
    document.body.dataset.runtimeError = String(event.reason);
  });

  const canvas = document.getElementById("opening-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const gameTitle = document.getElementById("title-interface");
  const skipButton = document.getElementById("skip-intro");
  const replayButton = document.getElementById("replay-intro");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(window.location.search);
  const saveMeta = document.querySelector(".save-meta");

  function readSaveSummary() {
    try {
      const raw = window.localStorage.getItem("eidji_demo_save_v1");
      if (!raw) return "尚无存档";
      const saved = JSON.parse(raw);
      if (saved.checkpoint === "prologue") return "本地存档 · 序章问卷";
      const day = Number(saved.day);
      if (Number.isFinite(day) && day > 0) return `本地存档 · 第 ${day} 天`;
      return "已有本地存档";
    } catch {
      return "尚无存档";
    }
  }

  if (saveMeta) saveMeta.textContent = readSaveSummary();

  const START_DELAY = 500;
  const TRANSITION = 1000;
  const MOBILE_BREAKPOINT = 700;

  const SHOTS = [
    {
      image: 0,
      duration: 2300,
      transition: "whiteout",
      mood: "wind",
      grade: "cold",
      from: { scale: 1.22, x: 0.018, y: 0.022, rot: -0.6 },
      to: { scale: 1.02, x: -0.018, y: -0.012, rot: 0.04 },
      focus: { x: 0.52, y: 0.55 },
      mobileFocus: { x: 0.54, y: 0.55 },
    },
    {
      image: 1,
      duration: 2200,
      transition: "fall",
      mood: "snow",
      grade: "collapse",
      from: { scale: 1.02, x: -0.01, y: -0.014, rot: -0.05 },
      to: { scale: 1.18, x: 0.014, y: 0.072, rot: 0.62 },
      focus: { x: 0.52, y: 0.64 },
      mobileFocus: { x: 0.61, y: 0.64 },
    },
    {
      image: 2,
      duration: 2400,
      transition: "beam",
      mood: "ember",
      grade: "ruin",
      from: { scale: 1.14, x: 0.02, y: 0.012, rot: 0.42 },
      to: { scale: 1.015, x: -0.016, y: 0, rot: 0 },
      focus: { x: 0.68, y: 0.62 },
      mobileFocus: { x: 0.7, y: 0.62 },
    },
    {
      image: 3,
      duration: 2700,
      transition: "bloom",
      mood: "dust",
      grade: "beam",
      from: { scale: 1.13, x: 0.005, y: 0.024, rot: 0.05 },
      to: { scale: 1.018, x: -0.012, y: -0.012, rot: 0 },
      focus: { x: 0.42, y: 0.65 },
      mobileFocus: { x: 0.39, y: 0.67 },
    },
    {
      image: 4,
      duration: 2400,
      transition: "flock",
      mood: "dust",
      grade: "hall",
      from: { scale: 1.15, x: 0.008, y: 0.008, rot: -0.05 },
      to: { scale: 1.018, x: -0.014, y: -0.006, rot: -0.2 },
      focus: { x: 0.42, y: 0.65 },
      mobileFocus: { x: 0.37, y: 0.68 },
    },
    {
      image: 5,
      duration: 2500,
      transition: "iris",
      mood: "feather",
      grade: "doves",
      from: { scale: 1.02, x: -0.012, y: 0.004, rot: -0.3 },
      to: { scale: 1.16, x: 0.018, y: -0.012, rot: 0.18 },
      focus: { x: 0.4, y: 0.65 },
      mobileFocus: { x: 0.38, y: 0.62 },
    },
    {
      image: 6,
      duration: 2400,
      transition: "paper",
      mood: "gold",
      grade: "rebirth",
      from: { scale: 1.1, x: 0.018, y: 0.006, rot: 0.2 },
      to: { scale: 1.012, x: -0.006, y: -0.004, rot: 0 },
      focus: { x: 0.5, y: 0.54 },
      mobileFocus: { x: 0.48, y: 0.52 },
    },
    {
      image: 7,
      duration: 3000,
      transition: "final",
      mood: "gold",
      grade: "hope",
      from: { scale: 1.065, x: 0.002, y: 0.01, rot: 0.02 },
      to: { scale: 1.004, x: 0, y: -0.006, rot: 0 },
      focus: { x: 0.55, y: 0.55 },
      mobileFocus: { x: 0.38, y: 0.54 },
    },
  ];

  let cursor = START_DELAY;
  SHOTS.forEach((shot) => {
    shot.start = cursor;
    shot.end = cursor + shot.duration;
    cursor = shot.end;
  });
  const FINISH_TIME = cursor;

  // The same lead dove crosses every act. It is intentionally hidden during
  // the darkest beats, then reappears in the next shaft of light.
  const DOVE_KEYS = [
    { t: 520, x: 1.08, y: 0.14, size: 0.014, rot: 0.22, alpha: 0 },
    { t: 980, x: 0.82, y: 0.17, size: 0.02, rot: 0.14, alpha: 0.62 },
    { t: 1900, x: 0.34, y: 0.1, size: 0.034, rot: -0.1, alpha: 0.86 },
    { t: 2450, x: 0.08, y: 0.15, size: 0.038, rot: -0.28, alpha: 0.2 },
    { t: 2750, x: -0.08, y: 0.2, size: 0.04, rot: -0.4, alpha: 0 },
    { t: 4050, x: 1.12, y: 0.24, size: 0.018, rot: 0.3, alpha: 0 },
    { t: 4450, x: 0.86, y: 0.22, size: 0.024, rot: 0.2, alpha: 0.48 },
    { t: 5350, x: 0.56, y: 0.3, size: 0.035, rot: -0.08, alpha: 0.8 },
    { t: 6400, x: 0.3, y: 0.22, size: 0.047, rot: -0.32, alpha: 0.9 },
    { t: 7000, x: 0.18, y: 0.19, size: 0.052, rot: -0.46, alpha: 0 },
    { t: 7900, x: 1.08, y: 0.18, size: 0.02, rot: 0.16, alpha: 0 },
    { t: 8250, x: 0.86, y: 0.2, size: 0.027, rot: 0.08, alpha: 0.7 },
    { t: 9200, x: 0.55, y: 0.34, size: 0.045, rot: -0.18, alpha: 0.9 },
    { t: 10050, x: 0.34, y: 0.42, size: 0.056, rot: -0.36, alpha: 0.78 },
    { t: 10650, x: 0.23, y: 0.46, size: 0.06, rot: -0.54, alpha: 0 },
    { t: 11100, x: 1.12, y: 0.2, size: 0.018, rot: 0.24, alpha: 0 },
    { t: 11450, x: 0.9, y: 0.22, size: 0.026, rot: 0.16, alpha: 0.64 },
    { t: 12300, x: 0.58, y: 0.24, size: 0.058, rot: -0.06, alpha: 0.92 },
    { t: 13300, x: 0.24, y: 0.18, size: 0.095, rot: -0.36, alpha: 0.94 },
    { t: 14350, x: -0.08, y: 0.13, size: 0.12, rot: -0.62, alpha: 0 },
    { t: 15350, x: 1.08, y: 0.4, size: 0.02, rot: 0.2, alpha: 0 },
    { t: 15700, x: 0.82, y: 0.35, size: 0.032, rot: 0.04, alpha: 0.68 },
    { t: 16800, x: 0.45, y: 0.42, size: 0.062, rot: -0.18, alpha: 0.92 },
    { t: 17850, x: 0.08, y: 0.28, size: 0.09, rot: -0.5, alpha: 0 },
  ];

  const EMBER_KEYS = [
    { t: 2750, x: 0.65, y: 0.72, alpha: 0 },
    { t: 3250, x: 0.65, y: 0.71, alpha: 0.9 },
    { t: 4300, x: 0.69, y: 0.55, alpha: 0.72 },
    { t: 5200, x: 0.78, y: 0.42, alpha: 0.48 },
    { t: 6100, x: 0.8, y: 0.35, alpha: 0 },
  ];

  const state = {
    raf: 0,
    startTime: 0,
    running: false,
    finished: false,
    lastScene: -2,
    hasStarted: false,
    reviewing: false,
  };

  const images = SHOTS.map((shot) => {
    const image = new Image();
    image.decoding = "async";
    image.src = `assets/opening/${["01-whiteout.jpg", "02-collapse.jpg", "03-ruin.png", "04-child-light.jpg", "05-hall.jpg", "06-doves.jpg", "07-rebirth.jpg", "08-hope.png"][shot.image]}`;
    return image;
  });

  let vw = 0;
  let vh = 0;
  let dpr = 1;
  let isMobile = false;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  function smootherstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  }

  function easeInOutCubic(t) {
    const x = clamp(t, 0, 1);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function mod(value, span) {
    return ((value % span) + span) % span;
  }

  function makeRng(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resizeCanvas() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    isMobile = vw <= MOBILE_BREAKPOINT;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
  }

  function pathState(keys, time) {
    if (time <= keys[0].t) return { ...keys[0], visible: 0 };
    if (time >= keys[keys.length - 1].t) return { ...keys[keys.length - 1], visible: 0 };

    for (let i = 0; i < keys.length - 1; i += 1) {
      const a = keys[i];
      const b = keys[i + 1];
      if (time >= a.t && time <= b.t) {
        const raw = (time - a.t) / Math.max(1, b.t - a.t);
        const p = smoothstep(raw);
        return {
          x: lerp(a.x, b.x, p),
          y: lerp(a.y, b.y, p),
          size: lerp(a.size ?? b.size ?? 0.1, b.size ?? a.size ?? 0.1, p),
          rot: lerp(a.rot, b.rot, p),
          alpha: lerp(a.alpha, b.alpha, p),
          visible: raw,
        };
      }
    }
    return { ...keys[keys.length - 1], visible: 1 };
  }

  function getDove(time) {
    const dove = pathState(DOVE_KEYS, time);
    const flutter = Math.sin(time * 0.018) * 0.012;
    const drift = Math.sin(time * 0.0052) * 0.006;
    const baseX = isMobile ? 0.5 + (dove.x - 0.5) * 0.9 : dove.x;
    return {
      x: baseX,
      y: dove.y + flutter + drift,
      size: dove.size,
      rot: dove.rot + Math.sin(time * 0.0031) * 0.05,
      alpha: dove.alpha,
    };
  }

  function getEmber(time) {
    const ember = pathState(EMBER_KEYS, time);
    const baseX = isMobile ? 0.5 + (ember.x - 0.5) * 0.9 : ember.x;
    return { ...ember, x: baseX };
  }

  const FIELDS = {};

  function buildFields() {
    const random = makeRng(7351);

    FIELDS.snow = Array.from({ length: 138 }, () => {
      const depth = random();
      return {
        x: random(),
        y: random(),
        vx: 0.018 + random() * 0.072 + depth * 0.022,
        vy: 0.1 + random() * 0.2 + depth * 0.08,
        size: 0.65 + Math.pow(depth, 2.1) * 4.8,
        alpha: 0.14 + random() * 0.58 + depth * 0.12,
        phase: random() * Math.PI * 2,
        depth,
      };
    });

    FIELDS.wind = Array.from({ length: 72 }, () => ({
      x: random() * 1.35,
      y: random(),
      speed: 0.62 + random() * 1.25,
      len: 0.045 + random() * 0.21,
      width: 0.35 + random() * 1.8,
      alpha: 0.08 + random() * 0.36,
      phase: random() * Math.PI * 2,
    }));

    FIELDS.ash = Array.from({ length: 58 }, () => ({
      x: random(),
      y: random(),
      vx: -0.006 + random() * 0.028,
      vy: 0.012 + random() * 0.045,
      size: 0.7 + random() * 2.4,
      alpha: 0.12 + random() * 0.42,
      phase: random() * Math.PI * 2,
    }));

    FIELDS.ember = Array.from({ length: 52 }, () => ({
      x: 0.56 + random() * 0.32,
      y: random(),
      speed: 0.035 + random() * 0.07,
      sway: 0.006 + random() * 0.025,
      phase: random() * Math.PI * 2,
      size: 0.6 + random() * 1.7,
      alpha: 0.35 + random() * 0.55,
    }));

    FIELDS.dust = Array.from({ length: 100 }, () => ({
      x: 0.12 + random() * 0.78,
      y: random(),
      rise: 0.003 + random() * 0.012,
      sway: 0.003 + random() * 0.013,
      phase: random() * Math.PI * 2,
      size: 0.45 + random() * 1.5,
      alpha: 0.12 + random() * 0.42,
    }));

    FIELDS.feather = Array.from({ length: 64 }, () => ({
      x: random() * 1.2,
      y: random(),
      vx: 0.018 + random() * 0.055,
      vy: -0.003 + random() * 0.022,
      phase: random() * Math.PI * 2,
      size: 1.2 + random() * 4.2,
      alpha: 0.2 + random() * 0.5,
    }));

    FIELDS.gold = Array.from({ length: 105 }, () => ({
      x: random(),
      y: random(),
      rise: 0.004 + random() * 0.016,
      sway: 0.002 + random() * 0.011,
      phase: random() * Math.PI * 2,
      size: 0.5 + random() * 2.1,
      alpha: 0.08 + random() * 0.34,
    }));
  }

  const FLOCK = Array.from({ length: 46 }, (_, i) => {
    const random = makeRng(9901 + i * 71);
    return {
      angle: -1.45 + random() * 0.88,
      speed: 0.2 + random() * 0.42,
      delay: random() * 1.18,
      size: 4 + random() * 15,
      lift: (random() - 0.5) * 0.18,
      phase: random() * Math.PI * 2,
    };
  });

  const SKY_FLIGHTS = [
    {
      start: 560, end: 2550, from: { x: 1.14, y: 0.13 }, to: { x: -0.18, y: 0.25 },
      bend: -0.035, count: 5, size: 11, spread: 0.033, color: "rgba(39, 45, 46, 0.34)",
    },
    {
      start: 3320, end: 4870, from: { x: -0.12, y: 0.2 }, to: { x: 1.12, y: 0.09 },
      bend: -0.02, count: 4, size: 20, spread: 0.046, color: "rgba(53, 59, 60, 0.46)",
    },
    {
      start: 5020, end: 7040, from: { x: 0.73, y: 0.57 }, to: { x: 0.08, y: 0.13 },
      bend: -0.15, count: 9, size: 15, spread: 0.052, color: "rgba(255, 249, 234, 0.76)",
    },
    {
      start: 7480, end: 9940, from: { x: 0.91, y: 0.18 }, to: { x: 0.13, y: 0.44 },
      bend: 0.1, count: 4, size: 15, spread: 0.042, color: "rgba(255, 249, 234, 0.66)",
    },
    {
      start: 10130, end: 12430, from: { x: 0.1, y: 0.23 }, to: { x: 0.93, y: 0.34 },
      bend: -0.1, count: 7, size: 16, spread: 0.045, color: "rgba(255, 249, 234, 0.64)",
    },
    {
      start: 12250, end: 15150, from: { x: 0.42, y: 0.7 }, to: { x: 1.16, y: 0.07 },
      bend: -0.2, count: 14, size: 17, spread: 0.06, color: "rgba(255, 249, 234, 0.84)",
    },
    {
      start: 15150, end: 17800, from: { x: 1.08, y: 0.43 }, to: { x: 0.05, y: 0.18 },
      bend: -0.08, count: 8, size: 14, spread: 0.05, color: "rgba(88, 42, 33, 0.64)",
    },
    {
      start: 17120, end: 20280, from: { x: -0.12, y: 0.2 }, to: { x: 1.1, y: 0.09 },
      bend: -0.055, count: 3, size: 13, spread: 0.03, color: "rgba(72, 45, 33, 0.54)",
    },
  ];

  const PAPER_BITS = Array.from({ length: 34 }, (_, i) => {
    const random = makeRng(4821 + i * 113);
    return {
      x: 0.18 + random() * 0.68,
      y: 0.12 + random() * 0.76,
      size: 1.5 + random() * 6.5,
      drift: -0.03 + random() * 0.07,
      rise: 0.006 + random() * 0.022,
      phase: random() * Math.PI * 2,
      red: random() > 0.72,
    };
  });

  buildFields();
  function shotIndexAt(time) {
    for (let i = SHOTS.length - 1; i >= 0; i -= 1) {
      if (time >= SHOTS[i].start) return i;
    }
    return -1;
  }

  function cameraAt(shot, progress, time) {
    const eased = easeInOutCubic(progress);
    const from = shot.from;
    const to = shot.to;
    let scale = lerp(from.scale, to.scale, eased);
    let x = lerp(from.x, to.x, eased);
    let y = lerp(from.y, to.y, eased);
    let rot = lerp(from.rot, to.rot, eased);

    // Camera moves stay monotonic inside each shot. No pulse, no handheld
    // micro-motion and no pre-cut kick: the frame never throbs on its own.
    if (shot.image === 0) {
      const driftOpen = smoothstep(progress);
      x -= driftOpen * 0.01;
    } else if (shot.image === 1) {
      const fall = Math.pow(progress, 3.2);
      scale += fall * 0.2;
      y += fall * 0.078;
      x += fall * 0.026;
      rot += fall * 0.72;
    } else if (shot.image === 2) {
      const track = smootherstep(progress);
      x += (0.5 - track) * 0.045;
    } else if (shot.image === 3) {
      const awaken = smoothstep((progress - 0.16) / 0.84);
      scale += (1 - awaken) * 0.075;
      y -= awaken * 0.018;
      rot -= (1 - awaken) * 0.55;
    } else if (shot.image === 4) {
      const reveal = smoothstep((progress - 0.28) / 0.72);
      scale -= reveal * 0.035;
      x += reveal * 0.012;
    } else if (shot.image === 5) {
      const burst = smoothstep((progress - 0.22) / 0.58);
      scale += burst * 0.12;
      x += burst * 0.028;
      y -= burst * 0.014;
      rot += burst * 0.48;
    } else if (shot.image === 6) {
      const bloom = easeOutCubic(progress);
      scale += (1 - bloom) * 0.15;
      rot -= (1 - bloom) * 0.45;
    } else if (shot.image === 7) {
      const settle = smootherstep(progress);
      scale += (1 - settle) * 0.055;
      y -= settle * 0.012;
    }

    return { scale, x, y, rot };
  }

  function shakeAt() {
    // No handheld micro-shake: the sequence uses clean camera moves and light
    // accents, so the whole frame stays rock-steady at every viewport.
    return { x: 0, y: 0 };
  }

  function filterForShot(shotIndex, progress) {
    const shot = SHOTS[shotIndex];
    if (shotIndex === 3) {
      const light = easeOutCubic(Math.min(1, progress * 1.55));
      return `saturate(${lerp(0.34, 0.68, light).toFixed(2)}) contrast(1.18) brightness(${lerp(0.3, 0.98, light).toFixed(2)})`;
    }
    const filters = [
      "saturate(0.5) contrast(1.16) brightness(1.01)",
      "saturate(0.34) contrast(1.2) brightness(0.89)",
      "saturate(0.78) contrast(1.17) brightness(0.8)",
      "saturate(0.62) contrast(1.19) brightness(0.91)",
      "saturate(0.76) contrast(1.16) brightness(0.86)",
      "saturate(0.72) contrast(1.13) brightness(0.99)",
      "saturate(0.9) contrast(1.06) brightness(1.03)",
      "saturate(0.82) contrast(1.05) brightness(1.04)",
    ];
    return filters[shotIndex] || filters[0];
  }

  function drawShot(index, progress, time, options = {}) {
    const shot = SHOTS[index];
    const image = images[shot.image];
    canvas.dataset.image = `${image?.complete}:${image?.naturalWidth || 0}:${index}`;
    if (!image || !image.complete || !image.naturalWidth) return null;

    const camera = cameraAt(shot, progress, time);
    const focus = isMobile ? shot.mobileFocus : shot.focus;
    const sourceAspect = image.naturalWidth / image.naturalHeight;
    const viewportAspect = vw / vh;
    let baseWidth;
    let baseHeight;

    if (sourceAspect > viewportAspect) {
      baseHeight = vh;
      baseWidth = vh * sourceAspect;
    } else {
      baseWidth = vw;
      baseHeight = vw / sourceAspect;
    }

    const extraScale = options.extraScale || 1;
    const shake = shakeAt(time);
    const drawWidth = baseWidth * camera.scale * extraScale * 1.055;
    const drawHeight = baseHeight * camera.scale * extraScale * 1.055;
    const x0 = (vw - drawWidth) * focus.x + camera.x * vw + (options.x || 0) * vw + shake.x;
    const y0 = (vh - drawHeight) * focus.y + camera.y * vh + (options.y || 0) * vh + shake.y;
    const rotation = camera.rot + (options.rot || 0) + (options.roll || 0);
    const blur = options.blur ? ` blur(${options.blur.toFixed(2)}px)` : "";

    ctx.save();
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.filter = `${filterForShot(index, progress)}${blur}`;
    ctx.translate(vw / 2, vh / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-vw / 2, -vh / 2);
    ctx.drawImage(image, x0, y0, drawWidth, drawHeight);
    canvas.dataset.drawn = `${x0.toFixed(1)},${y0.toFixed(1)},${drawWidth.toFixed(1)},${drawHeight.toFixed(1)}`;
    ctx.restore();

    return { x0, y0, drawWidth, drawHeight };
  }

  function screenPoint(x, y) {
    return { x: x * vw, y: y * vh };
  }

  function paintGrade(grade, time, alpha = 1) {
    canvas.dataset.grade = `${grade}:${alpha}`;
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "source-over";

    if (grade === "cold") {
      ctx.fillStyle = "rgba(184, 200, 207, 0.055)";
      ctx.fillRect(0, 0, vw, vh);
    } else if (grade === "collapse") {
      ctx.fillStyle = "rgba(20, 24, 26, 0.16)";
      ctx.fillRect(0, 0, vw, vh);
    } else if (grade === "ruin") {
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(91, 25, 17, 0.23)";
      ctx.fillRect(0, 0, vw, vh);
    } else if (grade === "beam") {
      const glow = ctx.createRadialGradient(vw * 0.46, vh * 0.42, 0, vw * 0.46, vh * 0.42, vw * 0.7);
      glow.addColorStop(0, "rgba(0, 0, 0, 0)");
      glow.addColorStop(0.52, "rgba(0, 0, 0, 0.08)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0.48)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, vw, vh);
    } else if (grade === "hall") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(100, 38, 27, 0.18)";
      ctx.fillRect(0, 0, vw, vh);
    } else if (grade === "doves") {
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(255, 246, 226, 0.035)";
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, vw, vh);
    } else if (grade === "rebirth") {
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(249, 236, 214, 0.13)";
      ctx.fillRect(0, 0, vw, vh);
    } else if (grade === "hope") {
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(250, 239, 220, 0.16)";
      ctx.fillRect(0, 0, vw, vh);
    }

    ctx.restore();
  }

  function drawVignette(time) {
    const gradient = ctx.createRadialGradient(vw * 0.5, vh * 0.48, vh * 0.22, vw * 0.5, vh * 0.5, Math.max(vw, vh) * 0.72);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.62, "rgba(0, 0, 0, 0.08)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  function drawSnow(time, alpha = 1) {
    const t = time / 1000;
    ctx.save();
    ctx.fillStyle = "#f5f5ef";
    FIELDS.snow.forEach((particle) => {
      const x = mod(particle.x + particle.vx * t, 1.2) - 0.1;
      const y = mod(particle.y + particle.vy * t, 1.2) - 0.1;
      const shimmer = 0.7 + Math.sin(t * 2.2 + particle.phase) * 0.3;
      const stretch = 1 + particle.depth * 1.7;
      ctx.globalAlpha = particle.alpha * alpha * shimmer;
      if (particle.depth > 0.72) {
        ctx.save();
        ctx.translate(x * vw, y * vh);
        ctx.rotate(-0.42);
        ctx.beginPath();
        ctx.ellipse(0, 0, particle.size * stretch, particle.size * 0.74, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x * vw, y * vh, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  function drawAsh(time, alpha = 1) {
    const t = time / 1000;
    ctx.save();
    FIELDS.ash.forEach((particle) => {
      const x = mod(particle.x + particle.vx * t, 1.08) - 0.04;
      const y = mod(particle.y + particle.vy * t, 1.1) - 0.05;
      const flutter = Math.sin(t * 1.3 + particle.phase) * 0.012;
      ctx.fillStyle = `rgba(48, 39, 35, ${particle.alpha * alpha})`;
      ctx.beginPath();
      ctx.ellipse(
        (x + flutter) * vw,
        y * vh,
        particle.size * 1.7,
        particle.size * 0.55,
        Math.sin(t + particle.phase) * 0.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
    ctx.restore();
  }

  function drawWind(time, alpha = 1) {
    const t = time / 1000;
    ctx.save();
    ctx.lineCap = "round";
    FIELDS.wind.forEach((particle) => {
      const x = mod(particle.x + particle.speed * t, 1.42) - 0.2;
      const y = particle.y + Math.sin(t * 0.8 + particle.phase) * 0.014;
      const length = particle.len * vw;
      const gradient = ctx.createLinearGradient(x * vw, 0, x * vw + length, 0);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.3, `rgba(255, 255, 255, ${particle.alpha * alpha})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = particle.width;
      ctx.beginPath();
      ctx.moveTo(x * vw, y * vh);
      ctx.lineTo(x * vw + length, y * vh - length * 0.06);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawEmbers(time, alpha = 1) {
    const t = time / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    FIELDS.ember.forEach((particle) => {
      const cycle = mod(particle.phase / (Math.PI * 2) + t * particle.speed, 1);
      const x = particle.x + Math.sin(t * 1.4 + particle.phase) * particle.sway;
      const y = 1.02 - cycle * 0.68;
      const fade = Math.sin(cycle * Math.PI);
      ctx.fillStyle = `rgba(205, 71, 45, ${particle.alpha * alpha * fade})`;
      ctx.beginPath();
      ctx.arc(x * vw, y * vh, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawDust(time, alpha = 1) {
    const t = time / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    FIELDS.dust.forEach((particle) => {
      const y = mod(particle.y - t * particle.rise, 1.14) - 0.07;
      const x = particle.x + Math.sin(t * 0.34 + particle.phase) * particle.sway;
      const shimmer = 0.45 + Math.sin(t * 0.86 + particle.phase) * 0.55;
      ctx.fillStyle = `rgba(245, 238, 218, ${particle.alpha * alpha * shimmer})`;
      ctx.beginPath();
      ctx.arc(x * vw, y * vh, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawFeathers(time, alpha = 1) {
    const t = time / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    FIELDS.feather.forEach((particle) => {
      const x = mod(particle.x + particle.vx * t, 1.24) - 0.12;
      const y = mod(particle.y + particle.vy * t, 1.12) - 0.06;
      const angle = Math.sin(t * 0.7 + particle.phase) * 0.7;
      ctx.strokeStyle = `rgba(255, 251, 240, ${particle.alpha * alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x * vw, y * vh);
      ctx.quadraticCurveTo(
        x * vw + Math.cos(angle) * particle.size * 3,
        y * vh + Math.sin(angle) * particle.size * 3,
        x * vw + Math.cos(angle) * particle.size * 5,
        y * vh + Math.sin(angle) * particle.size * 5,
      );
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawGold(time, alpha = 1) {
    const t = time / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    FIELDS.gold.forEach((particle) => {
      const y = mod(particle.y - t * particle.rise, 1.16) - 0.08;
      const x = particle.x + Math.sin(t * 0.31 + particle.phase) * particle.sway;
      const shimmer = 0.35 + Math.sin(t * 1.1 + particle.phase) * 0.65;
      ctx.fillStyle = `rgba(246, 220, 172, ${particle.alpha * alpha * shimmer})`;
      ctx.beginPath();
      ctx.arc(x * vw, y * vh, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawGustCurtain(time, alpha = 1) {
    if (alpha <= 0.01) return;
    const t = time / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 5; i += 1) {
      const travel = mod(t * (0.17 + i * 0.018) + i * 0.27, 1.55) - 0.28;
      const x = travel * vw;
      const width = vw * (0.1 + i * 0.035);
      const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.42, `rgba(255, 255, 255, ${(0.07 + i * 0.012) * alpha})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x, vh * 0.05);
      ctx.lineTo(x + width, vh * -0.04);
      ctx.lineTo(x + width * 0.72, vh * 0.62);
      ctx.lineTo(x - width * 0.16, vh * 0.54);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRuinSmoke(time, alpha = 1) {
    if (alpha <= 0.01) return;
    const t = time / 1000;
    ctx.save();
    for (let i = 0; i < 7; i += 1) {
      const phase = mod(i * 0.23 + t * 0.055, 1);
      const cx = (0.68 + Math.sin(t * 0.25 + i) * 0.035 + phase * 0.045) * vw;
      const cy = lerp(vh * 0.68, vh * 0.19, phase) + Math.sin(t * 0.38 + i * 1.8) * vh * 0.018;
      const radius = (0.09 + phase * 0.13 + i * 0.006) * Math.min(vw, vh);
      const smoke = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      smoke.addColorStop(0, `rgba(111, 102, 89, ${0.08 * alpha * (1 - phase)})`);
      smoke.addColorStop(0.45, `rgba(75, 67, 60, ${0.055 * alpha * (1 - phase)})`);
      smoke.addColorStop(1, "rgba(57, 50, 45, 0)");
      ctx.fillStyle = smoke;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }

  function drawBeamShaft(time, alpha = 1) {
    if (alpha <= 0.01) return;
    const t = time / 1000;
    const breathe = 0.76 + Math.sin(t * 1.55) * 0.12 + Math.sin(t * 4.1) * 0.04;
    const sway = Math.sin(t * 0.38) * vw * 0.004;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = alpha * 0.45 * breathe;
    const shaft = ctx.createLinearGradient(vw * 0.28, 0, vw * 0.52, vh);
    shaft.addColorStop(0, "rgba(255, 249, 228, 0.92)");
    shaft.addColorStop(0.45, "rgba(255, 244, 214, 0.38)");
    shaft.addColorStop(1, "rgba(255, 236, 197, 0.04)");
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(vw * 0.17, -vh * 0.03);
    ctx.lineTo(vw * 0.34, -vh * 0.03);
    ctx.lineTo(vw * 0.69 + sway, vh * 0.98);
    ctx.lineTo(vw * 0.48 + sway, vh * 1.02);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = alpha * (0.42 + Math.sin(t * 2.7) * 0.12);
    ctx.strokeStyle = "rgba(255, 250, 233, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      const p = mod(t * 0.08 + i * 0.19, 1);
      const y = p * vh;
      const x = lerp(vw * 0.23, vw * 0.57, p) + sway;
      ctx.beginPath();
      ctx.moveTo(x - vw * 0.035, y);
      ctx.lineTo(x + vw * 0.035, y - vh * 0.014);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDawnGlow(time, alpha = 1) {
    if (alpha <= 0.01) return;
    const pulse = 0.82 + Math.sin(time * 0.0021) * 0.16;
    const cx = vw * 0.53;
    const cy = vh * 0.45;
    const radius = Math.max(vw, vh) * 0.7;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, `rgba(255, 250, 237, ${0.35 * alpha * pulse})`);
    glow.addColorStop(0.2, `rgba(249, 227, 190, ${0.17 * alpha})`);
    glow.addColorStop(0.6, `rgba(189, 116, 74, ${0.05 * alpha})`);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  function drawPaperDrift(time, alpha = 1) {
    if (alpha <= 0.01) return;
    const t = time / 1000;
    ctx.save();
    for (const bit of PAPER_BITS) {
      const y = mod(bit.y - t * bit.rise, 1.1) - 0.05;
      const x = bit.x + Math.sin(t * 0.32 + bit.phase) * 0.018;
      ctx.save();
      ctx.translate(x * vw, y * vh);
      ctx.rotate(Math.sin(t * 0.55 + bit.phase) * 0.9);
      ctx.globalAlpha = alpha * (0.22 + (Math.sin(t * 0.8 + bit.phase) + 1) * 0.14);
      ctx.fillStyle = bit.red ? "rgba(112, 35, 29, 0.9)" : "rgba(248, 241, 226, 0.95)";
      ctx.fillRect(-bit.size, -bit.size * 0.44, bit.size * 2, bit.size * 0.88);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawDoorGlow(time, alpha = 1) {
    if (alpha <= 0.01) return;
    const pulse = 0.68 + Math.sin(time * 0.0042) * 0.2 + Math.sin(time * 0.011) * 0.08;
    const cx = vw * (isMobile ? 0.63 : 0.72);
    const cy = vh * 0.64;
    const radius = Math.min(vw, vh) * 0.19;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, `rgba(255, 151, 86, ${0.2 * alpha * pulse})`);
    glow.addColorStop(0.24, `rgba(190, 61, 37, ${0.16 * alpha * pulse})`);
    glow.addColorStop(1, "rgba(104, 31, 22, 0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = glow;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function drawChildLight(time, alpha = 1) {
    if (alpha <= 0.01) return;
    const breathe = 0.5 + Math.sin(time * 0.0034) * 0.5;
    const cx = vw * (isMobile ? 0.41 : 0.43);
    const cy = vh * 0.91;
    const radius = Math.min(vw, vh) * (0.08 + breathe * 0.025);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, `rgba(255, 238, 202, ${0.16 * alpha})`);
    glow.addColorStop(0.42, `rgba(236, 168, 111, ${0.1 * alpha})`);
    glow.addColorStop(1, "rgba(169, 78, 45, 0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = glow;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function drawStoryLayers(time) {
    if (time < 4800) {
      drawGustCurtain(time, clamp(1 - time / 4800, 0, 1));
      if (time > 3200) drawAsh(time, clamp((time - 3200) / 1700, 0, 1) * 0.55);
    }
    if (time > 4500 && time < 7650) {
      const doorAlpha = clamp(Math.min((time - 4500) / 700, (7650 - time) / 700), 0, 1);
      drawRuinSmoke(time, doorAlpha);
      drawDoorGlow(time, doorAlpha);
    }
    if (time > 7100 && time < 15350) {
      const beamAlpha = smoothstep((time - 7100) / 700) * (1 - smoothstep((time - 14500) / 850));
      drawBeamShaft(time, beamAlpha);
      drawChildLight(time, beamAlpha);
    }
    if (time > 14700) {
      drawPaperDrift(time, smoothstep((time - 14700) / 1100));
      drawDawnGlow(time, smoothstep((time - 16100) / 1600) * 0.82);
    }
  }

  function drawAtmosphere(mood, time, alpha = 1) {
    if (mood === "wind") {
      drawWind(time, alpha);
      drawSnow(time, alpha * 0.8);
    } else if (mood === "snow") {
      drawSnow(time, alpha);
      drawWind(time, alpha * 0.35);
    } else if (mood === "ember") {
      drawEmbers(time, alpha);
      drawDust(time, alpha * 0.4);
    } else if (mood === "dust") {
      drawDust(time, alpha);
    } else if (mood === "feather") {
      drawFeathers(time, alpha);
      drawDust(time, alpha * 0.7);
    } else if (mood === "gold") {
      drawGold(time, alpha);
      drawFeathers(time, alpha * 0.18);
    }
  }

  function drawDoveShape(x, y, sizePx, rotation, alpha, color, time, flipX = false) {
    if (alpha <= 0.01 || sizePx <= 0) return;

    const flap = Math.sin(time * 0.019) * 0.72;
    const scale = sizePx / 96;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale * (flipX ? -1 : 1), scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(255, 247, 226, 0.4)";
    ctx.shadowBlur = sizePx > 32 ? 8 : 0;

    // Far wing.
    ctx.save();
    ctx.translate(-2, -2);
    ctx.rotate(-0.2 + flap * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-12, -19, -34, -36, -55, -31);
    ctx.bezierCurveTo(-43, -13, -23, 0, 0, 0);
    ctx.fill();
    ctx.restore();

    // Near wing.
    ctx.save();
    ctx.translate(0, 0);
    ctx.rotate(0.16 - flap * 0.46);
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.bezierCurveTo(6, 20, -17, 39, -46, 34);
    ctx.bezierCurveTo(-37, 16, -22, 4, 0, 1);
    ctx.fill();
    ctx.restore();

    // Tail feathers, body and head.
    ctx.beginPath();
    ctx.moveTo(-23, -1);
    ctx.lineTo(-52, -10);
    ctx.lineTo(-43, -1);
    ctx.lineTo(-55, 8);
    ctx.lineTo(-24, 5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-28, 1);
    ctx.bezierCurveTo(-17, -8, 7, -11, 25, -7);
    ctx.lineTo(25, 3);
    ctx.bezierCurveTo(9, 10, -14, 12, -28, 5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(24, -7, 6.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(29, -9);
    ctx.lineTo(42, -5.5);
    ctx.lineTo(29, -3);
    ctx.closePath();
    ctx.fill();

    // A tiny warm glint keeps the dove legible against both snow and shadow.
    ctx.globalAlpha = alpha * 0.34;
    ctx.fillStyle = "rgba(177, 69, 45, 0.8)";
    ctx.beginPath();
    ctx.arc(20, -8, 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawGuideDove(time) {
    const dove = getDove(time);
    if (dove.alpha <= 0.01) return;

    const sizePx = Math.min(vw, vh) * dove.size * (isMobile ? 1.05 : 0.92);
    const past = getDove(time - 210);
    const flipX = dove.x <= past.x;

    // A soft warm velocity trail makes the bird read as flight, not a sticker.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    const trail = ctx.createLinearGradient(past.x * vw, past.y * vh, dove.x * vw, dove.y * vh);
    trail.addColorStop(0, "rgba(132, 48, 35, 0)");
    trail.addColorStop(1, `rgba(224, 132, 86, ${dove.alpha * 0.32})`);
    ctx.strokeStyle = trail;
    ctx.lineWidth = Math.max(1, sizePx * 0.055);
    ctx.beginPath();
    for (let i = 0; i <= 9; i += 1) {
      const sample = getDove(time - (9 - i) * 24);
      if (i === 0) ctx.moveTo(sample.x * vw, sample.y * vh);
      else ctx.lineTo(sample.x * vw, sample.y * vh);
    }
    ctx.stroke();
    ctx.restore();

    const aura = ctx.createRadialGradient(dove.x * vw, dove.y * vh, 0, dove.x * vw, dove.y * vh, Math.max(7, sizePx * 0.7));
    aura.addColorStop(0, `rgba(255, 247, 226, ${dove.alpha * 0.24})`);
    aura.addColorStop(1, "rgba(255, 247, 226, 0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = aura;
    ctx.fillRect(dove.x * vw - sizePx, dove.y * vh - sizePx, sizePx * 2, sizePx * 2);
    ctx.restore();

    drawDoveShape(
      dove.x * vw,
      dove.y * vh,
      sizePx,
      dove.rot,
      dove.alpha,
      "rgba(250, 247, 237, 0.96)",
      time,
      flipX,
    );
  }

  function drawSkyFlights(time) {
    for (const flight of SKY_FLIGHTS) {
      if (time < flight.start || time > flight.end) continue;
      const duration = flight.end - flight.start;
      const goingLeft = flight.to.x < flight.from.x;
      const baseRotation = Math.atan2(
        (flight.to.y - flight.from.y) * vh,
        (flight.to.x - flight.from.x) * vw,
      );
      for (let i = 0; i < flight.count; i += 1) {
        const offset = i - (flight.count - 1) / 2;
        const lag = Math.abs(offset) * 80 + i * 24;
        const p = clamp((time - flight.start - lag) / Math.max(360, duration - lag), 0, 1);
        if (p <= 0 || p >= 1) continue;
        const eased = smoothstep(p);
        const x = lerp(flight.from.x, flight.to.x, eased)
          + offset * flight.spread
          + Math.sin(time * 0.0014 + i * 2.1) * 0.006;
        const y = lerp(flight.from.y, flight.to.y, eased)
          + Math.abs(offset) * flight.spread * 0.34
          + Math.sin(p * Math.PI) * flight.bend
          + Math.sin(time * 0.002 + i * 1.7) * 0.008;
        const fade = Math.sin(p * Math.PI);
        const size = flight.size * (isMobile ? 0.82 : 1) * (0.88 + Math.abs(offset) * 0.05);
        if (size < 11) {
          drawGull(
            x * vw,
            y * vh,
            size,
            i * 1.7 + time * 0.025,
            fade * 0.65,
            flight.color,
          );
        } else {
          const alignedRotation = baseRotation - (goingLeft ? Math.PI : 0);
          drawDoveShape(
            x * vw,
            y * vh,
            size,
            alignedRotation + Math.sin(time * 0.0022 + i) * 0.12,
            fade * 0.78,
            flight.color,
            time + i * 63,
            goingLeft,
          );
        }
      }
    }
  }
  function drawHeartPulse(time) {
    if (time < 2420 || time > 5100) return;
    const center = isMobile ? { x: 0.58, y: 0.72 } : { x: 0.65, y: 0.71 };
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 4; i += 1) {
      const cycle = mod(time - 2420 - i * 220, 840) / 840;
      if (cycle > 1) continue;
      const radius = 5 + cycle * Math.min(vw, vh) * (0.1 + i * 0.018);
      const alpha = (1 - cycle) * (0.38 - i * 0.035);
      ctx.strokeStyle = `rgba(191, 61, 43, ${alpha})`;
      ctx.lineWidth = 1.2 + (1 - cycle) * 1.2;
      ctx.beginPath();
      ctx.ellipse(center.x * vw, center.y * vh, radius, radius * 0.67, -0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    const beat = Math.pow(Math.max(0, Math.sin((time - 2420) * 0.012)), 7);
    const core = ctx.createRadialGradient(center.x * vw, center.y * vh, 0, center.x * vw, center.y * vh, Math.min(vw, vh) * (0.025 + beat * 0.022));
    core.addColorStop(0, `rgba(229, 132, 82, ${0.38 + beat * 0.22})`);
    core.addColorStop(1, "rgba(145, 35, 27, 0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  function drawEmberSpirit(time) {
    if (time < 2950 || time > 6100) return;
    const ember = getEmber(time);
    if (ember.alpha <= 0.01) return;

    for (let i = 8; i >= 1; i -= 1) {
      const past = getEmber(time - i * 32);
      if (past.alpha <= 0.01) continue;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(194, 62, 43, ${past.alpha * (1 - i / 10) * 0.46})`;
      ctx.beginPath();
      ctx.arc(past.x * vw, past.y * vh, Math.max(0.7, 3.4 - i * 0.25), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(232, 116, 72, ${ember.alpha})`;
    ctx.shadowColor = "rgba(199, 55, 35, 0.95)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(ember.x * vw, ember.y * vh, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGull(x, y, size, phase, alpha, color) {
    const flap = Math.sin(phase) * 0.36;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(1, size * 0.11);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.quadraticCurveTo(x - size * 0.46, y - size * (0.42 + flap), x, y);
    ctx.quadraticCurveTo(x + size * 0.46, y - size * (0.42 + flap), x + size, y);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlock(time) {
    if (time < 11600 || time > 17850) return;
    const origin = { x: isMobile ? 0.43 : 0.4, y: isMobile ? 0.58 : 0.56 };
    const warm = time > 15800;
    const color = warm ? "rgba(78, 42, 32, 0.72)" : "rgba(250, 247, 238, 0.88)";

    FLOCK.forEach((bird, index) => {
      const age = (time - 11600) / 1000 - bird.delay;
      if (age <= 0) return;
      const lift = age * age * 0.012;
      const x = origin.x + Math.cos(bird.angle) * bird.speed * age + Math.sin(age * 2.4 + index) * 0.006;
      const y = origin.y + Math.sin(bird.angle) * bird.speed * age - lift + bird.lift * Math.sin(age * 1.6 + index);
      if (x < -0.16 || x > 1.16 || y < -0.2 || y > 1.16) return;
      const fadeIn = clamp(age * 3.4, 0, 1);
      const fadeOut = clamp((17850 - time) / 1900, 0, 1);
      drawGull(
        x * vw,
        y * vh,
        bird.size * (isMobile ? 0.8 : 1) * (1 + age * 0.2),
        bird.phase + time * 0.024,
        fadeIn * fadeOut * (warm ? 0.76 : 0.88),
        color,
      );
    });
  }
  function fillScreen(color, alpha, mode = "source-over") {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  function drawRadialFlash(cx, cy, radius, color, alpha, mode = "screen") {
    if (alpha <= 0) return;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, radius));
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.38, color);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  function drawTransition(index, rawProgress, time) {
    const current = SHOTS[index];
    const next = SHOTS[index + 1];
    const p = smootherstep(rawProgress);
    const glow = Math.sin(Math.PI * p);
    const direction = index % 2 === 0 ? 1 : -1;
    const isFall = current.transition === "fall";

    // A true double exposure. Both shots keep their real camera progress at
    // the seam, so entering and leaving the dissolve cannot make the frame jump.
    const currentProgress = clamp((time - current.start) / current.duration, 0, 1);
    const nextProgress = clamp((time - next.start) / next.duration, 0, 1);
    drawShot(index + 1, nextProgress, time, {
      alpha: 0.98,
      extraScale: 1 + (1 - p) * 0.018,
      x: -(1 - p) * 0.004 * direction,
      y: -(1 - p) * 0.006,
    });
    drawShot(index, currentProgress, time, {
      alpha: Math.max(0, 1 - p * 1.03),
      extraScale: 1 + p * 0.02,
      x: p * 0.004 * direction,
      y: p * 0.005,
    });

    // A slow sheet of light passes through the dissolve. It is a gradient,
    // not a hard wipe, and has only one soft peak.
    const sweepX = lerp(-0.22, 1.22, p) * vw;
    const sweepWidth = vw * 0.26;
    const sweep = ctx.createLinearGradient(sweepX - sweepWidth, 0, sweepX + sweepWidth, 0);
    sweep.addColorStop(0, "rgba(246, 238, 219, 0)");
    sweep.addColorStop(0.48, `rgba(246, 238, 219, ${glow * 0.07})`);
    sweep.addColorStop(1, "rgba(246, 238, 219, 0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();

    if (isFall) {
      fillScreen("rgb(12, 13, 13)", glow * 0.07);
    } else {
      fillScreen("rgb(246, 239, 224)", glow * 0.045, "screen");
      drawRadialFlash(
        vw * 0.5,
        vh * 0.47,
        Math.max(vw, vh) * 0.82,
        "rgba(255, 248, 231, 0.72)",
        glow * 0.07,
      );
    }

    paintGrade(current.grade, time, 1 - p);
    paintGrade(next.grade, time, p);
  }
  function drawFrameEdges() {
    const top = ctx.createLinearGradient(0, 0, 0, vh * 0.2);
    top.addColorStop(0, "rgba(0, 0, 0, 0.35)");
    top.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, vw, vh * 0.2);

    const bottom = ctx.createLinearGradient(0, vh * 0.72, 0, vh);
    bottom.addColorStop(0, "rgba(0, 0, 0, 0)");
    bottom.addColorStop(1, "rgba(0, 0, 0, 0.44)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, vh * 0.72, vw, vh * 0.28);
  }

  function drawImpact(time) {
    const events = [
      { t: 2740, duration: 320, color: "rgba(248, 250, 249, 1)", alpha: 0.45 },
      { t: 4940, duration: 360, color: "rgba(126, 29, 20, 1)", alpha: 0.34 },
      { t: 7340, duration: 420, color: "rgba(255, 246, 220, 1)", alpha: 0.3 },
      { t: 10040, duration: 330, color: "rgba(255, 248, 230, 1)", alpha: 0.34 },
      { t: 14920, duration: 430, color: "rgba(255, 249, 235, 1)", alpha: 0.48 },
      { t: 17330, duration: 520, color: "rgba(255, 242, 216, 1)", alpha: 0.32 },
    ];

    events.forEach((event) => {
      const p = (time - event.t) / event.duration;
      if (p < 0 || p > 1) return;
      const alpha = Math.pow(1 - p, 2) * event.alpha;
      fillScreen(event.color, alpha, "screen");
    });
  }

  function drawSkyShadow(time) {
    if (time < 2900 || time > 5200) return;
    const p = clamp((time - 2900) / 2300, 0, 1);
    const alpha = Math.sin(Math.PI * p) * 0.2;
    const x = lerp(0.98, 0.03, smoothstep(p));
    const y = 0.19 + Math.sin(p * Math.PI) * 0.015;
    const size = Math.min(vw, vh) * 0.12;
    ctx.save();
    drawDoveShape(
      x * vw,
      y * vh,
      size,
      -0.04,
      alpha,
      "rgba(32, 38, 39, 0.72)",
      time,
      true,
    );
    ctx.restore();
  }

  function drawShockwave(time) {
    const waves = [
      { t: 2735, x: 0.56, y: 0.55, color: "245, 247, 242", reach: 0.52 },
      { t: 4925, x: 0.62, y: 0.62, color: "188, 72, 48", reach: 0.62 },
      { t: 7335, x: 0.44, y: 0.62, color: "255, 248, 226", reach: 0.48 },
      { t: 10035, x: 0.44, y: 0.68, color: "255, 244, 218", reach: 0.56 },
      { t: 12425, x: 0.44, y: 0.6, color: "255, 248, 228", reach: 0.64 },
      { t: 14915, x: 0.52, y: 0.48, color: "255, 240, 208", reach: 0.7 },
      { t: 17325, x: 0.5, y: 0.5, color: "255, 244, 219", reach: 0.7 },
    ];

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const wave of waves) {
      const p = (time - wave.t) / 680;
      if (p < 0 || p > 1) continue;
      const radius = Math.max(vw, vh) * wave.reach * easeOutCubic(p);
      const alpha = Math.pow(1 - p, 2) * 0.13;
      for (let ring = 0; ring < 2; ring += 1) {
        const start = 0.25 + ring * 2.2 + p * 0.9;
        ctx.strokeStyle = `rgba(${wave.color}, ${alpha * (1 - ring * 0.35)})`;
        ctx.lineWidth = 1 + (1 - p) * 1.8;
        ctx.beginPath();
        ctx.ellipse(
          wave.x * vw,
          wave.y * vh,
          radius * (1 - ring * 0.11),
          radius * 0.62 * (1 - ring * 0.11),
          -0.14,
          start,
          start + 1.1 + ring * 0.55,
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawSpeedStreaks(progress, time) {
    if (progress <= 0.02 || progress >= 0.98) return;
    const alpha = Math.sin(Math.PI * progress) * 0.2;
    const t = time / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    for (let i = 0; i < 18; i += 1) {
      const lane = (i * 0.173 + 0.071) % 1;
      const x = mod(lane * 1.25 + progress * 0.55 - t * 0.08, 1.25) - 0.12;
      const y = ((i * 0.237 + 0.11) % 0.94) + 0.03;
      const length = (0.035 + (i % 5) * 0.022) * vw;
      const gradient = ctx.createLinearGradient(x * vw, 0, x * vw + length, 0);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.42, `rgba(255, 250, 236, ${alpha * (0.45 + (i % 3) * 0.16)})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 0.7 + (i % 3) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x * vw, y * vh);
      ctx.lineTo(x * vw + length, y * vh - length * 0.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderAt(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#080909";
    ctx.fillRect(0, 0, vw, vh);

    const index = shotIndexAt(time);
    canvas.dataset.rendered = "1";
    canvas.dataset.scene = String(index);
    canvas.dataset.time = String(Math.round(time));
    if (index < 0) return;

    const shot = SHOTS[index];
    const progress = clamp((time - shot.start) / shot.duration, 0, 1);
    const transitionStart = shot.end - TRANSITION;
    const transitionProgress = clamp((time - transitionStart) / TRANSITION, 0, 1);
    const inTransition = index < SHOTS.length - 1 && time > transitionStart;

    if (inTransition) {
      drawTransition(index, transitionProgress, time);
    } else {
      drawShot(index, progress, time);
    }

    if (!inTransition) {
      paintGrade(shot.grade, time, 1);
    }

    drawAtmosphere(shot.mood, time, inTransition ? 1 - transitionProgress : 1);
    if (inTransition) {
      drawAtmosphere(SHOTS[index + 1].mood, time, transitionProgress);
    }

    drawStoryLayers(time);
    drawHeartPulse(time);
    drawEmberSpirit(time);
    drawSkyFlights(time);
    drawSkyShadow(time);
    drawGuideDove(time);
    drawFlock(time);
    drawVignette(time);
    drawFrameEdges();

    if (time < shot.start + 760 && index === 0) {
      fillScreen("rgb(0, 0, 0)", 1 - easeOutCubic((time - shot.start) / 760));
    }

    if (state.lastScene !== index) {
      state.lastScene = index;
      document.body.classList.toggle("is-dark-scene", index >= 3 && index <= 5);
    }
  }

  function finish(options = {}) {
    if (state.finished) return;
    state.finished = true;
    state.running = false;
    if (state.raf) window.cancelAnimationFrame(state.raf);
    state.raf = 0;

    if (!state.reviewing) {
      renderAt(FINISH_TIME - 1);
    }

    document.body.classList.remove("is-dark-scene");
    document.body.classList.add("has-begun", "is-finished");
    gameTitle.classList.add("is-active");
    gameTitle.setAttribute("aria-hidden", "false");

    if (options.focus) {
      const firstLink = gameTitle.querySelector(".menu-button");
      if (firstLink) window.setTimeout(() => firstLink.focus({ preventScroll: true }), 360);
    }
  }

  function skipIntro() {
    if (state.finished) return;
    finish({ focus: true });
  }

  function loop(now) {
    if (!state.running || state.finished) return;
    const time = now - state.startTime;
    if (time >= FINISH_TIME) {
      renderAt(FINISH_TIME - 1);
      finish();
      return;
    }
    renderAt(time);
    state.raf = window.requestAnimationFrame(loop);
  }

  function startAnimation() {
    if (state.running || state.finished) return;
    state.startTime = performance.now();
    state.running = true;
    document.body.classList.add("has-begun");
    renderAt(0);
    state.raf = window.requestAnimationFrame(loop);
  }

  function replayIntro() {
    if (state.raf) window.cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.running = false;
    state.finished = false;
    state.reviewing = false;
    state.lastScene = -2;
    state.startTime = 0;
    gameTitle.classList.remove("is-active");
    gameTitle.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-finished", "is-dark-scene");
    window.scrollTo(0, 0);
    window.requestAnimationFrame(startAnimation);
  }

  function waitForImages() {
    return Promise.all(images.map((image) => new Promise((resolve) => {
      if (image.complete) {
        resolve();
        return;
      }
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    })));
  }

  if (skipButton) skipButton.addEventListener("click", skipIntro);
  if (replayButton) replayButton.addEventListener("click", replayIntro);

  const finalSkip = document.querySelector(".skip-to-final");
  if (finalSkip) {
    finalSkip.addEventListener("click", (event) => {
      event.preventDefault();
      finish({ focus: true });
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      replayIntro();
      return;
    }
    if (!state.finished && (event.key === "Enter" || event.key === "Escape")) {
      event.preventDefault();
      skipIntro();
    }
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    if (state.reviewing && state.frozenTime != null) {
      renderAt(state.frozenTime);
    }
  });

  resizeCanvas();
  gameTitle.setAttribute("aria-hidden", "true");

  const finishRequested = params.get("finish") === "1";
  const freeze = params.get("freeze") === "1";
  const snapshot = params.get("snapshot") === "1";
  const forcedSceneRaw = Number.parseInt(params.get("scene") || "", 10);
  const forcedTimeRaw = Number.parseFloat(params.get("t") || "");

  if (finishRequested || snapshot || freeze) {
    document.body.classList.add("is-snapshot");
  }

  if (finishRequested || reducedMotion) {
    state.reviewing = true;
    finish();
  } else if (Number.isFinite(forcedTimeRaw)) {
    state.reviewing = true;
    state.frozenTime = clamp(forcedTimeRaw, 0, FINISH_TIME - 1);
    document.body.classList.add("has-begun");
    waitForImages().then(() => renderAt(state.frozenTime));
  } else if (Number.isFinite(forcedSceneRaw) && forcedSceneRaw >= 1) {
    state.reviewing = true;
    const index = Math.min(forcedSceneRaw, SHOTS.length) - 1;
    state.frozenTime = SHOTS[index].start + SHOTS[index].duration * 0.42;
    document.body.classList.add("has-begun");
    waitForImages().then(() => {
      renderAt(state.frozenTime);
      if (forcedSceneRaw >= SHOTS.length && !freeze) {
        window.setTimeout(() => finish(), 500);
      }
    });
  } else {
    waitForImages().then(startAnimation);
  }
})();

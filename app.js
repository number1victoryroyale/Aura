(() => {
  "use strict";

  const STORAGE_KEY = "aura-tracker-state-v2";

  const POSITIVE_DEFAULTS = [
    { label: "Helped a stranger", value: 18500 },
    { label: "Hit the gym", value: 30000 },
    { label: "Ate something healthy", value: 6200 },
    { label: "Got a genuine compliment", value: 24000 },
    { label: "Touched grass", value: 28000 },
    { label: "Did a good deed", value: 30000 },
    { label: "Woke up early with no alarm", value: 27500 },
    { label: "Stayed hydrated all day", value: 4800 },
  ];

  const NEGATIVE_DEFAULTS = [
    { label: "Rage quit a game", value: -35000 },
    { label: "Ghosted someone", value: -28000 },
    { label: "Was rude to someone", value: -47000 },
    { label: "Doom scrolled for hours", value: -21000 },
    { label: "Overslept and missed something", value: -16500 },
    { label: "Got clowned on publicly", value: -500000 },
    { label: "Lied about something small", value: -33000 },
    { label: "Left dishes in the sink", value: -9200 },
  ];

  // A smooth gradient spanning every rank: void-black -> crimson -> the
  // violet baseline -> gold -> jade -> pure light -> an ethereal glow
  // beyond it. Stops are keyed to a FIXED signed order-of-magnitude (not
  // to a rank's position in the list), so a rank's color depends only on
  // its own numbers and never shifts when more ranks are added elsewhere.
  const TIER_COLOR_STOPS = [
    [-11, "#141019"],
    [-10, "#1f1a26"],
    [-8, "#8a4550"],
    [-6, "#b23b4f"],
    [-4, "#c96a78"],
    [4, "#8a6fe0"],
    [6, "#e7b24a"],
    [8, "#f2874a"],
    [9.5, "#4fae8f"],
    [10.5, "#fff3dc"],
    [11.5, "#cfe8ff"],
    [13, "#e3d1ff"],
    [14.5, "#ffe0f2"],
    [16, "#ffffff"],
  ];

  // A rank's position on that fixed scale, derived from its own bounds:
  // positive ranks key off their upper edge, negative ranks off their
  // (more extreme) lower edge, and the two open ends get pushed one unit
  // past their neighbor so they never collide with it.
  function tierPosition(min, max) {
    if (max === Infinity) return Math.log10(min) + 1;
    if (min === -Infinity) return -Math.log10(-max) - 1;
    if (min >= 0) return Math.log10(max);
    return -Math.log10(-min);
  }

  // Interpolated in HSL, not RGB: a straight RGB blend between, say,
  // violet and gold desaturates through a muddy grey-pink at the
  // midpoint. Blending hue around the color wheel instead keeps every
  // in-between rank looking like a deliberate color, not a smudge.
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(rgb) {
    return "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  }
  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s * 100, l * 100];
  }
  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const hue2rgb = (p, q, tt) => {
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
  }
  function lerpHue(h0, h1, t) {
    let d = h1 - h0;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return (h0 + d * t + 360) % 360;
  }
  function tierColorAt(pos) {
    const stops = TIER_COLOR_STOPS;
    if (pos <= stops[0][0]) return stops[0][1];
    if (pos >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
    for (let i = 0; i < stops.length - 1; i++) {
      const [p0, c0] = stops[i];
      const [p1, c1] = stops[i + 1];
      if (pos <= p1) {
        const localT = p1 === p0 ? 0 : (pos - p0) / (p1 - p0);
        const [h0, s0, l0] = rgbToHsl(hexToRgb(c0));
        const [h1, s1, l1] = rgbToHsl(hexToRgb(c1));
        const h = lerpHue(h0, h1, localT);
        const s = s0 + (s1 - s0) * localT;
        const l = l0 + (l1 - l0) * localT;
        return rgbToHex(hslToRgb(h, s, l));
      }
    }
    return stops[stops.length - 1][1];
  }

  // The flame metaphor: aura is a fire you tend, and it can travel a long
  // way in either direction — from utterly snuffed out to pure light. Ranks
  // are spaced about two to a decade (…, 1e4, 3e4, 1e5, 3e5, …) so a single
  // big action can still visibly climb a rank, all the way out to where the
  // readout switches to scientific notation.
  const TIER_BOUNDS = [
    ["Extinguished", -Infinity, -1e10],
    ["Void", -1e10, -3e9],
    ["Hollow", -3e9, -1e9],
    ["Withered", -1e9, -3e8],
    ["Corroded", -3e8, -1e8],
    ["Cracked", -1e8, -3e7],
    ["Fractured", -3e7, -1e7],
    ["Charred", -1e7, -3e6],
    ["Choking", -3e6, -1e6],
    ["Smothered", -1e6, -3e5],
    ["Waning", -3e5, -1e5],
    ["Fading", -1e5, -3e4],
    ["Dimming", -3e4, -1e4],
    ["Clouded", -1e4, 0],
    ["Dormant", 0, 1e4],
    ["Ember", 1e4, 3e4],
    ["Smoldering", 3e4, 1e5],
    ["Kindled", 1e5, 3e5],
    ["Burning", 3e5, 1e6],
    ["Blazing", 1e6, 3e6],
    ["Ablaze", 3e6, 1e7],
    ["Roaring", 1e7, 3e7],
    ["Radiant", 3e7, 1e8],
    ["Luminous", 1e8, 3e8],
    ["Incandescent", 3e8, 1e9],
    ["Stellar", 1e9, 3e9],
    ["Celestial", 3e9, 1e10],
    ["Transcendent", 1e10, 3e10],
    ["Ascendant", 3e10, 1e11],
    ["Empyrean", 1e11, 3e11],
    ["Eternal", 3e11, 1e12],
    ["Sovereign", 1e12, 3e12],
    ["Primordial", 3e12, 1e13],
    ["Absolute", 1e13, 3e13],
    ["Ineffable", 3e13, 1e14],
    ["Omniscient", 1e14, 3e14],
    ["Infinite", 3e14, 1e15],
    ["Boundless", 1e15, Infinity],
  ];

  const TIERS = TIER_BOUNDS.map(([label, min, max]) => {
    const color = tierColorAt(tierPosition(min, max));
    return { min, max, label, color, glow: color + "88" };
  });

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          aura: typeof parsed.aura === "number" ? parsed.aura : 0,
          customPositive: Array.isArray(parsed.customPositive) ? parsed.customPositive : [],
          customNegative: Array.isArray(parsed.customNegative) ? parsed.customNegative : [],
          history: Array.isArray(parsed.history) ? parsed.history : [],
        };
      }
    } catch (e) {
      console.warn("Failed to load aura state", e);
    }
    return { aura: 0, customPositive: [], customNegative: [], history: [] };
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- DOM refs ----------
  const auraValueEl = document.getElementById("aura-value");
  const orbEl = document.getElementById("orb");
  const dialProgressEl = document.getElementById("dial-progress");
  const tierLabelEl = document.getElementById("tier-label");
  const positiveListEl = document.getElementById("positive-actions");
  const negativeListEl = document.getElementById("negative-actions");
  const historyListEl = document.getElementById("history-list");
  const resetBtn = document.getElementById("reset-btn");
  const addPositiveBtn = document.getElementById("add-positive");
  const addNegativeBtn = document.getElementById("add-negative");
  const shakeWrap = document.getElementById("shake-wrap");
  const flashEl = document.getElementById("flash");
  const impactBanner = document.getElementById("impact-banner");
  const canvas = document.getElementById("fx-canvas");
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // ---------- Dial (tier + progress ring) ----------
  const DIAL_RADIUS = 44;
  const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;
  dialProgressEl.style.strokeDasharray = String(DIAL_CIRCUMFERENCE);

  function getTier(value) {
    return TIERS.find((t) => value < t.max) || TIERS[TIERS.length - 1];
  }

  // Past ten billion, plain digits stop being readable at a glance —
  // switch to "m.mm×10ⁿ" instead of a wall of commas.
  const SCI_NOTATION_THRESHOLD = 1e10;
  const SUPERSCRIPT_DIGITS = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","-":"⁻","+":"" };

  function toSuperscript(str) {
    return str.split("").map((c) => SUPERSCRIPT_DIGITS[c] ?? c).join("");
  }

  function formatNumber(n) {
    if (Math.abs(n) >= SCI_NOTATION_THRESHOLD) {
      const [mantissa, exponent] = n.toExponential(2).split("e");
      return mantissa + "×10" + toSuperscript(exponent);
    }
    return n.toLocaleString();
  }

  function formatDelta(n) {
    return (n > 0 ? "+" : "") + formatNumber(n);
  }

  function updateDial() {
    const tier = getTier(state.aura);
    orbEl.style.setProperty("--tier-color", tier.color);
    orbEl.style.setProperty("--tier-glow", tier.glow);
    tierLabelEl.textContent = tier.label;
    tierLabelEl.style.color = tier.color;
    tierLabelEl.style.borderColor = tier.color + "55";

    const boundless = tier.min === -Infinity || tier.max === Infinity;
    orbEl.classList.toggle("boundless", boundless);

    const fraction = boundless
      ? 1
      : Math.min(1, Math.max(0, (state.aura - tier.min) / (tier.max - tier.min)));
    dialProgressEl.style.strokeDashoffset = String(DIAL_CIRCUMFERENCE * (1 - fraction));
  }

  function renderAuraValue() {
    auraValueEl.textContent = formatNumber(state.aura);
    updateDial();
  }

  // ---------- Rendering action lists ----------
  function renderActionList(container, defaults, custom, isPositive) {
    container.innerHTML = "";
    const all = [
      ...defaults.map((a) => ({ ...a, custom: false })),
      ...custom.map((a) => ({ ...a, custom: true })),
    ];
    if (all.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.style.color = "var(--paper-dim)";
      empty.style.fontSize = "0.85rem";
      empty.textContent = "Nothing here yet.";
      container.appendChild(empty);
      return;
    }
    all.forEach((action) => {
      const item = document.createElement("button");
      item.className = "action-item";
      item.type = "button";

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = action.label;

      const value = document.createElement("span");
      value.className = "value";
      value.textContent = formatDelta(action.value);

      item.appendChild(label);
      item.appendChild(value);

      item.addEventListener("click", () => applyDelta(action.value, action.label));

      if (action.custom) {
        item.title = "Right-click / long-press to remove";
        item.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const list = isPositive ? state.customPositive : state.customNegative;
          const realIdx = list.findIndex(
            (a) => a.label === action.label && a.value === action.value
          );
          if (realIdx !== -1) {
            list.splice(realIdx, 1);
            saveState();
            renderAll();
          }
        });
      }

      container.appendChild(item);
    });
  }

  function renderHistory() {
    historyListEl.innerHTML = "";
    if (state.history.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "The trail is cold. Go kindle something.";
      historyListEl.appendChild(li);
      return;
    }
    state.history
      .slice()
      .reverse()
      .slice(0, 30)
      .forEach((entry) => {
        const li = document.createElement("li");
        li.className = entry.delta >= 0 ? "pos-row" : "neg-row";
        const label = document.createElement("span");
        label.textContent = entry.label;
        const delta = document.createElement("span");
        delta.className = "delta " + (entry.delta >= 0 ? "pos" : "neg");
        delta.textContent = formatDelta(entry.delta);
        li.appendChild(label);
        li.appendChild(delta);
        historyListEl.appendChild(li);
      });
  }

  function renderAll() {
    renderAuraValue();
    renderActionList(positiveListEl, POSITIVE_DEFAULTS, state.customPositive, true);
    renderActionList(negativeListEl, NEGATIVE_DEFAULTS, state.customNegative, false);
    renderHistory();
  }

  // ---------- Core aura mutation + impact frames ----------
  function notifyAuraChange() {
    window.dispatchEvent(new CustomEvent("aura:change", { detail: { aura: state.aura } }));
  }

  // A short cooldown after every act — no farming a leaderboard by
  // spam-clicking a button as fast as your mouse allows.
  const ACTION_COOLDOWN_MS = 1000;
  let cooldownUntil = 0;
  let cooldownTimer = null;

  function isOnCooldown() {
    return Date.now() < cooldownUntil;
  }

  function startCooldown() {
    cooldownUntil = Date.now() + ACTION_COOLDOWN_MS;
    document.body.classList.add("on-cooldown");
    clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      document.body.classList.remove("on-cooldown");
    }, ACTION_COOLDOWN_MS);
  }

  // No single kindling act can ever apply more than this — enforced here,
  // not just at the data/creation level, so it holds even against a
  // tampered custom action or corrupted storage.
  const KINDLE_APPLY_MAX = 30_000;

  function applyDelta(delta, label) {
    if (!delta || isOnCooldown()) return;
    if (delta > 0) delta = Math.min(delta, KINDLE_APPLY_MAX);
    state.aura += delta;
    state.history.push({ label, delta, at: Date.now() });
    if (state.history.length > 200) state.history = state.history.slice(-200);
    saveState();
    renderAuraValue();
    renderHistory();
    playImpact(delta);
    notifyAuraChange();
    startCooldown();
  }

  // The only way aura is ever reset to a chosen value — always 0, never
  // arbitrary, so there's no backdoor around tapping actions to earn it.
  function resetAura() {
    const delta = 0 - state.aura;
    if (delta === 0) return;
    state.aura = 0;
    state.history.push({ label: "Snuffed out", delta, at: Date.now() });
    if (state.history.length > 200) state.history = state.history.slice(-200);
    saveState();
    renderAuraValue();
    renderHistory();
    playImpact(delta);
    notifyAuraChange();
  }

  function playImpact(delta) {
    const good = delta > 0;
    const magnitude = Math.abs(delta);
    const intensity = Math.min(1, magnitude / 400000);

    auraValueEl.classList.remove("bump-up", "bump-down");
    void auraValueEl.offsetWidth;
    auraValueEl.classList.add(good ? "bump-up" : "bump-down");

    shakeWrap.classList.remove("shake-good", "shake-bad");
    void shakeWrap.offsetWidth;
    shakeWrap.classList.add(good ? "shake-good" : "shake-bad");

    flashEl.classList.remove("flash-good", "flash-bad");
    void flashEl.offsetWidth;
    flashEl.classList.add(good ? "flash-good" : "flash-bad");

    impactBanner.textContent = formatDelta(delta);
    impactBanner.classList.remove("play-good", "play-bad");
    void impactBanner.offsetWidth;
    impactBanner.classList.add(good ? "play-good" : "play-bad");

    const baseCount = good ? 36 : 26;
    const count = reduceMotion
      ? Math.round((baseCount + intensity * 120) * 0.35)
      : Math.round(baseCount + intensity * 120);
    spawnParticles(good, count);

    orbEl.animate(
      [
        { filter: "brightness(1)" },
        { filter: `brightness(${1.4 + intensity * 1.1})` },
        { filter: "brightness(1)" },
      ],
      { duration: 500 + intensity * 300, easing: "ease-out" }
    );
  }

  // ---------- Particle system ----------
  // Kindling rises like embers off a flame; smothering falls like ash and cinder.
  let particles = [];
  let rafId = null;

  function spawnParticles(good, count) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spread = good ? 2.5 + Math.random() * 7 : 1.5 + Math.random() * 5;
      particles.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * spread * 0.4,
        vy: good ? -(3 + Math.random() * 6) : Math.random() * 2,
        life: 1,
        decay: good ? 0.008 + Math.random() * 0.012 : 0.006 + Math.random() * 0.01,
        size: good ? 2 + Math.random() * 4 : 2 + Math.random() * 4.5,
        color: good ? pickEmberColor() : pickAshColor(),
        gravity: good ? -0.015 : 0.22,
        good,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * (good ? 0.1 : 0.25),
      });
    }
    if (!rafId) rafId = requestAnimationFrame(tickParticles);
  }

  function pickEmberColor() {
    const colors = ["#e7b24a", "#f2874a", "#fff3dc", "#c96a2f"];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  function pickAshColor() {
    const colors = ["#b23b4f", "#6b6270", "#3a3242", "#8a4550"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function tickParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.life -= p.decay;
      p.spin += p.spinSpeed;

      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;

      if (p.good) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    });

    particles = particles.filter((p) => p.life > 0 && p.y < canvas.height + 50 && p.y > -100);

    if (particles.length > 0) {
      rafId = requestAnimationFrame(tickParticles);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rafId = null;
    }
  }

  // ---------- Custom action creation ----------
  // Bounded so a custom action can't become a backdoor for setting aura to
  // anything: kindling tops out at KINDLE_APPLY_MAX (same ceiling every
  // other kindling act is held to); smothering keeps the wider range.
  const CUSTOM_ACTION_MIN = 100;
  const CUSTOM_SMOTHER_MAX = 1_000_000;

  function addCustomAction(isPositive) {
    const label = prompt(
      isPositive ? "What did you do to kindle your flame?" : "What did you do to smother it?"
    );
    if (!label || !label.trim()) return;
    const max = isPositive ? KINDLE_APPLY_MAX : CUSTOM_SMOTHER_MAX;
    const range = `${CUSTOM_ACTION_MIN.toLocaleString()}–${max.toLocaleString()}`;
    const raw = prompt(
      isPositive
        ? `How much aura does that kindle? (${range})`
        : `How much aura does that smother? (${range}, will be subtracted)`
    );
    let num = parseInt(raw, 10);
    if (isNaN(num) || num === 0) return;
    num = Math.min(max, Math.max(CUSTOM_ACTION_MIN, Math.abs(num)));
    const value = isPositive ? num : -num;
    const list = isPositive ? state.customPositive : state.customNegative;
    list.push({ label: label.trim(), value });
    saveState();
    renderAll();
  }

  // ---------- Events ----------
  resetBtn.addEventListener("click", () => {
    if (confirm("Snuff the flame out and reset your aura to 0? History stays.")) {
      resetAura();
    }
  });

  addPositiveBtn.addEventListener("click", () => addCustomAction(true));
  addNegativeBtn.addEventListener("click", () => addCustomAction(false));

  // ---------- Init ----------
  renderAll();

  // Small read-only hook for leaderboard.js — kept decoupled so the core
  // tracker never has to know Firebase (or a leaderboard) exists at all.
  window.Aura = {
    getAura: () => state.aura,
    formatNumber,
  };
})();

(() => {
  "use strict";

  const STORAGE_KEY = "aura-tracker-state-v2";

  const POSITIVE_DEFAULTS = [
    { label: "Helped a stranger", value: 18500 },
    { label: "Hit the gym", value: 42000 },
    { label: "Ate something healthy", value: 6200 },
    { label: "Got a genuine compliment", value: 24000 },
    { label: "Touched grass", value: 31000 },
    { label: "Did a good deed", value: 250000 },
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

  // The flame metaphor: aura is a fire you tend. It can go out entirely
  // (Fractured/Clouded), sit unlit at baseline (Dormant), catch (Kindled),
  // burn bright (Luminous), or become pure light (Transcendent). Thresholds
  // are scaled to match how wildly a single act can swing the flame.
  const TIERS = [
    { min: -Infinity, max: -300000, label: "Fractured", color: "#b23b4f", glow: "#b23b4f99" },
    { min: -300000, max: 0, label: "Clouded", color: "#c96a78", glow: "#c96a7877" },
    { min: 0, max: 100000, label: "Dormant", color: "#8a6fe0", glow: "#8a6fe066" },
    { min: 100000, max: 500000, label: "Kindled", color: "#e7b24a", glow: "#e7b24a88" },
    { min: 500000, max: 2000000, label: "Luminous", color: "#4fae8f", glow: "#4fae8f88" },
    { min: 2000000, max: Infinity, label: "Transcendent", color: "#fff3dc", glow: "#fff3dcaa" },
  ];

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
  const setInput = document.getElementById("set-input");
  const setBtn = document.getElementById("set-btn");
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

  // Past a million, plain digits stop being readable at a glance —
  // switch to "m.mm×10ⁿ" instead of a wall of commas.
  const SCI_NOTATION_THRESHOLD = 1_000_000;
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
  function applyDelta(delta, label) {
    if (!delta) return;
    state.aura += delta;
    state.history.push({ label, delta, at: Date.now() });
    if (state.history.length > 200) state.history = state.history.slice(-200);
    saveState();
    renderAuraValue();
    renderHistory();
    playImpact(delta);
  }

  function setAuraDirectly(newValue) {
    const before = state.aura;
    const delta = newValue - before;
    if (delta === 0) return;
    state.aura = newValue;
    state.history.push({ label: "Set by hand", delta, at: Date.now() });
    if (state.history.length > 200) state.history = state.history.slice(-200);
    saveState();
    renderAuraValue();
    renderHistory();
    playImpact(delta);
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
  function addCustomAction(isPositive) {
    const label = prompt(
      isPositive ? "What did you do to kindle your flame?" : "What did you do to smother it?"
    );
    if (!label || !label.trim()) return;
    const raw = prompt(
      isPositive
        ? "How much aura does that kindle? (positive number)"
        : "How much aura does that smother? (positive number, will be subtracted)"
    );
    let num = parseInt(raw, 10);
    if (isNaN(num) || num === 0) return;
    num = Math.abs(num);
    const value = isPositive ? num : -num;
    const list = isPositive ? state.customPositive : state.customNegative;
    list.push({ label: label.trim(), value });
    saveState();
    renderAll();
  }

  // ---------- Events ----------
  setBtn.addEventListener("click", () => {
    const raw = setInput.value.trim();
    if (raw === "") return;
    const num = parseInt(raw, 10);
    if (isNaN(num)) return;
    setAuraDirectly(num);
    setInput.value = "";
  });

  setInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") setBtn.click();
  });

  resetBtn.addEventListener("click", () => {
    if (confirm("Snuff the flame out and reset your aura to 0? History stays.")) {
      setAuraDirectly(0);
    }
  });

  addPositiveBtn.addEventListener("click", () => addCustomAction(true));
  addNegativeBtn.addEventListener("click", () => addCustomAction(false));

  // ---------- Init ----------
  renderAll();
})();

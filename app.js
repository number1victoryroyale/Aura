(() => {
  "use strict";

  const STORAGE_KEY = "aura-tracker-state-v1";

  const POSITIVE_DEFAULTS = [
    { label: "Helped a stranger", value: 15 },
    { label: "Hit the gym", value: 20 },
    { label: "Ate something healthy", value: 8 },
    { label: "Got a genuine compliment", value: 10 },
    { label: "Touched grass", value: 12 },
    { label: "Did a good deed", value: 25 },
    { label: "Woke up early with no alarm", value: 10 },
    { label: "Stayed hydrated all day", value: 5 },
  ];

  const NEGATIVE_DEFAULTS = [
    { label: "Rage quit a game", value: -15 },
    { label: "Ghosted someone", value: -12 },
    { label: "Was rude to someone", value: -18 },
    { label: "Doom scrolled for hours", value: -10 },
    { label: "Overslept and missed something", value: -8 },
    { label: "Got clowned on publicly", value: -22 },
    { label: "Lied about something small", value: -14 },
    { label: "Left dishes in the sink", value: -5 },
  ];

  const TIERS = [
    { max: -50, label: "Doomed", color: "#ff3366", glow: "#ff336699" },
    { max: 0, label: "Cursed", color: "#ff6b6b", glow: "#ff6b6b77" },
    { max: 50, label: "Neutral", color: "#7c6bff", glow: "#7c6bff77" },
    { max: 150, label: "Radiant", color: "#33ff99", glow: "#33ff9977" },
    { max: 300, label: "Ethereal", color: "#3fd8ff", glow: "#3fd8ff88" },
    { max: Infinity, label: "Legendary", color: "#ffd23f", glow: "#ffd23f99" },
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

  // ---------- DOM refs ----------
  const auraValueEl = document.getElementById("aura-value");
  const orbEl = document.getElementById("orb");
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

  // ---------- Tier / color logic ----------
  function getTier(value) {
    return TIERS.find((t) => value < t.max) || TIERS[TIERS.length - 1];
  }

  function updateOrbVisuals() {
    const tier = getTier(state.aura);
    orbEl.style.setProperty("--orb-color", tier.color);
    orbEl.style.setProperty("--orb-glow", tier.glow);
    tierLabelEl.textContent = tier.label;
    tierLabelEl.style.color = tier.color;
    tierLabelEl.style.borderColor = tier.color + "55";
  }

  function renderAuraValue() {
    auraValueEl.textContent = state.aura.toLocaleString();
    updateOrbVisuals();
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
      empty.style.color = "var(--text-dim)";
      empty.style.fontSize = "0.85rem";
      empty.textContent = "No actions yet.";
      container.appendChild(empty);
      return;
    }
    all.forEach((action, idx) => {
      const item = document.createElement("button");
      item.className = "action-item";
      item.type = "button";

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = action.label;

      const value = document.createElement("span");
      value.className = "value";
      value.textContent = (action.value > 0 ? "+" : "") + action.value;

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
      li.textContent = "Nothing has happened yet. Go touch some grass.";
      historyListEl.appendChild(li);
      return;
    }
    state.history
      .slice()
      .reverse()
      .slice(0, 30)
      .forEach((entry) => {
        const li = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = entry.label;
        const delta = document.createElement("span");
        delta.className = "delta " + (entry.delta >= 0 ? "pos" : "neg");
        delta.textContent = (entry.delta >= 0 ? "+" : "") + entry.delta;
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
    const before = state.aura;
    state.aura = before + delta;
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
    state.history.push({ label: "Manually set aura", delta, at: Date.now() });
    if (state.history.length > 200) state.history = state.history.slice(-200);
    saveState();
    renderAuraValue();
    renderHistory();
    playImpact(delta);
  }

  function playImpact(delta) {
    const good = delta > 0;
    const magnitude = Math.abs(delta);
    // Intensity scales with magnitude, capped.
    const intensity = Math.min(1, magnitude / 30);

    // Number bump animation
    auraValueEl.classList.remove("bump-up", "bump-down");
    void auraValueEl.offsetWidth; // reflow to restart animation
    auraValueEl.classList.add(good ? "bump-up" : "bump-down");

    // Screen shake
    shakeWrap.classList.remove("shake-good", "shake-bad");
    void shakeWrap.offsetWidth;
    shakeWrap.classList.add(good ? "shake-good" : "shake-bad");

    // Flash
    flashEl.classList.remove("flash-good", "flash-bad");
    void flashEl.offsetWidth;
    flashEl.classList.add(good ? "flash-good" : "flash-bad");

    // Impact banner text slam
    impactBanner.textContent = (good ? "+" : "") + delta + " AURA";
    impactBanner.classList.remove("play-good", "play-bad");
    void impactBanner.offsetWidth;
    impactBanner.classList.add(good ? "play-good" : "play-bad");

    // Particle burst, scaled by magnitude
    const baseCount = good ? 40 : 30;
    spawnParticles(good, Math.round(baseCount + intensity * 120));

    // Orb glow pop
    orbEl.animate(
      [
        { filter: "brightness(1)" },
        { filter: `brightness(${1.4 + intensity * 1.2})` },
        { filter: "brightness(1)" },
      ],
      { duration: 500 + intensity * 300, easing: "ease-out" }
    );
  }

  // ---------- Particle system ----------
  let particles = [];
  let rafId = null;

  function spawnParticles(good, count) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = good ? 4 + Math.random() * 10 : 2 + Math.random() * 6;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (good ? 2 : 0),
        life: 1,
        decay: 0.008 + Math.random() * 0.015,
        size: good ? 3 + Math.random() * 5 : 2 + Math.random() * 4,
        color: good ? pickGoodColor() : pickBadColor(),
        gravity: good ? 0.08 : 0.25,
        good,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.3,
      });
    }
    if (!rafId) rafId = requestAnimationFrame(tickParticles);
  }

  function pickGoodColor() {
    const colors = ["#ffd23f", "#33ff99", "#7c6bff", "#3fd8ff", "#ffffff"];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  function pickBadColor() {
    const colors = ["#ff3366", "#8a0f2e", "#450815", "#ff6b6b"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function tickParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.99;
      p.life -= p.decay;
      p.spin += p.spinSpeed;

      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      if (p.good) {
        // sparkle diamond
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // jagged shard
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    });

    particles = particles.filter((p) => p.life > 0 && p.y < canvas.height + 50);

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
      isPositive ? "What good deed did you do?" : "What did you do to deserve this?"
    );
    if (!label || !label.trim()) return;
    let raw = prompt(
      isPositive
        ? "How much aura is that worth? (positive number)"
        : "How much aura does that cost? (positive number, will be subtracted)"
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
    if (confirm("Reset your aura to 0? This won't clear your history.")) {
      setAuraDirectly(0);
    }
  });

  addPositiveBtn.addEventListener("click", () => addCustomAction(true));
  addNegativeBtn.addEventListener("click", () => addCustomAction(false));

  // ---------- Init ----------
  renderAll();
})();

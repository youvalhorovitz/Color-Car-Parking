(() => {
  "use strict";

  const PALETTE = [
    { name: "red", hex: "#e6483c" },
    { name: "blue", hex: "#3b82f6" },
    { name: "green", hex: "#3fa93f" },
    { name: "yellow", hex: "#e6b800" },
    { name: "orange", hex: "#f0791a" },
    { name: "purple", hex: "#9b4fd1" },
    { name: "pink", hex: "#ec6ea3" },
    { name: "teal", hex: "#1fb0a0" },
  ];

  const LIMITS = {
    carColors: { min: 1, max: PALETTE.length },
    houseColors: { min: 1, max: PALETTE.length },
    numCars: { min: 1, max: 14 },
    numHouses: { min: 1, max: 8 },
  };

  let config = { carColors: 4, houseColors: 4, numCars: 6, numHouses: 6 };

  const state = {
    houses: [],
    cars: [],
    parkedCount: 0,
  };

  const el = {
    game: document.getElementById("game"),
    housesRow: document.getElementById("housesRow"),
    lot: document.getElementById("lot"),
    stat: document.getElementById("stat"),
    shuffleBtn: document.getElementById("shuffleBtn"),
    setupBtn: document.getElementById("setupBtn"),
    setupOverlay: document.getElementById("setupOverlay"),
    setupCancel: document.getElementById("setupCancel"),
    setupApply: document.getElementById("setupApply"),
    winOverlay: document.getElementById("winOverlay"),
    playAgainBtn: document.getElementById("playAgainBtn"),
    changeSettingsBtn: document.getElementById("changeSettingsBtn"),
    fireworksCanvas: document.getElementById("fireworks"),
  };

  // ---------- color helpers ----------

  function shade(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.max(0, Math.min(255, Math.round(r + (percent < 0 ? r : 255 - r) * percent)));
    g = Math.max(0, Math.min(255, Math.round(g + (percent < 0 ? g : 255 - g) * percent)));
    b = Math.max(0, Math.min(255, Math.round(b + (percent < 0 ? b : 255 - b) * percent)));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function svgHouse(hex) {
    const roof = shade(hex, -0.35);
    const wall = hex;
    return `
      <svg viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg">
        <polygon points="60,4 112,46 8,46" fill="${roof}" />
        <rect x="18" y="44" width="84" height="58" rx="6" fill="${wall}" />
        <rect x="30" y="56" width="16" height="16" rx="2" fill="#fdf6e3" />
        <rect x="74" y="56" width="16" height="16" rx="2" fill="#fdf6e3" />
        <rect x="48" y="72" width="24" height="30" rx="3" fill="#fbeadb" />
        <circle cx="66" cy="88" r="1.8" fill="#3a2a1e" />
      </svg>`;
  }

  function svgCar(hex) {
    const dark = shade(hex, -0.4);
    const wheel = "#2b2b2b";
    const hub = "#c9c9c9";
    return `
      <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="28" width="92" height="20" rx="10" fill="${hex}" />
        <path d="M22 28 C26 12, 66 12, 74 28 Z" fill="${hex}" />
        <path d="M28 27 C31 17, 62 17, 68 27 Z" fill="#eaf6ff" />
        <circle cx="26" cy="49" r="10" fill="${wheel}" />
        <circle cx="26" cy="49" r="4" fill="${hub}" />
        <circle cx="74" cy="49" r="10" fill="${wheel}" />
        <circle cx="74" cy="49" r="4" fill="${hub}" />
        <rect x="4" y="32" width="10" height="8" rx="3" fill="${dark}" />
        <circle cx="90" cy="36" r="3" fill="#fff3b0" />
      </svg>`;
  }

  // ---------- setup helpers ----------

  function clampConfig(changedKey) {
    config.carColors = Math.min(LIMITS.carColors.max, Math.max(LIMITS.carColors.min, config.carColors));
    if (config.houseColors < config.carColors) config.houseColors = config.carColors;
    config.houseColors = Math.min(LIMITS.houseColors.max, Math.max(LIMITS.houseColors.min, config.houseColors));

    if (config.numCars < config.carColors) config.numCars = config.carColors;
    config.numCars = Math.min(LIMITS.numCars.max, Math.max(LIMITS.numCars.min, config.numCars));

    if (config.numHouses < config.houseColors) config.numHouses = config.houseColors;
    config.numHouses = Math.min(LIMITS.numHouses.max, Math.max(LIMITS.numHouses.min, config.numHouses));
  }

  function renderSetupValues() {
    document.getElementById("val-carColors").textContent = config.carColors;
    document.getElementById("val-houseColors").textContent = config.houseColors;
    document.getElementById("val-numCars").textContent = config.numCars;
    document.getElementById("val-numHouses").textContent = config.numHouses;
  }

  document.querySelectorAll(".stepper").forEach((stepper) => {
    const key = stepper.dataset.key;
    stepper.querySelectorAll(".step-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = btn.dataset.action === "inc" ? 1 : -1;
        config[key] += dir;
        clampConfig(key);
        renderSetupValues();
      });
    });
  });

  function openSetup() {
    renderSetupValues();
    el.setupOverlay.hidden = false;
  }

  function closeSetup() {
    el.setupOverlay.hidden = true;
  }

  el.setupBtn.addEventListener("click", openSetup);
  el.setupCancel.addEventListener("click", closeSetup);
  el.setupApply.addEventListener("click", () => {
    closeSetup();
    startNewGame();
  });

  // ---------- game setup ----------

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickDistinct(pool, count) {
    return shuffleArray(pool).slice(0, count);
  }

  function assignColors(colorSet, count) {
    const result = [];
    const shuffledSet = shuffleArray(colorSet);
    for (let i = 0; i < count; i++) {
      if (i < shuffledSet.length) {
        result.push(shuffledSet[i]);
      } else {
        result.push(colorSet[Math.floor(Math.random() * colorSet.length)]);
      }
    }
    return shuffleArray(result);
  }

  function startNewGame() {
    const houseColorSet = pickDistinct(PALETTE, config.houseColors);
    const carColorSet = pickDistinct(houseColorSet, config.carColors);

    const houseColors = assignColors(houseColorSet, config.numHouses);
    const carColorsAssigned = assignColors(carColorSet, config.numCars);

    state.houses = houseColors.map((color, i) => ({
      id: i,
      color,
      parkedCars: [],
    }));

    state.cars = carColorsAssigned.map((color, i) => ({
      id: i,
      color,
      parked: false,
      el: null,
    }));

    state.parkedCount = 0;

    renderHouses();
    renderCars();
    updateStat();
    el.winOverlay.hidden = true;
  }

  function renderHouses() {
    el.housesRow.innerHTML = "";
    state.houses.forEach((house) => {
      const slot = document.createElement("div");
      slot.className = "house-slot";
      slot.innerHTML = svgHouse(house.color.hex);
      el.housesRow.appendChild(slot);
    });
  }

  function renderCars() {
    el.lot.innerHTML = "";
    const lotRect = el.lot.getBoundingClientRect();
    const carW = 92;
    const carH = 52;
    const placed = [];

    state.cars.forEach((car) => {
      const carEl = document.createElement("div");
      carEl.className = "car";
      carEl.innerHTML = svgCar(car.color.hex);

      const pos = findFreeSpot(lotRect.width, lotRect.height, carW, carH, placed);
      placed.push(pos);
      carEl.style.left = `${pos.x}px`;
      carEl.style.top = `${pos.y}px`;

      carEl.addEventListener("pointerdown", (e) => onPointerDown(e, car));
      el.lot.appendChild(carEl);
      car.el = carEl;
    });
  }

  function findFreeSpot(areaW, areaH, w, h, placed) {
    const maxX = Math.max(0, areaW - w - 8);
    const maxY = Math.max(0, areaH - h - 8);
    let best = { x: Math.random() * maxX, y: Math.random() * maxY };
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = { x: Math.random() * maxX, y: Math.random() * maxY };
      const ok = placed.every((p) => {
        const dx = candidate.x - p.x;
        const dy = candidate.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) > 80;
      });
      if (ok) {
        best = candidate;
        break;
      }
    }
    return best;
  }

  function updateStat() {
    el.stat.textContent = `${state.parkedCount} / ${state.cars.length} parked`;
  }

  // ---------- drag & drop ----------

  let drag = null;

  function onPointerDown(e, car) {
    if (car.parked) return;
    const carEl = car.el;
    carEl.setPointerCapture(e.pointerId);
    const lotRect = el.lot.getBoundingClientRect();
    const carRect = carEl.getBoundingClientRect();

    drag = {
      car,
      pointerId: e.pointerId,
      offsetX: e.clientX - carRect.left,
      offsetY: e.clientY - carRect.top,
      startLeft: parseFloat(carEl.style.left) || 0,
      startTop: parseFloat(carEl.style.top) || 0,
    };

    carEl.classList.add("dragging");

    carEl.addEventListener("pointermove", onPointerMove);
    carEl.addEventListener("pointerup", onPointerUp);
    carEl.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const lotRect = el.lot.getBoundingClientRect();
    let x = e.clientX - lotRect.left - drag.offsetX;
    let y = e.clientY - lotRect.top - drag.offsetY;
    drag.car.el.style.left = `${x}px`;
    drag.car.el.style.top = `${y}px`;
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { car } = drag;
    const carEl = car.el;
    carEl.classList.remove("dragging");
    carEl.removeEventListener("pointermove", onPointerMove);
    carEl.removeEventListener("pointerup", onPointerUp);
    carEl.removeEventListener("pointercancel", onPointerUp);

    const gameRect = el.game.getBoundingClientRect();
    const carRect = carEl.getBoundingClientRect();
    const centerX = carRect.left + carRect.width / 2 - gameRect.left;

    const colWidth = gameRect.width / state.houses.length;
    let houseIndex = Math.floor(centerX / colWidth);
    houseIndex = Math.max(0, Math.min(state.houses.length - 1, houseIndex));
    const house = state.houses[houseIndex];

    if (house.color.name === car.color.name) {
      parkCar(car, house);
    } else {
      carEl.style.left = `${drag.startLeft}px`;
      carEl.style.top = `${drag.startTop}px`;
      carEl.classList.add("reject");
      setTimeout(() => carEl.classList.remove("reject"), 350);
    }

    drag = null;
  }

  function parkCar(car, house) {
    car.parked = true;
    car.el.classList.add("parked");
    house.parkedCars.push(car);

    const slotPos = computeSlotPosition(house);
    car.el.style.left = `${slotPos.x}px`;
    car.el.style.top = `${slotPos.y}px`;

    state.parkedCount++;
    updateStat();

    if (state.parkedCount === state.cars.length) {
      setTimeout(showWin, 350);
    }
  }

  function computeSlotPosition(house) {
    const gameRect = el.game.getBoundingClientRect();
    const lotRect = el.lot.getBoundingClientRect();
    const colWidth = gameRect.width / state.houses.length;
    const colCenterX = house.id * colWidth + colWidth / 2 - (lotRect.left - gameRect.left);

    const carW = 92;
    const carH = 52;
    const n = house.parkedCars.length - 1;
    const perRow = 2;
    const row = Math.floor(n / perRow);
    const col = n % perRow;
    const gap = 6;
    const x = colCenterX + (col === 0 ? -(carW + gap / 2) : gap / 2);
    const y = 12 + row * (carH + 10);
    return { x, y };
  }

  // ---------- win / fireworks ----------

  let fwCtx = null;
  let fwParticles = [];
  let fwAnimating = false;
  let fwBurstTimer = null;

  function showWin() {
    el.winOverlay.hidden = false;
    startFireworks();
  }

  function hideWin() {
    el.winOverlay.hidden = true;
    stopFireworks();
  }

  function resizeFireworksCanvas() {
    const canvas = el.fireworksCanvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function startFireworks() {
    resizeFireworksCanvas();
    fwCtx = el.fireworksCanvas.getContext("2d");
    fwParticles = [];
    fwAnimating = true;

    const burst = () => {
      if (!fwAnimating) return;
      const x = Math.random() * el.fireworksCanvas.width;
      const y = Math.random() * el.fireworksCanvas.height * 0.5 + 40;
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)].hex;
      for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40;
        const speed = 2 + Math.random() * 3;
        fwParticles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color,
        });
      }
      fwBurstTimer = setTimeout(burst, 500 + Math.random() * 400);
    };
    burst();
    requestAnimationFrame(fwLoop);
  }

  function fwLoop() {
    if (!fwAnimating) return;
    fwCtx.clearRect(0, 0, el.fireworksCanvas.width, el.fireworksCanvas.height);
    fwParticles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.alpha -= 0.012;
    });
    fwParticles = fwParticles.filter((p) => p.alpha > 0);
    fwParticles.forEach((p) => {
      fwCtx.globalAlpha = Math.max(0, p.alpha);
      fwCtx.fillStyle = p.color;
      fwCtx.beginPath();
      fwCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      fwCtx.fill();
    });
    fwCtx.globalAlpha = 1;
    requestAnimationFrame(fwLoop);
  }

  function stopFireworks() {
    fwAnimating = false;
    if (fwBurstTimer) clearTimeout(fwBurstTimer);
    fwParticles = [];
    if (fwCtx) fwCtx.clearRect(0, 0, el.fireworksCanvas.width, el.fireworksCanvas.height);
  }

  el.playAgainBtn.addEventListener("click", () => {
    hideWin();
    startNewGame();
  });

  el.changeSettingsBtn.addEventListener("click", () => {
    hideWin();
    openSetup();
  });

  el.shuffleBtn.addEventListener("click", () => {
    startNewGame();
  });

  window.addEventListener("resize", () => {
    if (!el.winOverlay.hidden) resizeFireworksCanvas();
    repositionParkedCars();
  });

  function repositionParkedCars() {
    state.houses.forEach((house) => {
      house.parkedCars.forEach((car, idx) => {
        const tmp = { ...house, parkedCars: house.parkedCars.slice(0, idx + 1) };
        const pos = computeSlotPosition(tmp);
        car.el.style.left = `${pos.x}px`;
        car.el.style.top = `${pos.y}px`;
      });
    });
  }

  clampConfig();
  startNewGame();
})();

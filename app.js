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

  const MAX_NUM_CARS = 14;
  const MAX_NUM_HOUSES = 8;

  const FREE_CAR_W = 78;
  const FREE_CAR_H = 44;
  const PARKED_CAR_W = 60;
  const PARKED_CAR_H = 34;
  const PARK_GAP = 4;
  const PARK_TOP_PADDING = 14;
  const PARK_ZONE_HEIGHT = PARK_TOP_PADDING * 2 + PARKED_CAR_H;

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

  let config = {
    numCars: 6,
    numHouses: 4,
    limitsEnabled: false,
    houseColorSet: pickDistinct(PALETTE, 3),
    carColorSet: [],
  };
  config.carColorSet = pickDistinct(config.houseColorSet, 3);

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
    setupClose: document.getElementById("setupClose"),
    setupApply: document.getElementById("setupApply"),
    limitsToggle: document.getElementById("limitsToggle"),
    carSwatches: document.getElementById("carSwatches"),
    houseSwatches: document.getElementById("houseSwatches"),
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

  // ---------- setup: color set helpers ----------

  function ensureCarColorsSubset() {
    const houseNames = config.houseColorSet.map((c) => c.name);
    config.carColorSet = config.carColorSet.map((car, i) => {
      if (houseNames.includes(car.name)) return car;
      const usedByOthers = config.carColorSet
        .filter((_, j) => j !== i)
        .map((c) => c.name);
      const replacement = config.houseColorSet.find((hc) => !usedByOthers.includes(hc.name));
      return replacement || config.houseColorSet[0];
    });
  }

  function clampCounts() {
    if (config.numCars < config.carColorSet.length) config.numCars = config.carColorSet.length;
    config.numCars = Math.min(MAX_NUM_CARS, Math.max(config.carColorSet.length, config.numCars));

    if (config.numHouses < config.houseColorSet.length) config.numHouses = config.houseColorSet.length;
    config.numHouses = Math.min(MAX_NUM_HOUSES, Math.max(config.houseColorSet.length, config.numHouses));
  }

  function incHouseColors() {
    if (config.houseColorSet.length >= PALETTE.length) return;
    const usedNames = config.houseColorSet.map((c) => c.name);
    const next = PALETTE.find((c) => !usedNames.includes(c.name));
    if (next) config.houseColorSet.push(next);
    clampCounts();
  }

  function decHouseColors() {
    if (config.houseColorSet.length <= Math.max(1, config.carColorSet.length)) return;
    config.houseColorSet.pop();
    ensureCarColorsSubset();
    clampCounts();
  }

  function incCarColors() {
    if (config.carColorSet.length >= config.houseColorSet.length) return;
    const usedNames = config.carColorSet.map((c) => c.name);
    const next = config.houseColorSet.find((c) => !usedNames.includes(c.name));
    if (next) config.carColorSet.push(next);
    clampCounts();
  }

  function decCarColors() {
    if (config.carColorSet.length <= 1) return;
    config.carColorSet.pop();
    clampCounts();
  }

  function cycleSwatch(pool, arr, index) {
    const current = arr[index];
    const startIdx = pool.findIndex((c) => c.name === current.name);
    for (let step = 1; step <= pool.length; step++) {
      const candidate = pool[(startIdx + step) % pool.length];
      const usedElsewhere = arr.some((c, i) => i !== index && c.name === candidate.name);
      if (!usedElsewhere) {
        arr[index] = candidate;
        return;
      }
    }
  }

  function cycleHouseSwatch(index) {
    cycleSwatch(PALETTE, config.houseColorSet, index);
    ensureCarColorsSubset();
  }

  function cycleCarSwatch(index) {
    cycleSwatch(config.houseColorSet, config.carColorSet, index);
  }

  // ---------- setup UI ----------

  function renderSetupUI() {
    document.getElementById("val-carColors").textContent = config.carColorSet.length;
    document.getElementById("val-houseColors").textContent = config.houseColorSet.length;
    document.getElementById("val-numCars").textContent = config.numCars;
    document.getElementById("val-numHouses").textContent = config.numHouses;
    el.limitsToggle.setAttribute("aria-checked", String(config.limitsEnabled));

    el.carSwatches.innerHTML = "";
    config.carColorSet.forEach((color, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch circle";
      btn.style.background = color.hex;
      btn.title = color.name;
      btn.addEventListener("click", () => {
        cycleCarSwatch(i);
        renderSetupUI();
      });
      el.carSwatches.appendChild(btn);
    });

    el.houseSwatches.innerHTML = "";
    config.houseColorSet.forEach((color, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch square";
      btn.style.background = color.hex;
      btn.title = color.name;
      btn.addEventListener("click", () => {
        cycleHouseSwatch(i);
        renderSetupUI();
      });
      el.houseSwatches.appendChild(btn);
    });
  }

  document.querySelectorAll(".stepper").forEach((stepper) => {
    const key = stepper.dataset.key;
    stepper.querySelectorAll(".step-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const inc = btn.dataset.action === "inc";
        if (key === "carColors") inc ? incCarColors() : decCarColors();
        else if (key === "houseColors") inc ? incHouseColors() : decHouseColors();
        else if (key === "numCars") {
          config.numCars += inc ? 1 : -1;
          clampCounts();
        } else if (key === "numHouses") {
          config.numHouses += inc ? 1 : -1;
          clampCounts();
        }
        renderSetupUI();
      });
    });
  });

  el.limitsToggle.addEventListener("click", () => {
    config.limitsEnabled = !config.limitsEnabled;
    renderSetupUI();
  });

  let configSnapshot = null;

  function openSetup() {
    configSnapshot = JSON.parse(JSON.stringify(config));
    renderSetupUI();
    el.setupOverlay.hidden = false;
  }

  function closeSetup(restore) {
    if (restore && configSnapshot) config = configSnapshot;
    configSnapshot = null;
    el.setupOverlay.hidden = true;
  }

  el.setupBtn.addEventListener("click", openSetup);
  el.setupClose.addEventListener("click", () => closeSetup(true));
  el.setupApply.addEventListener("click", () => {
    closeSetup(false);
    startNewGame();
  });

  // ---------- game setup ----------

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

  // Give some houses a capacity sign. Only colors that appear on more than one
  // house are eligible, and the limits are always generous enough that every car
  // still has somewhere to go.
  function assignHouseLimits() {
    state.houses.forEach((h) => {
      h.limit = null;
    });
    if (!config.limitsEnabled) return;

    const byColor = new Map();
    state.houses.forEach((h) => {
      if (!byColor.has(h.color.name)) byColor.set(h.color.name, []);
      byColor.get(h.color.name).push(h);
    });

    const eligible = [];

    byColor.forEach((houses, colorName) => {
      if (houses.length < 2) return;
      const carCount = state.cars.filter((c) => c.color.name === colorName).length;
      if (carCount === 0) return;

      // Deal the cars of this color out across its houses at random. Using that
      // deal as the floor for each capacity guarantees the board stays solvable
      // even if every house of the color ends up signed.
      const dealt = new Array(houses.length).fill(0);
      for (let i = 0; i < carCount; i++) {
        dealt[Math.floor(Math.random() * houses.length)]++;
      }

      // Cap below the color's car count so a sign is always a real constraint.
      const maxLimit = Math.max(1, carCount - 1);
      houses.forEach((house, i) => {
        const slack = Math.random() < 0.5 ? 0 : 1;
        house.candidateLimit = Math.min(maxLimit, Math.max(1, dealt[i] + slack));
      });
      eligible.push(houses);
    });

    let anySigned = false;
    eligible.forEach((houses) => {
      houses.forEach((house) => {
        if (Math.random() < 0.65) {
          house.limit = house.candidateLimit;
          anySigned = true;
        }
      });
    });

    // If the dice said "no signs anywhere", force one so the mode is visible.
    if (!anySigned && eligible.length) {
      const houses = eligible[Math.floor(Math.random() * eligible.length)];
      const house = houses[Math.floor(Math.random() * houses.length)];
      house.limit = house.candidateLimit;
    }

    state.houses.forEach((h) => {
      delete h.candidateLimit;
    });
  }

  function startNewGame() {
    const houseColors = assignColors(config.houseColorSet, config.numHouses);
    const carColorsAssigned = assignColors(config.carColorSet, config.numCars);

    state.houses = houseColors.map((color, i) => ({
      id: i,
      color,
      limit: null,
      parkedCars: [],
    }));

    state.cars = carColorsAssigned.map((color, i) => ({
      id: i,
      color,
      parked: false,
      el: null,
    }));

    state.parkedCount = 0;

    assignHouseLimits();
    renderHouses();
    renderCars();
    updateStat();
    el.winOverlay.hidden = true;
  }

  function renderHouses() {
    el.housesRow.innerHTML = "";
    const anyLimits = state.houses.some((h) => h.limit !== null);
    el.housesRow.classList.toggle("has-signs", anyLimits);

    state.houses.forEach((house) => {
      const slot = document.createElement("div");
      slot.className = "house-slot";

      const signArea = document.createElement("div");
      signArea.className = "sign-area";
      if (house.limit !== null) {
        const board = document.createElement("div");
        board.className = "sign-board";
        board.textContent = house.limit;
        const post = document.createElement("div");
        post.className = "sign-post";
        signArea.appendChild(board);
        signArea.appendChild(post);
        house.signBoardEl = board;
      } else {
        house.signBoardEl = null;
      }

      const art = document.createElement("div");
      art.className = "house-art";
      art.innerHTML = svgHouse(house.color.hex);

      slot.appendChild(signArea);
      slot.appendChild(art);
      el.housesRow.appendChild(slot);
    });
  }

  function isHouseFull(house) {
    return house.limit !== null && house.parkedCars.length >= house.limit;
  }

  function refreshSign(house) {
    if (house.signBoardEl) house.signBoardEl.classList.toggle("full", isHouseFull(house));
  }

  function renderCars() {
    el.lot.innerHTML = "";
    const lotRect = el.lot.getBoundingClientRect();
    const placed = [];

    state.cars.forEach((car) => {
      const carEl = document.createElement("div");
      carEl.className = "car";
      carEl.innerHTML = svgCar(car.color.hex);

      const pos = findFreeSpot(lotRect.width, lotRect.height, FREE_CAR_W, FREE_CAR_H, placed);
      placed.push(pos);
      carEl.style.left = `${pos.x}px`;
      carEl.style.top = `${pos.y}px`;

      carEl.addEventListener("pointerdown", (e) => onPointerDown(e, car));
      el.lot.appendChild(carEl);
      car.el = carEl;
    });
  }

  function findFreeSpot(areaW, areaH, w, h, placed) {
    const minY = PARK_ZONE_HEIGHT + 10;
    const maxX = Math.max(0, areaW - w - 8);
    const maxY = Math.max(minY, areaH - h - 8);
    let best = { x: Math.random() * maxX, y: minY + Math.random() * (maxY - minY) };
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = { x: Math.random() * maxX, y: minY + Math.random() * (maxY - minY) };
      const ok = placed.every((p) => {
        const dx = candidate.x - p.x;
        const dy = candidate.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) > 68;
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

    if (house.color.name === car.color.name && !isHouseFull(house)) {
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

    layoutHouseRow(house);
    refreshSign(house);

    state.parkedCount++;
    updateStat();

    if (state.parkedCount === state.cars.length) {
      setTimeout(showWin, 350);
    }
  }

  function layoutHouseRow(house) {
    const gameRect = el.game.getBoundingClientRect();
    const lotRect = el.lot.getBoundingClientRect();
    const colWidth = gameRect.width / state.houses.length;
    const colCenterX = house.id * colWidth + colWidth / 2 - (lotRect.left - gameRect.left);

    const n = house.parkedCars.length;
    const rowWidth = n * PARKED_CAR_W + (n - 1) * PARK_GAP;
    const startX = colCenterX - rowWidth / 2;

    house.parkedCars.forEach((car, idx) => {
      const x = startX + idx * (PARKED_CAR_W + PARK_GAP);
      car.el.style.left = `${x}px`;
      car.el.style.top = `${PARK_TOP_PADDING}px`;
    });
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
    state.houses.forEach(layoutHouseRow);
  });

  clampCounts();
  startNewGame();
})();

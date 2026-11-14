const EXT_ID = "com.echoes-forgotten-age.weight-room";
const STATE_KEY = `${EXT_ID}/state`;
const SDK_URL = "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3/+esm";

const PEDESTALS = [
  { id: "A", base: 9 },
  { id: "B", base: 8 },
  { id: "C", base: 7 },
  { id: "D", base: 6 },
];

const STONES = [
  { id: "stone-1", weight: 1, size: 28 },
  { id: "stone-2", weight: 2, size: 33 },
  { id: "stone-3", weight: 3, size: 38 },
  { id: "stone-4", weight: 4, size: 43 },
  { id: "stone-5", weight: 5, size: 48 },
  { id: "stone-6", weight: 6, size: 53 },
  { id: "stone-7", weight: 7, size: 58 },
];

const INITIAL_PLACEMENTS = Object.fromEntries(STONES.map(s => [s.id, "tray"]));

let state = {
  placements: { ...INITIAL_PLACEMENTS },
  hintLevel: 0,
  realDoor: 1,
};

let OBR = null;
let obrMode = false;
let sceneReady = true;
let role = "GM";
let selectedStone = null;
let unsubscribeMetadata = null;
let playedSolvedSound = false;

const $ = (sel) => document.querySelector(sel);

function normalizeState(candidate) {
  const safe = candidate && typeof candidate === "object" ? candidate : {};
  return {
    placements: { ...INITIAL_PLACEMENTS, ...(safe.placements || {}) },
    hintLevel: [0,1,2].includes(safe.hintLevel) ? safe.hintLevel : 0,
    realDoor: [0,1,2].includes(Number(safe.realDoor)) ? Number(safe.realDoor) : 1,
  };
}

function pedestalLoad(index) {
  const pid = `pedestal-${index}`;
  return STONES
    .filter(s => state.placements[s.id] === pid)
    .reduce((sum, s) => sum + s.weight, 0);
}

function finalHeight(index) {
  return PEDESTALS[index].base - pedestalLoad(index);
}

function isSolved() {
  const heights = PEDESTALS.map((_, i) => finalHeight(i));
  return heights.every(h => h >= 1) && heights.every(h => h === heights[0]);
}

async function saveState(next) {
  state = normalizeState(next);
  render();

  if (obrMode && sceneReady) {
    await OBR.scene.setMetadata({ [STATE_KEY]: state });
  } else {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }
}

async function moveStone(stoneId, destination) {
  if (!sceneReady) return;
  const next = normalizeState(state);
  next.placements[stoneId] = destination;
  selectedStone = null;
  await saveState(next);
}

function createStone(stone) {
  const el = document.createElement("div");
  el.className = "stone";
  if (selectedStone === stone.id) el.classList.add("selected");
  el.draggable = true;
  el.dataset.stoneId = stone.id;
  el.style.width = `${stone.size}px`;
  el.style.height = `${stone.size}px`;
  el.title = "Λίθινη σφαίρα";

  el.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", stone.id);
    e.dataTransfer.effectAllowed = "move";
  });

  el.addEventListener("click", e => {
    e.stopPropagation();
    selectedStone = selectedStone === stone.id ? null : stone.id;
    render();
  });

  return el;
}

function setupDropzone(el, zone) {
  el.addEventListener("dragover", e => {
    e.preventDefault();
    el.classList.add("drag-over");
  });
  el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
  el.addEventListener("drop", async e => {
    e.preventDefault();
    el.classList.remove("drag-over");
    const stoneId = e.dataTransfer.getData("text/plain");
    if (stoneId) await moveStone(stoneId, zone);
  });
  el.addEventListener("click", async () => {
    if (selectedStone) await moveStone(selectedStone, zone);
  });
}

function renderPedestals() {
  const wrap = $("#pedestals");
  wrap.innerHTML = "";

  PEDESTALS.forEach((ped, index) => {
    const h = finalHeight(index);
    const visualH = Math.max(1, Math.min(9, h));
    const platformBottom = 30 + visualH * 19;

    const box = document.createElement("div");
    box.className = "pedestal dropzone";
    box.dataset.zone = `pedestal-${index}`;

    const shaft = document.createElement("div");
    shaft.className = "shaft";
    shaft.style.height = `${Math.max(28, visualH * 8.5)}%`;

    const platform = document.createElement("div");
    platform.className = "platform";
    platform.style.bottom = `${platformBottom}px`;

    const stack = document.createElement("div");
    stack.className = "stone-stack";
    stack.style.bottom = `${platformBottom + 14}px`;

    STONES
      .filter(s => state.placements[s.id] === `pedestal-${index}`)
      .sort((a,b) => b.weight - a.weight)
      .forEach(s => stack.appendChild(createStone(s)));

    const mark = document.createElement("div");
    mark.className = "pedestal-mark";
    mark.textContent = ["Ⅰ","Ⅱ","Ⅲ","Ⅳ"][index];

    box.append(shaft, platform, stack, mark);
    setupDropzone(box, `pedestal-${index}`);
    wrap.appendChild(box);
  });
}

function renderTray() {
  const tray = $("#tray");
  tray.innerHTML = "";
  setupDropzoneOnce(tray, "tray");
  STONES
    .filter(s => state.placements[s.id] === "tray")
    .sort((a,b) => a.weight - b.weight)
    .forEach(s => tray.appendChild(createStone(s)));
}

let traySetup = false;
function setupDropzoneOnce(el, zone) {
  if (traySetup) return;
  setupDropzone(el, zone);
  traySetup = true;
}

function playUnlockSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [110, 165, 220].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now + i * .08);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * .08 + .02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + .55 + i * .08);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i*.08);
      osc.stop(now + .7 + i*.08);
    });
  } catch {}
}

function renderDoors(solved) {
  document.querySelectorAll(".door").forEach((door, idx) => {
    door.classList.toggle("open", solved && idx === state.realDoor);
  });
}

function renderHint() {
  const hint = $("#hint");
  if (state.hintLevel === 0) {
    hint.classList.add("hidden");
    return;
  }
  hint.classList.remove("hidden");
  hint.textContent = state.hintLevel === 1
    ? "Παρατήρηση: τα βάθρα λειτουργούν σαν μηχανικές ζυγαριές."
    : "Παρατήρηση: το κρίσιμο στοιχείο δεν είναι ίσο βάρος, αλλά να καταλήξουν και τα τέσσερα βάθρα στο ίδιο τελικό ύψος.";
}

function renderGM() {
  const panel = $("#gmPanel");
  const isGM = role === "GM";
  panel.classList.toggle("hidden", !isGM);
  if (!isGM) return;

  $("#doorSelect").value = String(state.realDoor);

  const rows = PEDESTALS.map((p,i) =>
    `${p.id}: αρχικό ${p.base} | φορτίο ${pedestalLoad(i)} | τελικό ${finalHeight(i)}`
  );
  $("#diagnostics").innerHTML =
    rows.join("<br>") +
    "<br><br>Βάρη σφαιρών: " +
    STONES.map(s => s.weight).join(", ");
}

function render() {
  $("#puzzle").classList.toggle("hidden", !sceneReady);
  $("#noScene").classList.toggle("hidden", sceneReady);

  if (!sceneReady) return;

  renderPedestals();
  renderTray();
  renderHint();

  const solved = isSolved();
  renderDoors(solved);

  const status = $("#status");
  status.classList.toggle("solved", solved);
  status.textContent = solved
    ? "Οι τέσσερις μηχανισμοί σταματούν ταυτόχρονα. Ακούγεται βαθύς πέτρινος κρότος…"
    : "Ο μηχανισμός αντιδρά καθώς μετακινείται το βάρος.";

  if (solved && !playedSolvedSound) {
    playedSolvedSound = true;
    playUnlockSound();
  } else if (!solved) {
    playedSolvedSound = false;
  }

  renderGM();
}

async function initOBR(sdk) {
  OBR = sdk.default;
  obrMode = OBR.isAvailable;

  if (!obrMode) {
    role = "GM";
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      try { state = normalizeState(JSON.parse(saved)); } catch {}
    }
    $("#syncBadge").textContent = "λειτουργία δοκιμής";
    render();
    return;
  }

  const start = async () => {
    role = await OBR.player.getRole();
    sceneReady = await OBR.scene.isReady();

    $("#syncBadge").textContent = sceneReady ? "συγχρονισμένο" : "χωρίς σκηνή";

    if (sceneReady) {
      const metadata = await OBR.scene.getMetadata();
      const existing = metadata[STATE_KEY];
      if (existing) {
        state = normalizeState(existing);
      } else {
        await OBR.scene.setMetadata({ [STATE_KEY]: state });
      }
    }

    if (unsubscribeMetadata) unsubscribeMetadata();
    unsubscribeMetadata = OBR.scene.onMetadataChange(metadata => {
      const incoming = metadata[STATE_KEY];
      if (incoming) {
        state = normalizeState(incoming);
        render();
      }
    });

    OBR.scene.onReadyChange(async ready => {
      sceneReady = ready;
      $("#syncBadge").textContent = ready ? "συγχρονισμένο" : "χωρίς σκηνή";
      if (ready) {
        const metadata = await OBR.scene.getMetadata();
        const incoming = metadata[STATE_KEY];
        state = incoming ? normalizeState(incoming) : normalizeState({});
        if (!incoming) await OBR.scene.setMetadata({ [STATE_KEY]: state });
      }
      render();
    });

    render();
  };

  if (OBR.isReady) await start();
  else OBR.onReady(start);
}

$("#doorSelect").addEventListener("change", async e => {
  const next = normalizeState(state);
  next.realDoor = Number(e.target.value);
  await saveState(next);
});

$("#hint1Btn").addEventListener("click", async () => {
  const next = normalizeState(state);
  next.hintLevel = 1;
  await saveState(next);
});

$("#hint2Btn").addEventListener("click", async () => {
  const next = normalizeState(state);
  next.hintLevel = 2;
  await saveState(next);
});

$("#hideHintsBtn").addEventListener("click", async () => {
  const next = normalizeState(state);
  next.hintLevel = 0;
  await saveState(next);
});

$("#resetBtn").addEventListener("click", async () => {
  const next = {
    placements: { ...INITIAL_PLACEMENTS },
    hintLevel: 0,
    realDoor: state.realDoor,
  };
  selectedStone = null;
  await saveState(next);
});

import(SDK_URL)
  .then(initOBR)
  .catch(err => {
    console.warn("Owlbear SDK unavailable; using local demo mode.", err);
    role = "GM";
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      try { state = normalizeState(JSON.parse(saved)); } catch {}
    }
    $("#syncBadge").textContent = "λειτουργία δοκιμής";
    render();
  });

import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import {
  CHANNEL, STATE_KEY, RECORDS, PHASE1_SOLUTION, PHASE2_SOLUTION,
  INDEX_MAP, INITIAL_TRAY, freshState, sanitizeState
} from "./shared.js";

const clueText = {
  KEY: "Βρισκόμουν πριν από την Quill.",
  QUILL: "Η Seal ακολούθησε αμέσως μετά από εμένα.",
  SEAL: "Βρισκόμουν πριν από το Eye.",
  EYE: "Η θέση μου δεν ήταν ούτε η πρώτη ούτε η τελευταία.",
  FLAME: "Ανάμεσα στη Seal και σε εμένα υπήρχε ακριβώς μία θέση, και βρισκόμουν μετά από το Eye."
};
const symbolSvg = {
  KEY: `<svg viewBox="0 0 100 140" aria-hidden="true"><circle cx="50" cy="32" r="17"/><circle cx="50" cy="32" r="7"/><path d="M50 49v55M50 83h18M50 97h11"/></svg>`,
  QUILL: `<svg viewBox="0 0 100 140" aria-hidden="true"><path d="M73 19C45 27 25 55 23 101c19-9 39-30 50-82Z"/><path d="M28 105 70 29M38 79l22-4M34 91l16-3"/></svg>`,
  SEAL: `<svg viewBox="0 0 100 140" aria-hidden="true"><path d="M50 24 62 29 74 28 78 40 87 49 81 61 83 74 70 79 62 89 50 84 38 89 30 79 17 74 19 61 13 49 22 40 26 28 38 29Z"/><circle cx="50" cy="56" r="20"/><path d="m50 43 5 9 10 2-7 7 2 10-10-5-10 5 2-10-7-7 10-2Z"/></svg>`,
  EYE: `<svg viewBox="0 0 100 140" aria-hidden="true"><path d="M12 60c18-28 58-28 76 0-18 28-58 28-76 0Z"/><circle cx="50" cy="60" r="14"/><circle cx="50" cy="60" r="5"/><path d="M50 21v13M50 86v13M21 33l9 10M79 33 70 43"/></svg>`,
  FLAME: `<svg viewBox="0 0 100 140" aria-hidden="true"><path d="M52 18c7 22-5 28 7 40 10-10 14-21 10-31 19 17 24 39 14 61-8 19-25 30-43 25-22-6-31-29-22-48 6-13 17-21 21-34 8 9 9 19 5 29 12-8 18-21 8-42Z"/><path d="M52 64c12 12 15 25 6 35-8 9-23 7-28-4-5-12 3-22 12-29-1 9 2 14 10 18 2-7 2-13 0-20Z"/></svg>`
};

let state = freshState();
let isGM = false;
let selectedRecord = null;
let demoMode = !OBR.isAvailable;
let suppressAutoCheck = false;

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const statusEl = $("status");
const warningEl = $("warning");

function arraysEqual(a,b){ return a.length === b.length && a.every((v,i)=>v===b[i]); }
function remainingRecords(){ return INITIAL_TRAY.filter(r => !state.slots.includes(r)); }

function setStatus(text="", kind="") {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
}

function recordButton(name) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `record ${selectedRecord === name ? "selected" : ""}`;
  b.draggable = true;
  b.dataset.record = name;
  b.setAttribute("aria-label", `${name} record`);
  b.innerHTML = `<div class="record-stone"><div class="record-symbol">${symbolSvg[name]}</div><span class="name">${name}</span></div>`;
  b.addEventListener("dragstart", e => e.dataTransfer.setData("text/plain", name));
  b.addEventListener("click", () => {
    selectedRecord = selectedRecord === name ? null : name;
    render();
  });
  return b;
}

function renderClues() {
  const clues = $("clues");
  clues.innerHTML = "";
  for (const name of RECORDS) {
    const div = document.createElement("div");
    div.className = "clue";
    div.innerHTML = `<strong>${name}</strong><span>${clueText[name]}</span>`;
    clues.append(div);
  }
}

function renderIndex() {
  const legend = $("indexLegend");
  legend.innerHTML = "";
  for (const name of PHASE1_SOLUTION) {
    const div = document.createElement("div");
    div.className = "index-entry";
    div.innerHTML = `<div class="sym">${name}</div><div class="roman">${INDEX_MAP[name]}</div>`;
    legend.append(div);
  }
}

function slotDrop(index, name) {
  if (!RECORDS.includes(name) || state.phase === 3) return;
  const slots = [...state.slots];
  const existing = slots.indexOf(name);
  if (existing >= 0) slots[existing] = null;
  const displaced = slots[index];
  slots[index] = name;
  selectedRecord = displaced || null;
  commit({ ...state, slots, updatedAt: Date.now() });
}

function removeFromSlot(index) {
  const slots = [...state.slots];
  selectedRecord = slots[index];
  slots[index] = null;
  commit({ ...state, slots, updatedAt: Date.now() });
}

async function commit(next) {
  state = sanitizeState(next);
  render();
  if (demoMode) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    autoCheck();
    return;
  }
  try {
    if (isGM) {
      await OBR.room.setMetadata({ [STATE_KEY]: state });
      await OBR.broadcast.sendMessage(CHANNEL, { type:"STATE_COMMIT", state }, { destination:"ALL" });
    } else {
      await OBR.broadcast.sendMessage(CHANNEL, { type:"STATE_PROPOSE", state }, { destination:"ALL" });
    }
  } catch (err) {
    console.error(err);
    setStatus("Sync error. Try again.", "error");
  }
  autoCheck();
}

function autoCheck() {
  if (suppressAutoCheck || state.phase === 3 || state.slots.some(v => !v)) return;
  suppressAutoCheck = true;
  setTimeout(async () => {
    if (state.phase === 1) {
      if (arraysEqual(state.slots, PHASE1_SOLUTION)) {
        setStatus("The Records lock into place…", "success");
        await commit({ ...state, phase:2, slots:[null,null,null,null,null], updatedAt:Date.now() });
      } else {
        const attempts1 = state.attempts1 + 1;
        setStatus("The stones remain silent. The provenance is wrong.", "error");
        await commit({ ...state, attempts1, slots:[null,null,null,null,null], updatedAt:Date.now() });
      }
    } else if (state.phase === 2) {
      if (arraysEqual(state.slots, PHASE2_SOLUTION)) {
        await commit({ ...state, phase:3, updatedAt:Date.now() });
      } else {
        const attempts2 = state.attempts2 + 1;
        const archiveAlerted = state.archiveAlerted || attempts2 >= 3;
        setStatus("A deep stone knock answers from inside the mountain.", "error");
        await commit({ ...state, attempts2, archiveAlerted, slots:[null,null,null,null,null], updatedAt:Date.now() });
      }
    }
    suppressAutoCheck = false;
  }, 350);
}

function render() {
  stage.className = `stage ${state.phase === 1 ? "phase-one" : state.phase === 2 ? "phase-two" : "open"}`;
  $("phaseLabel").textContent = state.phase === 1 ? "PHASE ONE · PROVENANCE" : state.phase === 2 ? "PHASE TWO · INDEX" : "THE HOLLOW ARCHIVE";
  $("cluesSection").classList.toggle("hidden", state.phase !== 1);
  $("indexLegend").classList.toggle("hidden", state.phase !== 2);
  $("archiveMessage").classList.toggle("hidden", state.phase !== 3);
  $("slots").parentElement.classList.toggle("hidden", state.phase === 3);
  $("tray").parentElement.classList.toggle("hidden", state.phase === 3);
  $("instructionText").textContent = state.phase === 1
    ? "«Κανένα αρχείο δεν διατηρείται αν δεν γνωρίζεις από πού προήλθε.»"
    : state.phase === 2
    ? "THE RECORD REMAINS. THE INDEX SPEAKS."
    : "The mountain has opened.";
  $("subInstruction").textContent = state.phase === 1
    ? "Τοποθετήστε τα Records στην αληθινή τους σειρά. Drag ή tap ένα Record και μετά tap μία θέση."
    : state.phase === 2
    ? "Χρησιμοποιήστε το Index I → V. Τα ίδια Records πρέπει να τοποθετηθούν ξανά."
    : "";

  const archiveMessage = $("archiveMessage");
  if (state.phase === 3) {
    archiveMessage.innerHTML = `<h2>HOLLOW ARCHIVE</h2><p>“What was forgotten was not lost.”</p>${state.archiveAlerted ? '<div class="warning" style="margin-top:12px">Two Archive Wardens are already waiting below.</div>' : ''}`;
    setStatus("The entrance is open.", "success");
  }

  warningEl.classList.toggle("hidden", !state.archiveAlerted || state.phase === 3);
  if (state.archiveAlerted && state.phase !== 3) warningEl.textContent = "The Archive has registered your presence.";

  const labels = $("slotLabels");
  labels.innerHTML = "";
  const slotsEl = $("slots");
  slotsEl.innerHTML = "";
  for (let i=0;i<5;i++) {
    const lab = document.createElement("div");
    lab.className = "slot-label";
    lab.textContent = state.phase === 2 ? ["I","II","III","IV","V"][i] : `POSITION ${i+1}`;
    labels.append(lab);

    const slot = document.createElement("div");
    slot.className = `slot ${state.slots[i] ? "" : "empty"}`;
    slot.dataset.index = i;
    slot.addEventListener("dragover", e => { e.preventDefault(); slot.classList.add("over"); });
    slot.addEventListener("dragleave", () => slot.classList.remove("over"));
    slot.addEventListener("drop", e => {
      e.preventDefault(); slot.classList.remove("over");
      slotDrop(i, e.dataTransfer.getData("text/plain"));
    });
    slot.addEventListener("click", () => {
      if (selectedRecord) slotDrop(i, selectedRecord);
      else if (state.slots[i]) removeFromSlot(i);
    });
    if (state.slots[i]) slot.append(recordButton(state.slots[i]));
    slotsEl.append(slot);
  }

  const tray = $("tray");
  tray.innerHTML = "";
  for (const name of remainingRecords()) tray.append(recordButton(name));

  $("gmControls").classList.toggle("hidden", !isGM && !demoMode);
  $("phase2Btn").disabled = state.phase >= 2;
  $("openBtn").disabled = state.phase === 3;
  renderIndex();
}

async function initOwlbear() {
  await new Promise(resolve => OBR.onReady(resolve));
  isGM = (await OBR.player.getRole()) === "GM";
  try { await OBR.action.setWidth(760); await OBR.action.setHeight(720); } catch {}
  const metadata = await OBR.room.getMetadata();
  state = sanitizeState(metadata[STATE_KEY]);
  $("syncPill").textContent = isGM ? "Synced · GM" : "Synced · Player";
  $("syncPill").classList.add("online");
  OBR.room.onMetadataChange(meta => {
    if (meta[STATE_KEY]) { state = sanitizeState(meta[STATE_KEY]); selectedRecord = null; render(); }
  });
  OBR.broadcast.onMessage(CHANNEL, event => {
    if (event.data?.type === "STATE_COMMIT") {
      state = sanitizeState(event.data.state);
      selectedRecord = null;
      render();
    }
  });
  render();
}

function initDemo() {
  isGM = true;
  const saved = localStorage.getItem(STATE_KEY);
  state = saved ? sanitizeState(JSON.parse(saved)) : freshState();
  $("syncPill").textContent = "Demo mode";
  $("demoNote").classList.remove("hidden");
  render();
}

$("toggleClues").addEventListener("click", () => {
  const clues = $("clues");
  clues.classList.toggle("hidden");
  $("toggleClues").textContent = clues.classList.contains("hidden") ? "Show clues" : "Hide clues";
});
$("resetBtn").addEventListener("click", () => commit(freshState()));
$("phase2Btn").addEventListener("click", () => commit({ ...state, phase:2, slots:[null,null,null,null,null], updatedAt:Date.now() }));
$("openBtn").addEventListener("click", () => commit({ ...state, phase:3, updatedAt:Date.now() }));

renderClues();
if (demoMode) initDemo(); else initOwlbear();

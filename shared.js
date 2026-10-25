export const EXTENSION_ID = "gr.echoes.hollow-archive-five-records";
export const STATE_KEY = `${EXTENSION_ID}/state`;
export const CHANNEL = `${EXTENSION_ID}/sync`;
export const RECORDS = ["KEY", "QUILL", "SEAL", "EYE", "FLAME"];
export const PHASE1_SOLUTION = ["KEY", "QUILL", "SEAL", "EYE", "FLAME"];
export const PHASE2_SOLUTION = ["KEY", "EYE", "FLAME"];
export const INITIAL_TRAY = ["SEAL", "FLAME", "KEY", "EYE", "QUILL"];

export function freshState() {
  return {
    version: 2,
    phase: 1,
    slots: [null, null, null, null, null],
    activation: [],
    attempts1: 0,
    attempts2: 0,
    archiveAlerted: false,
    hints: 0,
    updatedAt: Date.now()
  };
}

export function sanitizeState(value) {
  const base = freshState();
  if (!value || typeof value !== "object") return base;
  const phase = [1, 2, 3].includes(value.phase) ? value.phase : 1;
  const slots = Array.isArray(value.slots) && value.slots.length === 5
    ? value.slots.map(v => RECORDS.includes(v) ? v : null)
    : base.slots;
  const unique = slots.filter(Boolean);
  const activation = Array.isArray(value.activation)
    ? value.activation.filter(v => RECORDS.includes(v)).slice(0, 3)
    : [];
  if (new Set(unique).size !== unique.length) return base;
  return {
    version: 2,
    phase,
    slots,
    activation,
    attempts1: Number.isFinite(value.attempts1) ? Math.max(0, value.attempts1) : 0,
    attempts2: Number.isFinite(value.attempts2) ? Math.max(0, value.attempts2) : 0,
    archiveAlerted: Boolean(value.archiveAlerted),
    hints: Number.isFinite(value.hints) ? Math.max(0, Math.min(2, value.hints)) : 0,
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now()
  };
}

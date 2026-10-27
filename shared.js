export const EXTENSION_ID="gr.echoes.hollow-archive-five-records";
export const STATE_KEY=`${EXTENSION_ID}/state`,CHANNEL=`${EXTENSION_ID}/sync`,STATE_VERSION=9;
export const RECORDS=["KEY","QUILL","SEAL","EYE","FLAME"];
export const PHASE1_SOLUTION=["KEY","QUILL","SEAL","EYE","FLAME"];
export const INDEX={KEY:"IV",QUILL:"II",SEAL:"V",EYE:"I",FLAME:"III"};
export const PHASE2_SOLUTION=["EYE","QUILL","FLAME","KEY","SEAL"];
export const INITIAL_TRAY=["SEAL","FLAME","KEY","EYE","QUILL"];
export function freshState(){return{version:STATE_VERSION,phase:1,slots:[null,null,null,null,null],activation:[],attempts1:0,attempts2:0,archiveAlerted:false,hints:0,event:null,updatedAt:Date.now()}}
export function sanitizeState(v){const b=freshState();if(!v||typeof v!=="object"||v.version!==STATE_VERSION)return b;const phase=[1,2,3].includes(v.phase)?v.phase:1;const slots=Array.isArray(v.slots)&&v.slots.length===5?v.slots.map(x=>RECORDS.includes(x)?x:null):b.slots;const used=slots.filter(Boolean);if(new Set(used).size!==used.length)return b;return{version:STATE_VERSION,phase,slots,activation:Array.isArray(v.activation)?v.activation.filter(x=>RECORDS.includes(x)).slice(0,5):[],attempts1:Number.isFinite(v.attempts1)?Math.max(0,v.attempts1):0,attempts2:Number.isFinite(v.attempts2)?Math.max(0,v.attempts2):0,archiveAlerted:Boolean(v.archiveAlerted),hints:Number.isFinite(v.hints)?Math.max(0,Math.min(2,v.hints)):0,event:typeof v.event==="string"?v.event:null,updatedAt:Number.isFinite(v.updatedAt)?v.updatedAt:Date.now()}}
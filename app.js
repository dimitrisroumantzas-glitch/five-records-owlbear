import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import {
  CHANNEL, STATE_KEY, RECORDS, PHASE1_SOLUTION, PHASE2_SOLUTION,
  INITIAL_TRAY, freshState, sanitizeState
} from "./shared.js";

const $ = id => document.getElementById(id);
const scene = $("scene");
let state = freshState();
let isGM = false;
let demoMode = !OBR.isAvailable;
let selected = null;
let checking = false;

const SYMBOLS = {
  KEY: "⚿",
  QUILL: "✒",
  SEAL: "✦",
  EYE: "◉",
  FLAME: "♨"
};

const HINTS = [
  "Quill και Seal πρέπει να είναι ακριβώς δίπλα.",
  "Η Flame είναι τελευταία. Η Key προηγείται της Quill."
];

function eq(a,b){ return a.length===b.length && a.every((v,i)=>v===b[i]); }
function available(){ return INITIAL_TRAY.filter(r => !state.slots.includes(r)); }

function recordButton(name, activation=false){
  const b=document.createElement("button");
  b.type="button";
  b.className=`record-token ${selected===name?"selected":""} ${activation?"activation-token":""}`;
  b.dataset.record=name;
  b.draggable=!activation;
  b.innerHTML=`<span class="medallion"><span class="sigil">${SYMBOLS[name]}</span></span><span class="record-name">${name}</span>`;
  if(!activation){
    b.addEventListener("dragstart", e=>e.dataTransfer.setData("text/plain",name));
    b.addEventListener("click",()=>{ selected=selected===name?null:name; render(); });
  } else {
    b.addEventListener("click",()=>activate(name));
  }
  return b;
}

async function commit(next){
  state=sanitizeState(next); render();
  if(demoMode){ localStorage.setItem(STATE_KEY,JSON.stringify(state)); afterCommit(); return; }
  try{
    if(isGM){
      await OBR.room.setMetadata({[STATE_KEY]:state});
      await OBR.broadcast.sendMessage(CHANNEL,{type:"STATE_COMMIT",state},{destination:"ALL"});
    }else{
      await OBR.broadcast.sendMessage(CHANNEL,{type:"STATE_PROPOSE",state},{destination:"ALL"});
    }
  }catch(e){ console.error(e); setStatus("Sync error. Try again.","error"); }
  afterCommit();
}

function afterCommit(){
  if(state.phase===1 && state.slots.every(Boolean)) checkPhase1();
}

function place(index,name){
  if(state.phase!==1 || !RECORDS.includes(name)) return;
  const slots=[...state.slots];
  const existing=slots.indexOf(name);
  if(existing>=0) slots[existing]=null;
  const displaced=slots[index];
  slots[index]=name;
  selected=displaced||null;
  commit({...state,slots,updatedAt:Date.now()});
}

function remove(index){
  if(state.phase!==1) return;
  const slots=[...state.slots];
  selected=slots[index]; slots[index]=null;
  commit({...state,slots,updatedAt:Date.now()});
}

function checkPhase1(){
  if(checking) return; checking=true;
  setTimeout(async()=>{
    if(eq(state.slots,PHASE1_SOLUTION)){
      setStatus("Οι πέντε πλάκες κλειδώνουν στη θέση τους…","success");
      await commit({...state,phase:2,activation:[],updatedAt:Date.now()});
    }else{
      const attempts1=state.attempts1+1;
      setStatus("Ο βράχος παραμένει σιωπηλός. Η σειρά δεν είναι σωστή.","error");
      await commit({...state,attempts1,slots:[null,null,null,null,null],updatedAt:Date.now()});
    }
    checking=false;
  },450);
}

async function activate(name){
  if(state.phase!==2 || checking) return;
  const activation=[...state.activation,name].slice(-3);
  await commit({...state,activation,updatedAt:Date.now()});
  if(activation.length<3) return;
  checking=true;
  setTimeout(async()=>{
    if(eq(activation,PHASE2_SOLUTION)){
      setStatus("Οι σφραγίδες απαντούν. Κάτι μετακινείται μέσα στο βουνό…","success");
      await commit({...state,phase:3,activation,updatedAt:Date.now()});
    }else{
      const attempts2=state.attempts2+1;
      const archiveAlerted=state.archiveAlerted || attempts2>=3;
      setStatus("Η ακολουθία σβήνει. Ένα βαθύ χτύπημα ακούγεται από μέσα.","error");
      await commit({...state,activation:[],attempts2,archiveAlerted,updatedAt:Date.now()});
    }
    checking=false;
  },420);
}

function setStatus(text,kind=""){
  const el=$("status"); el.textContent=text; el.className=`status ${kind}`;
}

function render(){
  scene.className=`scene phase-${state.phase}`;
  $("gmControls").classList.toggle("hidden",!isGM&&!demoMode);
  $("activationPanel").classList.toggle("hidden",state.phase!==2);
  $("puzzleBoard").classList.toggle("hidden",state.phase===3);
  $("tray").classList.toggle("hidden",state.phase===3);
  $("clueList").parentElement.classList.toggle("dimmed",state.phase!==1);
  $("opened").classList.toggle("hidden",state.phase!==3);
  $("warning").classList.toggle("hidden",!state.archiveAlerted || state.phase===3);

  $("phaseCopy").textContent = state.phase===1
    ? "Τοποθετήστε τα Records στην αληθινή τους σειρά."
    : state.phase===2
      ? "Η σειρά έγινε δεκτή. Τώρα το Archive ζητά ενεργοποίηση."
      : "Η κρυφή είσοδος αποκαλύφθηκε.";

  const labels=$("slotLabels"); labels.innerHTML="";
  const slotsEl=$("slots"); slotsEl.innerHTML="";
  state.slots.forEach((r,i)=>{
    const lab=document.createElement("span"); lab.textContent=`${i+1}`; labels.append(lab);
    const slot=document.createElement("div"); slot.className=`record-slot ${r?"filled":""}`;
    slot.addEventListener("dragover",e=>{e.preventDefault();slot.classList.add("over")});
    slot.addEventListener("dragleave",()=>slot.classList.remove("over"));
    slot.addEventListener("drop",e=>{e.preventDefault();slot.classList.remove("over");place(i,e.dataTransfer.getData("text/plain"))});
    slot.addEventListener("click",()=>{ if(selected) place(i,selected); else if(r) remove(i); });
    if(r) slot.append(recordButton(r));
    slotsEl.append(slot);
  });

  const tray=$("tray"); tray.innerHTML="";
  if(state.phase===1){ available().forEach(r=>tray.append(recordButton(r))); }
  if(state.phase===2){ RECORDS.forEach(r=>tray.append(recordButton(r,true))); }

  const track=$("activationTrack"); track.innerHTML="";
  if(state.phase===2){
    for(let i=0;i<3;i++){
      const dot=document.createElement("div"); dot.className=`activation-step ${state.activation[i]?"lit":""}`;
      dot.textContent=state.activation[i] ? SYMBOLS[state.activation[i]] : "·"; track.append(dot);
    }
  }

  const hint=$("hintBox");
  if(state.hints>0){ hint.classList.remove("hidden"); hint.innerHTML=HINTS.slice(0,state.hints).map((h,i)=>`<div><b>Hint ${i+1}:</b> ${h}</div>`).join(""); }
  else hint.classList.add("hidden");

  if(state.phase===3) setStatus("ACCESS GRANTED","success");
}

async function initOwlbear(){
  await new Promise(resolve=>OBR.onReady(resolve));
  isGM=(await OBR.player.getRole())==="GM";
  try{ await OBR.action.setWidth(980); await OBR.action.setHeight(720); }catch{}
  const meta=await OBR.room.getMetadata(); state=sanitizeState(meta[STATE_KEY]);
  $("syncPill").textContent=isGM?"Synced · GM":"Synced · Player";
  OBR.room.onMetadataChange(meta=>{ if(meta[STATE_KEY]){state=sanitizeState(meta[STATE_KEY]);selected=null;render();} });
  OBR.broadcast.onMessage(CHANNEL,event=>{ if(event.data?.type==="STATE_COMMIT"){state=sanitizeState(event.data.state);selected=null;render();} });
  render();
}

function initDemo(){
  isGM=true; const saved=localStorage.getItem(STATE_KEY); state=saved?sanitizeState(JSON.parse(saved)):freshState();
  $("syncPill").textContent="Demo mode"; render();
}

$("resetBtn").addEventListener("click",()=>commit(freshState()));
$("hintBtn").addEventListener("click",()=>commit({...state,hints:Math.min(2,state.hints+1),updatedAt:Date.now()}));
$("solve1Btn").addEventListener("click",()=>commit({...state,phase:2,slots:[...PHASE1_SOLUTION],activation:[],updatedAt:Date.now()}));
$("openBtn").addEventListener("click",()=>commit({...state,phase:3,updatedAt:Date.now()}));

if(demoMode) initDemo(); else initOwlbear();

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
let statusTimer = null;

const HINTS = [
  "The first position answers to access. The Flame does not.",
  "One Record stands between Key and Seal; Seal and Eye stand together."
];

const SYMBOLS = {
  KEY: '<svg viewBox="0 0 100 140"><circle cx="50" cy="32" r="17"/><circle cx="50" cy="32" r="7"/><path d="M50 49v55M50 83h18M50 97h11"/></svg>',
  QUILL: '<svg viewBox="0 0 100 140"><path d="M73 19C45 27 25 55 23 101c19-9 39-30 50-82Z"/><path d="M28 105 70 29M38 79l22-4M34 91l16-3"/></svg>',
  SEAL: '<svg viewBox="0 0 100 140"><path d="M50 24 62 29 74 28 78 40 87 49 81 61 83 74 70 79 62 89 50 84 38 89 30 79 17 74 19 61 13 49 22 40 26 28 38 29Z"/><circle cx="50" cy="56" r="20"/></svg>',
  EYE: '<svg viewBox="0 0 100 140"><path d="M12 60c18-28 58-28 76 0-18 28-58 28-76 0Z"/><circle cx="50" cy="60" r="14"/><circle cx="50" cy="60" r="5"/></svg>',
  FLAME: '<svg viewBox="0 0 100 140"><path d="M52 18c7 22-5 28 7 40 10-10 14-21 10-31 19 17 24 39 14 61-8 19-25 30-43 25-22-6-31-29-22-48 6-13 17-21 21-34 8 9 9 19 5 29 12-8 18-21 8-42Z"/></svg>'
};

function eq(a,b){ return a.length===b.length && a.every((v,i)=>v===b[i]); }
function available(){ return INITIAL_TRAY.filter(r=>!state.slots.includes(r)); }

function showStatus(text,kind="",duration=2600){
  const el=$("status");
  el.textContent=text;
  el.className=`status show ${kind}`.trim();
  clearTimeout(statusTimer);
  if(duration>0) statusTimer=setTimeout(()=>el.classList.remove("show"),duration);
}

function recordButton(name){
  const b=document.createElement("button");
  b.type="button";
  b.className=`record-token ${selected===name?"selected":""}`;
  b.dataset.record=name;
  b.draggable=state.phase===1;
  b.setAttribute("aria-label",`${name} Record`);
  b.innerHTML=`<span class="record-art ${name.toLowerCase()}"></span><span class="record-name">${name}</span>`;
  b.addEventListener("dragstart",e=>{
    if(state.phase!==1) return;
    e.dataTransfer.setData("text/plain",name);
    e.dataTransfer.effectAllowed="move";
  });
  b.addEventListener("click",e=>{
    e.stopPropagation();
    if(state.phase!==1) return;
    selected=selected===name?null:name;
    render();
  });
  return b;
}

async function commit(next){
  state=sanitizeState(next);
  render();
  if(demoMode){
    localStorage.setItem(STATE_KEY,JSON.stringify(state));
    afterCommit();
    return;
  }
  try{
    if(isGM){
      await OBR.room.setMetadata({[STATE_KEY]:state});
      await OBR.broadcast.sendMessage(CHANNEL,{type:"STATE_COMMIT",state},{destination:"ALL"});
    }else{
      await OBR.broadcast.sendMessage(CHANNEL,{type:"STATE_PROPOSE",state},{destination:"ALL"});
    }
  }catch(err){
    console.error(err);
    showStatus("Sync error. Try again.","error");
  }
  afterCommit();
}

function afterCommit(){
  if(state.phase===1 && state.slots.every(Boolean)) checkPhase1();
}

function place(index,name){
  if(state.phase!==1 || checking || !RECORDS.includes(name)) return;
  const slots=[...state.slots];
  const existing=slots.indexOf(name);
  if(existing>=0) slots[existing]=null;
  const displaced=slots[index];
  slots[index]=name;
  selected=displaced||null;
  commit({...state,slots,updatedAt:Date.now()});
}

function remove(index){
  if(state.phase!==1 || checking) return;
  const slots=[...state.slots];
  selected=slots[index];
  slots[index]=null;
  commit({...state,slots,updatedAt:Date.now()});
}

function checkPhase1(){
  if(checking) return;
  checking=true;
  setTimeout(async()=>{
    if(eq(state.slots,PHASE1_SOLUTION)){
      showStatus("The stone answers. The five Records are accepted.","success",3200);
      await commit({...state,phase:2,activation:[],updatedAt:Date.now()});
    }else{
      showStatus("The altar rejects the provenance.","error",2400);
      await commit({
        ...state,
        attempts1:state.attempts1+1,
        slots:[null,null,null,null,null],
        activation:[],
        updatedAt:Date.now()
      });
    }
    checking=false;
  },520);
}

async function activate(name){
  if(state.phase!==2 || checking) return;
  const activation=[...state.activation,name];
  await commit({...state,activation,updatedAt:Date.now()});
  if(activation.length<3) return;
  checking=true;
  setTimeout(async()=>{
    if(eq(activation,PHASE2_SOLUTION)){
      showStatus("The inner seal releases.","success",1800);
      await commit({...state,phase:3,activation,updatedAt:Date.now()});
    }else{
      const attempts2=state.attempts2+1;
      const archiveAlerted=state.archiveAlerted || attempts2>=3;
      showStatus("A deep stone knock answers from inside the mountain.","error",2800);
      await commit({...state,activation:[],attempts2,archiveAlerted,updatedAt:Date.now()});
    }
    checking=false;
  },520);
}

function renderSlots(){
  const slotsEl=$("slots");
  slotsEl.innerHTML="";
  state.slots.forEach((name,index)=>{
    const slot=document.createElement("div");
    slot.className=`record-slot ${name?"filled":""}`;
    slot.dataset.index=index;
    slot.addEventListener("dragover",e=>{
      if(state.phase!==1) return;
      e.preventDefault();
      slot.classList.add("over");
    });
    slot.addEventListener("dragleave",()=>slot.classList.remove("over"));
    slot.addEventListener("drop",e=>{
      e.preventDefault();
      slot.classList.remove("over");
      place(index,e.dataTransfer.getData("text/plain"));
    });
    slot.addEventListener("click",()=>{
      if(state.phase!==1) return;
      if(selected) place(index,selected);
      else if(name) remove(index);
    });
    if(name) slot.append(recordButton(name));
    slotsEl.append(slot);
  });
}

function renderTray(){
  const tray=$("recordTray");
  tray.innerHTML="";
  if(state.phase!==1) return;
  for(const name of available()) tray.append(recordButton(name));
}

function renderActivation(){
  const holder=$("activationSockets");
  holder.innerHTML="";
  if(state.phase!==2) return;
  PHASE1_SOLUTION.forEach(name=>{
    const b=document.createElement("button");
    b.type="button";
    b.className=`activation-socket ${state.activation.includes(name)?"lit":""}`;
    b.setAttribute("aria-label",`Activate ${name}`);
    b.innerHTML=SYMBOLS[name];
    b.addEventListener("click",()=>activate(name));
    holder.append(b);
  });
}

function renderHint(){
  const el=$("hintLine");
  if(state.hints<=0){
    el.classList.add("hidden");
    el.textContent="";
    return;
  }
  el.textContent=HINTS[Math.min(state.hints,HINTS.length)-1];
  el.classList.remove("hidden");
}

function render(){
  scene.className=`scene phase-${state.phase}`;
  $("clueGrid").classList.toggle("hidden",state.phase!==1);
  $("phase2Inscription").classList.toggle("hidden",state.phase!==2);
  $("activationSockets").classList.toggle("hidden",state.phase!==2);
  $("recordTray").classList.toggle("hidden",state.phase!==1);
  $("opened").classList.toggle("hidden",state.phase!==3);
  $("warning").classList.toggle("hidden",!state.archiveAlerted || state.phase===3);
  $("phaseHeading").textContent=state.phase===1?"PROVENANCE":state.phase===2?"THE INNER INDEX":"";
  $("gmToggle").classList.toggle("hidden",!isGM&&!demoMode);

  renderSlots();
  renderTray();
  renderActivation();
  renderHint();

  if(state.phase===3){
    $("gmDrawer").classList.add("hidden");
    showStatus("", "", 1);
  }
}

function toggleGmDrawer(){
  if(!isGM&&!demoMode) return;
  $("gmDrawer").classList.toggle("hidden");
}

async function sizeOwlbear(expanded=false){
  if(demoMode) return;
  try{
    const sw=Math.max(900,(window.screen?.availWidth||1366)-(expanded?24:90));
    const sh=Math.max(560,(window.screen?.availHeight||768)-(expanded?36:120));
    let w=Math.min(expanded?1600:1360,sw);
    let h=w*9/16;
    if(h>sh){ h=sh; w=h*16/9; }
    await OBR.action.setWidth(Math.round(w));
    await OBR.action.setHeight(Math.round(h));
  }catch(err){ console.warn("Could not resize Owlbear popover",err); }
}

function updateFullscreenButton(){
  const full=Boolean(document.fullscreenElement);
  $("fullscreenBtn").textContent=full?"⛶":"⛶";
  $("fullscreenBtn").title=full?"Exit full screen":"Full screen";
  $("fullscreenBtn").setAttribute("aria-label",full?"Exit full screen":"Full screen");
}

async function toggleFullscreen(){
  if(document.fullscreenElement){
    try{ await document.exitFullscreen(); }catch{}
    document.body.classList.remove("immersive");
    await sizeOwlbear(false);
    return;
  }
  try{
    if(document.documentElement.requestFullscreen){
      await document.documentElement.requestFullscreen({navigationUI:"hide"});
      document.body.classList.add("immersive");
      return;
    }
  }catch(err){
    console.warn("Browser fullscreen unavailable inside Owlbear",err);
  }
  document.body.classList.add("immersive");
  await sizeOwlbear(true);
  showStatus("Immersive view enabled.","success",1800);
}

async function initOwlbear(){
  await new Promise(resolve=>OBR.onReady(resolve));
  isGM=(await OBR.player.getRole())==="GM";
  await sizeOwlbear(false);
  const metadata=await OBR.room.getMetadata();
  state=sanitizeState(metadata[STATE_KEY]);
  $("syncPill").textContent=isGM?"Synced · GM":"Synced · Player";
  OBR.room.onMetadataChange(meta=>{
    if(meta[STATE_KEY]){
      state=sanitizeState(meta[STATE_KEY]);
      selected=null;
      render();
    }
  });
  OBR.broadcast.onMessage(CHANNEL,event=>{
    if(event.data?.type==="STATE_COMMIT"){
      state=sanitizeState(event.data.state);
      selected=null;
      render();
    }
  });
  render();
}

function initDemo(){
  isGM=true;
  const saved=localStorage.getItem(STATE_KEY);
  state=saved?sanitizeState(JSON.parse(saved)):freshState();
  $("syncPill").textContent="Demo mode";
  render();
}

$("fullscreenBtn").addEventListener("click",toggleFullscreen);
$("gmToggle").addEventListener("click",toggleGmDrawer);
$("resetBtn").addEventListener("click",()=>{
  $("gmDrawer").classList.add("hidden");
  commit(freshState());
});
$("hintBtn").addEventListener("click",()=>commit({...state,hints:Math.min(2,state.hints+1),updatedAt:Date.now()}));
$("solve1Btn").addEventListener("click",()=>{
  showStatus("GM override: provenance accepted.","success");
  commit({...state,phase:2,slots:[...PHASE1_SOLUTION],activation:[],updatedAt:Date.now()});
});
$("openBtn").addEventListener("click",()=>commit({...state,phase:3,updatedAt:Date.now()}));
document.addEventListener("fullscreenchange",updateFullscreenButton);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && !$("gmDrawer").classList.contains("hidden")) $("gmDrawer").classList.add("hidden");
});

if(demoMode) initDemo(); else initOwlbear();

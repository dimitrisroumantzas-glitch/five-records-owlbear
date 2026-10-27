import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import{CHANNEL,STATE_KEY,RECORDS,PHASE1_SOLUTION,PHASE2_SOLUTION,INITIAL_TRAY,freshState,sanitizeState}from"./shared.js";

const $=id=>document.getElementById(id);
const scene=$("scene");
const MODAL_ID="gr.echoes.hollow-archive-five-records/fullscreen";
const fullPage=new URLSearchParams(location.search).get("fullscreen")==="1";
if(fullPage)document.body.classList.add("fullscreen-page");

let state=freshState();
let isGM=false;
let demoMode=!OBR.isAvailable;
let selected=null;
let checking=false;

const eq=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const available=()=>INITIAL_TRAY.filter(r=>!state.slots.includes(r));

function flash(){
  const el=$("flash");
  el.classList.remove("active");
  void el.offsetWidth;
  el.classList.add("active");
  setTimeout(()=>el.classList.remove("active"),750);
}

function card(name){
  const b=document.createElement("button");
  b.type="button";
  b.className="card";
  if(state.phase===2&&state.activation.includes(name))b.classList.add("chosen");
  b.dataset.record=name;
  b.draggable=state.phase===1;
  b.innerHTML='<span class="card-face"></span>';
  b.addEventListener("dragstart",e=>{
    if(state.phase!==1)return;
    e.dataTransfer.setData("text/plain",name);
    e.dataTransfer.effectAllowed="move";
  });
  b.addEventListener("click",e=>{
    e.stopPropagation();
    if(state.phase===1){
      selected=selected===name?null:name;
      render();
    }else if(state.phase===2){
      activate(name);
    }
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
  if(isGM){
    await OBR.room.setMetadata({[STATE_KEY]:state});
    await OBR.broadcast.sendMessage(CHANNEL,{type:"STATE_COMMIT",state},{destination:"ALL"});
  }else{
    await OBR.broadcast.sendMessage(CHANNEL,{type:"STATE_PROPOSE",state},{destination:"ALL"});
  }
  afterCommit();
}

function afterCommit(){
  if(state.phase===1&&state.slots.every(Boolean))checkPhase1();
}

function place(index,name){
  if(state.phase!==1||checking||!RECORDS.includes(name))return;
  const slots=[...state.slots];
  const old=slots.indexOf(name);
  if(old>=0)slots[old]=null;
  const displaced=slots[index];
  slots[index]=name;
  selected=displaced||null;
  commit({...state,slots,updatedAt:Date.now()});
}

function remove(index){
  if(state.phase!==1)return;
  const slots=[...state.slots];
  selected=slots[index];
  slots[index]=null;
  commit({...state,slots,updatedAt:Date.now()});
}

function checkPhase1(){
  if(checking)return;
  checking=true;
  setTimeout(async()=>{
    if(eq(state.slots,PHASE1_SOLUTION)){
      await commit({...state,phase:2,activation:[],updatedAt:Date.now()});
      flash();
    }else{
      await commit({...state,attempts1:state.attempts1+1,slots:[null,null,null,null,null],activation:[],updatedAt:Date.now()});
    }
    checking=false;
  },450);
}

async function activate(name){
  if(state.phase!==2||checking||state.activation.includes(name))return;
  const activation=[...state.activation,name];
  await commit({...state,activation,updatedAt:Date.now()});
  if(activation.length<5)return;

  checking=true;
  setTimeout(async()=>{
    if(eq(activation,PHASE2_SOLUTION)){
      flash();
      await commit({...state,phase:3,activation,updatedAt:Date.now()});
    }else{
      const attempts2=state.attempts2+1;
      if(attempts2>=3)flash();
      await commit({...state,activation:[],attempts2,archiveAlerted:state.archiveAlerted||attempts2>=3,updatedAt:Date.now()});
    }
    checking=false;
  },500);
}

function renderSlots(){
  const holder=$("slots");
  holder.innerHTML="";
  state.slots.forEach((name,index)=>{
    const slot=document.createElement("div");
    slot.className="slot";
    slot.addEventListener("dragover",e=>{
      if(state.phase===1){e.preventDefault();slot.classList.add("over");}
    });
    slot.addEventListener("dragleave",()=>slot.classList.remove("over"));
    slot.addEventListener("drop",e=>{
      e.preventDefault();slot.classList.remove("over");
      place(index,e.dataTransfer.getData("text/plain"));
    });
    slot.addEventListener("click",()=>{
      if(state.phase===1){
        if(selected)place(index,selected);
        else if(name)remove(index);
      }
    });
    if(name)slot.append(card(name));
    holder.append(slot);
  });
}

function renderTray(){
  const holder=$("tray");
  holder.innerHTML="";
  if(state.phase!==1)return;
  for(const name of available())holder.append(card(name));
}

function render(){
  scene.className=`scene phase-${state.phase}`;
  $("gmToggle").classList.toggle("hidden",!isGM&&!demoMode);
  renderSlots();
  renderTray();
  if(state.phase===3)$("gmDrawer").classList.add("hidden");
}

async function fullscreen(){
  if(demoMode){
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    }catch{}
    return;
  }
  if(fullPage){
    await OBR.modal.close(MODAL_ID);
    return;
  }
  const url=new URL(location.href);
  url.searchParams.set("fullscreen","1");
  await OBR.modal.open({id:MODAL_ID,url:url.toString(),fullScreen:true,hideBackdrop:true,hidePaper:true});
}

async function init(){
  await new Promise(resolve=>OBR.onReady(resolve));
  isGM=(await OBR.player.getRole())==="GM";
  const metadata=await OBR.room.getMetadata();
  state=sanitizeState(metadata[STATE_KEY]);
  if(isGM&&metadata[STATE_KEY]?.version!==10){
    await OBR.room.setMetadata({[STATE_KEY]:state});
  }
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

function demo(){
  isGM=true;
  const saved=localStorage.getItem(STATE_KEY);
  state=saved?sanitizeState(JSON.parse(saved)):freshState();
  render();
}

$("fullscreenBtn").onclick=fullscreen;
$("gmToggle").onclick=()=>{if(isGM||demoMode)$("gmDrawer").classList.toggle("hidden")};
$("resetBtn").onclick=()=>{selected=null;commit(freshState())};
$("solve1Btn").onclick=()=>commit({...state,phase:2,slots:[...PHASE1_SOLUTION],activation:[],updatedAt:Date.now()});
$("openBtn").onclick=()=>commit({...state,phase:3,updatedAt:Date.now()});

demoMode?demo():init();
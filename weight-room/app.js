import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import{CHANNEL,STATE_KEY,STATE_VERSION,BASE_HEIGHTS,STONES,freshState,sanitizeState,pedestalLoad,finalHeight,isSolved}from"./shared.js?v=600";

const $=id=>document.getElementById(id);
const MODAL_ID="gr.echoes.weight-room/fullscreen";
const params=new URLSearchParams(location.search);
const fullPage=params.get("fullscreen")==="1";
const forceDemo=params.get("demo")==="1";

let state=freshState();
let selected=null;
let isGM=false;
let demoMode=forceDemo||!OBR.isAvailable;
let lastSolved=false;

if(fullPage)document.body.classList.add("fullscreen-page");

function lowThud(freq=82,dur=.17,vol=.05){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type="sine";
    osc.frequency.setValueAtTime(freq,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(38,freq*.52),ctx.currentTime+dur);
    gain.gain.setValueAtTime(vol,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime+dur+.03);
  }catch{}
}

function stoneGrind(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const buffer=ctx.createBuffer(1,ctx.sampleRate*.85,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    src.buffer=buffer;
    filter.type="lowpass";
    filter.frequency.value=360;
    gain.gain.value=.065;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }catch{}
}

function dustAt(el){
  const layer=$("dustLayer");
  const r=el.getBoundingClientRect();
  for(let i=0;i<8;i++){
    const p=document.createElement("i");
    p.className="dust-puff";
    p.style.left=`${r.left+r.width*(.25+Math.random()*.5)}px`;
    p.style.top=`${r.bottom-15+Math.random()*8}px`;
    p.style.setProperty("--dx",`${(Math.random()-.5)*70}px`);
    p.style.setProperty("--dy",`${-22-Math.random()*60}px`);
    layer.appendChild(p);
    setTimeout(()=>p.remove(),1200);
  }
}

function flash(){
  const el=$("flash");
  el.classList.remove("active");
  void el.offsetWidth;
  el.classList.add("active");
  setTimeout(()=>el.classList.remove("active"),900);
}

async function commit(next){
  state=sanitizeState(next);
  render();

  if(demoMode){
    localStorage.setItem(STATE_KEY,JSON.stringify(state));
    return;
  }

  if(isGM){
    await OBR.room.setMetadata({[STATE_KEY]:state});
    await OBR.broadcast.sendMessage(CHANNEL,{type:"STATE_COMMIT",state},{destination:"ALL"});
  }else{
    await OBR.broadcast.sendMessage(CHANNEL,{type:"STATE_PROPOSE",state},{destination:"ALL"});
  }
}

function moveStone(stoneId,zone){
  if(!STONES.some(s=>s.id===stoneId))return;
  const placements={...state.placements,[stoneId]:zone};
  selected=null;
  lowThud();
  commit({...state,placements,updatedAt:Date.now()});
}

function stoneElement(stone,onPedestal=false){
  const el=document.createElement("button");
  el.type="button";
  el.className="stone"+(selected===stone.id?" selected":"")+(onPedestal?" on-pedestal":"");
  el.style.setProperty("--size",`${stone.size}px`);
  el.dataset.stone=stone.id;
  el.draggable=true;
  el.setAttribute("aria-label","Πέτρινη σφαίρα");

  el.addEventListener("dragstart",e=>{
    e.dataTransfer.setData("text/plain",stone.id);
    e.dataTransfer.effectAllowed="move";
    el.classList.add("dragging");
  });
  el.addEventListener("dragend",()=>el.classList.remove("dragging"));
  el.addEventListener("click",e=>{
    e.stopPropagation();
    selected=selected===stone.id?null:stone.id;
    render();
  });
  return el;
}

function makeDropTarget(el,zone){
  el.addEventListener("dragover",e=>{
    e.preventDefault();
    el.classList.add("over");
  });
  el.addEventListener("dragleave",()=>el.classList.remove("over"));
  el.addEventListener("drop",e=>{
    e.preventDefault();
    el.classList.remove("over");
    const id=e.dataTransfer.getData("text/plain");
    if(id){
      moveStone(id,zone);
      if(zone!=="floor")dustAt(el);
    }
  });
  el.addEventListener("click",()=>{
    if(selected){
      moveStone(selected,zone);
      if(zone!=="floor")dustAt(el);
    }
  });
}

function renderPedestals(){
  const holder=$("pedestals");
  holder.innerHTML="";

  BASE_HEIGHTS.forEach((base,index)=>{
    const raw=finalHeight(state,index);
    const h=Math.max(1,Math.min(9,raw));

    const ped=document.createElement("div");
    ped.className="pedestal";
    ped.dataset.pedestal=String(index);

    const shaft=document.createElement("div");
    shaft.className="pedestal-shaft";
    shaft.style.height=`${24+h*6.7}%`;

    const cap=document.createElement("div");
    cap.className="pedestal-cap";
    const bottom=4+h*4.9;
    cap.style.bottom=`${bottom}%`;

    const stack=document.createElement("div");
    stack.className="pedestal-stack";
    stack.style.bottom=`${bottom+7.5}%`;

    STONES
      .filter(s=>state.placements[s.id]===`p${index}`)
      .sort((a,b)=>b.weight-a.weight)
      .forEach(s=>stack.appendChild(stoneElement(s,true)));

    const baseEl=document.createElement("div");baseEl.className="pedestal-base";ped.append(baseEl,shaft,cap,stack);
    makeDropTarget(ped,`p${index}`);
    holder.appendChild(ped);
  });
}

function renderTray(){
  const holder=$("stoneTray");
  holder.innerHTML="";
  STONES
    .filter(s=>state.placements[s.id]==="floor")
    .sort((a,b)=>a.weight-b.weight)
    .forEach(s=>holder.appendChild(stoneElement(s,false)));

  if(!holder.dataset.wired){
    makeDropTarget(holder,"floor");
    holder.dataset.wired="1";
  }
}

function renderDoors(){
  const solved=isSolved(state);
  document.querySelectorAll(".door").forEach((el,index)=>{
    el.classList.toggle("open",solved&&index===state.door);
    el.classList.toggle("false-door",solved&&index!==state.door);
  });
}

function renderHint(){
  const hint=$("hint");
  if(state.hint===0){
    hint.classList.add("hidden");
    return;
  }
  hint.classList.remove("hidden");
  hint.textContent=state.hint===1
    ?"Οι τέσσερις βάσεις υποχωρούν σαν μηχανικές ζυγαριές."
    :"Το ζητούμενο δεν είναι ίσο βάρος. Τα τέσσερα βάθρα πρέπει να καταλήξουν στο ίδιο τελικό ύψος.";
}

function renderGM(){
  $("gmToggle").classList.toggle("hidden",!isGM&&!demoMode);
  if(!isGM&&!demoMode)$("gmDrawer").classList.add("hidden");
  $("doorSelect").value=String(state.door);
  $("diagnostics").innerHTML=BASE_HEIGHTS.map((base,i)=>
    `Βάθρο ${i+1}: αρχικό ${base} • φορτίο ${pedestalLoad(state,i)} • τελικό ${finalHeight(state,i)}`
  ).join("<br>");
}

function render(){
  renderPedestals();
  renderTray();
  renderDoors();
  renderHint();
  renderGM();

  const nowSolved=isSolved(state);
  if(nowSolved&&!lastSolved){
    flash();
    stoneGrind();
    setTimeout(()=>lowThud(118,.7,.10),400);
    const success=$("success");
    success.classList.remove("hidden");
    setTimeout(()=>success.classList.add("hidden"),3500);
  }
  lastSolved=nowSolved;
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
  await OBR.modal.open({
    id:MODAL_ID,
    url:url.toString(),
    fullScreen:true,
    hideBackdrop:true,
    hidePaper:true
  });
}

async function init(){
  await new Promise(resolve=>OBR.onReady(resolve));
  isGM=(await OBR.player.getRole())==="GM";

  const metadata=await OBR.room.getMetadata();
  state=sanitizeState(metadata[STATE_KEY]);

  if(isGM&&metadata[STATE_KEY]?.version!==STATE_VERSION){
    await OBR.room.setMetadata({[STATE_KEY]:state});
  }

  OBR.room.onMetadataChange(meta=>{
    if(meta[STATE_KEY]){
      state=sanitizeState(meta[STATE_KEY]);
      selected=null;
      render();
    }
  });

  OBR.broadcast.onMessage(CHANNEL,async event=>{
    if(isGM&&event.data?.type==="STATE_PROPOSE"){
      const proposed=sanitizeState(event.data.state);
      state=proposed;
      selected=null;
      await OBR.room.setMetadata({[STATE_KEY]:state});
      await OBR.broadcast.sendMessage(CHANNEL,{type:"STATE_COMMIT",state},{destination:"ALL"});
      render();
      return;
    }
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
  if(saved){
    try{state=sanitizeState(JSON.parse(saved));}catch{state=freshState();}
  }
  render();
}

$("fullscreenBtn").onclick=fullscreen;
$("gmToggle").onclick=()=>{if(isGM||demoMode)$("gmDrawer").classList.toggle("hidden");};
$("doorSelect").onchange=e=>commit({...state,door:Number(e.target.value),updatedAt:Date.now()});
$("hint1Btn").onclick=()=>commit({...state,hint:1,updatedAt:Date.now()});
$("hint2Btn").onclick=()=>commit({...state,hint:2,updatedAt:Date.now()});
$("hideHintsBtn").onclick=()=>commit({...state,hint:0,updatedAt:Date.now()});
$("resetBtn").onclick=()=>{selected=null;commit({...freshState(),door:state.door});};

demoMode?demo():init();
const SDK_URL="https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
const EXT="gr.echoes.weight-room.v3";
const KEY=`${EXT}/state`;
const CHANNEL=`${EXT}/sync`;
const BASE=[9,8,7,6];
const STONES=[
  {id:"s1",w:1,size:52},{id:"s2",w:2,size:59},{id:"s3",w:3,size:66},
  {id:"s4",w:4,size:74},{id:"s5",w:5,size:82},{id:"s6",w:6,size:90},{id:"s7",w:7,size:99}
];
const initialPlaces=()=>Object.fromEntries(STONES.map(s=>[s.id,"floor"]));
const fresh=()=>({places:initialPlaces(),hint:0,door:1,rev:Date.now()});
let state=fresh(),selected=null,OBR=null,isGM=true,demo=true,sceneReady=true,successShown=false,unsubs=[];
const $=q=>document.querySelector(q);
const clampState=x=>{
  const n=x&&typeof x==="object"?x:{};
  return {places:{...initialPlaces(),...(n.places||{})},hint:[0,1,2].includes(n.hint)?n.hint:0,door:[0,1,2].includes(+n.door)?+n.door:1,rev:n.rev||Date.now()};
};
const load=i=>STONES.filter(s=>state.places[s.id]===`p${i}`).reduce((a,s)=>a+s.w,0);
const height=i=>BASE[i]-load(i);
const solved=()=>{const h=BASE.map((_,i)=>height(i));return h.every(v=>v>=1)&&h.every(v=>v===h[0]);};
function stoneSound(freq=88,dur=.18,vol=.055){try{const c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.55),c.currentTime+dur);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dur);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+dur+.03)}catch{}}
function grind(){try{const c=new(window.AudioContext||window.webkitAudioContext)(),b=c.createBuffer(1,c.sampleRate*.72,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type="lowpass";f.frequency.value=370;g.gain.value=.07;s.connect(f).connect(g).connect(c.destination);s.start()}catch{}}
function dustAt(el){const r=el.getBoundingClientRect(),layer=$("#dustLayer");for(let i=0;i<10;i++){const p=document.createElement("i");p.className="dust-puff";p.style.left=`${r.left+r.width*(.25+Math.random()*.5)}px`;p.style.top=`${r.bottom-18+Math.random()*10}px`;p.style.setProperty("--dx",`${(Math.random()-.5)*80}px`);p.style.setProperty("--dy",`${-25-Math.random()*65}px`);layer.appendChild(p);setTimeout(()=>p.remove(),1300)}}
async function commit(next,source="local"){
  const was=solved(); state=clampState(next); render();
  if(!was&&solved()){grind();setTimeout(()=>stoneSound(126,.72,.11),380)}
  if(demo){localStorage.setItem(KEY,JSON.stringify(state));return;}
  if(source==="remote")return;
  if(isGM){await OBR.scene.setMetadata({[KEY]:state});await OBR.broadcast.sendMessage(CHANNEL,{type:"COMMIT",state},{destination:"ALL"});}
  else await OBR.broadcast.sendMessage(CHANNEL,{type:"PROPOSE",state},{destination:"ALL"});
}
async function moveStone(id,zone){if(!id||!sceneReady)return;const next=clampState(state);next.places[id]=zone;next.rev=Date.now();selected=null;stoneSound();await commit(next);}
function makeStone(s){const e=document.createElement("div");e.className="stone"+(selected===s.id?" selected":"");e.style.width=e.style.height=`${s.size}px`;e.draggable=true;e.dataset.id=s.id;e.addEventListener("dragstart",ev=>{e.classList.add("dragging");ev.dataTransfer.setData("text/plain",s.id);ev.dataTransfer.effectAllowed="move"});e.addEventListener("dragend",()=>e.classList.remove("dragging"));e.addEventListener("click",ev=>{ev.stopPropagation();selected=selected===s.id?null:s.id;render()});return e;}
function wireDrop(el,zone){el.addEventListener("dragover",ev=>{ev.preventDefault();if(zone!=="floor")el.classList.add("valid-target")});el.addEventListener("dragleave",()=>el.classList.remove("valid-target"));el.addEventListener("drop",ev=>{ev.preventDefault();el.classList.remove("valid-target");moveStone(ev.dataTransfer.getData("text/plain"),zone);if(zone!=="floor")dustAt(el)});el.addEventListener("click",()=>{if(selected){moveStone(selected,zone);if(zone!=="floor")dustAt(el)}});}
function renderPedestals(){const wrap=$("#pedestals");wrap.innerHTML="";BASE.forEach((base,i)=>{const h=Math.max(1,Math.min(9,height(i)));const p=document.createElement("div");p.className="pedestal";const shaft=document.createElement("div");shaft.className="shaft";shaft.style.height=`${20+h*7.3}%`;const cap=document.createElement("div");cap.className="cap";const bottom=5+h*5.1;cap.style.bottom=`${bottom}%`;const stack=document.createElement("div");stack.className="stack";stack.style.bottom=`${bottom+8}%`;STONES.filter(s=>state.places[s.id]===`p${i}`).sort((a,b)=>b.w-a.w).forEach(s=>stack.appendChild(makeStone(s)));p.append(shaft,cap,stack);wireDrop(p,`p${i}`);wrap.appendChild(p)});}
function renderFloor(){const wrap=$("#stones");wrap.innerHTML="";STONES.filter(s=>state.places[s.id]==="floor").sort((a,b)=>a.w-b.w).forEach(s=>wrap.appendChild(makeStone(s)));if(!wrap.dataset.wired){wireDrop(wrap,"floor");wrap.dataset.wired="1";}}
function renderDoors(){document.querySelectorAll(".door").forEach((d,i)=>d.classList.toggle("open",solved()&&i===state.door));}
function renderHint(){const h=$("#hint");if(!state.hint){h.classList.add("hidden");return;}h.classList.remove("hidden");h.textContent=state.hint===1?"Οι τέσσερις βάσεις υποχωρούν σαν μηχανικές ζυγαριές.":"Το ζητούμενο δεν είναι ίσο βάρος. Τα τέσσερα βάθρα πρέπει να καταλήξουν στο ίδιο τελικό ύψος.";}
function renderGM(){$("#gmToggle").classList.toggle("hidden",!isGM);if(!isGM)$("#gmPanel").classList.add("hidden");$("#doorSelect").value=String(state.door);$("#diag").innerHTML=BASE.map((b,i)=>`Βάθρο ${i+1}: αρχικό ${b} • φορτίο ${load(i)} • τελικό ${height(i)}`).join("<br>");}
function render(){renderPedestals();renderFloor();renderDoors();renderHint();renderGM();const s=$("#success");if(solved()&&!successShown){successShown=true;s.classList.remove("hidden");setTimeout(()=>s.classList.add("hidden"),3700)}if(!solved())successShown=false;}
$("#fullscreen").onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{}};
$("#gmToggle").onclick=()=>$("#gmPanel").classList.toggle("hidden");
$("#doorSelect").onchange=e=>commit({...state,door:+e.target.value,rev:Date.now()});
$("#hint1").onclick=()=>commit({...state,hint:1,rev:Date.now()});
$("#hint2").onclick=()=>commit({...state,hint:2,rev:Date.now()});
$("#hideHint").onclick=()=>commit({...state,hint:0,rev:Date.now()});
$("#reset").onclick=()=>{selected=null;commit({...fresh(),door:state.door});};
async function boot(sdk){OBR=sdk.default;demo=!OBR.isAvailable;if(demo){const saved=localStorage.getItem(KEY);if(saved)try{state=clampState(JSON.parse(saved))}catch{};$("#sync").textContent="δοκιμαστική λειτουργία";render();return;}
  const start=async()=>{isGM=(await OBR.player.getRole())==="GM";sceneReady=await OBR.scene.isReady();$("#noScene").classList.toggle("hidden",sceneReady);$("#sync").textContent=sceneReady?"συγχρονισμένο":"χωρίς σκηνή";if(sceneReady){const meta=await OBR.scene.getMetadata();if(meta[KEY])state=clampState(meta[KEY]);else if(isGM)await OBR.scene.setMetadata({[KEY]:state});}
    unsubs.push(OBR.scene.onMetadataChange(meta=>{if(meta[KEY])commit(meta[KEY],"remote")}));
    unsubs.push(OBR.scene.onReadyChange(async ready=>{sceneReady=ready;$("#noScene").classList.toggle("hidden",ready);$("#sync").textContent=ready?"συγχρονισμένο":"χωρίς σκηνή";if(ready){const meta=await OBR.scene.getMetadata();if(meta[KEY])state=clampState(meta[KEY]);else state=fresh();}render()}));
    unsubs.push(OBR.broadcast.onMessage(CHANNEL,async event=>{const msg=event.data||{};if(msg.type==="PROPOSE"&&isGM){await commit(msg.state)}else if(msg.type==="COMMIT"&&!isGM){await commit(msg.state,"remote")}}));render();};
  if(OBR.isReady)await start();else OBR.onReady(start);
}
import(SDK_URL).then(boot).catch(()=>{demo=true;const saved=localStorage.getItem(KEY);if(saved)try{state=clampState(JSON.parse(saved))}catch{};$("#sync").textContent="δοκιμαστική λειτουργία";render();});
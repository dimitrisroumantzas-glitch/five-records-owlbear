/* Echoes of the Forgotten Age — Scene 50. v9.0.0
   Photographic, fully isolated transparent objects. Nothing is painted twice.
   All 7 stone images and all 4 pedestal images are individually composited.
*/
const ROOT='gr.echoes.weight-room.fotoreal',KEY=ROOT+'/state',CHANNEL=ROOT+'/sync',VERSION=9;
const SIZE=1254, BASE=[9,8,7,6], M=[28,22,21,26], TOP=[550,594,620,638], ANCHOR=[{x:353,y:948},{x:550,y:953},{x:738,y:951},{x:940,y:951}];
const WEIGHTS=[1,2,3,4,5,6,7].map(w=>({id:'w'+w,weight:w}));
const DOORS=[{x:357,y:155,w:154,h:310},{x:587,y:155,w:143,h:310},{x:806,y:158,w:150,h:313}];
const $=id=>document.getElementById(id),cv=$('stage'),ctx=cv.getContext('2d');
let geom={},sprites={},room=null,game=fresh(),animation=[0,0,0,0],animTarget=[0,0,0,0],drag=null,selected=null,hover=null,gm=false,OBR=null,demo=true,doorStart=null,doorProg=0,solvedLast=false,renderQueued=false,noticeTimer=null,audio=null;
const qp=new URLSearchParams(location.search),demoParam=qp.get('demo')==='1';
const floorLocations={};
function fresh(){return {version:VERSION,placements:Object.fromEntries(WEIGHTS.map(x=>[x.id,'floor'])),door:1,hint:0,revision:0};}
function clean(v){const b=fresh();if(!v||v.version!==VERSION)return b;for(const s of WEIGHTS){const t=v.placements?.[s.id];if(['floor','p0','p1','p2','p3'].includes(t))b.placements[s.id]=t;}b.door=[0,1,2].includes(+v.door)?+v.door:1;b.hint=[0,1,2].includes(+v.hint)?+v.hint:0;b.revision=Number.isFinite(v.revision)?v.revision:0;return b;}
function load(i){return WEIGHTS.filter(w=>game.placements[w.id]==='p'+i).reduce((a,w)=>a+w.weight,0);}
function height(i){return BASE[i]-load(i);}
function solved(){const hs=BASE.map((_,i)=>height(i));return hs.every(h=>h>=1)&&hs.every(h=>h===hs[0]);}
function notice(s,time=3300){const el=$('status');el.textContent=s;el.classList.remove('hidden');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.add('hidden'),time);}
function thud(freq=75){try{audio??=new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(34,audio.currentTime+.23);g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.25);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.27);}catch{}}
function showImg(asset,x,y,w,h,alpha=1){if(!asset)return;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(asset,x,y,w,h);ctx.restore();}
function round(v){return Math.round(v*10)/10;}
function stoneCenter(id){const z=game.placements[id],geo=geom[id];if(!geo)return{x:0,y:0,scale:1};if(z==='floor')return{x:geo.x+geo.w/2,y:geo.y+geo.h/2,scale:1};const index=+z.slice(-1),stack=WEIGHTS.filter(w=>game.placements[w.id]===z).sort((a,b)=>b.weight-a.weight);let offset=0;for(const item of stack){const g=geom[item.id],sc=Math.min(.9,96/g.w,85/g.h);if(item.id===id)return{x:ANCHOR[index].x,y:TOP[index]+animation[index]-g.h*sc*.35-offset,scale:sc};offset+=g.h*sc*.77;}return{x:0,y:0,scale:1};}
function ellipse(x,y,w,h,fill,blur=0){ctx.save();ctx.fillStyle=fill;if(blur)ctx.filter=`blur(${blur}px)`;ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,2*Math.PI);ctx.fill();ctx.restore();}
function drawPedestal(i){const id='p'+i,g=geom[id],img=sprites[id];if(!g||!img)return;const a=ANCHOR[i];
  ellipse(a.x,a.y-2,67,17,'#03060591',7);
  // stationary socket below, old bronze foundation locked into the ground
  const split=[846,849,849,857][i],by=split-g.y;
  ctx.drawImage(img,0,by,g.w,g.h-by,g.x,split,g.w,g.h-by);
  // moving upper carved shaft. The fixed socket conceals the shaft disappearing downwards.
  const shift=animation[i];
  ctx.save();ctx.beginPath();ctx.rect(g.x-3,g.y-3,g.w+6,split-g.y+3);ctx.clip();
  ctx.drawImage(img,0,0,g.w,by,g.x,g.y+shift,g.w,by);
  ctx.restore();
  // slight shadow where the moving mechanism enters the fixed base, not a UI overlay
  if(shift>2)ellipse(a.x,split+1,42,5,`rgba(0,0,0,${Math.min(.55,shift/150)})`,3);
  if(hover===i){ctx.save();ctx.strokeStyle='#c9bd8cb0';ctx.shadowColor='#c6a96e';ctx.shadowBlur=10;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(a.x,TOP[i]+shift+11,53,13,0,0,2*Math.PI);ctx.stroke();ctx.restore();}
}
function drawWeight(id){if(drag?.id===id)return;const g=geom[id],img=sprites[id];if(!g||!img)return;const loc=stoneCenter(id),w=g.w*loc.scale,h=g.h*loc.scale;
  if(game.placements[id]==='floor')ellipse(loc.x,loc.y+h*.32,w*.46,h*.12,'#01030377',4);
  else ellipse(loc.x,TOP[+game.placements[id].at(-1)]+animation[+game.placements[id].at(-1)]+9,w*.43,8,'#0000008f',3);
  showImg(img,loc.x-w/2,loc.y-h/2,w,h);
  if(selected===id){ctx.save();ctx.shadowColor='#e3c27f';ctx.shadowBlur=24;ctx.strokeStyle='#f2deaeaa';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(loc.x,loc.y+h*.35,w*.50,9,0,0,2*Math.PI);ctx.stroke();ctx.restore();}
}
function drawDrag(){if(!drag)return;const g=geom[drag.id],img=sprites[drag.id];if(!g||!img)return;const sc=Math.min(.94,110/g.w),w=g.w*sc,h=g.h*sc;ellipse(drag.x+18,drag.y+35,w*.35,10,'#0009',6);ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=18;showImg(img,drag.x-w/2,drag.y-h/2,w,h,.95);ctx.restore();}
function drawDoor(){if(!solved())return;const {x,y,w,h}=DOORS[game.door],t=doorProg;
ctx.save();ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x,y+80);ctx.quadraticCurveTo(x,y,x+w/2,y);ctx.quadraticCurveTo(x+w,y,x+w,y+80);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.clip();
let gd=ctx.createRadialGradient(x+w/2,y+h*.65,3,x+w/2,y+h*.55,w);gd.addColorStop(0,'#134849');gd.addColorStop(.4,'#091517');gd.addColorStop(1,'#020405');ctx.fillStyle=gd;ctx.fillRect(x,y,w,h);
const off=t*w*.52;ctx.drawImage(room,x,y,w/2,h,x-off,y,w/2,h);ctx.drawImage(room,x+w/2,y,w/2,h,x+w/2+off,y,w/2,h);
ctx.restore();if(t>.1){ctx.save();ctx.globalAlpha=.28*t;ellipse(x+w/2,y+h*.75,34*t,77*t,'#b0e9d9',40);ctx.restore();}}
function render(){renderQueued=false;if(!room)return;ctx.clearRect(0,0,SIZE,SIZE);ctx.drawImage(room,0,0,SIZE,SIZE);for(let i=0;i<4;i++)drawPedestal(i);for(const {id} of WEIGHTS)drawWeight(id);drawDrag();drawDoor();}
function requestRender(){if(!renderQueued){renderQueued=true;requestAnimationFrame(render);}}
function updateAnimation(){let moving=false;for(let i=0;i<4;i++){const target=Math.min(152,load(i)*M[i]);animTarget[i]=target;const diff=target-animation[i];if(Math.abs(diff)>.12){animation[i]+=diff*.16;moving=true;}else animation[i]=target;}if(solved()&&doorProg<1){doorProg=Math.min(1,doorProg+.025);moving=true;}if(moving)requestRender();requestAnimationFrame(updateAnimation);}
function mapPoint(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*SIZE,y:(e.clientY-r.top)/r.height*SIZE};}
function pointWeight(p){for(const w of [...WEIGHTS].reverse()){const g=geom[w.id],loc=stoneCenter(w.id),ww=g.w*loc.scale,hh=g.h*loc.scale;if(Math.abs(p.x-loc.x)<ww*.49&&Math.abs(p.y-loc.y)<hh*.53)return w.id;}return null;}
function pointZone(p){for(let i=0;i<4;i++)if(Math.abs(p.x-ANCHOR[i].x)<73&&p.y>TOP[i]+animation[i]-70&&p.y<960)return 'p'+i;return p.y>970?'floor':null;}
function updateGM(){$('door').value=String(game.door);$('diagnostics').textContent=BASE.map((b,i)=>`Βάθρο ${i+1}: ${b} - ${load(i)} = ${height(i)}`).join('\n')+'\nΣτόχος: ίδιο τελικό ύψος.';}
async function commit(next){const was=solved();game=clean(next);if(solved()&&!was){doorProg=0;notice('Μια αρχαία θύρα υποχωρεί με βαρύ κρότο.',5100);thud(125);}else if(!solved())doorProg=0;requestRender();updateGM();if(demo||!OBR)return;
try{await OBR.room.setMetadata({[KEY]:game});await OBR.broadcast.sendMessage(CHANNEL,{kind:'SYNC',state:game},{destination:'ALL'});}catch(e){console.error(e);notice('Η κίνηση δεν συγχρονίστηκε.');}}
function move(id,zone){if(!id||!zone)return;selected=null;drag=null;thud(77);if(demo||gm){void commit({...game,placements:{...game.placements,[id]:zone},revision:game.revision+1});}else if(OBR){game.placements[id]=zone;requestRender();void OBR.broadcast.sendMessage(CHANNEL,{kind:'MOVE',id,zone},{destination:'ALL'}).catch(console.warn);}}
cv.addEventListener('pointerdown',e=>{const p=mapPoint(e),id=pointWeight(p);if(id){selected=id;drag={id,x:p.x,y:p.y,start:p};cv.setPointerCapture(e.pointerId);requestRender();}else if(selected){const zone=pointZone(p);if(zone)move(selected,zone);}});
cv.addEventListener('pointermove',e=>{const p=mapPoint(e);if(drag){drag.x=p.x;drag.y=p.y;const z=pointZone(p);hover=z?.startsWith('p')?+z.at(-1):null;cv.style.cursor='grabbing';requestRender();}else cv.style.cursor=pointWeight(p)?'grab':selected?'pointer':'default';});
cv.addEventListener('pointerup',e=>{if(!drag)return;const d=drag,p=mapPoint(e),z=pointZone(p),moved=Math.hypot(p.x-d.start.x,p.y-d.start.y)>12;drag=null;hover=null;cv.style.cursor='default';if(moved&&z)move(d.id,z);else selected=d.id;requestRender();});
cv.addEventListener('pointercancel',()=>{drag=null;hover=null;requestRender();});
$('gmToggle').onclick=()=>{$('gmPanel').classList.toggle('hidden');};
$('door').onchange=e=>{if(gm||demo)void commit({...game,door:+e.target.value});};
$('hint1').onclick=()=>{if(gm||demo){notice('Οι τέσσερις βάσεις λειτουργούν σαν μηχανικές ζυγαριές.',6500);void commit({...game,hint:1});}};
$('hint2').onclick=()=>{if(gm||demo){notice('Ο στόχος δεν είναι ίσα βάρη, αλλά ίδιο τελικό ύψος.',6500);void commit({...game,hint:2});}};
$('reset').onclick=()=>{if(gm||demo){selected=null;doorProg=0;void commit({...fresh(),door:game.door});notice('Ο μηχανισμός επέστρεψε στην αρχική θέση.');}};
$('full').onclick=async()=>{try{if(!demo&&OBR){const id=ROOT+'/fullscreen';if(qp.get('fullscreen')==='1')await OBR.modal.close(id);else{const url=new URL(location.href);url.searchParams.set('fullscreen','1');await OBR.modal.open({id,url:url.href,fullScreen:true,hidePaper:true,hideBackdrop:true});}}else if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){console.warn(e);}};
function image(url){return new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>no(new Error('Asset load failed: '+url));im.src=url;});}
async function boot(){try{geom=await(await fetch('./assets/geometry.json?v=900')).json();room=await image('./assets/room.webp?v=900');const entries=Object.entries(geom);await Promise.all(entries.map(async([k,v])=>sprites[k]=await image('./'+v.file+'?v=900')));$('loading').classList.add('hidden');requestRender();requestAnimationFrame(updateAnimation);
if(demoParam){demo=true;gm=true;$('gmToggle').classList.remove('hidden');window.__weightRoomTest={get:()=>JSON.parse(JSON.stringify(game)),move:(id,zone)=>move(id,zone),reset:()=>{void commit(fresh());},solved:()=>solved()};updateGM();return;}
try{const imp=await import('https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm');OBR=imp.default;if(!OBR.isAvailable)throw new Error('Standalone mode');await new Promise(r=>OBR.onReady(r));gm=(await OBR.player.getRole())==='GM';demo=false;$('gmToggle').classList.toggle('hidden',!gm);const metadata=await OBR.room.getMetadata();game=clean(metadata[KEY]);if(gm&&metadata[KEY]?.version!==VERSION)await OBR.room.setMetadata({[KEY]:game});
OBR.room.onMetadataChange(m=>{if(m[KEY]){const was=solved();game=clean(m[KEY]);if(solved()&&!was){doorProg=0;thud(120);notice('Ο μηχανισμός ενεργοποιήθηκε.',5000);}if(!solved())doorProg=0;requestRender();updateGM();}});
OBR.broadcast.onMessage(CHANNEL,async ev=>{const d=ev.data;if(gm&&d?.kind==='MOVE'&&WEIGHTS.some(w=>w.id===d.id)&&['floor','p0','p1','p2','p3'].includes(d.zone)){await commit({...game,placements:{...game.placements,[d.id]:d.zone},revision:game.revision+1});}else if(d?.kind==='SYNC'){const was=solved();game=clean(d.state);if(solved()&&!was){doorProg=0;notice('Ο μηχανισμός ενεργοποιήθηκε.',5000);}if(!solved())doorProg=0;requestRender();updateGM();}});updateGM();requestRender();}
catch(e){console.info('Preview outside Owlbear:',e);demo=true;gm=true;$('gmToggle').classList.remove('hidden');updateGM();}
}catch(e){console.error(e);$('loading').textContent='Η φόρτωση απέτυχε. Ελέγξτε τη σύνδεση.';}}
boot();

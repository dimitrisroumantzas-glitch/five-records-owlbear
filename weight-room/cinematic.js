// Scene 50 — real-image point-and-click/drag puzzle. No CSS-proxy pillars or stone buttons.
const W=1254, H=1254, PREFIX='gr.echoes.weight-room.cinematic', KEY=`${PREFIX}/state`, CHANNEL=`${PREFIX}/sync`;
const VERSION=8, BASE=[9,8,7,6];
const PEDS=[
 {x:354,y:666, drop:{x:282,y:534,w:145,h:436}},
 {x:550,y:712, drop:{x:482,y:570,w:137,h:410}},
 {x:737,y:740, drop:{x:666,y:584,w:145,h:390}},
 {x:934,y:762, drop:{x:863,y:606,w:141,h:358}}
];
const DOORS=[{x:357,y:154,w:148,h:310},{x:577,y:143,w:151,h:325},{x:792,y:147,w:148,h:325}];
const STONES=[
 {id:'s1',w:1,p:[[150,1100],[166,1076],[186,1063],[204,1072],[221,1100],[231,1120],[215,1148],[176,1157],[148,1135]]},
 {id:'s2',w:2,p:[[243,1090],[265,1064],[308,1058],[341,1073],[363,1107],[357,1140],[329,1157],[281,1161],[246,1141]]},
 {id:'s3',w:3,p:[[380,1086],[404,1055],[443,1057],[477,1084],[492,1116],[481,1144],[455,1159],[410,1156],[382,1123]]},
 {id:'s4',w:4,p:[[495,1077],[517,1041],[565,1025],[610,1043],[637,1075],[640,1134],[613,1169],[535,1175],[495,1140]]},
 {id:'s5',w:5,p:[[637,1071],[660,1046],[705,1032],[746,1047],[774,1080],[778,1132],[744,1179],[682,1184],[641,1153]]},
 {id:'s6',w:6,p:[[794,1048],[824,1011],[865,988],[914,996],[946,1035],[959,1105],[934,1161],[894,1180],[840,1178],[793,1144]]},
 {id:'s7',w:7,p:[[973,1023],[1014,971],[1065,958],[1118,968],[1162,1018],[1181,1097],[1163,1158],[1129,1182],[1044,1196],[985,1160]]}
];
for(const s of STONES){
 s.cx=s.p.reduce((v,q)=>v+q[0],0)/s.p.length;
 s.cy=s.p.reduce((v,q)=>v+q[1],0)/s.p.length;
 s.minX=Math.min(...s.p.map(p=>p[0]));s.maxX=Math.max(...s.p.map(p=>p[0]));
 s.minY=Math.min(...s.p.map(p=>p[1]));s.maxY=Math.max(...s.p.map(p=>p[1]));
}
const $=id=>document.getElementById(id);
const canvas=$('stage'),ctx=canvas.getContext('2d',{alpha:false});
let original=null,cleared=null,OBR=null,game=fresh(),isGM=false,demo=true,selected=null,dragging=null,hover=null,doorAnimation=0,doorAnimStart=0,renderPending=false,msgTimer=0,audioContext=null;
const isDemoParam=new URLSearchParams(location.search).get('demo')==='1';
function fresh(){return {v:VERSION,places:Object.fromEntries(STONES.map(s=>[s.id,'floor'])),door:1,hint:0,updated:Date.now()};}
function sanitize(raw){const initial=fresh();if(!raw||raw.v!==VERSION)return initial;
 for(const s of STONES){const value=raw.places?.[s.id];initial.places[s.id]=['floor','p0','p1','p2','p3'].includes(value)?value:'floor';}
 initial.door=[0,1,2].includes(Number(raw.door))?Number(raw.door):1;
 initial.hint=[0,1,2].includes(Number(raw.hint))?Number(raw.hint):0;
 initial.updated=Number.isFinite(raw.updated)?raw.updated:Date.now();return initial;
}
function loadImg(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Αποτυχία φόρτωσης '+url));img.src=url;});}
function load(p){return STONES.filter(s=>game.places[s.id]===`p${p}`).reduce((n,s)=>n+s.w,0);}
function height(p){return BASE[p]-load(p);}
function solved(){const v=PEDS.map((_,i)=>height(i));return v.every(h=>h>=1)&&v.every(h=>h===v[0]);}
function outline(poly){ctx.beginPath();ctx.moveTo(poly[0][0],poly[0][1]);for(let i=1;i<poly.length;i++)ctx.lineTo(poly[i][0],poly[i][1]);ctx.closePath();}
function drawSprite(s,x,y,scale=1,alpha=1){
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.scale(scale,scale);ctx.translate(-s.cx,-s.cy);
 outline(s.p);ctx.clip();ctx.drawImage(original,0,0,W,H);ctx.restore();
}
function shadowStone(cx,cy,width){ctx.save();ctx.fillStyle='#050908a8';ctx.filter='blur(8px)';ctx.beginPath();ctx.ellipse(cx,cy,width*.50,width*.12,0,0,Math.PI*2);ctx.fill();ctx.restore();}
function ringGlow(p,active){
 const ped=PEDS[p], h=height(p), y=ped.y+55+Math.max(0,Math.min(80,(BASE[p]-h)*9));
 ctx.save();ctx.strokeStyle=active?'#9fd8d3ba':'#c5a87471';ctx.lineWidth=active?3:2;ctx.shadowColor=active?'#9bd9db':'#bba26c';ctx.shadowBlur=active?11:3;
 ctx.beginPath();ctx.ellipse(ped.x,y,42,10,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function renderDoor(){if(!solved())return;
 const door=DOORS[game.door];const t=Math.min(1,doorAnimation);const {x,y,w,h}=door;
 ctx.save();ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x,y+74);ctx.quadraticCurveTo(x+w*.08,y+7,x+w*.5,y);
 ctx.quadraticCurveTo(x+w*.92,y+7,x+w,y+74);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.clip();
 const grad=ctx.createRadialGradient(x+w/2,y+h*.75,1,x+w/2,y+h*.55,w);
 grad.addColorStop(0,'#183d3b');grad.addColorStop(.42,'#070d10');grad.addColorStop(1,'#020405');ctx.fillStyle=grad;ctx.fillRect(x,y,w,h);
 const off=t*w*.52;ctx.drawImage(original,x,y,w/2,h,x-off,y,w/2,h);ctx.drawImage(original,x+w/2,y,w/2,h,x+w/2+off,y,w/2,h);
 ctx.restore();
 if(t>.3){ctx.save();ctx.fillStyle=`rgba(156,226,208,${.12*t})`;ctx.shadowColor='#99d0d0';ctx.shadowBlur=55;ctx.beginPath();ctx.ellipse(x+w/2,y+h*.7,24*t,50*t,0,0,Math.PI*2);ctx.fill();ctx.restore();}
}
function redraw(){
 renderPending=false;if(!original||!cleared)return;
 ctx.clearRect(0,0,W,H);ctx.drawImage(original,0,0,W,H);
 // Erase only weights picked up from the ground. Background stays the approved art.
 for(const s of STONES){if(game.places[s.id]==='floor'||dragging?.stone===s.id)continue;
  ctx.save();outline(s.p);ctx.clip();ctx.drawImage(cleared,0,0,W,H);ctx.restore();}
 if(dragging?.stone){const s=STONES.find(a=>a.id===dragging.stone);ctx.save();outline(s.p);ctx.clip();ctx.drawImage(cleared,0,0,W,H);ctx.restore();}
 for(let i=0;i<4;i++){
  const stones=STONES.filter(s=>game.places[s.id]===`p${i}`).sort((a,b)=>b.w-a.w);
  const h=height(i);if(stones.length>0||hover===i)ringGlow(i,hover===i);
  let up=0;
  for(const s of stones){const scale=Math.min(.88,82/(s.maxX-s.minX));const stoneH=(s.maxY-s.minY)*scale;
    const p=PEDS[i],settle=Math.min(52,load(i)*5.1),cy=p.y-stoneH*.48-settle-up;
    shadowStone(p.x,p.y+2,85);
    drawSprite(s,p.x,cy,scale);up+=stoneH*.72;
  }
  if(dragging&&hover===i){ctx.save();ctx.strokeStyle='#d2bf83b0';ctx.lineWidth=2;ctx.shadowColor='#d8b978';ctx.shadowBlur=13;ctx.beginPath();ctx.ellipse(PEDS[i].x,PEDS[i].y+29,60,18,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 }
 if(dragging?.stone){const s=STONES.find(a=>a.id===dragging.stone);shadowStone(dragging.x,dragging.y+30,80);drawSprite(s,dragging.x,dragging.y,.78,.94);}
 if(selected&&!dragging){const s=STONES.find(a=>a.id===selected);if(s){const loc=stonePosition(s);ctx.save();ctx.lineWidth=3;ctx.strokeStyle='#dac083b8';ctx.shadowColor='#c4ad6c';ctx.shadowBlur=14;ctx.translate(loc.x,loc.y);ctx.scale(loc.scale,loc.scale);ctx.translate(-s.cx,-s.cy);outline(s.p);ctx.stroke();ctx.restore();}}
 renderDoor();
 if(solved()&&doorAnimation<1)requestAnimationFrame(animateDoor);
}
function requestDraw(){if(!renderPending){renderPending=true;requestAnimationFrame(redraw);}}
function stonePosition(s){const loc=game.places[s.id];if(loc==='floor')return {x:s.cx,y:s.cy,scale:1};
 const i=Number(loc.at(-1)),stack=STONES.filter(z=>game.places[z.id]===loc).sort((a,b)=>b.w-a.w);
 let up=0;for(const z of stack){const scale=Math.min(.88,82/(z.maxX-z.minX)),stoneH=(z.maxY-z.minY)*scale;
  if(z.id===s.id)return {x:PEDS[i].x,y:PEDS[i].y-stoneH*.48-Math.min(52,load(i)*5.1)-up,scale};up+=stoneH*.72;}
 return {x:s.cx,y:s.cy,scale:1};}
function mousePos(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left)/r.width*W,y:(event.clientY-r.top)/r.height*H};}
function insidePolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if(((a[1]>p.y)!==(b[1]>p.y))&&(p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
 }return inside;}
function hitStone(p){for(const s of [...STONES].reverse()){
 const loc=stonePosition(s);const local={x:(p.x-loc.x)/loc.scale+s.cx,y:(p.y-loc.y)/loc.scale+s.cy};
 if(insidePolygon(local,s.p))return s.id;
 }return null;}
function zoneAt(p){for(let i=0;i<PEDS.length;i++){const d=PEDS[i].drop;if(p.x>d.x&&p.x<d.x+d.w&&p.y>d.y&&p.y<d.y+d.h)return `p${i}`;}
 if(p.y>970)return 'floor';return null;}
function notify(message,ms=3600){const el=$('status');el.textContent=message;el.classList.remove('hidden');clearTimeout(msgTimer);msgTimer=setTimeout(()=>el.classList.add('hidden'),ms);}
function sound(){try{audioContext??=new AudioContext();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(95,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(39,audioContext.currentTime+.24);gain.gain.setValueAtTime(.055,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+.24);osc.connect(gain).connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.25);}catch{}}
function animateDoor(t){if(!doorAnimStart)doorAnimStart=t;doorAnimation=Math.min(1,(t-doorAnimStart)/1350);requestDraw();}
function checkVictory(was){if(solved()&&!was){doorAnimation=0;doorAnimStart=0;notify('Η πέτρα υποχωρεί. Μία από τις θύρες ανοίγει.',5000);sound();}}
async function apply(next,{remote=false}={}){
 const prev=solved(),oldHint=game.hint;game=sanitize(next);checkVictory(prev);if(remote&&game.hint!==oldHint&&game.hint>0)notify(game.hint===1?'Οι τέσσερις βάσεις λειτουργούν σαν μηχανικές ζυγαριές.':'Το ζητούμενο είναι να φτάσουν στο ίδιο τελικό ύψος.',6500);requestDraw();updateGM();
 if(remote||demo||!OBR)return;
 try{if(isGM){await OBR.room.setMetadata({[KEY]:game});await OBR.broadcast.sendMessage(CHANNEL,{type:'STATE',state:game},{destination:'ALL'});}
 else await OBR.broadcast.sendMessage(CHANNEL,{type:'MOVE',places:game.places},{destination:'ALL'});
 }catch(e){console.warn('Owlbear sync',e);notify('Η κίνηση έγινε τοπικά αλλά ο συγχρονισμός απέτυχε.',4500);}
}
function dropStone(id,zone){if(!id||!zone)return;const p={...game.places,[id]:zone};selected=null;hover=null;sound();void apply({...game,places:p,updated:Date.now()});}
canvas.addEventListener('pointerdown',e=>{const p=mousePos(e),stone=hitStone(p);
 if(stone){selected=stone;dragging={stone,x:p.x,y:p.y,initial:p};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';requestDraw();return;}
 if(selected){const zone=zoneAt(p);if(zone)dropStone(selected,zone);}
});
canvas.addEventListener('pointermove',e=>{const p=mousePos(e);
 if(dragging){dragging.x=p.x;dragging.y=p.y;const zone=zoneAt(p);hover=zone?.startsWith('p')?Number(zone.at(-1)):null;requestDraw();}
 else canvas.style.cursor=hitStone(p)?'grab':selected&&zoneAt(p)?'pointer':'default';
});
canvas.addEventListener('pointerup',e=>{if(!dragging)return;const d=dragging;const p=mousePos(e);dragging=null;hover=null;canvas.style.cursor='default';
 const delta=Math.hypot(p.x-d.initial.x,p.y-d.initial.y);const zone=zoneAt(p);
 if(zone&&delta>9)dropStone(d.stone,zone);else if(delta<=9)selected=d.stone;requestDraw();
});
canvas.addEventListener('pointercancel',()=>{dragging=null;hover=null;requestDraw();});
function updateGM(){$('doorChoose').value=String(game.door);$('diagnostics').textContent=PEDS.map((_,i)=>`Βάθρο ${i+1}: ${BASE[i]} - ${load(i)} = ${height(i)}`).join('\n');}
$('gmButton').onclick=()=>{$('gmPanel').classList.toggle('hidden');};
$('doorChoose').onchange=e=>{if(isGM)void apply({...game,door:Number(e.target.value),updated:Date.now()});};
$('hintOne').onclick=()=>{if(isGM){notify('Οι τέσσερις πέτρινες βάσεις λειτουργούν σαν μηχανικές ζυγαριές.',6500);void apply({...game,hint:1,updated:Date.now()});}};
$('hintTwo').onclick=()=>{if(isGM){notify('Το ζητούμενο είναι να καταλήξουν όλες οι βάσεις στο ίδιο ύψος.',6500);void apply({...game,hint:2,updated:Date.now()});}};
$('reset').onclick=()=>{if(isGM){doorAnimation=0;doorAnimStart=0;selected=null;void apply({...fresh(),door:game.door});notify('Ο μηχανισμός επέστρεψε στην αρχική του θέση.');}};
$('fullButton').onclick=async()=>{try{if(!demo&&OBR){const id=`${PREFIX}/full`;if(location.search.includes('fullscreen=1'))await OBR.modal.close(id);
 else{const url=new URL(location.href);url.searchParams.set('fullscreen','1');await OBR.modal.open({id,url:url.href,fullScreen:true,hidePaper:true,hideBackdrop:true});}}
 else if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){console.warn(e);}};
async function boot(){
 try{[original,cleared]=await Promise.all([loadImg('./assets/scene50-approved.avif'),loadImg('./assets/scene50-cleared.avif')]);}
 catch(e){notify('Δεν φορτώθηκαν οι εικόνες της σκηνής.');console.error(e);return;}
 requestDraw();updateGM();
 if(isDemoParam){demo=true;isGM=true;$('gmButton').classList.remove('hidden');return;}
 try{const mod=await import('https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm');OBR=mod.default;
  if(!OBR.isAvailable)throw new Error('Owlbear context unavailable');
  await new Promise(resolve=>OBR.onReady(resolve));demo=false;isGM=(await OBR.player.getRole())==='GM';
  $('gmButton').classList.toggle('hidden',!isGM);
  const meta=await OBR.room.getMetadata();game=sanitize(meta[KEY]);if(isGM&&meta[KEY]?.v!==VERSION)await OBR.room.setMetadata({[KEY]:game});
  OBR.room.onMetadataChange(m=>{if(m[KEY])void apply(m[KEY],{remote:true});});
  OBR.broadcast.onMessage(CHANNEL,async event=>{
   if(event.data?.type==='STATE')void apply(event.data.state,{remote:true});
  });
  requestDraw();updateGM();
 }catch(e){console.info('Standalone preview',e);demo=true;isGM=true;$('gmButton').classList.remove('hidden');}
}
boot();

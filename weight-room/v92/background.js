import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
const ROOT="gr.echoes.weight-room.fotoreal.v92",KEY=ROOT+"/state",CHANNEL=ROOT+"/sync";
const VERSION=92,BASE=[16,14,13,12],MASS=[1,2,3,4,7,10,12];
function fresh(){return {version:VERSION,placements:Object.fromEntries(MASS.map((_,i)=>["w"+(i+1),"floor"])),door:1,hint:0,revision:0};}
function clean(v){const b=fresh();if(!v||v.version!==VERSION)return b;
 for(let i=0;i<MASS.length;i++){const id="w"+(i+1),z=v.placements?.[id];if(["floor","p0","p1","p2","p3"].includes(z))b.placements[id]=z;}
 if([0,1,2].includes(+v.door))b.door=+v.door;
 if([0,1,2].includes(+v.hint))b.hint=+v.hint;
 b.revision=Number.isSafeInteger(v.revision)&&v.revision>=0?v.revision:0;return b;}
function height(g,i){return BASE[i]-MASS.reduce((s,m,k)=>s+(g.placements["w"+(k+1)]==="p"+i?m:0),0);}
function solved(g){const h=BASE.map((_,i)=>height(g,i));return h.every(x=>x>=2)&&h.every(x=>x===h[0]);}
OBR.onReady(async()=>{
 if((await OBR.player.getRole())!=="GM")return;
 const metadata=await OBR.room.getMetadata();
 if(metadata[KEY]?.version!==VERSION)await OBR.room.setMetadata({[KEY]:fresh()});
 let pending=Promise.resolve();
 OBR.broadcast.onMessage(CHANNEL,ev=>{
  const d=ev.data;if(d?.kind!=="MOVE")return;
  pending=pending.then(async()=>{
    const meta=await OBR.room.getMetadata(),g=clean(meta[KEY]);
    const idx=MASS.findIndex((_,i)=>"w"+(i+1)===d.id);
    if(idx<0||!["floor","p0","p1","p2","p3"].includes(d.zone)||solved(g))return;
    const old=g.placements[d.id];
    if(old!==d.zone){
      if(d.zone.startsWith("p")){
        const i=Number(d.zone.slice(-1));
        if(BASE[i]-height(g,i)+MASS[idx]>BASE[i]-2)return;
      }
      g.placements[d.id]=d.zone;g.revision++;
      await OBR.room.setMetadata({[KEY]:g});
    }
    await OBR.broadcast.sendMessage(CHANNEL,{kind:"SYNC",state:g},{destination:"ALL"});
  }).catch(console.warn);
 });
});
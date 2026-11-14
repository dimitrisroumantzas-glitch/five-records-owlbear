import OBR from 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm';
const PREFIX='gr.echoes.weight-room.cinematic',KEY=`${PREFIX}/state`,CHANNEL=`${PREFIX}/sync`;
const VERSION=8, ids=['s1','s2','s3','s4','s5','s6','s7'];
function fresh(){return {v:VERSION,places:Object.fromEntries(ids.map(id=>[id,'floor'])),door:1,hint:0,updated:Date.now()};}
OBR.onReady(async()=>{
 if((await OBR.player.getRole())!=='GM')return;
 OBR.broadcast.onMessage(CHANNEL,async event=>{
  if(event.data?.type!=='MOVE')return;
  const old=(await OBR.room.getMetadata())[KEY];
  const state=old?.v===VERSION?JSON.parse(JSON.stringify(old)):fresh();
  const proposal=event.data.places||{};
  for(const id of ids){if(['floor','p0','p1','p2','p3'].includes(proposal[id]))state.places[id]=proposal[id];}
  state.updated=Date.now();
  await OBR.room.setMetadata({[KEY]:state});
  await OBR.broadcast.sendMessage(CHANNEL,{type:'STATE',state},{destination:'ALL'});
 });
});
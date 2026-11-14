export const EXTENSION_ID="gr.echoes.weight-room";
export const STATE_KEY=`${EXTENSION_ID}/state`;
export const CHANNEL=`${EXTENSION_ID}/sync`;
export const STATE_VERSION=5;

export const BASE_HEIGHTS=[9,8,7,6];
export const STONES=[
  {id:"s1",weight:1,size:48},
  {id:"s2",weight:2,size:56},
  {id:"s3",weight:3,size:64},
  {id:"s4",weight:4,size:72},
  {id:"s5",weight:5,size:80},
  {id:"s6",weight:6,size:88},
  {id:"s7",weight:7,size:96}
];

export function freshState(){
  return{
    version:STATE_VERSION,
    placements:Object.fromEntries(STONES.map(s=>[s.id,"floor"])),
    hint:0,
    door:1,
    updatedAt:Date.now()
  };
}

export function sanitizeState(v){
  const b=freshState();
  if(!v||typeof v!=="object"||v.version!==STATE_VERSION)return b;
  const allowed=new Set(["floor","p0","p1","p2","p3"]);
  const placements={...b.placements};
  for(const stone of STONES){
    const z=v.placements?.[stone.id];
    if(allowed.has(z))placements[stone.id]=z;
  }
  return{
    version:STATE_VERSION,
    placements,
    hint:[0,1,2].includes(v.hint)?v.hint:0,
    door:[0,1,2].includes(Number(v.door))?Number(v.door):1,
    updatedAt:Number.isFinite(v.updatedAt)?v.updatedAt:Date.now()
  };
}

export function pedestalLoad(state,index){
  return STONES.filter(s=>state.placements[s.id]===`p${index}`).reduce((sum,s)=>sum+s.weight,0);
}
export function finalHeight(state,index){return BASE_HEIGHTS[index]-pedestalLoad(state,index);}
export function isSolved(state){
  const h=BASE_HEIGHTS.map((_,i)=>finalHeight(state,i));
  return h.every(v=>v>=1)&&h.every(v=>v===h[0]);
}
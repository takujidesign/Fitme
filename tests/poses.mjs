import assert from 'node:assert/strict';
import {EXERCISES,EX} from '../app/js/exercises.js';
import {solve,interpolatePose,figureSVG,renderPose} from '../app/js/figure.js';
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const angle=(a,b,c)=>{const u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/Math.hypot(...u)/Math.hypot(...v))))*180/Math.PI;};
const signed=(a,b,c)=>Math.atan2((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]),(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))*180/Math.PI;
assert.equal(EXERCISES.length,40);
assert.equal(interpolatePose({a1:[175,176],x:180},{a1:[175,-35],x:-35},.5).a1[1],250.5);
assert.equal(interpolatePose({a1:[175,176]},{a1:[175,-35]},.5,{longArc:['a1']}).a1[1],70.5);
assert.equal(interpolatePose({x:180},{x:-35},.5).x,72.5);
let poses=0;
for(const ex of EXERCISES){
 for(let f=0;f<ex.frames.length;f++)for(let i=0;i<=9;i++){
  const p=interpolatePose(ex.frames[f],ex.frames[(f+1)%ex.frames.length],i/9,ex),j=solve(p,ex.view),where=`${ex.id} frame ${f}, step ${i}`;
  for(const [limb,lens] of [[j.arm1,[25,23]],[j.arm2,[25,23]],[j.leg1,[34,34]],[j.leg2,[34,34]]]){
   assert(limb.flat().every(Number.isFinite),where+' finite joints');
   assert(Math.abs(length(limb[0],limb[1])-lens[0])<.001,where+' proximal bone length');assert(Math.abs(length(limb[1],limb[2])-lens[1])<.001,where+' distal bone length');
   assert(angle(...limb)<=160.01,where+' flexion ≤160');
   assert(limb[2][1]<=182.01,where+' hand/ankle above floor');
  }
  for(const foot of [j.foot1,j.foot2].filter(Boolean))assert(foot[1]<=182.01,where+' toe above floor');
  assert(length(j.arm1[0],j.sh1)<2&&length(j.arm2[0],j.sh2)<2,where+' shoulder connections');
  if(ex.view!=='front')assert(length(j.leg1[0],j.hip)<2&&length(j.leg2[0],j.hip)<2,where+' hip connections');
  if(['plank','side_plank'].includes(ex.id))assert(angle(j.neckBase,j.hip,j.leg1[2])<=10,where+' straight trunk');
  if(ex.id==='triceps_ext')assert(Math.abs(p.a1[0]-180)<=20&&Math.abs(p.a2[0]-180)<=20,where+' upper arms vertical');
  if(ex.id==='db_curl')assert(Math.abs(p.a1[0])<=15&&Math.abs(p.a2[0])<=15,where+' upper arms vertical');
  if(ex.id==='crunch')assert(p.t>=-120&&p.y===174,where+' lower back stays down');
  for(const [leg,index] of [[j.leg1,0],[j.leg2,1]]){
   const direction=ex.id==='bench_press'?-1:index===1&&(ex.view==='front'||p.sym)?-1:1;
   assert(signed(...leg)*direction>=-5.01,where+' knee does not hyperextend');
   assert(angle(j.neckBase,j.hip,leg[1])<=170.01,where+' hip flexion limit');
   if(['squat','goblet_squat','squat_jump','chair_squat'].includes(ex.id))assert(Math.abs(leg[1][0]-leg[2][0])<=20,where+' squat knee stays within 20px sagittal projection of planted ankle');
  }
  for(const arm of [j.arm1,j.arm2])assert(angle(j.hip,arm[0],arm[1])<=180.01,where+' shoulder flexion range');
  const props=String(ex.prop||'').split(' '),rendered=renderPose(p,ex,'check');
  if(props.includes('db'))for(const arm of [j.arm1,j.arm2])assert(rendered.includes(`x="${arm[2][0]-7}" y="${arm[2][1]-3}"`),where+' dumbbell grip stays in hand');
  if(props.includes('bar'))assert(Math.abs(j.arm1[2][1]-j.arm2[2][1])<=4,where+' both hands contact bar within 2px');
  if(props.includes('kb'))assert(length(j.arm1[2],j.arm2[2])<=4,where+' both hands at goblet grip');
  poses++;
 }
 const svg=figureSVG(ex);assert(!/NaN|undefined/.test(svg),ex.id+' valid rendered SVG');
}
assert(EX.step_up.prop==='step'&&EX.side_plank.prop==='mat');
console.log(`PASS ${poses} poses: 40 exercises, every keyframe and eight intermediate samples per transition; bone connectivity, elbow/knee flexion, floor and listed movement invariants.`);

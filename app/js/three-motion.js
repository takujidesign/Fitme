import * as T from './vendor/three/three.module.js';
const Y=new T.Vector3(0,1,0), rad=Math.PI/180;
export const BONE_MAP={pelvis:'pelvis',spine:'spine_01',chest:'spine_03',neck:'neck_01',head:'head'};
for(const side of ['L','R'])for(const [a,b] of Object.entries({upper_arm:'upperarm',forearm:'lowerarm',hand:'hand',thigh:'thigh',shin:'calf',foot:'foot'}))BONE_MAP[`${a}.${side}`]=`${b}_${side.toLowerCase()}`;
const parent={spine:'pelvis',chest:'spine',neck:'chest',head:'neck'};
for(const s of ['L','R'])Object.assign(parent,{[`upper_arm.${s}`]:'chest',[`forearm.${s}`]:`upper_arm.${s}`,[`hand.${s}`]:`forearm.${s}`,[`thigh.${s}`]:'pelvis',[`shin.${s}`]:`thigh.${s}`,[`foot.${s}`]:`shin.${s}`});
function entry(frame,name){const direct=frame.bones[name];if(direct)return direct;const wild=frame.bones[name.replace(/\.[LR]$/,'.*')];if(!wild)return {};return name.endsWith('.R')?{...wild,rot:wild.rot?.map((v,i)=>i?v*-1:v),aim_world:wild.aim_world?.map((v,i)=>i?v:-v)}:wild;}
const restDir=name=>name.startsWith('foot')?new T.Vector3(0,-.18,-.07).normalize():/upper_arm|forearm|hand/.test(name)?new T.Vector3(name.endsWith('R')?-1:1,0,0):/thigh|shin/.test(name)?new T.Vector3(0,0,-1):new T.Vector3(0,0,1);
function directions(frame){
 const delta={},dirs={};
 for(const name of Object.keys(BONE_MAP)){
  const x=entry(frame,name),rest=new T.Quaternion().setFromUnitVectors(Y,restDir(name)),q=(delta[parent[name]]||new T.Quaternion()).clone().multiply(rest).multiply(new T.Quaternion().setFromEuler(new T.Euler(...(x.rot||[0,0,0]).map(v=>v*rad),'XYZ')));
  delta[name]=q.clone().multiply(rest.clone().invert());
  const d=x.aim_world?new T.Vector3(...x.aim_world):Y.clone().applyQuaternion(q);
  dirs[name]=new T.Vector3(d.x,d.z,-d.y).normalize(); // Blender Z up -> glTF Y up.
 }
 return dirs;
}
export function prepareRig(scene){
 scene.updateMatrixWorld(true);const bones={},rest=new Map();scene.traverse(n=>{if(n.isBone){bones[n.name]=n;rest.set(n,{q:n.quaternion.clone(),p:n.position.clone()});}});
 const aim=(bone,direction)=>{
  if(!bone||!direction.lengthSq())return;scene.updateMatrixWorld(true);
  const world=bone.getWorldQuaternion(new T.Quaternion()),current=Y.clone().applyQuaternion(world);
  const q=new T.Quaternion().setFromUnitVectors(current,direction.clone().normalize()).multiply(world);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateMatrixWorld(true);
 };
 return {bones,reset(){for(const [b,r] of rest){b.quaternion.copy(r.q);b.position.copy(r.p);}scene.position.set(0,0,0);scene.updateMatrixWorld(true);},aim,rest};
}
export function sampleKeyframes(scene,rig,data,phase){
 rig.reset();const fs=data.keyframes;phase=((phase%1)+1)%1;
 let index=0;while(index<fs.length-2&&fs[index+1].t<=phase)index++;
 const a=fs[index],b=fs[index+1]||a,u=Math.max(0,Math.min(1,(phase-a.t)/(b.t-a.t||1))),f=(1-Math.cos(u*Math.PI))/2;
 const own=data.provenance.licence==='original',da=own?null:directions(a),db=own?null:directions(b);
 const blend=(x,y)=>new T.Vector3(...(x||[0,0,0])).lerp(new T.Vector3(...(y||x||[0,0,0])),f);
 if(own){
  const root=blend(a.bones.pelvis.loc,b.bones.pelvis.loc);rig.bones.pelvis.position.copy(rig.bones.pelvis.parent.worldToLocal(root));
  rig.aim(rig.bones.pelvis,blend(a.bones.spine.aim_world,b.bones.spine.aim_world));
  if(data.id==='side_plank')rig.bones.pelvis.rotateY(Math.PI/2);
  for(const [name,target] of Object.entries(BONE_MAP))if(name!=='pelvis'&&a.bones[name]?.aim_world)rig.aim(rig.bones[target],blend(a.bones[name].aim_world,b.bones[name]?.aim_world));
 }else{
  for(const [name,target] of Object.entries(BONE_MAP))rig.aim(rig.bones[target],da[name].clone().lerp(db[name],f).normalize());
  const loc=blend(a.bones.pelvis?.loc,b.bones.pelvis?.loc);scene.position.add(new T.Vector3(loc.x,loc.z,-loc.y));
 }
 if(data.id==='goblet_squat'){
  scene.updateMatrixWorld(true);const target=rig.bones.hand_l.getWorldPosition(new T.Vector3()).add(rig.bones.hand_r.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
  for(const side of ['l','r']){
   const upper=rig.bones['upperarm_'+side],lower=rig.bones['lowerarm_'+side],hand=rig.bones['hand_'+side],start=upper.getWorldPosition(new T.Vector3()),elbow=lower.getWorldPosition(new T.Vector3()),end=hand.getWorldPosition(new T.Vector3());
   const a=start.distanceTo(elbow),b=elbow.distanceTo(end),axis=target.clone().sub(start),d=Math.max(.001,Math.min(a+b-.001,axis.length()));axis.normalize();
   const along=(a*a-b*b+d*d)/(2*d),outward=new T.Vector3(side==='l'?1:-1,-1,0);outward.addScaledVector(axis,-outward.dot(axis)).normalize();
   const bend=start.clone().addScaledVector(axis,along).addScaledVector(outward,Math.sqrt(Math.max(0,a*a-along*along)));
   rig.aim(upper,bend.clone().sub(start));rig.aim(lower,target.clone().sub(bend));
  }
 }
 // Keep the rig's different limb proportions above its support plane.
 groundRig(scene,rig);
}
export function groundRig(scene,rig){
 scene.updateMatrixWorld(true);let min=Infinity;
 for(const n of ['foot_l','foot_r','ball_l','ball_r','hand_l','hand_r'])if(rig.bones[n])min=Math.min(min,rig.bones[n].getWorldPosition(new T.Vector3()).y);
 // A joint can be above the floor while the skin around it intersects the mat.
 for(const [name,radius] of Object.entries({head:.11,pelvis:.13,spine_01:.13,spine_02:.13,spine_03:.13,lowerarm_l:.045,lowerarm_r:.045,calf_l:.06,calf_r:.06}))min=Math.min(min,rig.bones[name].getWorldPosition(new T.Vector3()).y-radius);
 if(min<.045)scene.position.y+=.045-min;scene.updateMatrixWorld(true);
}

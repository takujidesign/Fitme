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
 const sockets={};
 for(const side of ['l','r']){
  const hand=bones['hand_'+side],base=bones['middle_01_'+side];
  sockets[side]=hand.worldToLocal(base.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
  sockets[side].z-=.018;
 }
 const footWorld=bones.foot_l.getWorldQuaternion(new T.Quaternion());
 return {scene,bones,sockets,footWorld,reset(){for(const [b,r] of rest){b.quaternion.copy(r.q);b.position.copy(r.p);}scene.position.set(0,0,0);scene.quaternion.identity();scene.updateMatrixWorld(true);},aim,rest};
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
 constrainPose(rig,data.id,phase);
}
export function groundRig(scene,rig){
 scene.updateMatrixWorld(true);let min=Infinity;
 for(const n of ['foot_l','foot_r','ball_l','ball_r','hand_l','hand_r'])if(rig.bones[n])min=Math.min(min,rig.bones[n].getWorldPosition(new T.Vector3()).y);
 // A joint can be above the floor while the skin around it intersects the mat.
 for(const [name,radius] of Object.entries({head:.11,pelvis:.13,spine_01:.13,spine_02:.13,spine_03:.13,lowerarm_l:.045,lowerarm_r:.045,calf_l:.06,calf_r:.06}))min=Math.min(min,rig.bones[name].getWorldPosition(new T.Vector3()).y-radius);
 if(min<.045)scene.position.y+=.045-min;scene.updateMatrixWorld(true);
}

// Original, procedural corrections. No external motion data is used here.
export const HAND_POSES={grip_bar:80,grip_db:80,grip_kb:80,flat:0,fist:85,relaxed:18};
const hands={};
for(const [pose,ids] of Object.entries({grip_bar:'bench_press deadlift lat_pulldown',grip_db:'db_row db_curl shoulder_press lateral_raise rdl triceps_ext',grip_kb:'goblet_squat',flat:'pushup knee_pushup wall_pushup plank side_plank mountain_climber bird_dog cat_cow child_pose',fist:'jog run_interval high_knees jump_rope'}))for(const id of ids.split(' '))hands[id]=pose;
// Explicit per-phase declarations shared by clips, authored frames and acceptance tests.
export const CONTACTS={
 squat:{feet:'both'},goblet_squat:{feet:'both'},lunge:{feet:'both'},bridge:{feet:'both'},calf_raise:{feet:'toes'},squat_jump:{feet:'landing'},
 deadlift:{feet:'both'},rdl:{feet:'both'},pushup:{flat:'both',feet:'toes'},knee_pushup:{flat:'both'},bench_press:{feet:'both'},
 shoulder_press:{feet:'both'},lateral_raise:{feet:'both'},triceps_ext:{feet:'both'},db_row:{feet:'both'},lat_pulldown:{feet:'both'},db_curl:{feet:'both'},
 superman:{},plank:{flat:'both'},crunch:{},leg_raise:{},mountain_climber:{flat:'both'},jumping_jack:{feet:'landing'},high_knees:{feet:'alternate'},
 jog:{feet:'alternate'},walk:{feet:'alternate'},jump_rope:{feet:'landing'},forward_fold:{feet:'both'},quad_stretch:{feet:'left'},
 child_pose:{flat:'both'},bird_dog:{flat:'right'},dead_bug:{},cat_cow:{flat:'both'},chair_squat:{feet:'both'},wall_pushup:{flat:'wall',feet:'both'},
 step_up:{feet:'step'},run_interval:{feet:'alternate'},side_plank:{flat:'right'},kegel:{},breathing:{}
};
export function contactPhase(id,phase){
 const c=CONTACTS[id],feet=c.feet==='both'||c.feet==='toes'?['l','r']:c.feet==='left'?['l']:c.feet==='alternate'?[phase<.5?'l':'r']:c.feet==='landing'&&(phase<.12||phase>.88)?['l','r']:c.feet==='step'?(phase<.12||phase>.88?['l','r']:['l']):[];
 const flat=c.flat==='both'||c.flat==='wall'?['l','r']:c.flat==='left'?['l']:c.flat==='right'?['r']:[];
 return {feet,flat,wall:c.flat==='wall',step:c.feet==='step'};
}
export function handPose(id,side,phase){return contactPhase(id,phase).flat.includes(side)?'flat':hands[id]==='flat'?'relaxed':hands[id]||'relaxed';}
export function palmSocket(rig,side){rig.scene.updateMatrixWorld(true);return rig.bones['hand_'+side].localToWorld(rig.sockets[side].clone());}
export function poseHands(rig,id,phase){
 for(const side of ['l','r']){
  const pose=handPose(id,side,phase),flex=HAND_POSES[pose]*rad;
  for(const finger of ['index','middle','ring','pinky','thumb'])for(let j=1;j<=3;j++){
   const b=rig.bones[`${finger}_0${j}_${side}`];if(!b)continue;
   b.quaternion.copy(rig.rest.get(b).q);
   if(pose==='flat'&&finger!=='thumb')rig.aim(b,Y.clone().applyQuaternion(rig.bones['hand_'+side].getWorldQuaternion(new T.Quaternion())));
   // Finger local Z crosses the phalanges; negative flexion closes toward the palm.
   b.rotateZ(finger==='thumb'?flex*.65:-flex);
   if(j===1&&finger==='thumb'&&flex)b.rotateZ((side==='l'?1:-1)*.35);
  }
 }
 rig.scene.updateMatrixWorld(true);
}
export function solveTwoBone(rig,upperName,lowerName,endName,target,pole){
 const upper=rig.bones[upperName],lower=rig.bones[lowerName],end=rig.bones[endName];
 const p=b=>b.getWorldPosition(new T.Vector3());rig.scene.updateMatrixWorld(true);
 const start=p(upper),a=start.distanceTo(p(lower)),b=p(lower).distanceTo(p(end)),axis=target.clone().sub(start);
 const d=T.MathUtils.clamp(axis.length(),Math.abs(a-b)+1e-5,a+b-1e-5);axis.normalize();
 const along=(a*a-b*b+d*d)/(2*d),bend=pole.clone().addScaledVector(axis,-pole.dot(axis));
 if(bend.lengthSq()<1e-8)bend.crossVectors(axis,new T.Vector3(1,0,0));bend.normalize();
 const elbow=start.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
 const rotate=(bone,child,goal)=>{const from=p(child).sub(p(bone)).normalize(),to=goal.clone().sub(p(bone)).normalize(),q=new T.Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new T.Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));rig.scene.updateMatrixWorld(true);};
 rotate(upper,lower,elbow);rotate(lower,end,start.clone().addScaledVector(axis,d));
 return p(end).distanceTo(target);
}
function orientHand(rig,side,direction){
 const y=direction.clone().normalize(),x=new T.Vector3(-1,0,0);x.addScaledVector(y,-x.dot(y)).normalize();
 const z=new T.Vector3().crossVectors(x,y),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)),hand=rig.bones['hand_'+side];
 hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));rig.scene.updateMatrixWorld(true);
}
function pinPalm(rig,side,target,pole,direction){
 for(let i=0;i<8;i++){
  orientHand(rig,side,direction);
  const wrist=rig.bones['hand_'+side].getWorldPosition(new T.Vector3()),offset=palmSocket(rig,side).sub(wrist);
  solveTwoBone(rig,'upperarm_'+side,'lowerarm_'+side,'hand_'+side,target.clone().sub(offset),pole);
 }
 orientHand(rig,side,direction);
}
export function constrainPose(rig,id,phase){
 const V=(x,y,z)=>new T.Vector3(x,y,z),p=n=>rig.bones[n].getWorldPosition(new T.Vector3());
 const u=(1-Math.cos(phase*Math.PI*2))/2;
 const authored=['bench_press','deadlift','plank','lateral_raise','lunge'].includes(id);
 if(authored){
  rig.reset();
  const angle=id==='bench_press'?-Math.PI/2:id==='plank'?1.35:id==='deadlift'?.95*(1-u):0;
  rig.scene.quaternion.setFromAxisAngle(V(1,0,0),angle);rig.scene.updateMatrixWorld(true);
  const root=id==='bench_press'?V(0,.65,.35):id==='plank'?V(0,.19,0):id==='deadlift'?V(0,.49+.415*u,-.22*(1-u)):id==='lunge'?V(0,.77-.25*u,0):V(0,.905,-.05);
  rig.scene.position.add(root.sub(p('pelvis')));rig.scene.updateMatrixWorld(true);
  if(id==='bench_press')for(const name of ['pelvis','spine_01','spine_02','spine_03','neck_01'])rig.aim(rig.bones[name],V(0,0,-1));
  for(const side of ['l','r']){
   const sign=side==='l'?1:-1;
   let foot=id==='bench_press'?V(sign*.30,.10,.65):id==='plank'?V(sign*.10,.10,-.83):id==='lunge'?V(sign*.12,.10,side==='l'?.43:-.43):V(sign*.14,.10,.04);
   solveTwoBone(rig,'thigh_'+side,'calf_'+side,'foot_'+side,foot,V(0,0,1));
   // Keep the sole level (toe joint .089 m below the ankle in this rig).
   const footBone=rig.bones['foot_'+side];
   footBone.quaternion.copy(footBone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rig.footWorld));
   if(id==='lateral_raise'){
    const a=(10+78*u)*rad;rig.aim(rig.bones['upperarm_'+side],V(sign*Math.sin(a),-Math.cos(a),0));
    rig.aim(rig.bones['lowerarm_'+side],V(sign*Math.sin(a),-Math.cos(a),.18));
   }else if(id==='bench_press'){const a=(-12+90*u)*rad;rig.aim(rig.bones['upperarm_'+side],V(sign*.10,.255*Math.sin(a),.255*Math.cos(a)));rig.aim(rig.bones['lowerarm_'+side],V(0,1,0));orientHand(rig,side,V(0,0,-1));}
   else if(id==='deadlift')pinPalm(rig,side,V(sign*.28,.23+.65*u+.06*Math.sin(Math.PI*u),.25-.13*u+.08*Math.sin(Math.PI*u)),V(sign,0,-1),V(0,-1,0));
   else if(id==='plank')pinPalm(rig,side,V(sign*.20,.025,.83),V(0,-1,-.3),V(0,0,1));
   else {rig.aim(rig.bones['upperarm_'+side],V(sign*.12,-1,0));rig.aim(rig.bones['lowerarm_'+side],V(0,-1,.08));}
  }
 }
 if(!authored){
  const contacts=contactPhase(id,phase),targets={},footRotation=rig.footWorld.clone();
  if(id==='calf_raise')footRotation.premultiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),.55*u));
  for(const side of ['l','r']){
   targets[side]=p('foot_'+side);
   if(contacts.feet.includes(side))targets[side].y=contacts.step&&side==='l'?.45:id==='calf_raise'?.01+.089*Math.cos(.55*u)+.149*Math.sin(.55*u):.10;
   if(contacts.step&&side==='l')targets[side].z=.4;
  }
  // Root compensation is necessary when retargeting longer source limbs.
  // Preserve the stance coordinates while lowering the pelvis into IK reach.
  for(let iteration=0;iteration<5;iteration++){
   let excess=0;
   for(const side of contacts.feet){
    solveTwoBone(rig,'thigh_'+side,'calf_'+side,'foot_'+side,targets[side],V(0,0,1));
    excess=Math.max(excess,p('foot_'+side).y-targets[side].y);
   }
   if(contacts.flat.length&&!contacts.wall)for(const side of contacts.flat)excess=Math.max(excess,p('upperarm_'+side).y-.51);
   if(excess<.001)break;rig.scene.position.y-=excess+.001;rig.scene.updateMatrixWorld(true);
  }
  for(const side of ['l','r']){
   if(contacts.feet.includes(side)||p('ball_'+side).y<.01){
    if(!contacts.feet.includes(side))targets[side].y=.10;
    solveTwoBone(rig,'thigh_'+side,'calf_'+side,'foot_'+side,targets[side],V(0,0,1));
    const foot=rig.bones['foot_'+side];foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(footRotation));
   }
  }
  for(const side of contacts.flat){
   const shoulder=p('upperarm_'+side),target=palmSocket(rig,side);
   if(contacts.wall)target.z=.68;
   else {target.y=.025;target.x=shoulder.x;target.z=shoulder.z+(id==='child_pose'?.27:.08);}
   pinPalm(rig,side,target,V(side==='l'?1:-1,-1,0),contacts.wall?V(0,1,0):V(0,0,1));
  }
 }
 if(id==='bird_dog'){rig.aim(rig.bones.upperarm_l,V(0,0,1));rig.aim(rig.bones.lowerarm_l,V(0,0,1));}
 if(id==='lat_pulldown')for(const side of ['l','r']){const target=palmSocket(rig,side);target.z=Math.max(target.z,p('head').z+.18);pinPalm(rig,side,target,V(side==='l'?1:-1,0,0),V(0,1,0));}
 poseHands(rig,id,phase);
}

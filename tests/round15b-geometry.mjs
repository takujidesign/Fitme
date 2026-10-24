import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as T from '../app/js/vendor/three/three.module.js';
import {GLTFLoader} from '../app/js/vendor/three/GLTFLoader.js';
import {MeshoptDecoder} from '../app/js/vendor/three/meshopt_decoder.module.js';
import {prepareRig,sampleKeyframes,groundRig,constrainPose,palmSocket,handPose,HAND_POSES,CONTACTS,contactPhase} from '../app/js/three-motion.js';
import {props,posedBounds,fitCamera} from '../app/js/three-viewer.js';
import {EXERCISES} from '../app/js/exercises.js';
const base=new URL('../app/3d/',import.meta.url),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base)));
async function glb(file){const b=await readFile(new URL(file,base));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
assert.deepEqual(Object.keys(CONTACTS).sort(),EXERCISES.map(e=>e.id).sort());
assert.deepEqual(Object.keys(HAND_POSES).sort(),['grip_bar','grip_db','grip_kb','flat','fist','relaxed'].sort());
const failures=[],geometry={};let checks=0;
function check(ok,message){checks++;if(!ok)failures.push(message);}
for(const ex of EXERCISES){
 const {scene:model}=await glb('human.glb'),rig=prepareRig(model),scene=new T.Scene();scene.add(model);
 const row=manifest[ex.id];let data,mixer,clip;
 if(row.clip){clip=(await glb(row.clip)).animations[0];mixer=new T.AnimationMixer(model);mixer.clipAction(clip).play();}else data=JSON.parse(await readFile(new URL(row.keyframes,base)));
 const update=props(scene,rig,ex),bounds=new T.Box3(),frames=[];
 for(let i=0;i<16;i++){
  const phase=i/16;if(data)sampleKeyframes(model,rig,data,phase);else{model.position.set(0,0,0);mixer.setTime(phase*clip.duration);groundRig(model,rig);constrainPose(rig,ex.id,phase);}update(phase);
  scene.updateMatrixWorld(true);posedBounds(scene,bounds);
  const p=n=>rig.bones[n].getWorldPosition(new T.Vector3()),tag=ex.id+'@'+phase;
  const handles=[];scene.traverse(n=>{if(n.userData.handle){const center=n.getWorldPosition(new T.Vector3()),axis=new T.Vector3(1,0,0).applyQuaternion(n.getWorldQuaternion(new T.Quaternion()));handles.push({center,axis,two:n.userData.twoHanded,side:n.userData.side});}});
  for(const side of ['l','r']){
   const pose=handPose(ex.id,side,phase),socket=palmSocket(rig,side);
   if(pose.startsWith('grip')){
    check(handles.length>0,tag+' missing implement');
    const candidates=handles.filter(h=>h.two||h.side===side||pose==='grip_kb');
    const distance=Math.min(...candidates.map(h=>socket.clone().sub(h.center).cross(h.axis).length()));
    check(distance<=.025,tag+' '+side+' handle '+distance.toFixed(3));
    for(const finger of ['index','middle','ring','pinky'])for(let j=1;j<=3;j++){const b=rig.bones[`${finger}_0${j}_${side}`],angle=rig.rest.get(b).q.angleTo(b.quaternion)*180/Math.PI;check(angle>=70&&angle<=90,tag+' finger '+angle);}
   }
   if(contactPhase(ex.id,phase).feet.includes(side))check(Math.abs(p('ball_'+side).y-(ex.id==='step_up'&&side==='l'?.36:.01))<=.01,tag+' sole '+side+' '+p('ball_'+side).y.toFixed(3));
   if(contactPhase(ex.id,phase).flat.includes(side))check(Math.abs(ex.id==='wall_pushup'?socket.z-.68:socket.y-.025)<=.02,tag+' palm floor '+socket.y.toFixed(3));
  }
  if(ex.id==='deadlift')check(Math.abs(palmSocket(rig,'l').distanceTo(palmSocket(rig,'r'))-.56)<.01,tag+' fixed bar grip');
  if(ex.id==='bench_press')for(const side of ['l','r'])check(p('hand_'+side).sub(p('lowerarm_'+side)).normalize().dot(new T.Vector3(0,1,0))>.995,tag+' vertical forearm');
  if(ex.id==='bench_press')for(const [bone,radius]of [['pelvis',.125],['spine_03',.125],['head',.10]])check(Math.abs(p(bone).y-radius-.525)<=.03,tag+' bench '+bone+' '+p(bone).y.toFixed(3));
  if(ex.id==='plank'){check(Math.abs(p('lowerarm_l').z-p('upperarm_l').z)<.03,tag+' elbows under shoulders');check(p('lowerarm_l').y<.07,tag+' forearm support');const angle=p('head').sub(p('pelvis')).angleTo(p('foot_l').sub(p('pelvis')))*180/Math.PI;check(angle>=170&&angle<=190,tag+' plank '+angle.toFixed(1));}
  if(ex.id==='lunge'&&i===8){check(p('calf_r').y<=.15,tag+' back knee '+p('calf_r').y.toFixed(3));check(Math.abs(p('calf_l').z-p('foot_l').z)<.08,tag+' front shin vertical');}
  if(ex.id==='lateral_raise'&&i===8)for(const side of ['l','r']){const angle=p('lowerarm_'+side).sub(p('upperarm_'+side)).angleTo(new T.Vector3(0,-1,0))*180/Math.PI;check(angle>=75&&angle<=100,tag+' raise '+angle);}
  // Conservative torso spheres against each finite handle segment, excluding intentional hand contact.
  for(const h of handles)for(const [bone,radius]of [['pelvis',.10],['spine_01',.10],['spine_03',.10],['head',.09]]){
   const delta=p(bone).sub(h.center),along=T.MathUtils.clamp(delta.dot(h.axis),h.two?-.7:-.11,h.two?.7:.11),distance=delta.addScaledVector(h.axis,-along).length();check(distance>=radius+.015,tag+' implement/body '+bone+' '+distance.toFixed(3));
  }
  for(const h of handles)for(const side of ['l','r'])for(const [a,b,radius]of [['thigh','calf',.055],['calf','foot',.04],['upperarm','lowerarm',.035]])for(const t of [.25,.5,.75]){
   const center=p(a+'_'+side).lerp(p(b+'_'+side),t),delta=center.sub(h.center),along=T.MathUtils.clamp(delta.dot(h.axis),h.two?-.7:-.11,h.two?.7:.11);
   check(delta.addScaledVector(h.axis,-along).length()>=radius+.015,tag+' implement intersects '+a+'_'+side);
  }
  frames.push({phase,joints:Object.fromEntries(Object.keys(rig.bones).filter(n=>!/leaf/.test(n)).map(n=>[n,p(n).toArray()])),palms:{l:palmSocket(rig,'l').toArray(),r:palmSocket(rig,'r').toArray()},handles:handles.map(h=>({center:h.center.toArray(),axis:h.axis.toArray()}))});
 }
 const camera=new T.PerspectiveCamera(36,1,.01,30);fitCamera(camera,bounds);let extent=0;
 for(const point of bounds.points){const p=point.clone().project(camera);extent=Math.max(extent,Math.abs(p.x),Math.abs(p.y));}
 check(extent>=.80&&extent<=.90,ex.id+' framing '+extent);
 geometry[ex.id]={camera:camera.position.toArray(),target:bounds.getCenter(new T.Vector3()).toArray(),frames};
}
await writeFile(new URL('../docs/round15-screens/anim-geometry.json',import.meta.url),JSON.stringify(geometry));
console.log(JSON.stringify({checks,failures},null,2));
assert.equal(failures.length,0,'Round 15B geometric acceptance');

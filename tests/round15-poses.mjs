import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../app/js/vendor/three/GLTFLoader.js';
import {MeshoptDecoder} from '../app/js/vendor/three/meshopt_decoder.module.js';
import * as T from '../app/js/vendor/three/three.module.js';
import {prepareRig,sampleKeyframes,groundRig} from '../app/js/three-motion.js';
import {highlight,props} from '../app/js/three-viewer.js';
import {EX} from '../app/js/exercises.js';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function glb(file){const b=await readFile(new URL('../app/3d/'+file,import.meta.url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const manifest=JSON.parse(await readFile(new URL('../app/3d/manifest.json',import.meta.url)));
let samples=0;const issues=[];
const angle=(a,b,c)=>new T.Vector3().subVectors(b,a).angleTo(new T.Vector3().subVectors(c,b))*180/Math.PI;
for(const [id,row] of Object.entries(manifest)){
 const {scene}=await glb('human.glb'),rig=prepareRig(scene);let data,mixer,clip;
 const materials=highlight(scene,EX[id]);assert(materials.length===1);assert(materials[0].vertexColors&&materials[0].roughness===.8);
 const propsScene=new T.Scene();propsScene.add(scene);const updateProps=props(propsScene,rig,EX[id]);
 if(row.clip){clip=(await glb(row.clip)).animations[0];mixer=new T.AnimationMixer(scene);mixer.clipAction(clip).play();}else data=JSON.parse(await readFile(new URL('../app/3d/'+row.keyframes,import.meta.url)));
 const phases=data?data.keyframes.slice(0,-1).flatMap((f,i)=>Array.from({length:10},(_,k)=>f.t+(data.keyframes[i+1].t-f.t)*k/10)):Array.from({length:61},(_,i)=>i/61);
 for(const phase of phases){
  if(data)sampleKeyframes(scene,rig,data,phase);else {scene.position.set(0,0,0);mixer.setTime(phase*clip.duration);groundRig(scene,rig);}
  const p=name=>rig.bones[name].getWorldPosition(new T.Vector3());
  updateProps();
  for(const bone of Object.values(rig.bones))assert(bone.matrixWorld.elements.every(Number.isFinite),`${id} finite ${bone.name}`);
  for(const name of ['foot_l','foot_r','ball_l','ball_r','hand_l','hand_r'])assert(p(name).y>=-.0001,`${id} ${name} floor`);
  for(const s of ['l','r']){
   const elbow=angle(p('upperarm_'+s),p('lowerarm_'+s),p('hand_'+s)),knee=angle(p('thigh_'+s),p('calf_'+s),p('foot_'+s));
   if(elbow>165||knee>165)issues.push({id,phase,elbow,knee});
  }
  if(['plank','side_plank'].includes(id)){const line=angle(p('neck_01'),p('pelvis'),p('foot_l'));if(line>20)issues.push({id,phase,line});}
  if(id==='triceps_ext')for(const side of ['l','r'])assert(p('lowerarm_'+side).sub(p('upperarm_'+side)).normalize().dot(new T.Vector3(0,1,0))>Math.cos(20*Math.PI/180),'overhead extension: upper arm vertical');
  if(id==='goblet_squat')assert(p('hand_l').distanceTo(p('hand_r'))<.012,'both hands share goblet grip');
  if(EX[id].prop?.includes('db'))for(const side of ['l','r'])assert(rig.bones['hand_'+side].children.some(n=>n.isGroup),'dumbbell attached to hand');
  samples++;
 }
}
console.log(JSON.stringify({samples,issues:issues.slice(0,25),issueCount:issues.length},null,2));
assert.equal(issues.length,0,'3D joint and hold invariants');

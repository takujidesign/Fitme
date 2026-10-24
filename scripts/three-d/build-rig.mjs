// Fetch only explicitly allowlisted public CC0 assets and keyframes-only MIT specs.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, dedup, meshopt, cloneDocument, weld, simplify} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier} from 'meshoptimizer';
import {Quaternion} from 'three';
import {mkdir, writeFile, readFile, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {EXERCISES} from '../../app/js/exercises.js';
import {solve} from '../../app/js/figure.js';

export const COMMIT='ea3a60130fdcfb3c4771e44d09f84ebab4ee9bae';
const base=`https://raw.githubusercontent.com/AssiamahS/opengym3d/${COMMIT}/`;
const out=new URL('../../app/3d/',import.meta.url), sources=[];
const adaptations={db_row:'bent_over_row',calf_raise:'calf_raise',deadlift:'deadlift',shoulder_press:'dumbbell_shoulder_press',bridge:'glute_bridge',db_curl:'hammer_curl',high_knees:'high_knees',lateral_raise:'lateral_raise',lunge:'lunge',rdl:'romanian_deadlift',triceps_ext:'overhead_tricep_extension',superman:'superman'};
const clips={pushup:'Pushup',jumping_jack:'Jumping Jacks',jog:'Jog',run_interval:'Sprint',walk:'Walk'};
const allowed=new Set(['LICENSE','motions/cc0/mesh2motion/LICENSE-CC0.md',...['base','addon'].map(n=>`motions/cc0/mesh2motion/human-${n}-animations.glb`),...Object.values(adaptations).map(n=>`exercises/${n}.json`)]);
const hash=b=>createHash('sha256').update(b).digest('hex');
async function download(path){
 if(!allowed.has(path))throw Error('Source outside allowlist');
 const r=await fetch(base+path);if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);
 const b=Buffer.from(await r.arrayBuffer());sources.push({url:base+path,sha256:hash(b),bytes:b.length});return b;
}
await mkdir(new URL('clips/',out),{recursive:true});await mkdir(new URL('keyframes/',out),{recursive:true});
await mkdir(new URL('../../licenses/',import.meta.url),{recursive:true});
for(const [src,dst] of [['LICENSE','opengym3d-MIT.txt'],['motions/cc0/mesh2motion/LICENSE-CC0.md','mesh2motion-CC0.txt']])await writeFile(new URL('../../licenses/'+dst,import.meta.url),await download(src));
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const docs=[];
for(const lane of ['base','addon'])docs.push(await io.readBinary(await download(`motions/cc0/mesh2motion/human-${lane}-animations.glb`)));
function dropAnimation(a){a.listChannels().forEach(c=>c.dispose());a.listSamplers().forEach(s=>s.dispose());a.dispose();}
const human=cloneDocument(docs[0]);human.getRoot().listAnimations().forEach(dropAnimation);
const material=human.createMaterial('Matte grey').setBaseColorFactor([.65,.67,.69,1]).setMetallicFactor(0).setRoughnessFactor(.8);
for(const mesh of human.getRoot().listMeshes())for(const p of mesh.listPrimitives()){p.setMaterial(material);p.setAttribute('TEXCOORD_0',null);}
await MeshoptSimplifier.ready;
await human.transform(prune(),dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.25,error:.001}),meshopt({encoder:MeshoptEncoder,level:'high'}));
await io.write(fileURLToPath(new URL('human.glb',out)),human);
// Sample every track at 30 Hz, including quaternion slerp. No discarded clips survive.
for(const [id,name] of Object.entries(clips)){
 const source=cloneDocument(docs.find(d=>d.getRoot().listAnimations().some(a=>a.getName()===name)));
 for(const a of source.getRoot().listAnimations())if(a.getName()!==name)dropAnimation(a);
 const anim=source.getRoot().listAnimations()[0];anim.setName(id);
 for(const ch of anim.listChannels()){
  const s=ch.getSampler(),input=s.getInput(),output=s.getOutput(),times=input.getArray(),values=output.getArray(),size=output.getElementSize(),duration=times[times.length-1];
  const cubic=s.getInterpolation()==='CUBICSPLINE',step=s.getInterpolation()==='STEP';
  const count=Math.ceil(duration*30)+1,ts=new Float32Array(count),vs=new Float32Array(count*size);let cursor=0;
  for(let i=0;i<count;i++){
   const t=Math.min(i/30,duration);ts[i]=t;while(cursor<times.length-2&&times[cursor+1]<t)cursor++;
   const next=Math.min(cursor+1,times.length-1),f=next===cursor?0:(t-times[cursor])/(times[next]-times[cursor]);
   if(cubic){const dt=times[next]-times[cursor],f2=f*f,f3=f2*f;for(let k=0;k<size;k++)vs[i*size+k]=(2*f3-3*f2+1)*values[(cursor*3+1)*size+k]+(f3-2*f2+f)*dt*values[(cursor*3+2)*size+k]+(-2*f3+3*f2)*values[(next*3+1)*size+k]+(f3-f2)*dt*values[next*3*size+k];if(size===4)new Quaternion().fromArray(vs,i*4).normalize().toArray(vs,i*4);}
   else if(step){for(let k=0;k<size;k++)vs[i*size+k]=values[cursor*size+k];}
   else if(ch.getTargetPath()==='rotation')new Quaternion().fromArray(values,cursor*4).slerp(new Quaternion().fromArray(values,next*4),f).toArray(vs,i*4);
   else for(let k=0;k<size;k++)vs[i*size+k]=values[cursor*size+k]+(values[next*size+k]-values[cursor*size+k])*f;
  }
  s.setInterpolation('LINEAR');
  s.setInput(source.createAccessor().setType('SCALAR').setArray(ts).setBuffer(source.getRoot().listBuffers()[0]));
  s.setOutput(source.createAccessor().setType(output.getType()).setArray(vs).setBuffer(source.getRoot().listBuffers()[0]));
 }
 for(const n of source.getRoot().listNodes()){n.setMesh(null);n.setSkin(null);}
 await source.transform(prune({keepLeaves:true}),dedup(),meshopt({encoder:MeshoptEncoder,level:'high'}));
 await io.write(fileURLToPath(new URL(`clips/${id}.glb`,out)),source);
}
const manifest={};
for(const ex of EXERCISES){
 if(clips[ex.id]){manifest[ex.id]={lane:'CC0',clip:`clips/${ex.id}.glb`,sourceClip:clips[ex.id]};continue;}
 let frames,duration,provenance;
 if(adaptations[ex.id]){
  const spec=JSON.parse(await download(`exercises/${adaptations[ex.id]}.json`));
  if(Object.keys(spec.movement||{}).some(k=>!['pattern','qa'].includes(k))||!spec.keyframes?.length)throw Error('Not a keyframes-only spec');
  frames=spec.keyframes;duration=spec.duration;provenance={licence:'MIT',source:adaptations[ex.id],commit:COMMIT};
  if(ex.id==='db_curl')for(const frame of frames)frame.bones['hand.*']={rot:[0,0,90]};
  // Adapt the barbell-row peak to a dumbbell grip without a >170 degree elbow fold.
  if(ex.id==='db_row')for(const frame of frames)if(frame.bones['forearm.*']?.aim_world?.[2]>0)frame.bones['forearm.*'].aim_world=[.05,-.9,.43];
  // Keep the bridge arms resting alongside the trunk on the narrower CC0 rig.
  if(ex.id==='bridge')for(const frame of frames)for(const bone of ['upper_arm.*','forearm.*'])frame.bones[bone]={aim_world:[.08,-.99,-.03]};
 }else{
  duration=ex.dur.reduce((a,b)=>a+b,0)/1000;let elapsed=0;
  frames=ex.frames.map((p,i)=>{
   const j=solve(p,ex.view),bones={pelvis:{loc:[0,(182-p.y)*.014,(p.x-100)*.014]},spine:{aim_world:[0,-Math.cos(p.t*Math.PI/180),Math.sin(p.t*Math.PI/180)]}};
   for(const [limb,names,side] of [[j.arm1,['upper_arm','forearm'],'L'],[j.arm2,['upper_arm','forearm'],'R'],[j.leg1,['thigh','shin'],'L'],[j.leg2,['thigh','shin'],'R']])for(let k=0;k<2;k++){
    const dx=limb[k+1][0]-limb[k][0],dy=limb[k+1][1]-limb[k][1],front=ex.view==='front';
    bones[`${names[k]}.${side}`]={rot:[0,0,0],aim_world:front?[dx,-dy,0]:[0,-dy,dx]};
   }
   for(const side of ['L','R'])bones[`foot.${side}`]={aim_world:[0,0,1]};
   const frame={t:elapsed/duration,bones};elapsed+=ex.dur[i]/1000;return frame;
  });frames.push({...frames[0],t:1});provenance={licence:'original',source:'app/js/exercises.js',derivation:'Round 11 solved joint directions; sagittal YZ and frontal XY planes'};
 }
 const data={id:ex.id,fps:30,duration,keyframes:frames,provenance};
 await writeFile(new URL(`keyframes/${ex.id}.json`,out),JSON.stringify(data,null,2)+'\n');
 manifest[ex.id]={lane:provenance.licence,keyframes:`keyframes/${ex.id}.json`};
}
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
const vendor=new URL('../../app/js/vendor/three/',import.meta.url);await mkdir(vendor,{recursive:true});
for(const [src,dst] of [['three/build/three.module.js','three.module.js'],['three/build/three.core.js','three.core.js'],['three/examples/jsm/loaders/GLTFLoader.js','GLTFLoader.js'],['three/examples/jsm/utils/BufferGeometryUtils.js','BufferGeometryUtils.js'],['three/examples/jsm/controls/OrbitControls.js','OrbitControls.js'],['meshoptimizer/meshopt_decoder.module.js','meshopt_decoder.module.js'],['three/LICENSE','LICENSE-three.txt'],['meshoptimizer/LICENSE.md','LICENSE-meshoptimizer.txt']]){
 let bytes=await readFile(new URL('../node_modules/'+src,import.meta.url));
 if(dst.endsWith('.js'))bytes=Buffer.from(bytes.toString().replaceAll("from 'three'","from './three.module.js'").replaceAll("'../utils/BufferGeometryUtils.js'","'./BufferGeometryUtils.js'"));
 await writeFile(new URL(dst,vendor),bytes);
}
const outputs=[];for(const file of ['human.glb',...Object.keys(clips).map(id=>`clips/${id}.glb`),...Object.keys(manifest).filter(id=>manifest[id].keyframes).map(id=>`keyframes/${id}.json`)]){const b=await readFile(new URL(file,out));outputs.push({file,bytes:b.length,sha256:hash(b)});}
await writeFile(new URL('SOURCES.json',out),JSON.stringify({commit:COMMIT,sources,outputs,tools:{three:'0.180.0','gltf-transform':'4.2.1',meshoptimizer:'0.24.0'},resampleFps:30},null,2)+'\n');
console.log('human bytes',outputs[0].bytes,'clips bytes',outputs.filter(x=>x.file.startsWith('clips/')).reduce((n,x)=>n+x.bytes,0));

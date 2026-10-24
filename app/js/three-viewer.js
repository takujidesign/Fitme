import * as T from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {MeshoptDecoder} from './vendor/three/meshopt_decoder.module.js';
import {prepareRig,sampleKeyframes,groundRig,constrainPose,palmSocket} from './three-motion.js';
import {exerciseMuscles} from './muscle-map.js';
import {L} from './ui.js';
let active;
const asset=p=>new URL('../3d/'+p,import.meta.url).href;
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function json(path){const r=await fetch(asset(path));if(!r.ok)throw Error('3D asset unavailable');return r.json();}
export async function mount3D(host,ex,{signal}={}){
 active?.stop();let stopped=false,renderer,controls,frame,resize,observer,detach,mixer,model,scene,elapsed=0,speed=1,playing=true,visible=true,last=0,lastDraw=0,slow=0,fps=60;
 const dispose=object=>object?.traverse(n=>{n.geometry?.dispose();for(const m of [n.material].flat().filter(Boolean))m.dispose();});
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(frame);resize?.disconnect();observer?.disconnect();detach?.disconnect();document.removeEventListener('visibilitychange',visibility);signal?.removeEventListener('abort',stop);controls?.dispose();mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);dispose(scene);renderer?.dispose();renderer?.forceContextLoss();if(active?.stop===stop)active=null;};
 const visibility=()=>{last=0;if(!document.hidden&&!stopped){cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);}};
 active={stop};signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted){stop();return {stop};}
 host.innerHTML=`<div class="three-stage"></div><div class="three-controls"><button class="chip" data-play>${L('หยุดชั่วคราว','Pause')}</button><label>${L('ความเร็ว','Speed')} <select data-speed aria-label="${L('ความเร็ว','Speed')}"><option>0.5</option><option selected>1</option><option>1.5</option></select>×</label>${[['front','ด้านหน้า','Front'],['side','ด้านข้าง','Side'],['quarter','3/4','3/4']].map(([v,th,en])=>`<button class="chip" data-camera="${v}">${L(th,en)}</button>`).join('')}<button class="chip" data-reset>${L('รีเซ็ต','Reset')}</button></div>`;
 const stage=host.querySelector('.three-stage');let rig,data,clip,duration=2;
 function tick(now){
  if(stopped)return;if(!host.isConnected){stop();return;}if(document.hidden||!visible){last=0;return;}
  frame=requestAnimationFrame(tick);const dt=last?Math.min((now-last)/1000,.1):0;last=now;
  if(dt>.02){if(++slow>30)fps=30;}else slow=Math.max(0,slow-1);
  if(playing)elapsed+=dt*speed;if(now-lastDraw<1000/fps-1)return;lastDraw=now;
  const phase=elapsed/duration%1;
  if(data)sampleKeyframes(model,rig,data,phase);else{model.position.set(0,0,0);mixer.setTime(elapsed);groundRig(model,rig);constrainPose(rig,ex.id,phase);}
  for(const m of materials)m.emissiveIntensity=.12+.08*(1-Math.cos(phase*Math.PI*2));
  updateProps(elapsed);controls.update();renderer.render(scene,camera);
 }
 let camera,updateProps=()=>{},materials=[];
 try{
  const manifest=await json('manifest.json'),row=manifest[ex.id];if(!row)throw Error('No animation');
  const [g,motion]=await Promise.all([loader.loadAsync(asset('human.glb')),row.clip?loader.loadAsync(asset(row.clip)):json(row.keyframes)]);
  if(stopped){dispose(g.scene);return {stop};}
  model=g.scene;scene=new T.Scene();scene.add(model);rig=prepareRig(model);
  if(row.clip){clip=motion.animations[0];mixer=new T.AnimationMixer(model);mixer.clipAction(clip).play();duration=clip.duration;}else{data=motion;duration=data.duration;}
  materials=highlight(model,ex);updateProps=props(scene,rig,ex);
  const points=[],bounds=new T.Box3();
  for(let i=0;i<32;i++){
   if(data)sampleKeyframes(model,rig,data,i/32);else{model.position.set(0,0,0);mixer.setTime(i/32*duration);groundRig(model,rig);constrainPose(rig,ex.id,i/32);}
   updateProps(i/32*duration);posedBounds(scene,bounds);
  }
  for(let i=0;i<=20;i++){
   if(data)sampleKeyframes(model,rig,data,i/40);else{model.position.set(0,0,0);mixer.setTime(i/40*duration);groundRig(model,rig);constrainPose(rig,ex.id,i/40);}
   points.push(rig.bones[ex.arrow?.joint==='hip'?'pelvis':'hand_l'].getWorldPosition(new T.Vector3()));
  }
  if(points[0].distanceTo(points.at(-1))>.04){
   const path=new T.CatmullRomCurve3(points),arrows=new T.Group();
   arrows.add(new T.Mesh(new T.TubeGeometry(path,32,.008,5,false),new T.MeshBasicMaterial({color:0xe74550})));
   arrows.add(new T.ArrowHelper(path.getTangent(1),path.getPoint(1),.1,0xe74550,.07,.045));scene.add(arrows);arrows.visible=false;
   const toggle=document.createElement('button');toggle.className='chip';toggle.textContent=L('ลูกศรการเคลื่อนไหว','Movement arrows');toggle.setAttribute('aria-pressed','false');toggle.onclick=()=>{arrows.visible=!arrows.visible;toggle.setAttribute('aria-pressed',String(arrows.visible));};host.querySelector('.three-controls').append(toggle);
  }
  scene.add(new T.HemisphereLight(0xffffff,0x555566,2));const key=new T.DirectionalLight(0xffffff,3);key.position.set(3,5,4);scene.add(key);
  renderer=new T.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0,0);stage.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label',L(ex.name));renderer.domElement.setAttribute('role','img');renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(stopped)return;stop();host.dispatchEvent(new Event('three-fallback'));},{once:true});
  camera=new T.PerspectiveCamera(36,1,.01,30);controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.minDistance=2;controls.maxDistance=6;controls.minPolarAngle=.35;controls.maxPolarAngle=Math.PI*.7;controls.minAzimuthAngle=-Math.PI;controls.maxAzimuthAngle=Math.PI;
  const preset=kind=>{fitCamera(camera,bounds,kind);controls.target.copy(bounds.getCenter(new T.Vector3()));const distance=camera.position.distanceTo(controls.target);controls.minDistance=distance*.7;controls.maxDistance=distance*1.7;controls.update();};preset('quarter');
  resize=new ResizeObserver(()=>{const w=stage.clientWidth||320;renderer.setSize(w,w);});resize.observe(stage);
  host.querySelector('[data-play]').onclick=e=>{playing=!playing;e.target.textContent=playing?L('หยุดชั่วคราว','Pause'):L('เล่น','Play');};
  host.querySelector('[data-speed]').onchange=e=>speed=Number(e.target.value);
  host.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>preset(b.dataset.camera));host.querySelector('[data-reset]').onclick=()=>preset('quarter');
  let tapped=0;renderer.domElement.addEventListener('pointerup',()=>{const now=performance.now();if(now-tapped<300)preset('quarter');tapped=now;});renderer.domElement.addEventListener('dblclick',()=>preset('quarter'));
  observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visibility();});observer.observe(stage);
  detach=new MutationObserver(()=>{if(!host.isConnected)stop();});detach.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',visibility);frame=requestAnimationFrame(tick);
  host.dataset.threeReady=ex.id;
  return {stop,seek(phase){elapsed=phase*duration;playing=false;},get scene(){return scene;},get rig(){return rig;}};
 }catch(e){stop();throw e;}
}
export function highlight(model,ex){
 const targets=exerciseMuscles(ex),primary=ex.primaryMuscles||targets.slice(0,1),materials=[];
 model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;
  const g=mesh.geometry,pos=g.attributes.position,indices=g.attributes.skinIndex,weights=g.attributes.skinWeight,colors=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
   let strongest=0,bone='',boneIndex=0;for(let k=0;k<4;k++){const w=weights.getComponent(i,k);if(w>strongest){strongest=w;boneIndex=indices.getComponent(i,k);bone=mesh.skeleton.bones[boneIndex].name;}}
   const local=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[boneIndex]);
   const back=pos.getZ(i)<0,region=/thigh/.test(bone)?(back?'hamstrings':'quads'):/calf|foot|ball/.test(bone)?'calves':/pelvis/.test(bone)?(targets.includes('pelvic_floor')?'pelvic_floor':'glutes'):/upperarm/.test(bone)?(local.y<.12?(targets.includes('rear_delts')?'rear_delts':'front_delts'):back?'triceps':'biceps'):/lowerarm|hand|finger/.test(bone)?'forearms':/clavicle/.test(bone)?(back?'rear_delts':'front_delts'):/spine_03/.test(bone)?(back?'lats':'chest'):/spine/.test(bone)?(back?'lower_back':Math.abs(pos.getX(i))>.15?'obliques':'abs'):'neck';
   const color=new T.Color(primary.includes(region)?0xec424e:targets.includes(region)?0xf29b44:0xb8bdc3);color.toArray(colors,i*3);
  }
  g.setAttribute('color',new T.BufferAttribute(colors,3));mesh.material.dispose();mesh.material=new T.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0,emissive:0xffffff,emissiveIntensity:.15});
  // Emission follows the per-vertex tint instead of lighting inactive skin white.
  mesh.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb * step(vColor.g, vColor.r * 0.85);');};materials.push(mesh.material);
 });return materials;
}
export function props(scene,rig,ex){
 const mat=new T.MeshStandardMaterial({color:0x555b62,roughness:.8}),group=new T.Group();scene.add(group);const dynamic=[];
 const box=(size,p)=>{const m=new T.Mesh(new T.BoxGeometry(...size,8,4,12),mat);m.position.set(...p);group.add(m);return m;};
 const weight=(length=.22,radius=.065)=>{const g=new T.Group();for(const [x,r,w] of [[0,.018,length],[-length/2,radius,.045],[length/2,radius,.045]]){const m=new T.Mesh(new T.CylinderGeometry(r,r,w,16),mat);m.rotation.z=Math.PI/2;m.position.x=x;g.add(m);}return g;};
 const prop=ex.prop||'';
 if(/bench/.test(prop)){const bench=box([.42,.09,1.15],[0,.48,0]);bench.rotation.x=T.MathUtils.degToRad(Math.min(60,Math.max(0,ex.benchIncline||0)));for(const z of [-.4,.4])box([.32,.45,.07],[0,.225,z]);}
 if(/mat/.test(prop)||['plank','pushup','knee_pushup'].includes(ex.id))box([1.2,.018,2.2],[0,.009,0]);
 if(/wall/.test(prop)){
  const wall=box([1.4,1.8,.04],[0,.9,.7]);wall.material=mat.clone();wall.material.transparent=true;wall.material.opacity=.22;wall.material.depthWrite=false;
  wall.position.z=.72;
 }
 if(/step/.test(prop))box([.8,.35,.6],[0,.175,.4]);
 if(/chair/.test(prop)){box([.5,.08,.5],[0,.45,-.1]);box([.5,.55,.05],[0,.75,-.35]);for(const x of [-.2,.2])for(const z of [-.3,.1])box([.04,.42,.04],[x,.21,z]);}
 if(/db/.test(prop))for(const side of ['l','r']){const g=weight();rig.bones['hand_'+side].add(g);g.position.copy(rig.sockets[side]);g.userData.handle=true;g.userData.side=side;}
 if(/kb/.test(prop)){const g=new T.Group(),bell=new T.Mesh(new T.SphereGeometry(.1,16,12),mat);bell.position.y=-.18;g.add(bell);const handle=new T.Mesh(new T.TorusGeometry(.065,.013,8,16),mat);handle.position.y=-.065;g.add(handle);rig.bones.hand_l.add(g);g.position.copy(rig.sockets.l);g.userData.handle=true;g.userData.side='l';dynamic.push(()=>g.quaternion.copy(rig.bones.hand_l.getWorldQuaternion(new T.Quaternion()).invert()));}
 if(/plate|bar/.test(prop)){const bar=weight(1.4,prop.includes('cable')?.022:.18);group.add(bar);bar.userData.handle=true;bar.userData.twoHanded=true;let cable;
  if(prop.includes('cable')){cable=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,2,-.2),new T.Vector3()]),new T.LineBasicMaterial({color:0x999999}));group.add(cable);}
  dynamic.push(()=>{const a=palmSocket(rig,'l'),b=palmSocket(rig,'r'),center=a.clone().add(b).multiplyScalar(.5);bar.position.copy(center);bar.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),a.sub(b).normalize());if(cable){cable.geometry.attributes.position.setXYZ(1,...center.toArray());cable.geometry.attributes.position.needsUpdate=true;}});}
 if(ex.id==='lat_pulldown'){box([.4,1.8,.3],[0,.9,-.5]);box([1.3,.06,.06],[0,2,-.2]);}
 if(ex.id==='jump_rope'){const curve=new T.EllipseCurve(0,0,.55,1,0,Math.PI*2);const geo=new T.BufferGeometry().setFromPoints(curve.getPoints(48).map(p=>new T.Vector3(p.x,p.y+.8,0)));const rope=new T.Line(geo,new T.LineBasicMaterial({color:0x777777}));group.add(rope);dynamic.push(time=>rope.rotation.x=time*6);}
 return (time=0)=>dynamic.forEach(f=>f(time));
}

// Sample the actual deformed vertices, including attached props, without WebGL.
export function posedBounds(scene,bounds=new T.Box3()){
 scene.updateMatrixWorld(true);bounds.points??=[];
 scene.traverse(mesh=>{if(!mesh.isMesh)return;mesh.skeleton?.update();const pos=mesh.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const p=new T.Vector3().fromBufferAttribute(pos,i);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld);bounds.expandByPoint(p);bounds.points.push(p);}
 });return bounds;
}
export function fitCamera(camera,bounds,kind='quarter'){
 const center=bounds.getCenter(new T.Vector3()),direction=new T.Vector3(...(kind==='front'?[0,.12,1]:kind==='side'?[1,.12,0]:[1,.39,1])).normalize();
 const corners=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new T.Vector3(x,y,z));
 let lo=.01,hi=20;
 for(let i=0;i<40;i++){
  const d=(lo+hi)/2;camera.position.copy(center).addScaledVector(direction,d);camera.lookAt(center);camera.updateMatrixWorld(true);
  let extent=0;for(const p of bounds.points||corners){const q=p.clone().project(camera);extent=Math.max(extent,Math.abs(q.x),Math.abs(q.y));}
  if(extent>.85||corners.some(p=>p.clone().applyMatrix4(camera.matrixWorldInverse).z>=0))lo=d;else hi=d;
 }
 return center;
}

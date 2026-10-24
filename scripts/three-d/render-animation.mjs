// CPU projection of the actual skinned GLB for pose review. Not browser screenshots.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import * as T from '../../app/js/vendor/three/three.module.js';
import {GLTFLoader} from '../../app/js/vendor/three/GLTFLoader.js';
import {MeshoptDecoder} from '../../app/js/vendor/three/meshopt_decoder.module.js';
import {prepareRig,sampleKeyframes,groundRig,constrainPose} from '../../app/js/three-motion.js';
import {highlight,props,posedBounds,fitCamera} from '../../app/js/three-viewer.js';
import {EXERCISES} from '../../app/js/exercises.js';
const base=new URL('../../app/3d/',import.meta.url),out=new URL('../../docs/round15-screens/',import.meta.url),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(new URL('manifest.json',base)));
async function glb(file){const b=await readFile(new URL(file,base));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const tiles=[];
for(const ex of EXERCISES){
 const row=manifest[ex.id],{scene:model}=await glb('human.glb'),rig=prepareRig(model),scene=new T.Scene();scene.add(model);
 let mixer,clip,data;
 if(row.clip){clip=(await glb(row.clip)).animations[0];mixer=new T.AnimationMixer(model);mixer.clipAction(clip).play();}else data=JSON.parse(await readFile(new URL(row.keyframes,base)));
 const sample=phase=>{if(data)sampleKeyframes(model,rig,data,phase);else{model.position.set(0,0,0);mixer.setTime(phase*clip.duration);groundRig(model,rig);constrainPose(rig,ex.id,phase);}};
 highlight(model,ex);const updateProps=props(scene,rig,ex),bounds=new T.Box3();
 for(let i=0;i<32;i++){sample(i/32);updateProps(i/32);posedBounds(scene,bounds);}
 const camera=new T.PerspectiveCamera(36,1,.01,30);fitCamera(camera,bounds);
 for(const phase of [0,.25,.5]){
 sample(phase);updateProps(phase);scene.updateMatrixWorld(true);model.traverse(n=>n.skeleton?.update());
 const triangles=[],light=new T.Vector3(2,4,3).normalize();
 scene.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,pos=g.attributes.position,index=g.index,colors=g.attributes.color,points=[];
  for(let i=0;i<pos.count;i++){const p=new T.Vector3().fromBufferAttribute(pos,i);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld);points.push(p);}
  for(let k=0;k<(index?.count||pos.count);k+=3){const ids=[0,1,2].map(j=>index?index.getX(k+j):k+j),world=ids.map(i=>points[i]),normal=new T.Vector3().subVectors(world[1],world[0]).cross(new T.Vector3().subVectors(world[2],world[0])).normalize();
   const color=colors?new T.Color(colors.getX(ids[0]),colors.getY(ids[0]),colors.getZ(ids[0])):mesh.material.color.clone();color.multiplyScalar(.45+.55*Math.abs(normal.dot(light)));
   const projected=world.map(p=>p.clone().project(camera));triangles.push({opacity:mesh.material.opacity,depth:projected.reduce((n,p)=>n+p.z,0),points:projected.map(p=>`${((p.x+1)*160).toFixed(2)},${((1-p.y)*160).toFixed(2)}`).join(' '),color:'#'+color.getHexString()});
  }
 });
 const polygons=triangles.sort((a,b)=>b.depth-a.depth).map(t=>`<polygon points="${t.points}" fill="${t.color}" opacity="${t.opacity}"/>`).join('');
 const tile=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="350"><rect width="320" height="350" fill="#181c23"/>${polygons}<text x="12" y="339" font-family="sans-serif" font-size="14" fill="white">${ex.id} / ${phase===0?'start':phase===.25?'mid':'peak'}</text></svg>`);
 const png=await sharp(tile).png().toBuffer();tiles.push({input:png,left:(tiles.length%6)*320,top:Math.floor(tiles.length/6)*350});
}
}
await sharp({create:{width:1920,height:7000,channels:3,background:'#181c23'}}).composite(tiles).png().toFile(new URL('anim-contact.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'));
await writeFile(new URL('anim-contact.html',out),`<!doctype html><meta charset="utf-8"><title>Round 15B animation review</title><h1>All 40 / start, mid, peak / 3/4 view</h1><p>Software projection of the actual skinned mesh and props, with a fixed camera fitted over 32 frames per clip. Not a browser screenshot.</p><img style="width:100%" src="anim-contact.png" alt="Forty exercises, three phases each">`);
console.log('Rendered 120 software frames for all 40 exercises.');

// CPU projection of the actual skinned GLB for pose review. Not browser screenshots.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import * as T from '../../app/js/vendor/three/three.module.js';
import {GLTFLoader} from '../../app/js/vendor/three/GLTFLoader.js';
import {MeshoptDecoder} from '../../app/js/vendor/three/meshopt_decoder.module.js';
import {prepareRig,sampleKeyframes,groundRig} from '../../app/js/three-motion.js';
import {highlight,props} from '../../app/js/three-viewer.js';
import {EXERCISES} from '../../app/js/exercises.js';
const base=new URL('../../app/3d/',import.meta.url),out=new URL('../../docs/round15-screens/',import.meta.url),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(new URL('manifest.json',base)));
async function glb(file){const b=await readFile(new URL(file,base));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const tiles=[];
for(const ex of EXERCISES){
 const row=manifest[ex.id],{scene:model}=await glb('human.glb'),rig=prepareRig(model),scene=new T.Scene();scene.add(model);
 if(row.clip){const clip=(await glb(row.clip)).animations[0],mixer=new T.AnimationMixer(model);mixer.clipAction(clip).play();mixer.setTime(.4*clip.duration);groundRig(model,rig);}else sampleKeyframes(model,rig,JSON.parse(await readFile(new URL(row.keyframes,base))),.4);
 highlight(model,ex);props(scene,rig,ex)();scene.updateMatrixWorld(true);model.traverse(n=>n.skeleton?.update());
 const camera=new T.PerspectiveCamera(36,1,.01,30);camera.position.set(2.7,1.9,2.7);camera.lookAt(0,.85,0);camera.updateMatrixWorld();
 const triangles=[],light=new T.Vector3(2,4,3).normalize();
 scene.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,pos=g.attributes.position,index=g.index,colors=g.attributes.color,points=[];
  for(let i=0;i<pos.count;i++){const p=new T.Vector3().fromBufferAttribute(pos,i);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld);points.push(p);}
  for(let k=0;k<(index?.count||pos.count);k+=3){const ids=[0,1,2].map(j=>index?index.getX(k+j):k+j),world=ids.map(i=>points[i]),normal=new T.Vector3().subVectors(world[1],world[0]).cross(new T.Vector3().subVectors(world[2],world[0])).normalize();
   const color=colors?new T.Color(colors.getX(ids[0]),colors.getY(ids[0]),colors.getZ(ids[0])):mesh.material.color.clone();color.multiplyScalar(.45+.55*Math.abs(normal.dot(light)));
   const projected=world.map(p=>p.clone().project(camera));triangles.push({opacity:mesh.material.opacity,depth:projected.reduce((n,p)=>n+p.z,0),points:projected.map(p=>`${((p.x+1)*160).toFixed(2)},${((1-p.y)*160).toFixed(2)}`).join(' '),color:'#'+color.getHexString()});
  }
 });
 const polygons=triangles.sort((a,b)=>b.depth-a.depth).map(t=>`<polygon points="${t.points}" fill="${t.color}" opacity="${t.opacity}"/>`).join('');
 const tile=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="350"><rect width="320" height="350" fill="#181c23"/>${polygons}<text x="12" y="339" font-family="sans-serif" font-size="14" fill="white">${ex.id}</text></svg>`);
 const png=await sharp(tile).png().toBuffer();await writeFile(new URL('cpu-'+ex.id+'.png',out),png);tiles.push({input:png,left:(tiles.length%5)*320,top:Math.floor(tiles.length/5)*350});
}
await sharp({create:{width:1600,height:2800,channels:3,background:'#181c23'}}).composite(tiles).png().toFile(new URL('contact-sheet-cpu.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'));
await writeFile(new URL('contact-sheet.html',out),`<!doctype html><meta charset="utf-8"><title>Round 15 CPU pose review</title><h1>All 40 · phase 0.4 · 3/4 view</h1><p>CPU projection of the skinned GLB. This is not a WebGL/browser screenshot or a performance measurement.</p><img style="width:100%" src="contact-sheet-cpu.png" alt="Forty exercise poses">`);
console.log('Rendered 40 CPU pose previews and contact sheet. Browser validation remains separate.');

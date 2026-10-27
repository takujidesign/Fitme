import {getState,getImage,putImage,blobToBase64} from './store.js';
export async function fullBackup(){
 const s=structuredClone(getState());delete s.account;delete s.premium;delete s.healthImport;
 s.notifications={...s.notifications,enabled:false,deviceId:null};
 const ids=new Set((s.photos||[]).map(p=>p.id));
 const scan=v=>{if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='photoId'&&typeof x==='string')ids.add(x);else scan(x);}};scan(s);
 s.imageBackup={};for(const id of ids){const b=await getImage(id).catch(()=>null);if(b)s.imageBackup[id]=`data:${b.type||'image/jpeg'};base64,${await blobToBase64(b)}`;}
 return s;
}
export async function restoreImages(s){for(const [id,url] of Object.entries(s.imageBackup||{})){const m=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);if(!m)throw Error('Invalid backup image');await putImage(id,new Blob([Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0))],{type:m[1]}));}delete s.imageBackup;}

import {fail} from './security.js';
export const imageFailure=(code,status)=>Object.assign(fail(code,status),{code});
export function validateImage(bytes,type,maxBytes){
 if(bytes.length>maxBytes)throw imageFailure('image_too_large',413);
 const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/webp'&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 if(!valid)throw imageFailure('unsupported_image',415);
 return {bytes,type,extension:type==='image/jpeg'?'jpg':'webp'};
}
export async function readImage(req,maxBytes,{legacy=false}={}){
 const type=(req.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
 if(!['image/webp','image/jpeg',...(legacy?['application/json']:[])].includes(type))throw imageFailure('unsupported_image',415);
 const cap=type==='application/json'?1450000:maxBytes;
 if(Number(req.headers.get('Content-Length'))>cap)throw imageFailure('image_too_large',413);
 const reader=req.body?.getReader();if(!reader)throw imageFailure('unsupported_image',415);
 let size=0;const chunks=[];
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>cap){await reader.cancel();throw imageFailure('image_too_large',413);}chunks.push(r.value);}
 let bytes=new Uint8Array(size),at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 // Preserve queued uploads from earlier app versions (WebP-only JSON).
 if(type==='application/json'){
  try{const body=JSON.parse(new TextDecoder().decode(bytes));if(typeof body.data!=='string'||Object.keys(body).some(k=>k!=='data'))throw Error();bytes=Uint8Array.from(atob(body.data),c=>c.charCodeAt(0));}catch{throw imageFailure('unsupported_image',415);}
  return validateImage(bytes,'image/webp',maxBytes);
 }
 return validateImage(bytes,type,maxBytes);
}
export function storedImageType(object,key){return object.httpMetadata?.contentType||(/\.jpe?g$/i.test(key)?'image/jpeg':'image/webp');}

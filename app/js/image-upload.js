// Browser encoders may silently return PNG when WebP is unsupported.
const imageError=code=>Object.assign(new Error(code),{code});
export async function encodeImage(canvas,{maxBytes}){
 if(!(maxBytes>0)||!canvas.width||!canvas.height)throw imageError('unsupported_image');
 const encode=(surface,type,quality)=>new Promise(resolve=>{try{surface.toBlob(resolve,type,quality);}catch{resolve(null);}});
 const webp=await encode(canvas,'image/webp',.8);
 if(webp?.type==='image/webp'&&webp.size>0&&webp.size<=maxBytes)return webp;
 let surface=canvas;
 for(;;){
  for(const quality of [.85,.8,.75,.7,.65,.6]){
   const blob=await encode(surface,'image/jpeg',quality);
   if(!blob||blob.type!=='image/jpeg'||!blob.size)throw imageError('unsupported_image');
   if(blob.size<=maxBytes)return blob;
  }
  if(surface.width===1&&surface.height===1)throw imageError('image_too_large');
  const smaller=document.createElement('canvas');
  smaller.width=Math.max(1,Math.floor(surface.width*.75));smaller.height=Math.max(1,Math.floor(surface.height*.75));
  smaller.getContext('2d').drawImage(surface,0,0,smaller.width,smaller.height);surface=smaller;
 }
}
export async function loadImage(file){
 try{return await createImageBitmap(file);}catch{
  const url=URL.createObjectURL(file),img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});return img;}
  catch{throw imageError('unsupported_image');}finally{URL.revokeObjectURL(url);}
 }
}

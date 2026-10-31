// Always re-encode through canvas: no original EXIF is copied.
export async function downscaleMealPhotos(files){
 if(!files.length||files.length>2)throw Error('Choose 1?2 photos');
 const bitmaps=[];
 try{for(const file of files)bitmaps.push(await createImageBitmap(file));if(!bitmaps.length||bitmaps.length>2)throw Error('Choose 1–2 photos');
  const height=Math.max(...bitmaps.map(b=>b.height)),width=bitmaps.reduce((n,b)=>n+b.width*height/b.height,0),scale=Math.min(1,768/Math.max(width,height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);let x=0;
  for(const b of bitmaps){const w=b.width*height/b.height*scale;ctx.drawImage(b,x,0,w,canvas.height);x+=w;}
  return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not resize image')),'image/jpeg',.8));
 }finally{bitmaps.forEach(b=>b.close());}
}

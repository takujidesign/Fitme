// Read-only local preview for generated assets; never serves the repository root.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
export function previewServer(root=resolve('web/dist')){
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.xml':'application/xml','.txt':'text/plain'};
 return createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+sep))throw Error('outside assets');
  try{if((await stat(file)).isDirectory())file=join(file,'index.html');}catch{if(!extname(file))file+='.html';}
  let content;try{content=await readFile(file);}catch{res.statusCode=404;file=join(root,'404.html');content=await readFile(file);}
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.setHeader('Content-Security-Policy',(await readFile(join(root,'_headers'),'utf8')).match(/Content-Security-Policy: (.+)/)[1]);res.end(content);
 }catch{res.statusCode=404;res.end('Not found');}});
}
if(process.argv[1]===fileURLToPath(import.meta.url))previewServer().listen(5199,'127.0.0.1',()=>console.log('Read-only preview http://127.0.0.1:5199'));

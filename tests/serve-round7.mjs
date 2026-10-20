// Local-only capture fixture. Serves app/ and named QA scripts; never repo-root images.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const app=resolve(import.meta.dirname,'../app');
createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://localhost'),path=decodeURIComponent(u.pathname);
    const file=path==='/round7-driver.js'?resolve(import.meta.dirname,'round7-driver.js'):resolve(app,'.'+(path==='/'?'/index.html':path));
    if(file!==resolve(import.meta.dirname,'round7-driver.js')&&!file.startsWith(app+'\\')&&!file.startsWith(app+'/'))throw Error();
    let data=await readFile(file);
    if(file.endsWith('config.js'))data=Buffer.from(data.toString().replace("API_BASE: 'https://api.fixmee.app'","API_BASE: ''"));
    if(file.endsWith('index.html'))data=Buffer.from(data.toString().replace('src="js/app.js"','src="/round7-driver.js"'));
    if(file.endsWith('sw.js')){res.writeHead(404);return res.end();}
    res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[extname(file)]||'text/plain','Cache-Control':'no-store'});
    res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(5177,'127.0.0.1',()=>console.log('Round 7 local QA: http://127.0.0.1:5177/?theme=dark&screen=today'));

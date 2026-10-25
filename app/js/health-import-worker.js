import {Unzip,UnzipInflate} from './vendor/fflate.js';
import {createHealthParser} from './health-parser.js';
export async function parseHealthFile(file,options={},progress=()=>{},signal){
 const parser=createHealthParser(options),reader=file.stream().getReader(),decoder=new TextDecoder();let found=false,read=0,error=null;
 const abort=()=>{parser.cancel();reader.cancel();};signal?.addEventListener('abort',abort,{once:true});
 const unzip=new Unzip(entry=>{if(!/(^|\/)export\.xml$/.test(entry.name))return;if(found){error=Error('Multiple export.xml files');return;}found=true;entry.ondata=(err,data,final)=>{if(err){error=err;return;}try{parser.push(decoder.decode(data,{stream:!final}));}catch(e){error=e;}};entry.start();});unzip.register(UnzipInflate);
 try{while(true){if(signal?.aborted)throw Error('Import cancelled');const {done,value}=await reader.read();if(done){unzip.push(new Uint8Array(),true);break;}read+=value.byteLength;for(let at=0;at<value.length;at+=1024){unzip.push(value.subarray(at,at+1024),false);if(error)throw error;}if(error)throw error;progress({loaded:read,total:file.size});}if(signal?.aborted)throw Error('Import cancelled');if(error)throw error;if(!found)throw Error('export.xml not found');return parser.finish();}finally{signal?.removeEventListener('abort',abort);reader.releaseLock();}
}
if(typeof self!=='undefined'&&typeof document==='undefined'){let controller;self.onmessage=async({data})=>{if(data.type==='cancel'){controller?.abort();return;}controller=new AbortController();try{const days=await parseHealthFile(data.file,data,progress=>self.postMessage({type:'progress',...progress}),controller.signal);self.postMessage({type:'done',days});}catch(e){self.postMessage({type:'error',message:e.message});}};}

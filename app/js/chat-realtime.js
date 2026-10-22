import {api} from './account.js';
import {CONFIG} from './config.js';
export async function watchConversation(id,host,refresh){
 let socket,closed=false,poll;const stop=()=>{closed=true;clearInterval(poll);socket?.close();window.removeEventListener('hashchange',stop);};
 window.addEventListener('hashchange',stop,{once:true});
 poll=setInterval(()=>{if(!host.isConnected)return stop();if(socket?.readyState!==1)refresh();},5000);
 try{const {ticket}=await api('conversations/'+id+'/ticket',{});if(closed||!host.isConnected)return stop();const url=new URL(CONFIG.API_BASE.replace(/\/$/,'')+'/api/conversations/socket');url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('ticket',ticket);socket=new WebSocket(url);socket.onmessage=e=>{try{const event=JSON.parse(e.data);if(event.type==='refresh')refresh();if(event.type==='typing'){const el=document.querySelector('[data-chat-typing]');if(el){el.hidden=false;setTimeout(()=>{el.hidden=true;},4000);}}}catch{}};socket.onerror=()=>socket.close();}catch{/* Five-second polling remains available. */}
 return {stop,send:event=>{if(socket?.readyState===1)socket.send(JSON.stringify(event));}};
}

import {query as q} from './accounts.js';
// Hibernating sockets carry only invalidations and ephemeral collaboration state.
// Message bodies remain in D1 and are fetched through the authenticated HTTP API.
export class Conversation {
 constructor(state,env){this.state=state;this.env=env;}
 async allowed(id,user){
  if(!await q(this.env,'SELECT 1 FROM conversation_members m JOIN profiles p ON p.user_id=m.user_id WHERE m.conversation_id=? AND m.user_id=? AND m.invited=0 AND p.suspended=0 AND p.age16=1',id,user).first())return false;
  return !await q(this.env,'SELECT 1 FROM blocks b JOIN conversation_members m ON m.conversation_id=? WHERE (b.a=? AND b.b=m.user_id) OR (b.b=? AND b.a=m.user_id)',id,user,user).first();
 }
 async fetch(req){
  if(req.method==='POST'){await this.broadcast({type:'refresh'});return Response.json({ok:true});}
  const id=req.headers.get('X-Conversation'),user=req.headers.get('X-User');
  if(!id||!user||!await this.allowed(id,user))return new Response('Forbidden',{status:403});
  if(req.headers.get('Upgrade')!=='websocket')return new Response('WebSocket required',{status:426});
  const [client,server]=Object.values(new WebSocketPair());this.state.acceptWebSocket(server);server.serializeAttachment({id,user,last:0});
  return new Response(null,{status:101,webSocket:client});
 }
 async broadcast(event){for(const socket of this.state.getWebSockets()){try{const a=socket.deserializeAttachment();if(!await this.allowed(a.id,a.user)){socket.close(1008,'Unavailable');continue;}socket.send(JSON.stringify(event));}catch{socket.close(1011,'Reconnect');}}}
 async webSocketMessage(socket,data){try{const a=socket.deserializeAttachment();if(!await this.allowed(a.id,a.user)){socket.close(1008,'Unavailable');return;}if(typeof data!=='string'||data.length>4000)throw Error();const event=JSON.parse(data);if(Date.now()-a.last<500)return;a.last=Date.now();socket.serializeAttachment(a);
  if(event.type==='typing')await this.broadcast({type:'typing',user:a.user,until:Date.now()+4000});
  else if(event.type==='rest'&&Number.isInteger(event.seconds)&&event.seconds>=0&&event.seconds<=600){const value={type:'rest',user:a.user,until:Date.now()+event.seconds*1000};await this.state.storage.put('rest',value);await this.broadcast(value);}
  else if(event.type==='session'&&typeof event.workout==='string'&&event.workout.length<=2000)await this.broadcast({type:'session',user:a.user,workout:event.workout});
 }catch{socket.close(1008,'Invalid event');}}
 webSocketClose(socket,code,reason){socket.close(code,reason);}
 webSocketError(socket){socket.close(1011,'Reconnect');}
}

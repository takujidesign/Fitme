import assert from 'node:assert/strict';
import {Conversation} from './src/conversation.js';
import {testDB} from './test-db.mjs';
const {db,DB}=testDB(),a=crypto.randomUUID(),b=crypto.randomUUID(),c=crypto.randomUUID(),stored=new Map();
for(const id of [a,b]){db.prepare('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES(?,?,?,?,?)').run(id,id+'@example.test','x','x',Date.now());db.prepare('INSERT INTO profiles(user_id,age16,created) VALUES(?,1,?)').run(id,Date.now());}
db.prepare('INSERT INTO conversations VALUES(?,?,?)').run(c,'Mock room',Date.now());for(const id of [a,b])db.prepare('INSERT INTO conversation_members(conversation_id,user_id) VALUES(?,?)').run(c,id);
const makeSocket=user=>({data:{id:c,user,last:0},events:[],closed:[],deserializeAttachment(){return this.data;},serializeAttachment(value){this.data=value;},send(value){this.events.push(JSON.parse(value));},close(...args){this.closed.push(args);}});
const sockets=[makeSocket(a),makeSocket(b)],state={getWebSockets:()=>sockets,storage:{put:async(key,value)=>stored.set(key,value)}};
const room=new Conversation(state,{DB});globalThis.fetch=async()=>{throw Error('External network forbidden');};
await room.webSocketMessage(sockets[0],JSON.stringify({type:'typing'}));assert.equal(sockets[1].events[0].type,'typing');
sockets[0].data.last=0;await room.webSocketMessage(sockets[0],JSON.stringify({type:'rest',seconds:60}));assert(stored.get('rest').until>Date.now());assert.equal(sockets[1].events.at(-1).type,'rest');
const count=sockets[1].events.length;await room.webSocketMessage(sockets[0],JSON.stringify({type:'typing'}));assert.equal(sockets[1].events.length,count,'typing throttled');
db.prepare('INSERT INTO blocks VALUES(?,?,?)').run(b,a,Date.now());await room.broadcast({type:'refresh'});assert.equal(sockets[1].events.length,count,'blocked users receive no events');assert.equal(sockets[0].closed.at(-1)[0],1008);
db.prepare('DELETE FROM blocks').run();sockets[0].data.last=0;await room.webSocketMessage(sockets[0],'x'.repeat(4001));assert.equal(sockets[0].closed.at(-1)[1],'Invalid event');
db.close();console.log('PASS round11 realtime: authenticated membership, hibernation attachments, typing throttle, shared rest state, block enforcement and malformed-event rejection. Mock sockets only.');

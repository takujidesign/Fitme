import { REPDB_URL, fetchRepdb } from './repdb.js';
self.onmessage=async event=>{if(event.data!==REPDB_URL)return;try{self.postMessage(await fetchRepdb());}catch{self.postMessage({error:'RepDB unavailable'});}};

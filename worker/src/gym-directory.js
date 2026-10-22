import {query as q} from './accounts.js';
// Called only after an explicit nearby search; tests inject a fetch mock.
export async function refreshGyms(env,lat,lng,fetcher=fetch,now=Date.now()){
 const area=`${Math.floor(lat*20)/20}:${Math.floor(lng*20)/20}`,cached=await q(env,'SELECT updated FROM gym_areas WHERE area=?',area).first();
 if(cached&&now-cached.updated<7*86400000)return;
 // Claim the refresh first to avoid request storms; failed refresh retries next week.
 const claim=await q(env,'INSERT INTO gym_areas VALUES(?,?) ON CONFLICT(area) DO UPDATE SET updated=excluded.updated WHERE gym_areas.updated<?',area,now,now-7*86400000).run();if(!claim.meta.changes)return;
 const query=`[out:json][timeout:15];(nwr[leisure=fitness_centre](around:3000,${lat},${lng});nwr[leisure=sports_centre][sport=fitness](around:3000,${lat},${lng});nwr[amenity=gym](around:3000,${lat},${lng}););out center tags;`;
 try{const res=await fetcher('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(18000)});if(!res.ok)return;const data=await res.json();for(const item of (data.elements||[]).slice(0,300)){const x=item.lat??item.center?.lat,y=item.lon??item.center?.lon,name=item.tags?.name;if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>90||Math.abs(y)>180||typeof name!=='string')continue;await q(env,"INSERT INTO gyms VALUES(?,?,?,?,?,'approved','osm',?) ON CONFLICT(osm_id) DO UPDATE SET name=excluded.name,lat=excluded.lat,lng=excluded.lng,updated=excluded.updated WHERE gyms.source='osm'",crypto.randomUUID(),`${item.type}/${item.id}`,name.slice(0,100),x,y,now).run();}}catch{/* Cached and approved user gyms remain available offline. */}
}

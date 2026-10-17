import { getState, addDays } from './store.js';
import { sessionFor } from './workout.js';
import { CONFIG } from './config.js';
export const VIDEO_CACHE='fitme-videos-v1';
export function cacheableVideo(url){try{const u=new URL(url),base=new URL(CONFIG.API_BASE);return u.protocol==='https:'&&u.origin===base.origin&&/^\/api\/media\/[a-z0-9_-]+$/.test(u.pathname);}catch{return false;}}
export async function downloadPlanVideos(videos,onProgress=()=>{}){
 await navigator.storage?.persist?.();const s=getState(),ids=new Set();for(let i=0;i<s.profile.planDays;i++)for(const item of sessionFor(s.profile,addDays(s.profile.startDate,i))?.items||[])ids.add(item.id);
 const urls=[...new Set([...ids].map(id=>videos[id]).filter(cacheableVideo))],cache=await caches.open(VIDEO_CACHE);let done=0;
 for(const url of urls){if(!await cache.match(url)){const response=await fetch(url);if(!response.ok||!response.headers.get('Content-Type')?.includes('video/mp4'))throw Error('Video download failed');await cache.put(url,response);}onProgress(++done,urls.length);}return urls.length;
}
export const deleteVideos=()=>caches.delete(VIDEO_CACHE);
export async function cachedVideo(url){if(!globalThis.caches)return null;const hit=await (await caches.open(VIDEO_CACHE)).match(url);return hit?URL.createObjectURL(await hit.blob()):null;}
export async function cacheOfflineAssets(){
 if(!globalThis.caches||navigator.onLine===false)return;
 const cache=await caches.open('fitme-assets-v1');
 const urls=['https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',...[...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.href).filter(u=>u.startsWith('https://fonts.googleapis.com/'))];
 await Promise.allSettled(urls.map(async url=>{const response=await cache.match(url)||await fetch(url);if(!response.ok)return;await cache.put(url,response.clone());if(url.includes('fonts.googleapis.com')){const css=await response.text();await Promise.allSettled([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(async m=>{if(!await cache.match(m[1])){const font=await fetch(m[1]);if(font.ok)await cache.put(m[1],font);}}));}}));
}

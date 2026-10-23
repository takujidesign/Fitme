import {integrationEnabled} from './beta.js';
// Leaflet 1.9.4, vendored BSD-2-Clause. No tiles load unless an admin sets a URL.
let loading;
const instances=new WeakMap();
export async function gymMap(host,gyms,position,tileUrl,onPick){
 if(!integrationEnabled('maps'))return;
 if(!host||!tileUrl||!/^https:\/\//.test(tileUrl))return;
 loading??=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='./js/vendor/leaflet/leaflet.css';document.head.append(css);const script=document.createElement('script');script.src='./js/vendor/leaflet/leaflet.js';script.onload=()=>resolve(window.L);script.onerror=()=>{loading=null;reject(Error('Map unavailable'));};document.head.append(script);});
 const leaflet=await loading;if(!host.isConnected)return;instances.get(host)?.();host.style.height='280px';host.setAttribute('aria-label','OpenStreetMap');
 const map=leaflet.map(host).setView([position.lat,position.lng],15);
 leaflet.tileLayer(tileUrl,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
 for(const gym of gyms){const popup=document.createElement('div');popup.textContent=gym.name;leaflet.circleMarker([gym.lat,gym.lng],{radius:7}).addTo(map).bindPopup(popup);}
 if(onPick){let pin;map.on('click',event=>{pin?.remove();pin=leaflet.circleMarker(event.latlng,{radius:8}).addTo(map);onPick({lat:event.latlng.lat,lng:event.latlng.lng});});}
 const dispose=()=>{window.removeEventListener('hashchange',dispose);map.remove();instances.delete(host);};instances.set(host,dispose);window.addEventListener('hashchange',dispose,{once:true});return map;
}

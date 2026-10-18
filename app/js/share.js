import { earnedBadges } from './challenges.js';
import { getState, todayISO, addDays, diffDays } from './store.js';
import { actions, pickFiles } from './core.js';
import { L, sheet, toast } from './ui.js';
export function shareStats(s=getState()){
  const today=todayISO();let date=s.logs[today]?.done?.workout?today:addDays(today,-1),streak=0;
  while(s.logs[date]?.done?.workout){streak++;date=addDays(date,-1);}
  const weights=s.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  return {days:Math.max(0,diffDays(s.profile.startDate,today)+1),workouts:Object.values(s.logs).filter(l=>l.done?.workout).length,streak,change:weights.length>=2?weights.at(-1).kg-weights[0].kg:null};
}
export async function drawShare(canvas,photos=[]){
  await document.fonts?.ready;canvas.width=1080;canvas.height=1350;const c=canvas.getContext('2d'),s=getState(),stats=shareStats(s);
  c.fillStyle='#0B0F14';c.fillRect(0,0,1080,1350);c.fillStyle='#C8F31D';c.font='bold 78px Kanit, sans-serif';c.fillText('Fixmee',72,125);
  c.fillStyle='#EEF3F9';c.font='bold 56px Kanit, sans-serif';c.fillText(s.profile.name||L('ความก้าวหน้าของฉัน','My progress'),72,215,936);
  const metrics=[[stats.days,L('วันในแผน','days on plan')],[stats.workouts,L('ครั้งที่ฝึก','workouts done')],[stats.streak,L('วันต่อเนื่อง','day streak')],[stats.change===null?'—':`${stats.change>0?'+':''}${stats.change.toFixed(1)} kg`,L('น้ำหนักเปลี่ยนแปลง','weight change')]];
  metrics.forEach(([value,label],i)=>{const x=72+(i%2)*480,y=345+Math.floor(i/2)*180;c.fillStyle='#19E3C4';c.font='bold 64px Kanit, sans-serif';c.fillText(String(value),x,y,440);c.fillStyle='#EEF3F9';c.font='32px Kanit, sans-serif';c.fillText(label,x,y+55,440);});
  for(let i=0;i<photos.length;i++){const bmp=await createImageBitmap(photos[i]);const x=72+i*480,y=670,w=456,h=520,scale=Math.min(w/bmp.width,h/bmp.height);c.drawImage(bmp,x+(w-bmp.width*scale)/2,y+(h-bmp.height*scale)/2,bmp.width*scale,bmp.height*scale);bmp.close();c.fillStyle='#EEF3F9';c.font='28px Kanit, sans-serif';c.fillText(i?L('หลัง','After'):L('ก่อน','Before'),x,y+h+40);}
  c.fillStyle='#C8F31D';c.font='28px Kanit, sans-serif';c.fillText(L('เหรียญรางวัล','Badges')+': '+earnedBadges(s).length,72,1260);
  c.fillStyle='#8C9AAE';c.font='26px Kanit, sans-serif';c.fillText(todayISO()+' · Fixmee',72,1300);
}
actions['share-card']=()=>{
  sheet(`<h2>${L('แชร์ผลลัพธ์','Share results')}</h2><p>${L('รูปก่อน/หลังจะใส่เฉพาะรูปที่คุณเลือกในครั้งนี้','Before/after photos are included only when you select them here.')}</p><div class="row gap"><button class="btn ghost" id="share-photos">${L('เลือกรูปก่อน/หลัง','Choose before/after')}</button><button class="btn ghost" id="share-clear">${L('ไม่ใส่รูป','Remove photos')}</button></div><canvas id="share-canvas" style="width:100%;height:auto"></canvas><button class="btn primary block" id="share-send" disabled>${L('แชร์ / ดาวน์โหลด PNG','Share / download PNG')}</button>`,{async onMount(root){
    const canvas=root.querySelector('canvas'),send=root.querySelector('#share-send');let photos=[];
    const render=async()=>{send.disabled=true;try{await drawShare(canvas,photos);send.disabled=false;}catch(e){toast(e.message,'warn');}};
    root.querySelector('#share-photos').onclick=async()=>{try{const selected=await pickFiles({multiple:true});if(selected.length!==2)return toast(L('เลือก 2 รูป ตามลำดับก่อน/หลัง','Choose two photos, before then after'),'warn');photos=selected;await render();}catch(e){toast(e.message,'warn');}};
    root.querySelector('#share-clear').onclick=()=>{photos=[];render();};
    send.onclick=async()=>{try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG export failed');const file=new File([blob],'fixmee-progress.png',{type:'image/png'});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file]});else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}catch(e){if(e.name!=='AbortError')toast(e.message,'warn');}};
    await render();
  }});
};

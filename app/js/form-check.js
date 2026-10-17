import { L, toast } from './ui.js';
import { speak } from './voice.js';
export const supportedForm=new Set(['squat','goblet_squat','lunge','pushup','plank','bridge','shoulder_press','lateral_raise','curl','bicep_curl','db_curl']);
export function angle(a,b,c){const x=[a.x-b.x,a.y-b.y],y=[c.x-b.x,c.y-b.y],d=Math.hypot(...x)*Math.hypot(...y);return d?Math.acos(Math.max(-1,Math.min(1,(x[0]*y[0]+x[1]*y[1])/d)))*180/Math.PI:0;}
// Hysteresis, minimum dwell and tracking-loss reset prevent jitter/partial poses counting as reps.
export class RepCounter{
 constructor(id){this.id=id;this.reps=0;this.hold=0;this.phase='start';this.last=0;this.changed=0;this.errors=new Set();}
 update(l,now){const ids=[11,12,13,14,15,16,23,24,25,26,27,28];if(!l||ids.some(i=>!l[i]||(l[i].visibility??1)<.6)){this.phase='start';this.last=0;return {reps:this.reps,hold:this.hold,cues:['Keep your whole body visible']};}
 const knee=angle(l[23],l[25],l[27]),elbow=angle(l[11],l[13],l[15]),hip=angle(l[11],l[23],l[25]),shoulder=angle(l[23],l[11],l[13]);let value=elbow,low=85,high=155,cues=[];
 if(/squat|lunge/.test(this.id)){value=knee;low=105;if(knee<145&&knee>115)cues.push('Lower slowly to a comfortable depth');if(Math.abs(l[25].x-l[26].x)<Math.abs(l[27].x-l[28].x)*.65)cues.push('Keep knees tracking over toes');if(hip<70)cues.push('Keep your chest lifted');}
 else if(this.id==='bridge'){value=180-hip;low=15;high=50;if(hip>178)cues.push('Avoid arching your lower back');if(Math.abs(l[23].y-l[24].y)>.08)cues.push('Keep hips level');}
 else if(this.id==='lateral_raise'){value=180-shoulder;low=105;high=155;if(shoulder>100)cues.push('Stop near shoulder height');if(elbow<120)cues.push('Keep a soft elbow bend');}
 else if(this.id==='shoulder_press'){if(shoulder>110&&elbow<90)cues.push('Keep elbows under wrists');if(Math.abs(l[11].y-l[12].y)>.08)cues.push('Keep shoulders level');}
 else if(/curl/.test(this.id)){if(shoulder>35)cues.push('Keep elbows near your sides');if(Math.abs(l[11].x-l[23].x)>.18)cues.push('Avoid swinging your torso');}
 else {if(hip<155)cues.push(l[23].y>(l[11].y+l[27].y)/2?'Lift hips into line':'Lower hips into line');if(Math.abs(l[11].y-l[12].y)>.1)cues.push('Keep shoulders level');}
 if(this.id==='plank'){if(!cues.length&&this.last)this.hold+=Math.min(200,Math.max(0,now-this.last))/1000;}
 else if(now-this.changed>=200){if(this.phase==='start'&&value>=high){this.phase='ready';this.changed=now;}else if(this.phase==='ready'&&value<=low){this.phase='down';this.changed=now;}else if(this.phase==='down'&&value>=high){this.reps++;this.phase='ready';this.changed=now;}}
 this.last=now;cues.forEach(c=>this.errors.add(c));return {reps:this.reps,hold:this.hold,cues};
 }
}
let stopCurrent;
export function stopFormCheck(){const stop=stopCurrent;stopCurrent=null;return stop?.();}
export async function startFormCheck(container,id,onEnd){stopFormCheck();let stream,model,frame,stopped=false,lastCue=0,previous=-1;const counter=new RepCounter(id);
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());model?.close();const summary={reps:counter.reps,seconds:Math.floor(counter.hold),cues:[...counter.errors]};onEnd(summary);return summary;};stopCurrent=stop;
 container.innerHTML=`<p class="note">${L('ประมวลผลในเครื่องเท่านั้น ไม่มีภาพส่งออกจากอุปกรณ์','Processed on device. No camera frames leave this device.')}</p><p>${L('หันด้านข้างให้เห็นทั้งตัว ใช้คำแนะนำเป็นตัวช่วยเท่านั้น','Show your whole body from the side. Cues are approximate guidance.')}</p><video muted playsinline style="width:100%;max-height:300px;transform:scaleX(-1)"></video><p role="status">${L('กำลังโหลดโมเดล','Loading model')}</p><button class="btn ghost" type="button">${L('จบการตรวจฟอร์ม','End form check')}</button>`;
 container.querySelector('button').onclick=()=>{const result=stopFormCheck();if(result)container.querySelector('[role=status]').textContent=`${result.reps} reps · ${result.seconds}s · ${result.cues.join(' / ')}`;};
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});if(stopped){stream.getTracks().forEach(t=>t.stop());return;}const video=container.querySelector('video');video.srcObject=stream;await video.play();
  const {FilesetResolver,PoseLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
  model=await PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'),{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'},runningMode:'VIDEO',numPoses:1});if(stopped){model.close();return;}
  const tick=now=>{if(stopped)return;if(!container.isConnected){stopFormCheck();return;}try{if(video.currentTime!==previous){previous=video.currentTime;const result=counter.update(model.detectForVideo(video,now).landmarks[0],now);container.querySelector('[role=status]').textContent=`${result.reps} reps · ${Math.floor(result.hold)}s · ${result.cues.join(' / ')}`;if(result.cues.length&&now-lastCue>5000){speak(result.cues[0],result.cues[0]);lastCue=now;}}frame=requestAnimationFrame(tick);}catch{stopFormCheck();toast(L('ตรวจฟอร์มไม่ได้ บันทึกเซ็ตเองได้ตามปกติ','Form check unavailable. Log this set manually.'),'warn');}};frame=requestAnimationFrame(tick);
 }catch{stopFormCheck();container.innerHTML=`<p role="status">${L('กล้องหรือโมเดลไม่พร้อม บันทึกเซ็ตเองได้ตามปกติ','Camera or model unavailable. Continue logging manually.')}</p>`;}
}

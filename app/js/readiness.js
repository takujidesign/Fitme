import { EX } from './exercises.js';
export function readiness(checkin){
 if(!checkin)return {score:100,mode:'normal'};
 if(checkin.override==='recovery')return {score:30,mode:'recovery'};
 const energy=Math.max(1,Math.min(5,Number(checkin.energy)||3)),stress=Math.max(1,Math.min(5,Number(checkin.stress)||3));
 const sleep=Number.isFinite(checkin.sleep)?Math.max(0,Math.min(12,checkin.sleep)):7;
 const areas={quads:'legs',hamstrings:'legs',glutes:'legs',calves:'legs',adductors:'legs',front_delts:'shoulders',rear_delts:'shoulders',biceps:'arms',triceps:'arms',forearms:'arms',lats:'back',lower_back:'back',traps:'back'};
 const sore=new Set(Object.entries(checkin.soreness||{}).filter(([,v])=>v).map(([k])=>areas[k]||k)).size;
 const score=Math.max(0,Math.min(100,Math.round(energy*12+(6-stress)*6+Math.min(sleep,8)*4-20-sore*8-(checkin.hrPenalty||0))));
 return {score,mode:score<20?'rest':score<40?'recovery':score<70?'lighter':'normal'};
}
export function readinessSession(session,checkin){
 if(!session)return session;const {score,mode}=readiness(checkin);if(mode==='normal')return {...session,readiness:mode,readinessScore:score};
 let items=session.items;
 if(mode==='rest')items=[];
 else if(mode==='recovery')items=[{id:'walk',sets:1,sec:600,rest:0},{id:'cat_cow',sets:1,sec:60,rest:15},{id:'breathing',sets:1,sec:120,rest:0}];
 else items=items.filter(i=>i.phase!=='finisher').map(i=>{const id=({pushup:'wall_pushup',squat:'chair_squat',squat_jump:'chair_squat',burpee:'walk',jumping_jack:'walk',jump_rope:'walk',mountain_climber:'bird_dog',high_knees:'walk'})[i.id]||i.id;return {...i,id,sets:Math.max(1,i.sets-1),...(EX[id].type==='time'&&i.reps?{sec:30,reps:undefined}:{})};});
 return {...session,type:['rest','recovery'].includes(mode)?'rest':session.type,split:['rest','recovery'].includes(mode)?'recovery':session.split,items,readiness:mode,readinessScore:score};
}

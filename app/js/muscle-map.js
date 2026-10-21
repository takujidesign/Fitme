import { EXERCISES } from './exercises.js';
import { L, esc } from './ui.js';
export const REGIONS = {pelvic_floor:['อุ้งเชิงกราน','Pelvic floor'],chest:['อก','Chest'],front_delts:['ไหล่หน้า','Front delts'],rear_delts:['ไหล่ข้าง/หลัง','Side / rear delts'],biceps:['หน้าแขน','Biceps'],triceps:['หลังแขน','Triceps'],forearms:['ปลายแขน','Forearms'],abs:['หน้าท้อง','Abs'],obliques:['ท้องด้านข้าง','Obliques'],traps:['บ่า','Traps'],lats:['หลังด้านข้าง','Lats'],lower_back:['หลังล่าง','Lower back'],glutes:['ก้น','Glutes'],quads:['ต้นขาหน้า','Quads'],hamstrings:['ต้นขาหลัง','Hamstrings'],adductors:['ต้นขาด้านใน','Adductors'],calves:['น่อง','Calves'],neck:['คอ','Neck']};
export const DB_MUSCLES={abdominals:['abs','obliques'],hamstrings:['hamstrings'],adductors:['adductors'],quadriceps:['quads'],biceps:['biceps'],shoulders:['front_delts','rear_delts'],chest:['chest'],'middle back':['traps','lats'],calves:['calves'],glutes:['glutes'],'lower back':['lower_back'],lats:['lats'],triceps:['triceps'],traps:['traps'],forearms:['forearms'],neck:['neck'],abductors:['glutes']};
const words={quads:'quads',glutes:'glutes',hamstrings:'hamstrings',calves:'calves',chest:'chest',shoulders:'front_delts',delts:'rear_delts',triceps:'triceps',biceps:'biceps',forearms:'forearms',abs:'abs',core:'abs',obliques:'obliques',traps:'traps',lats:'lats',back:'lats',hip:'adductors',hips:'glutes'};
const ORIGINAL_MUSCLES={squat:['quads','glutes'],goblet_squat:['quads','glutes','abs'],lunge:['quads','glutes'],bridge:['glutes','hamstrings'],calf_raise:['calves'],squat_jump:['quads','glutes','calves'],deadlift:['hamstrings','glutes','lower_back','traps'],rdl:['hamstrings','glutes','lower_back'],pushup:['chest','front_delts','triceps'],knee_pushup:['chest','front_delts','triceps'],bench_press:['chest','front_delts','triceps'],shoulder_press:['front_delts','rear_delts','triceps'],lateral_raise:['rear_delts'],triceps_ext:['triceps'],db_row:['lats','traps','biceps'],lat_pulldown:['lats','biceps'],db_curl:['biceps'],superman:['lower_back','glutes'],plank:['abs','obliques'],crunch:['abs'],leg_raise:['abs'],mountain_climber:['abs','quads'],jumping_jack:['quads','calves','rear_delts'],high_knees:['quads','calves','abs'],jog:['quads','hamstrings','calves'],walk:['quads','hamstrings','calves'],jump_rope:['calves'],forward_fold:['hamstrings','lower_back'],quad_stretch:['quads'],child_pose:['lats','lower_back'],bird_dog:['abs','lower_back','glutes'],dead_bug:['abs'],cat_cow:['abs','lower_back'],chair_squat:['quads','glutes'],wall_pushup:['chest','front_delts','triceps'],step_up:['quads','glutes'],run_interval:['quads','hamstrings','calves'],side_plank:['obliques'],kegel:['pelvic_floor'],breathing:['abs']};
export function exerciseMuscles(ex){if(ex?.primaryMuscles)return [...new Set([...ex.primaryMuscles,...(ex.secondaryMuscles||[])])];return ORIGINAL_MUSCLES[ex?.id]||[];}
export const ANIMATED_MUSCLES=Object.fromEntries(EXERCISES.map(e=>[e.id,exerciseMuscles(e)]));
// Original schematic anatomy drawn for Fixmee; no third-party SVG or code.
// Original front/back region contours, mirrored where appropriate (not third-party artwork).
const shapes={
 pelvic_floor:['M43 109 Q50 105 57 109 L53 117 Q50 120 47 117Z'],
 chest:['M34 49 Q40 46 49 49 L49 65 Q39 70 32 62Z',true],
 front_delts:['M28 46 Q20 48 21 61 L29 65 Q35 57 33 50Z',true],
 biceps:['M22 64 Q30 62 29 72 Q28 82 23 87 Q18 78 22 64Z',true],
 forearms:['M21 88 Q27 87 25 98 L21 114 L16 112 Q15 99 21 88Z',true],
 abs:['M41 70 Q45 68 49 70 L49 98 Q42 101 41 94Z',true],
 obliques:['M32 70 L39 73 L39 99 L33 105 Q35 87 32 70Z',true],
 quads:['M33 122 Q41 117 47 125 L44 148 Q42 160 36 160 Q29 146 33 122Z',true],
 adductors:['M46 120 L49 125 L48 145 Q43 141 43 134Z',true],
 calves:['M35 164 Q44 161 44 173 L40 194 L35 197 Q30 178 35 164Z',true],
 neck:['M45 34 L55 34 L58 44 Q50 47 42 44Z'],
 traps:['M44 40 L50 44 L50 67 Q41 54 31 51Z',true],
 rear_delts:['M29 47 Q19 47 21 60 L28 65 Q34 58 33 51Z',true],
 triceps:['M23 65 Q31 64 29 76 L25 88 Q18 84 20 75Z',true],
 lats:['M33 61 L48 70 L48 90 Q41 86 36 79Z',true],
 lower_back:['M42 88 L49 92 L49 109 L39 106Z',true],
 glutes:['M34 111 Q43 107 49 112 L49 130 Q39 139 32 127Z',true],
 hamstrings:['M33 136 Q40 132 46 135 L43 159 Q36 167 33 153Z',true]
};
const back=new Set(['traps','rear_delts','triceps','lats','lower_back','glutes','hamstrings']);
export function muscleMap(values={}, label=L('กล้ามเนื้อ','Muscles'), action=''){return `<svg class="muscle-map" viewBox="0 0 210 218" role="group" aria-label="${esc(label)}">${[0,110].map((x,i)=>`<g transform="translate(${x},0)"><text x="50" y="12" text-anchor="middle" fill="currentColor" font-size="9">${i?L('ด้านหลัง','Back'):L('ด้านหน้า','Front')}</text><path d="M42 36 Q37 41 29 43 Q20 44 18 60 Q17 77 13 90 L10 112 Q15 119 22 113 L29 88 Q31 78 31 69 Q37 88 32 108 Q28 121 29 142 Q33 155 30 167 L29 199 Q30 205 43 201 L46 171 Q45 159 49 143 L50 129 L51 143 Q55 159 54 171 L57 201 Q70 205 71 199 L70 167 Q67 155 71 142 Q72 121 68 108 Q63 88 69 69 Q69 78 71 88 L78 113 Q85 119 90 112 L87 90 Q83 77 82 60 Q80 44 71 43 Q63 41 58 36Z" fill="none" stroke="currentColor" opacity=".3"/><circle cx="50" cy="26" r="10" fill="none" stroke="currentColor"/>${Object.entries(shapes).filter(([id])=>back.has(id)===!!i||['calves','forearms','neck'].includes(id)).map(([id,[path,mirror]])=>{const v=values[id]||0,status=typeof v==='object'?v.status:v>0?'target':'fresh';return `<a href="${action?'#':'#/library?muscle='+id}" ${action?`data-act="${action}" data-region="${id}" role="button" aria-pressed="${!!v}"`:''} tabindex="0" aria-label="${esc(L(...REGIONS[id]))}: ${typeof v==='object'?v.sets+' '+L('เซ็ต','sets')+(status.startsWith('volume-')?'':' · '+L(status==='fatigued'?'ล้า':status==='recovering'?'กำลังฟื้นตัว':'พร้อม',status)):v}"><title>${esc(L(...REGIONS[id]))}</title>${[false,...(mirror?[true]:[])].map(flip=>`<path data-region="${id}" d="${path}" ${flip?'transform="translate(100 0) scale(-1 1)"':''} class="muscle-${status}" stroke="currentColor" stroke-width=".7"/>`).join('')}</a>`;}).join('')}</g>`).join('')}</svg>`;}
export function muscleRecovery(logs, lookup, now=Date.now()){
 const result=Object.fromEntries(Object.keys(REGIONS).map(id=>[id,{sets:0,load:0,status:'fresh'}]));
 for(const [date,log] of Object.entries(logs||{})){
  const at=Date.parse(log.workout?.at||date+'T12:00:00'),hours=(now-at)/3600000;if(hours<0||hours>168)continue;
  const sets=log.sets?.length?log.sets:log.done?.workout?(log.workout?.items||[]).flatMap(it=>Array.from({length:it.sets||1},()=>({id:it.id}))):[];
  const counts={};for(const set of sets)for(const id of exerciseMuscles(lookup[set.id]))counts[id]=(counts[id]||0)+1;
  for(const [id,n] of Object.entries(counts)){result[id].sets+=n;result[id].load+=n*Math.max(0,1-hours/Math.min(72,48+n*2));}
  const soreness=log.checkin?.soreness||{};const groups={shoulders:['front_delts','rear_delts'],arms:['biceps','triceps','forearms'],legs:['quads','hamstrings','glutes','calves'],push:['chest','front_delts','triceps'],pull:['lats','traps','biceps'],core:['abs','obliques'],back:['lats','lower_back']};if(hours<72)for(const [key,sore] of Object.entries(soreness))if(sore)for(const id of (groups[key]||[key]))if(result[id])result[id].load+=4*(1-hours/72);
 }
 for(const r of Object.values(result))r.status=r.load>=8?'fatigued':r.load>=1?'recovering':'fresh';return result;
}

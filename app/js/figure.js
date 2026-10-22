import { exerciseMuscles } from './muscle-map.js';
import { L } from './ui.js';
import { photoHTML } from './exercise-library.js';
// Animated exercise figure: a 2D skeleton driven by keyframed poses.
// Angle convention (degrees): 0 = pointing down, 90 = forward (right), 180 = up, -90 = back (left).
// Limbs are either absolute angles [upper, lower] or an IK target {to:[x,y], bend:±1}
// so hands and feet stay planted while the body moves.
const LEN = { torso: 46, neck: 7, head: 10, ua: 25, fa: 23, th: 34, sh: 34, foot: 11 };
const rad = (a) => (a * Math.PI) / 180;
const dir = (a) => [Math.sin(rad(a)), Math.cos(rad(a))];
const along = (p, a, l) => { const d = dir(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; };
const angTo = (p, q) => (Math.atan2(q[0] - p[0], q[1] - p[1]) * 180) / Math.PI;

function ik(p, t, l1, l2, bend) {
  const dx = t[0] - p[0], dy = t[1] - p[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const base = angTo(p, t);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const alpha = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  const a1 = base + alpha * bend;
  const j = along(p, a1, l1);
  const end = [p[0] + (dx / Math.hypot(dx, dy || 1e-6)) * d, p[1] + (dy / Math.hypot(dx, dy || 1e-6)) * d];
  return [a1, angTo(j, end)];
}

const lerp = (a, b, t) => a + (b - a) * t;
export function lerpVal(a, b, t, angle = false) {
  if (typeof a === 'number') return a + (angle ? (((((b ?? a) - a + 180) % 360) + 360) % 360 - 180) : (b ?? a) - a) * t;
  if (Array.isArray(a)) return a.map((v, i) => lerpVal(v, b?.[i], t, angle));
  if (a && typeof a === 'object') {
    const o = {};
    for (const k in a) o[k] = lerpVal(a[k], b?.[k], t);
    return o;
  }
  return a;
}
// Coordinates and IK targets are linear; only absolute joint angles wrap.
export function interpolatePose(a, b, t, ex = {}) {
  let from,to;
  return Object.fromEntries(Object.keys(a).map(k => {
    const limbKey={a1:'arm1',a2:'arm2',l1:'leg1',l2:'leg2'}[k];let av=a[k],bv=b[k];
    // A transition may switch from a planted IK target to a swinging limb.
    // Convert both endpoints to the same angle representation before blending.
    if(limbKey&&av&&bv&&Array.isArray(av)!==Array.isArray(bv)){
      from??=solve(a,ex.view);to??=solve(b,ex.view);
      const angles=j=>[angTo(j[0],j[1]),angTo(j[1],j[2])];av=angles(from[limbKey]);bv=angles(to[limbKey]);
    }
    return [k,lerpVal(av,bv,t,['t','h','f1','f2','a1','a2','l1','l2'].includes(k)&&!ex.longArc?.includes(k))];
  }));
}
const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

function limb(spec, root, l1, l2, defBend) {
  const a = spec && !Array.isArray(spec) ? ik(root, spec.to, l1, l2, spec.bend ?? defBend) : spec || [0, 0];
  const j = along(root, a[0], l1);
  return [root, j, along(j, a[1], l2)];
}

// Resolve a pose into joint coordinates.
export function solve(pose, view) {
  const hip = [pose.x, pose.y];
  const t = pose.t ?? 180;
  const neckBase = along(hip, t, LEN.torso);
  const head = along(neckBase, t + (pose.h || 0), LEN.neck + LEN.head);
  const front = view === 'front';
  // front view: shoulders/hips spread sideways (perpendicular to the torso)
  const side = (p, w) => (front ? along(p, t - 90, w) : p);
  const sideB = (p, w) => (front ? along(p, t + 90, w) : p);
  const sh1 = side(neckBase, 13), sh2 = sideB(neckBase, 13);
  const hp1 = side(hip, 7), hp2 = sideB(hip, 7);
  const mirror = (s) => (Array.isArray(s) ? s.map((v) => -v)
    : s?.to ? { to: [2 * pose.x - s.to[0], s.to[1]], bend: -(s.bend ?? 1) } : s);
  const a2spec = pose.sym ? mirror(pose.a1) : pose.a2 ?? pose.a1;
  const l2spec = pose.sym ? mirror(pose.l1) : pose.l2 ?? pose.l1;
  const arm1 = limb(pose.a1, sh1, LEN.ua, LEN.fa, -1);
  const arm2 = limb(a2spec, sh2, LEN.ua, LEN.fa, front ? 1 : -1);
  const leg1 = limb(pose.l1, hp1, LEN.th, LEN.sh, 1);
  const leg2 = limb(l2spec, hp2, LEN.th, LEN.sh, front ? -1 : 1);
  const foot = (leg, f) => along(leg[2], f ?? 90, LEN.foot);
  const f2 = pose.sym && pose.f1 != null ? -pose.f1 : pose.f2 ?? pose.f1;
  return {
    hip, neckBase, head, sh1, sh2, arm1, arm2, leg1, leg2,
    foot1: front ? null : foot(leg1, pose.f1), foot2: front ? null : foot(leg2, f2),
  };
}


function propSVG(prop, j) {
  if (!prop) return '';
  const hands = [j.arm1[2], j.arm2[2]];
  const out = [];
  for (const p of String(prop).split(' ')) {
    if (p === 'db') hands.forEach((h) => out.push(`<rect x="${h[0] - 7}" y="${h[1] - 3}" width="14" height="6" rx="2" class="prop"/><rect x="${h[0] - 9}" y="${h[1] - 6}" width="4" height="12" rx="1.5" class="prop"/><rect x="${h[0] + 5}" y="${h[1] - 6}" width="4" height="12" rx="1.5" class="prop"/>`));
    if (p === 'kb') out.push(`<circle cx="${hands[0][0]}" cy="${hands[0][1] + 9}" r="8" class="prop"/>`);
    if (p === 'plate') out.push(`<circle cx="${hands[0][0]}" cy="${hands[0][1]}" r="15" class="prop-o"/><circle cx="${hands[0][0]}" cy="${hands[0][1]}" r="3" class="prop"/>`);
    if (p === 'bar') { const y = (hands[0][1] + hands[1][1]) / 2; out.push(`<line x1="${Math.min(hands[0][0], hands[1][0]) - 26}" y1="${y}" x2="${Math.max(hands[0][0], hands[1][0]) + 26}" y2="${y}" class="prop-l"/>`); }
    if (p === 'bench') out.push('<rect x="36" y="146" width="110" height="9" rx="3" class="prop-o"/><line x1="50" y1="155" x2="50" y2="181" class="prop-l"/><line x1="132" y1="155" x2="132" y2="181" class="prop-l"/>');
    if (p === 'wall') out.push('<rect x="170" y="24" width="9" height="158" rx="2" class="prop-o"/>');
    if (p === 'chair') out.push('<rect x="48" y="150" width="48" height="7" rx="3" class="prop-o"/><path d="M52 181V107H59V150M91 157V181" class="prop-l"/>');
    if (p === 'box') out.push('<rect x="20" y="146" width="62" height="36" rx="4" class="prop-o"/>');
    if (p === 'step') out.push('<rect x="110" y="160" width="50" height="22" rx="3" class="prop-o"/>');
    if (p === 'mat') out.push('<rect x="14" y="179" width="172" height="5" rx="2.5" class="mat"/>');
    if (p === 'cable') out.push(`<line x1="100" y1="10" x2="${(hands[0][0] + hands[1][0]) / 2}" y2="${(hands[0][1] + hands[1][1]) / 2}" class="prop-t"/>`);
  }
  return out.join('');
}

let figureId = 0;
const viewBoxes = new WeakMap();
// Sample the whole rep once, including IK arcs, so framing never pumps or clips.
export function figureViewBox(ex) {
  if(viewBoxes.has(ex))return viewBoxes.get(ex);
  const points=[];
  for(let i=0;i<ex.frames.length;i++)for(let step=0;step<=16;step++){
    const j=solve(interpolatePose(ex.frames[i],ex.frames[(i+1)%ex.frames.length],step/16,ex),ex.view);
    points.push(j.head,j.hip,j.neckBase,...j.arm1,...j.arm2,...j.leg1,...j.leg2);
    if(j.foot1)points.push(j.foot1,j.foot2);
    if(/bar/.test(ex.prop||''))points.push(...[j.arm1[2],j.arm2[2]].flatMap(([x,y])=>[[x-28,y],[x+28,y]]));
  }
  const bounds={bench:[[33,143],[149,184]],wall:[[167,21],[182,185]],chair:[[45,104],[99,184]],box:[[17,143],[85,185]],mat:[[14,179],[186,184]],cable:[[100,10]]};
  bounds.step=[[107,157],[163,185]];
  for(const prop of String(ex.prop||'').split(' '))points.push(...(bounds[prop]||[]));
  const arrow=movementArrow(ex);if(arrow)points.push(arrow.a,arrow.b,arrow.c);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const left=Math.min(...xs)-14,top=Math.min(...ys)-14;
  const width=Math.max(...xs)-left+14,height=Math.max(...ys)-top+14;
  const box=[left,top,width,height].map(v=>+v.toFixed(2)).join(' ');
  viewBoxes.set(ex,box);return box;
}
export function figureDefs(id) {
  const gradients = [];
  for (const part of ['th', 'sh', 'ua', 'fa', 'torso', 'skin', 'shoe']) {
    for (const far of [false, true]) for (const highlight of [false, true]) {
      const colors = highlight ? (far ? ['#B8D85A', '#637B1F'] : ['#E9FF9A', '#97BC31'])
        : far ? ['#8796AA', '#435165'] : part === 'shoe' ? ['#9AA9BA', '#455264'] : ['#eeeeec', '#a3a5a6'];
      gradients.push(`<linearGradient id="${id}-${part}-${+far}-${+highlight}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>`);
    }
  }
  return `<defs>${gradients.join('')}<filter id="${id}-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.1"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="${id}-shadow" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="2"/></filter></defs>`;
}

export function renderPose(pose, ex, id = 'figure') {
  const j = solve(pose, ex.view), hl = new Set();
  const regions = exerciseMuscles(ex), primary = new Set(ex.primaryMuscles || regions.slice(0, 1));
  const musclePaint = region => primary.has(region) ? 'var(--muscle-primary)' : regions.includes(region) ? 'var(--muscle-secondary)' : 'var(--muscle-neutral)';
  // Fusiform muscle bellies follow bone coordinates, with a central highlight ridge.
  const belly = (a, b, width, region, offset = 0) => {
    const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len;
    const point=(t,w)=>`${(a[0]+dx*t+nx*(w+offset)).toFixed(2)},${(a[1]+dy*t+ny*(w+offset)).toFixed(2)}`;
    return `<path data-muscle="${region}" d="M${point(.08,0)} C${point(.18,width)},${point(.58,width)},${point(.92,0)} C${point(.65,-width*.65)},${point(.23,-width*.65)},${point(.08,0)}Z" fill="${musclePaint(region)}" stroke="#59616a" stroke-opacity=".3" stroke-width=".45"/><path d="M${point(.2,-width*.15)} Q${point(.45,-width*.45)} ${point(.75,0)}" fill="none" stroke="white" stroke-opacity=".28" stroke-width=".6"/>`;
  };
  const paint = (part, far = false) => `fill="url(#${id}-${part}-${+far}-${+hl.has(part)})" stroke="#536174" stroke-opacity=".22" stroke-width=".5" ${hl.has(part) ? `filter="url(#${id}-glow)"` : ''}`;
  // Tapered capsule: straight sides and rounded joint caps, widths in SVG units.
  const capsule = (a, b, w1, w2, part, far = false) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const pt = (p, w) => `${(p[0] + nx * w).toFixed(2)},${(p[1] + ny * w).toFixed(2)}`;
    const r1 = w1 / 2, r2 = w2 / 2;
    return `<path d="M${pt(a, r1)} L${pt(b, r2)} A${r2},${r2} 0 0 0 ${pt(b, -r2)} L${pt(a, -r1)} A${r1},${r1} 0 0 0 ${pt(a, r1)}Z" ${paint(part, far)}/>`;
  };
  const legs = (leg, foot, far) => capsule(leg[0], leg[1], 15, 10, 'th', far) + capsule(leg[1], leg[2], 10, 7, 'sh', far)
    + belly(leg[0],leg[1],5,'quads',-2) + belly(leg[0],leg[1],3,'hamstrings',3) + belly(leg[1],leg[2],4,'calves')
    + capsule(leg[2], foot || [leg[2][0] + (leg === j.leg1 ? 4 : -4), leg[2][1] + 1], 7, 6, 'shoe', far);
  const arms = (arm, far) => capsule(arm[0], arm[1], 10, 8, 'ua', far) + capsule(arm[1], arm[2], 8, 6, 'fa', far)
    + belly(arm[0],arm[1],3.5,'biceps',-2) + belly(arm[0],arm[1],2.8,'triceps',2.5) + belly(arm[1],arm[2],3,'forearms') + belly(arm[0],along(arm[0],angTo(arm[0],arm[1]),13),4,'front_delts',-2) + belly(arm[0],along(arm[0],angTo(arm[0],arm[1]),13),3,'rear_delts',2)
    + capsule(arm[2], along(arm[2], angTo(arm[1], arm[2]), 3), 6, 5, 'skin', far);
  const far = ex.view !== 'front';
  const behindProps = ['bench', 'box', 'step', 'wall', 'chair', 'mat', 'cable'].filter((p) => String(ex.prop || '').includes(p)).join(' ');
  const handProps = String(ex.prop || '').split(' ').filter((p) => !behindProps.includes(p)).join(' ');
  const t = pose.t ?? 180, front = ex.view === 'front';
  const torsoPoint = (length, width) => along(along(j.hip, t, length), t - 90, width).map((v) => v.toFixed(2)).join(',');
  const torso = [[0, 9], [13, 7], [34, front ? 15 : 10], [44, front ? 14 : 8], [46, 0], [44, front ? -14 : -8], [34, front ? -15 : -10], [13, -7], [0, -9], [-4, 0]];
  const [hx, hy] = j.head;
  const tp=(l,w)=>along(along(j.hip,t,l),t-90,w);
  const anatomy = [-1,1].map(sign=>
    belly(tp(39,sign*1),tp(36,sign*(front?14:9)),6,'chest') +
    belly(tp(44,sign*2),tp(32,sign*10),3,'traps') +
    belly(tp(31,sign*9),tp(12,sign*6),3,'lats') +
    belly(tp(27,sign*6),tp(9,sign*6),2.5,'obliques') +
    [12,19,26].map(l=>belly(tp(l,sign*.6),tp(l,sign*4.5),3,'abs')).join('') +
    belly(tp(10,sign*3),tp(3,sign*5),4,'lower_back')
  ).join('');
  const shorts = `<path d="M${torsoPoint(6,9)} Q${torsoPoint(-3,13)} ${torsoPoint(-12,9)} L${torsoPoint(-10,0)} L${torsoPoint(-12,-9)} Q${torsoPoint(-3,-13)} ${torsoPoint(6,-9)}Z" fill="#242832"/>`;

  return `<ellipse cx="${j.hip[0]}" cy="${Math.max(j.leg1[2][1], j.leg2[2][1]) + 4}" rx="31" ry="4" fill="#17202D" opacity=".2" filter="url(#${id}-shadow)"/>
    ${propSVG(behindProps, j)}${arms(j.arm2, far)}${legs(j.leg2, j.foot2, far)}
    <polygon points="${torso.map(([l, w]) => torsoPoint(l, w)).join(' ')}" ${paint('torso')}/>
    ${anatomy}${legs(j.leg1, j.foot1, false)}${shorts}${belly(tp(3,-5),tp(-6,-5),4,'glutes')}${belly(tp(3,5),tp(-6,5),4,'adductors')}${belly(tp(2,-2),tp(2,2),2,'pelvic_floor')}${capsule(j.neckBase, j.head, 8, 7, 'skin')}
    <path d="M${hx - 9},${hy - 3} Q${hx - 9},${hy - 11} ${hx},${hy - 11} Q${hx + 10},${hy - 11} ${hx + 9},${hy} L${hx + 6},${hy + 8} Q${hx},${hy + 12} ${hx - 6},${hy + 7}Z" ${paint('skin')} transform="rotate(${180 - t} ${hx} ${hy})"/>
    ${belly(j.neckBase,along(j.neckBase,t,8),2,'neck')}${arms(j.arm1, false)}${propSVG(handProps, j)}`;
}

// Mounts a looping animation into a container; returns a stop() function.
const running = new Set();
// Stable topology per exercise: retain SVG nodes and update only changed attributes.
// Definitions, gradients and paths are never rebuilt during a rep.
function bodyPainter(group) {
  let nodes;
  return markup=>{
    if(!nodes){group.innerHTML=markup;nodes=[...group.querySelectorAll('*')];return;}
    let index=0;
    for(const tag of markup.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)){
      const node=nodes[index++];if(!node)continue;
      for(const attr of tag[2].matchAll(/([\w:-]+)="([^"]*)"/g))if(node.getAttribute(attr[1])!==attr[2])node.setAttribute(attr[1],attr[2]);
    }
  };
}
export function animateFigure(el, ex, { speed = 1, paused = false } = {}) {
  if(ex?.images){el.innerHTML=photoHTML(ex);return {stop(){el.innerHTML='';},pause(){el.classList.add('photos-paused');},play(){el.classList.remove('photos-paused');}};}
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { el.innerHTML = startFinishHTML(ex); return {stop(){},pause(){},play(){}}; }
  const id = 'fig-' + ++figureId;
  const frames = ex.frames;
  const durs = ex.dur || frames.map(() => 900);
  el.innerHTML = `<svg viewBox="${figureViewBox(ex)}" class="figure" role="img" aria-label="${ex.id}">${figureDefs(id)}<g class="body"></g><g class="motion-arrow">${arrowSVG(ex)}</g></svg>`;
  const g = el.querySelector('.body'), paintBody = bodyPainter(g);
  const state = { el, stopped: false, paused, t0: performance.now(), offset: 0 };
  const total = durs.reduce((a, b) => a + b, 0);
  const draw = (now) => {
    if (state.stopped) return;
    if (!el.isConnected) { state.stopped = true; running.delete(state); return; }
    let t = state.paused ? state.offset : ((now - state.t0) * speed) % total;
    if (!state.paused) state.offset = t;
    let i = 0;
    while (t > durs[i]) { t -= durs[i]; i++; }
    const a = frames[i], b = frames[(i + 1) % frames.length];
    const hold = ex.hold ? Math.min(1, t / (durs[i] * 0.75)) : t / durs[i];
    const rect=el.getBoundingClientRect?.();
    if (!document.hidden && (!rect || (rect.bottom >= 0 && rect.top <= (globalThis.innerHeight || Infinity)))) {
      paintBody(renderPose(interpolatePose(a, b, ease(hold), ex), ex, id));
      const arrow = el.querySelector('.motion-arrow');
      if (arrow) arrow.style.opacity = String(.25 + .65 * Math.sin(Math.PI * state.offset / total) ** 2);
    }
    requestAnimationFrame(draw);
  };
  if (frames.length === 1) g.innerHTML = renderPose(frames[0], ex, id);
  else requestAnimationFrame(draw);
  running.add(state);
  return {
    stop: () => { state.stopped = true; running.delete(state); },
    pause: () => { state.paused = true; },
    play: () => { state.paused = false; state.t0 = performance.now() - state.offset / speed; },
  };
}
// Static thumbnail (first or mid frame).
export function figureSVG(ex, frameIdx = 1) {
  if(ex?.images)return photoHTML(ex);
  const id = 'fig-' + ++figureId;
  const f = ex.frames[Math.min(frameIdx, ex.frames.length - 1)];
  return `<svg viewBox="${figureViewBox(ex)}" class="figure">${figureDefs(id)}<g class="body">${renderPose(f, ex, id)}</g>${arrowSVG(ex)}</svg>`;
}

// Pick the farthest endpoint/keyframe automatically; explicit overrides stay optional.
export function movementArrow(ex) {
  if (!ex.frames?.length || ex.hold || ['side_plank','kegel','breathing'].includes(ex.id)) return null;
  const at=(j,key)=>({hand1:j.arm1[2],hand2:j.arm2[2],foot1:j.leg1[2],foot2:j.leg2[2],hip:j.hip})[key];
  const start=solve(ex.frames[0],ex.view); let best=null;
  for(let i=1;i<ex.frames.length;i++)for(const key of ex.arrow?.joint?[ex.arrow.joint]:['hand1','hand2','hip','foot1','foot2']) {
    const a=at(start,key),b=at(solve(ex.frames[i],ex.view),key); if(!a||!b)continue;
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length>.1 && (!best||length>best.length))best={a,b,length,peak:i,joint:key};
  }
  if(!best)return null;
  const {a,b,length}=best, bend=ex.arrow?.bend ?? 18;
  const c=[(a[0]+b[0])/2-(b[1]-a[1])/length*bend,(a[1]+b[1])/2+(b[0]-a[0])/length*bend];
  return {...best,c,path:`M${a.join(',')} Q${c.join(',')} ${b.join(',')}`};
}
export function arrowSVG(ex) {
  const arrow=movementArrow(ex);if(!arrow)return '';
  const {b,c}=arrow,angle=Math.atan2(b[1]-c[1],b[0]-c[0]);
  const tip=sign=>[b[0]-7*Math.cos(angle+sign*.5),b[1]-7*Math.sin(angle+sign*.5)].join(',');
  return `<g class="movement-arrow" fill="none" stroke="var(--muscle-primary)" stroke-width="2.5" stroke-linecap="round"><path d="${arrow.path}"/><path d="M${tip(1)} L${b.join(',')} L${tip(-1)}"/></g>`;
}
export function startFinishHTML(ex) {
  if(ex?.images)return photoHTML(ex);
  const peak=movementArrow(ex)?.peak ?? Math.min(1,ex.frames.length-1);
  return `<div class="start-finish">${[0,peak].map((frame,i)=>`<figure>${figureSVG(ex,frame)}<figcaption>${i?L('จบ','Finish'):L('เริ่ม','Start')}</figcaption></figure>`).join('')}</div>`;
}

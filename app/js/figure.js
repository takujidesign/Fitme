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
function lerpVal(a, b, t) {
  if (typeof a === 'number') return lerp(a, b ?? a, t);
  if (Array.isArray(a)) return a.map((v, i) => lerpVal(v, b?.[i], t));
  if (a && typeof a === 'object') {
    const o = {};
    for (const k in a) o[k] = lerpVal(a[k], b?.[k], t);
    return o;
  }
  return a;
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
    if (p === 'mat') out.push('<rect x="14" y="179" width="172" height="5" rx="2.5" class="mat"/>');
    if (p === 'cable') out.push(`<line x1="100" y1="10" x2="${(hands[0][0] + hands[1][0]) / 2}" y2="${(hands[0][1] + hands[1][1]) / 2}" class="prop-t"/>`);
  }
  return out.join('');
}

let figureId = 0;
function figureDefs(id) {
  const gradients = [];
  for (const part of ['th', 'sh', 'ua', 'fa', 'torso', 'skin', 'shoe']) {
    for (const far of [false, true]) for (const highlight of [false, true]) {
      const colors = highlight ? (far ? ['#B8D85A', '#637B1F'] : ['#E9FF9A', '#97BC31'])
        : far ? ['#8796AA', '#435165'] : part === 'shoe' ? ['#9AA9BA', '#455264'] : ['#EFF3F8', '#9DADC1'];
      gradients.push(`<linearGradient id="${id}-${part}-${+far}-${+highlight}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>`);
    }
  }
  return `<defs>${gradients.join('')}<filter id="${id}-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.1"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="${id}-shadow" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="2"/></filter></defs>`;
}

export function renderPose(pose, ex, id = 'figure') {
  const j = solve(pose, ex.view), hl = new Set(ex.hl || []);
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
    + capsule(leg[2], foot || [leg[2][0] + (leg === j.leg1 ? 4 : -4), leg[2][1] + 1], 7, 6, 'shoe', far);
  const arms = (arm, far) => capsule(arm[0], arm[1], 10, 8, 'ua', far) + capsule(arm[1], arm[2], 8, 6, 'fa', far)
    + capsule(arm[2], along(arm[2], angTo(arm[1], arm[2]), 3), 6, 5, 'skin', far);
  const far = ex.view !== 'front';
  const behindProps = ['bench', 'box', 'wall', 'chair', 'mat', 'cable'].filter((p) => String(ex.prop || '').includes(p)).join(' ');
  const handProps = String(ex.prop || '').split(' ').filter((p) => !behindProps.includes(p)).join(' ');
  const t = pose.t ?? 180, front = ex.view === 'front';
  const torsoPoint = (length, width) => along(along(j.hip, t, length), t - 90, width).map((v) => v.toFixed(2)).join(',');
  const torso = [[0, 9], [13, 7], [34, front ? 15 : 10], [44, front ? 14 : 8], [46, 0], [44, front ? -14 : -8], [34, front ? -15 : -10], [13, -7], [0, -9], [-4, 0]];
  const [hx, hy] = j.head;
  return `<ellipse cx="${j.hip[0]}" cy="${Math.max(j.leg1[2][1], j.leg2[2][1]) + 4}" rx="31" ry="4" fill="#17202D" opacity=".2" filter="url(#${id}-shadow)"/>
    ${propSVG(behindProps, j)}${arms(j.arm2, far)}${legs(j.leg2, j.foot2, far)}
    <polygon points="${torso.map(([l, w]) => torsoPoint(l, w)).join(' ')}" ${paint('torso')}/>
    ${legs(j.leg1, j.foot1, false)}${capsule(j.neckBase, j.head, 8, 7, 'skin')}
    <path d="M${hx - 9},${hy - 3} Q${hx - 9},${hy - 11} ${hx},${hy - 11} Q${hx + 10},${hy - 11} ${hx + 9},${hy} L${hx + 6},${hy + 8} Q${hx},${hy + 12} ${hx - 6},${hy + 7}Z" ${paint('skin')} transform="rotate(${180 - t} ${hx} ${hy})"/>
    ${arms(j.arm1, false)}${propSVG(handProps, j)}`;
}

// Mounts a looping animation into a container; returns a stop() function.
const running = new Set();
export function animateFigure(el, ex, { speed = 1, paused = false } = {}) {
  if(ex?.images){el.innerHTML=photoHTML(ex);return {stop(){el.innerHTML='';},pause(){el.classList.add('photos-paused');},play(){el.classList.remove('photos-paused');}};}
  const id = 'fig-' + ++figureId;
  const frames = ex.frames;
  const durs = ex.dur || frames.map(() => 900);
  el.innerHTML = `<svg viewBox="0 0 200 200" class="figure" role="img" aria-label="${ex.id}">${figureDefs(id)}<line x1="6" y1="182" x2="194" y2="182" class="ground"/><g class="body"></g></svg>`;
  const g = el.querySelector('.body');
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
    g.innerHTML = renderPose(lerpVal(a, b, ease(hold)), ex, id);
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
  return `<svg viewBox="0 0 200 200" class="figure">${figureDefs(id)}<line x1="6" y1="182" x2="194" y2="182" class="ground"/><g class="body">${renderPose(f, ex, id)}</g></svg>`;
}

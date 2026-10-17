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

const seg = (a, b, cls, w) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" class="${cls}" stroke-width="${w}"/>`;

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
    if (p === 'box') out.push('<rect x="20" y="146" width="62" height="36" rx="4" class="prop-o"/>');
    if (p === 'mat') out.push('<rect x="14" y="179" width="172" height="5" rx="2.5" class="mat"/>');
    if (p === 'cable') out.push(`<line x1="100" y1="10" x2="${(hands[0][0] + hands[1][0]) / 2}" y2="${(hands[0][1] + hands[1][1]) / 2}" class="prop-t"/>`);
  }
  return out.join('');
}

export function renderPose(pose, ex) {
  const j = solve(pose, ex.view);
  const hl = new Set(ex.hl || []);
  const c = (part, far) => `limb ${far ? 'far' : ''} ${hl.has(part) ? 'hl' : ''}`;
  const W = { torso: 13, ua: 9, fa: 8, th: 11, sh: 9.5, foot: 6 };
  const legs = (leg, foot, far) => seg(leg[0], leg[1], c('th', far), W.th) + seg(leg[1], leg[2], c('sh', far), W.sh) + (foot ? seg(leg[2], foot, c('foot', far), W.foot) : '');
  const arms = (arm, far) => seg(arm[0], arm[1], c('ua', far), W.ua) + seg(arm[1], arm[2], c('fa', far), W.fa);
  const far = ex.view !== 'front';
  const behindProps = ['bench', 'box', 'mat', 'cable'].filter((p) => String(ex.prop || '').includes(p)).join(' ');
  const handProps = String(ex.prop || '').split(' ').filter((p) => !behindProps.includes(p)).join(' ');
  return `${propSVG(behindProps, j)}
    ${arms(j.arm2, far)}${legs(j.leg2, j.foot2, far)}
    ${seg(j.hip, j.neckBase, c('torso'), W.torso)}
    ${ex.view === 'front' ? seg(j.sh1, j.sh2, c('torso'), 9) + seg(j.leg1[0], j.leg2[0], c('torso'), 9) : ''}
    ${legs(j.leg1, j.foot1, false)}
    <circle cx="${j.head[0].toFixed(1)}" cy="${j.head[1].toFixed(1)}" r="${LEN.head}" class="head"/>
    ${arms(j.arm1, false)}${propSVG(handProps, j)}`;
}

// Mounts a looping animation into a container; returns a stop() function.
const running = new Set();
export function animateFigure(el, ex, { speed = 1, paused = false } = {}) {
  const frames = ex.frames;
  const durs = ex.dur || frames.map(() => 900);
  el.innerHTML = `<svg viewBox="0 0 200 200" class="figure" role="img" aria-label="${ex.id}"><line x1="6" y1="182" x2="194" y2="182" class="ground"/><g class="body"></g></svg>`;
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
    g.innerHTML = renderPose(lerpVal(a, b, ease(hold)), ex);
    requestAnimationFrame(draw);
  };
  if (frames.length === 1) g.innerHTML = renderPose(frames[0], ex);
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
  const f = ex.frames[Math.min(frameIdx, ex.frames.length - 1)];
  return `<svg viewBox="0 0 200 200" class="figure"><line x1="6" y1="182" x2="194" y2="182" class="ground"/><g class="body">${renderPose(f, ex)}</g></svg>`;
}

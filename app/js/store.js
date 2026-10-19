import { syncKeys } from './sync-data.js';
// App state in localStorage, images in IndexedDB.
const KEY = 'fitme:v1';
const listeners = new Set();

export const todayISO = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return todayISO(d);
};
export const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

const defaults = () => ({
  lang: (['th','en','zh','ja','vi'].includes((navigator.language||'en').split('-')[0])?(navigator.language||'en').split('-')[0]:'en'),
  onboarded: false, consents: {terms:null,health:null,version:null}, telemetry: true,
  profile: {
    name: '', sex: 'male', age: 30, height: 170, weight: 70, goalWeight: null,
    bodyFat: null, muscle: null, bmrScan: null, visceral: null,
    goal: 'recomp', level: 'beginner', location: 'home',
    trainDays: [1, 3, 5], sessionMin: 45,
    wake: '06:30', bed: '22:30', workoutTime: '18:00',
    avoidEx: [], preferEx: [], fasting: 'none', eatStart: '12:00',
    mealsPerDay: 4, diet: 'normal', exclude: [],
    planDays: 30, startDate: todayISO(),
    program: null, trainerPlan: null,
    womensHealth: {enabled:false,mode:'cycle',lastPeriod:'',cycleLength:28,adjustments:false,weeks:0,cleared:false,breastfeeding:false},
  },
  account: { token:null, user:null, version:0, lastSync:0, error:'' }, updatedAt:{}, chat:[], challenges:[], badges:[], blocks:[], suggestionDecisions:{},
  theme: 'auto', voiceCoach: false, measurements: [], customFoods: [],
  notifications: { enabled: false, deviceId: null, meals: true, supplements: true, workout: true, water: false, medications: true, sleep: true, fasting: true },
  weights: [],
  photos: [], // {id, date, pose}
  supplements: [], // {uid, productId, startDate, photoId, custom?}
  logs: {}, // date -> {done:{eventKey:true}, water, sleep:{bed,wake,quality}, workout:{completed}}
  libraryExercises: {}, extraExercises: {}, freeWorkout: null, restDefault: 60, mealOverrides: {}, mealPrep: [],
  libraryExercises: {}, extraExercises: {}, freeWorkout: null, restDefault: 60, mealOverrides: {}, mealPrep: [],
  dayOverrides: {}, exSwaps: {}, shoppingChecks: {},
  mealSeed: {}, // date|slot -> seed offset for regenerated meals
  premium: { token: null, until: null, exportsLeft: 0, ref: null },
  payments: [],
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const s = JSON.parse(raw);
    const d = defaults();
    return { ...d, ...s, notifications: { ...d.notifications, ...s.notifications }, measurements: s.measurements || [], customFoods: s.customFoods || [], profile: { ...d.profile, ...(s.profile || {}) }, premium: { ...d.premium, ...(s.premium || {}) }, dayOverrides: s.dayOverrides || {}, exSwaps: s.exSwaps || {}, shoppingChecks: s.shoppingChecks || {} };
  } catch {
    return defaults();
  }
}

export const getState = () => state;

export function setState(mutator, {remote = false} = {}) {
  const before = remote ? null : Object.fromEntries(syncKeys.map(k=>[k, JSON.stringify(state[k])]));
  const rows = remote ? null : Object.fromEntries(['logs','foodLog','supplements','weights','measurements','customFoods'].map(k=>[k, structuredClone(state[k] || (['logs','foodLog'].includes(k)?{}:[]))]));
  mutator(state);
  if (!remote) {
    const now=Date.now();state.updatedAt ||= {};
    for(const k of syncKeys) if(before[k]!==JSON.stringify(state[k])) {
      state.updatedAt[k]=now;
      if(rows[k]) {
        if(Array.isArray(state[k])) { const id=v=>v.uid||v.id||v.date;const old=new Map(rows[k].map(v=>[id(v),JSON.stringify(v)]));for(const v of state[k])if(old.get(id(v))!==JSON.stringify(v))v.updatedAt=now; }
        else for(const [id,v] of Object.entries(state[k]||{}))if(v && typeof v==='object' && JSON.stringify(rows[k][id])!==JSON.stringify(v))v.updatedAt=now;
      }
    }
  }
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
  listeners.forEach((fn) => fn(state, {remote}));
}
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function dayLog(date) {
  return state.logs[date] || { done: {}, water: 0 };
}
export function updateLog(date, fn) {
  setState((s) => {
    const l = s.logs[date] || { done: {}, water: 0 };
    fn(l);
    s.logs[date] = l;
  });
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = defaults();
  return idbClear();
}
export function importState(obj) {
  const d = defaults();
  setState((s) => Object.assign(s, d, obj, { notifications: { ...d.notifications, ...obj.notifications }, measurements: obj.measurements || [], customFoods: obj.customFoods || [], profile: { ...d.profile, ...obj.profile }, premium: { ...d.premium, ...s.premium, ...obj.premium }, dayOverrides: obj.dayOverrides || {}, exSwaps: obj.exSwaps || {}, shoppingChecks: obj.shoppingChecks || {} }));
}

// ---------- IndexedDB for images ----------
let dbp;
function db() {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('fitme', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('images');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('images', mode);
    const req = fn(t.objectStore('images'));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}
export const putImage = (id, blob) => tx('readwrite', (s) => s.put(blob, id));
export const getImage = (id) => tx('readonly', (s) => s.get(id));
export const delImage = (id) => tx('readwrite', (s) => s.delete(id));
const idbClear = () => tx('readwrite', (s) => s.clear()).catch(() => {});

const urlCache = new Map();
export async function imageURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const b = await getImage(id).catch(() => null);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(id, u);
  return u;
}

// Downscale a user photo to keep storage small.
export async function compressImage(file, max = 1280, quality = 0.82) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', quality));
}
export const blobToBase64 = (blob) => new Promise((res) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.readAsDataURL(blob);
});
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

'use strict';
/* LIFT 3: offline workout tracker, calorie tracker and on-device coach */
const VERSION = '3.1.0';
const KEY = 'lift3:data';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const z = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const pkey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = pkey(k); d.setDate(d.getDate() + n); return dkey(d); };
const dayDiff = (a, b) => Math.round((pkey(b) - pkey(a)) / 864e5);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const r1 = n => Math.round(n * 10) / 10;
const kg = w => String(+(+w || 0).toFixed(2));
const roundTo = (x, inc) => Math.round(x / inc) * inc;
function fmt(n, d = 0) {
  n = Number(n) || 0;
  const [i, f] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? '.' + f : '');
}
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const shortDate = k => { const d = pkey(k); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const longDate = k => { const d = pkey(k); return `${DOW[d.getDay()]} ${d.getDate()} ${MONL[d.getMonth()]}`; };
function relDate(k) { const n = dayDiff(k, dkey()); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : n < 7 ? `${n} days ago` : shortDate(k); }
const mmss = s => `${Math.floor(s / 60)}:${z(Math.max(0, s % 60))}`;
const haptic = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

/* ================= icons ================= */
const sv = (d, sw = 2) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  today: sv('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  train: sv('<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>'),
  food: sv('<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4"/><path d="M17 21V3c-2 0-3 3-3 7s1 4 3 4"/>'),
  coach: sv('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>'),
  progress: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  plus: sv('<path d="M12 5v14M5 12h14"/>'),
  check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
  x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  left: sv('<path d="M15 5l-7 7 7 7"/>'),
  right: sv('<path d="M9 5l7 7-7 7"/>'),
  spark: sv('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  send: sv('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.4),
  trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
};

/* ================= exercise library ================= */
// type: wr = weight x reps, r = reps, t = seconds, ladder = progression ladder, round = timed rounds (minutes)
const EX = {
  bsq: { name: 'Barbell back squat', type: 'wr', m: ['quads', 'glutes', 'core'], inc: 2.5, sets: 4, lo: 5, hi: 8, rest: 150 },
  db_bench: { name: 'Dumbbell bench press', type: 'wr', m: ['chest', 'triceps', 'shoulders'], inc: 2, sets: 4, lo: 6, hi: 10, rest: 150 },
  db_incline: { name: 'Incline dumbbell press', type: 'wr', m: ['chest', 'shoulders', 'triceps'], inc: 2, sets: 3, lo: 8, hi: 12, rest: 105 },
  db_ohp: { name: 'Seated dumbbell shoulder press', type: 'wr', m: ['shoulders', 'triceps'], inc: 2, sets: 4, lo: 6, hi: 10, rest: 150 },
  db_lat: { name: 'Dumbbell lateral raise', type: 'wr', m: ['shoulders'], inc: 1, sets: 3, lo: 12, hi: 20, rest: 60 },
  cable_lat: { name: 'Cable or dumbbell lateral raise', type: 'wr', m: ['shoulders'], inc: 1, sets: 4, lo: 12, hi: 20, rest: 60 },
  face_pull: { name: 'Face pull', type: 'wr', m: ['shoulders', 'back'], inc: 2.5, sets: 3, lo: 15, hi: 20, rest: 60 },
  cable_fly: { name: 'Cable fly', type: 'wr', m: ['chest'], inc: 2.5, sets: 2, lo: 12, hi: 15, rest: 60 },
  db_tri: { name: 'Overhead dumbbell triceps extension', type: 'wr', m: ['triceps'], inc: 2, sets: 2, lo: 10, hi: 15, rest: 60 },
  db_floor: { name: 'Dumbbell floor press', type: 'wr', m: ['chest', 'triceps'], inc: 2, sets: 3, lo: 8, hi: 12, rest: 105 },
  db_row: { name: 'One-arm dumbbell row (each arm)', type: 'wr', m: ['back', 'biceps'], inc: 2, sets: 3, lo: 10, hi: 12, rest: 90 },
  cs_row: { name: 'Chest-supported dumbbell row', type: 'wr', m: ['back', 'biceps', 'shoulders'], inc: 2, sets: 4, lo: 8, hi: 12, rest: 120 },
  cable_row: { name: 'Seated cable row', type: 'wr', m: ['back', 'biceps'], inc: 5, sets: 3, lo: 10, hi: 12, rest: 90 },
  bb_row: { name: 'Barbell row', type: 'wr', m: ['back', 'biceps'], inc: 2.5, sets: 3, lo: 8, hi: 12, rest: 105 },
  latpd: { name: 'Lat pulldown', type: 'wr', m: ['back', 'biceps'], inc: 5, sets: 3, lo: 8, hi: 12, rest: 90 },
  latpd_wide: { name: 'Lat pulldown (wide grip)', type: 'wr', m: ['back', 'biceps'], inc: 5, sets: 4, lo: 8, hi: 12, rest: 120 },
  db_rear: { name: 'Rear delt fly', type: 'wr', m: ['shoulders', 'back'], inc: 1, sets: 3, lo: 15, hi: 20, rest: 60 },
  db_curl: { name: 'Dumbbell curl', type: 'wr', m: ['biceps'], inc: 2, sets: 3, lo: 10, hi: 12, rest: 60 },
  db_hammer: { name: 'Hammer curl', type: 'wr', m: ['biceps'], inc: 2, sets: 2, lo: 10, hi: 15, rest: 60 },
  db_rdl: { name: 'Dumbbell Romanian deadlift', type: 'wr', m: ['hamstrings', 'glutes', 'back'], inc: 2, sets: 3, lo: 8, hi: 10, rest: 120 },
  rdl_bb: { name: 'Romanian deadlift', type: 'wr', m: ['hamstrings', 'glutes', 'back'], inc: 2.5, sets: 4, lo: 6, hi: 10, rest: 150 },
  legcurl: { name: 'Leg curl', type: 'wr', m: ['hamstrings'], inc: 5, sets: 3, lo: 10, hi: 15, rest: 60 },
  farmer: { name: "Farmer's carry", type: 'wr', unit: 'm', m: ['core'], inc: 2, sets: 3, lo: 30, hi: 40, rest: 60 },
  bss: { name: 'Bulgarian split squat (each leg)', type: 'wr', m: ['quads', 'glutes'], inc: 2, sets: 3, lo: 8, hi: 12, rest: 90 },
  goblet: { name: 'Goblet squat', type: 'wr', m: ['quads', 'glutes'], inc: 2, sets: 3, lo: 10, hi: 15, rest: 90 },
  lunge: { name: 'Walking lunge (each leg)', type: 'wr', m: ['quads', 'glutes'], inc: 2, sets: 2, lo: 10, hi: 12, rest: 90 },
  legpress: { name: 'Leg press', type: 'wr', m: ['quads', 'glutes'], inc: 5, sets: 3, lo: 10, hi: 15, rest: 120 },
  calf: { name: 'Standing calf raise', type: 'wr', m: ['calves'], inc: 2, sets: 3, lo: 12, hi: 20, rest: 60 },
  l_push: { name: 'Push-up ladder', type: 'ladder', ladder: 'push', m: ['chest', 'triceps', 'shoulders'], sets: 3, rest: 90 },
  l_pull: { name: 'Pull-up ladder', type: 'ladder', ladder: 'pull', m: ['back', 'biceps'], sets: 3, rest: 120 },
  l_dip: { name: 'Dip ladder', type: 'ladder', ladder: 'dip', m: ['triceps', 'chest', 'shoulders'], sets: 3, rest: 90 },
  abwheel: { name: 'Ab wheel rollout', type: 'r', m: ['core'], sets: 3, lo: 8, hi: 12, rest: 60 },
  hlr: { name: 'Hanging knee or leg raise', type: 'r', m: ['core'], sets: 3, lo: 10, hi: 15, rest: 60 },
  plank: { name: 'Plank', type: 't', m: ['core'], sets: 3, lo: 30, hi: 60, rest: 45 },
  rope: { name: 'Skipping rounds', type: 'round', m: ['cardio'], sets: 8, lo: 0.5, hi: 3, rest: 60 },
  bag: { name: 'Heavy bag rounds', type: 'round', m: ['cardio'], sets: 6, lo: 2, hi: 3, rest: 60 },
  shadow: { name: 'Shadow boxing rounds', type: 'round', m: ['cardio'], sets: 3, lo: 2, hi: 3, rest: 60 },
  rope_wu: { name: 'Skipping warm-up', type: 'round', m: ['cardio'], sets: 1, lo: 5, hi: 5, rest: 30, fixed: 'Easy skipping for 5 min to warm up. Stay light on your feet.' },
  bag8: { name: 'Heavy bag rounds', type: 'round', m: ['cardio'], sets: 6, lo: 3, hi: 3, rest: 60 },
  shadow_cd: { name: 'Shadow boxing cool-down', type: 'round', m: ['cardio'], sets: 1, lo: 5, hi: 5, rest: 0, fixed: 'Easy shadow boxing for 5 min. Bring your breathing down.' },
  bike_spr: { name: 'Bike sprints (70 s easy between)', type: 't', m: ['cardio'], sets: 6, lo: 20, hi: 30, rest: 70 },
  bike_z2: { name: 'Steady bike or 2–3 km run', type: 'round', m: ['cardio'], sets: 1, lo: 35, hi: 45, step: 5, steady: true, rest: 0 },
};
const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core', 'cardio'];

const LADDERS = {
  push: [
    { name: 'Wall push-up', sets: 3, reps: 20 }, { name: 'High incline push-up', sets: 3, reps: 15 },
    { name: 'Low incline push-up', sets: 3, reps: 15 }, { name: 'Knee push-up', sets: 3, reps: 15 },
    { name: 'Full push-up', sets: 3, reps: 12 }, { name: 'Wide push-up', sets: 3, reps: 12 },
    { name: 'Diamond push-up', sets: 3, reps: 10 }, { name: 'Decline push-up', sets: 3, reps: 10 },
    { name: 'Archer push-up (each side)', sets: 3, reps: 6 }, { name: 'Assisted one-arm push-up (each side)', sets: 3, reps: 5 },
  ],
  pull: [
    { name: 'Dead hang', sets: 3, reps: 30, unit: 's' }, { name: 'Scapular pull', sets: 3, reps: 10 },
    { name: 'Inverted row, high bar', sets: 3, reps: 12 }, { name: 'Inverted row, low bar', sets: 3, reps: 12 },
    { name: 'Jumping pull-up', sets: 3, reps: 8 }, { name: 'Negative pull-up (5 s down)', sets: 3, reps: 5 },
    { name: 'Pull-up', sets: 3, reps: 5 }, { name: 'Pull-up', sets: 3, reps: 10 },
    { name: 'Chin-up with 2 s pause', sets: 3, reps: 8 }, { name: 'Weighted pull-up', sets: 3, reps: 6 },
  ],
  dip: [
    { name: 'Top support hold', sets: 3, reps: 30, unit: 's' }, { name: 'Bench dip', sets: 3, reps: 15 },
    { name: 'Foot-assisted dip', sets: 3, reps: 10 }, { name: 'Negative dip (5 s down)', sets: 3, reps: 6 },
    { name: 'Parallel bar dip', sets: 3, reps: 8 }, { name: 'Parallel bar dip', sets: 3, reps: 15 },
    { name: 'Weighted dip', sets: 3, reps: 8 },
  ],
};
const LADDER_NAME = { push: 'Push-up', pull: 'Pull-up', dip: 'Dip' };

const DEFAULT_PROG = {
  schedule: { 1: 'upperA', 2: 'lowerA', 3: 'cardioA', 4: 'upperB', 5: 'lowerB', 6: 'cardioB' },
  gym: {
    upperA: { name: 'Upper A: Chest & Back', color: 'red', ex: ['db_bench', 'cs_row', 'l_pull', 'db_incline', 'cable_row', 'db_lat', 'face_pull'] },
    lowerA: { name: 'Lower A: Squat', color: 'yellow', ex: ['bsq', 'db_rdl', 'bss', 'legcurl', 'calf', 'abwheel'] },
    cardioA: { name: 'Cardio A: Boxing Intervals', color: 'green', cardio: true, ex: ['rope_wu', 'bag8', 'shadow_cd'] },
    upperB: { name: 'Upper B: Shoulders & Width', color: 'blue', ex: ['db_ohp', 'latpd_wide', 'l_dip', 'db_row', 'cable_lat', 'db_rear', 'cable_fly', 'db_hammer', 'db_tri'] },
    lowerB: { name: 'Lower B: Hinge & Finisher', color: 'white', ex: ['rdl_bb', 'legpress', 'lunge', 'hlr', 'farmer', 'bike_spr'] },
    cardioB: { name: 'Cardio B: Steady', color: 'green', cardio: true, ex: ['bike_z2'] },
  },
  home: {
    upperA: { name: 'Upper A: Chest & Back', color: 'red', ex: ['db_floor', 'bb_row', 'l_pull', 'l_push', 'db_row', 'db_lat', 'db_rear'] },
    lowerA: { name: 'Lower A: Squat', color: 'yellow', ex: ['bsq', 'db_rdl', 'bss', 'calf', 'abwheel'] },
    cardioA: { name: 'Cardio A: Boxing Intervals', color: 'green', cardio: true, ex: ['rope_wu', 'bag8', 'shadow_cd'] },
    upperB: { name: 'Upper B: Shoulders & Width', color: 'blue', ex: ['db_ohp', 'l_pull', 'l_dip', 'db_row', 'cable_lat', 'db_rear', 'db_hammer', 'db_tri'] },
    lowerB: { name: 'Lower B: Hinge & Finisher', color: 'white', ex: ['rdl_bb', 'goblet', 'lunge', 'hlr', 'farmer', 'bike_spr'] },
    cardioB: { name: 'Cardio B: Steady', color: 'green', cardio: true, ex: ['bike_z2'] },
  },
};
const DAY_ORDER = ['upperA', 'lowerA', 'cardioA', 'upperB', 'lowerB', 'cardioB'];
const isCardioDay = w => { const d = S.prog[w.mode] && S.prog[w.mode][w.dayId]; return w.dayId === 'boxing' || !!(d && d.cardio); };

/* ================= food library (typical values; check packaging) ================= */
const FOODS = [
  { id: 'egg', name: 'Egg, large', unit: 'each', base: 1, kcal: 72, p: 6.3, c: 0.4, f: 4.8, serve: 2 },
  { id: 'rice', name: 'White rice, cooked', unit: 'g', base: 100, kcal: 130, p: 2.7, c: 28.2, f: 0.3, serve: 150 },
  { id: 'sweetpot', name: 'Sweet potato, roasted', unit: 'g', base: 100, kcal: 90, p: 2, c: 20.7, f: 0.2, serve: 150 },
  { id: 'thigh', name: 'Chicken thigh, skinless, cooked', unit: 'g', base: 100, kcal: 209, p: 26, c: 0, f: 10.9, serve: 150 },
  { id: 'breast', name: 'Chicken breast, cooked', unit: 'g', base: 100, kcal: 165, p: 31, c: 0, f: 3.6, serve: 150 },
  { id: 'mince', name: 'Beef mince, cooked, drained', unit: 'g', base: 100, kcal: 250, p: 26, c: 0, f: 15.4, serve: 120 },
  { id: 'veg', name: 'Frozen mixed veg, cooked', unit: 'g', base: 100, kcal: 65, p: 2.9, c: 13, f: 0.2, serve: 100 },
  { id: 'pap', name: 'Pap (stiff), cooked', unit: 'g', base: 100, kcal: 110, p: 2.5, c: 23.5, f: 0.5, serve: 200 },
  { id: 'oats', name: 'Rolled oats, dry', unit: 'g', base: 100, kcal: 379, p: 13.2, c: 67.7, f: 6.5, serve: 50 },
  { id: 'milk', name: 'Full cream milk', unit: 'ml', base: 100, kcal: 64, p: 3.3, c: 4.7, f: 3.5, serve: 250 },
  { id: 'bread', name: 'Brown bread, slice', unit: 'each', base: 1, kcal: 90, p: 3.7, c: 15.6, f: 1.1, serve: 2 },
  { id: 'pb', name: 'Peanut butter', unit: 'g', base: 100, kcal: 588, p: 25, c: 20, f: 50, serve: 16 },
  { id: 'banana', name: 'Banana, medium', unit: 'each', base: 1, kcal: 105, p: 1.3, c: 27, f: 0.4, serve: 1 },
  { id: 'apple', name: 'Apple, medium', unit: 'each', base: 1, kcal: 95, p: 0.5, c: 25, f: 0.3, serve: 1 },
  { id: 'whey', name: 'Whey protein, 30 g scoop', unit: 'each', base: 1, kcal: 120, p: 24, c: 3, f: 1.5, serve: 1 },
  { id: 'tuna', name: 'Tuna in water, drained', unit: 'g', base: 100, kcal: 116, p: 25.5, c: 0, f: 0.8, serve: 120 },
  { id: 'pilchards', name: 'Pilchards in tomato sauce', unit: 'g', base: 100, kcal: 145, p: 17, c: 2.5, f: 7.5, serve: 155 },
  { id: 'beans', name: 'Baked beans in tomato sauce', unit: 'g', base: 100, kcal: 85, p: 4.7, c: 14, f: 0.4, serve: 200 },
  { id: 'yoghurt', name: 'Plain low-fat yoghurt', unit: 'g', base: 100, kcal: 63, p: 5.3, c: 7, f: 1.6, serve: 175 },
  { id: 'lentils', name: 'Lentils, cooked', unit: 'g', base: 100, kcal: 116, p: 9, c: 20, f: 0.4, serve: 150 },
  { id: 'potato', name: 'Potato, boiled', unit: 'g', base: 100, kcal: 87, p: 1.9, c: 20, f: 0.1, serve: 200 },
  { id: 'cheddar', name: 'Cheddar cheese', unit: 'g', base: 100, kcal: 403, p: 25, c: 1.3, f: 33, serve: 30 },
  { id: 'oil', name: 'Cooking oil, tablespoon', unit: 'each', base: 1, kcal: 124, p: 0, c: 0, f: 14, serve: 1 },
];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

/* ================= state ================= */
function fresh() {
  return {
    v: 2, profile: null, targets: null, mode: 'gym', prog: clone(DEFAULT_PROG),
    ladders: { push: 1, pull: 1, dip: 1 }, workouts: [], bw: [], food: {}, customFoods: [], customEx: {},
    recent: [], cardio: [], chat: [], settings: { rest: 90, hideInstall: false, lastDeload: null }, active: null,
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw); const f = fresh();
      const out = Object.assign(f, d, { settings: Object.assign(f.settings, d.settings || {}) });
      if (!d.v || d.v < 2) { out.prog = clone(DEFAULT_PROG); out.v = 2; } // switch to the upper/lower hybrid programme
      return out;
    }
  } catch (e) {}
  return fresh();
}
let S = load();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer); saveTimer = null;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Storage is full. Export a backup in Settings.'); }
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }

const getEx = id => EX[id] || S.customEx[id] || null;
const foodById = id => S.customFoods.find(f => f.id === id) || FOODS.find(f => f.id === id) || null;
const sortedBW = () => [...S.bw].sort((a, b) => (a.date < b.date ? -1 : 1));
const latestWeight = () => { const b = sortedBW(); return b.length ? b[b.length - 1].kg : (S.profile && S.profile.weight) || null; };
function ladderLevel(l) { return LADDERS[l][clamp(S.ladders[l] || 1, 1, LADDERS[l].length) - 1]; }
function exName(id) { const d = getEx(id); if (!d) return id; return d.type === 'ladder' ? ladderLevel(d.ladder).name : d.name; }
function unitOf(d) { if (d.unit) return d.unit; if (d.type === 'ladder') return ladderLevel(d.ladder).unit === 's' ? 's' : 'reps'; return d.type === 't' ? 's' : d.type === 'round' ? 'min' : 'reps'; }
function scheduledDay(d = new Date()) { return S.prog.schedule[d.getDay()] || null; }
function nextSessionText() {
  const prog = S.prog[S.mode];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const id = scheduledDay(d);
    if (id && prog[id]) return i === 1 ? `${prog[id].name} tomorrow` : `${prog[id].name} on ${DOW[d.getDay()]}`;
  }
  return 'nothing scheduled';
}
function dayTotals(k) { const t = { kcal: 0, p: 0, c: 0, f: 0 }; for (const e of S.food[k] || []) { t.kcal += e.kcal; t.p += e.p; t.c += e.c; t.f += e.f; } return t; }

/* ================= coach engine (runs fully on-device) ================= */
const strengthEx = d => d && d.type === 'wr' && !d.unit;
const e1rm = (w, r) => (num(r) > 0 && num(w) > 0 ? num(w) * (1 + Math.min(num(r), 12) / 30) : 0);
const bestE1 = e => e.sets.reduce((b, s) => Math.max(b, e1rm(s.w, s.r)), 0);
const bestReps = e => e.sets.reduce((b, s) => Math.max(b, num(s.r)), 0);
function entriesFor(id) {
  const out = [];
  for (const w of S.workouts) { const e = w.ex.find(x => x.id === id); if (e && e.sets.length) out.push({ date: w.date, ts: w.ts, e }); }
  return out.sort((a, b) => a.ts - b.ts);
}
const lastEntry = id => { const h = entriesFor(id); return h.length ? h[h.length - 1].e : null; };

function recommend(id) {
  const d = getEx(id); if (!d) return null;
  const hist = entriesFor(id);
  if (d.type === 'ladder') {
    const L = LADDERS[d.ladder], lvl = S.ladders[d.ladder], lv = ladderLevel(d.ladder), u = lv.unit === 's' ? ' s' : '';
    const last = hist.length ? hist[hist.length - 1].e : null;
    const atLevel = last && last.level === lvl;
    if (atLevel) {
      const hit = last.sets.length >= lv.sets && last.sets.every(s => num(s.r) >= lv.reps);
      if (hit && lvl < L.length) return { r: lv.reps, tag: 'up', levelUp: true, text: `You cleared ${lv.sets} × ${lv.reps}${u} last time. Move up to level ${lvl + 1}: ${L[lvl].name}.` };
      if (hit) return { r: lv.reps, tag: 'up', text: `Top of the ladder. Add load or slow the lowering phase to keep progressing.` };
      return { r: lv.reps, tag: 'hold', text: `Goal: ${lv.sets} × ${lv.reps}${u}. Your best set last time was ${bestReps(last)}${u}. Add one rep where you can.` };
    }
    return { r: lv.reps, tag: 'hold', text: `Goal at this level: ${lv.sets} × ${lv.reps}${u}. When you hit every set, move up.` };
  }
  if (d.fixed) return { r: d.lo, tag: 'hold', text: d.fixed };
  const ru = d.unit === 'm' ? ' m' : ' reps';
  if (!hist.length) {
    if (d.type === 'wr') return { w: null, r: d.lo, tag: 'new', text: d.unit === 'm' ? `First time: carry the heaviest dumbbells you can hold for ${d.lo} m without your grip slipping.` : `First time: pick a weight you can lift for ${d.lo} clean reps with 2 left in the tank.` };
    if (d.steady) return { r: d.lo, tag: 'new', text: `Aim for ${fmtMin(d.lo)} at a pace where you can still talk in full sentences.` };
    if (d.type === 'round') return { r: d.lo, tag: 'new', text: `Start with ${d.sets} rounds of ${fmtMin(d.lo)} and 60 s rest.` };
    return { r: d.lo, tag: 'new', text: `Aim for ${d.sets} × ${d.lo}${d.type === 't' ? ' s' : ''} with good form.` };
  }
  const last = hist[hist.length - 1].e;
  const sets = last.sets.filter(s => num(s.r) > 0);
  if (d.type === 'wr') {
    const w = Math.max(...sets.map(s => num(s.w)));
    const work = sets.filter(s => num(s.w) >= w);
    const allTop = work.length >= d.sets && work.every(s => num(s.r) >= d.hi);
    const under = e => { const tw = Math.max(...e.sets.map(s => num(s.w))); return { tw, low: e.sets.filter(s => num(s.w) >= tw).every(s => num(s.r) < d.lo) }; };
    if (allTop) return { w: +(w + d.inc).toFixed(2), r: d.lo, tag: 'up', text: `You hit ${d.hi}${ru} on every set. Go up to ${kg(w + d.inc)} kg and aim for ${d.lo}${ru}.` };
    const u1 = under(last), u0 = hist.length > 1 ? under(hist[hist.length - 2].e) : null;
    if (u1.low && u0 && u0.low && u0.tw === u1.tw) {
      const nw = Math.max(d.inc, roundTo(w * 0.9, d.inc));
      return { w: nw, r: d.lo, tag: 'down', text: `Two sessions under ${d.lo}${ru} at ${kg(w)} kg. Drop to ${kg(nw)} kg and build back up.` };
    }
    const minR = Math.min(...work.map(s => num(s.r)));
    const goal = Math.min(d.hi, Math.max(d.lo, minR + (d.unit === 'm' ? 5 : 1)));
    return { w, r: goal, tag: 'hold', text: `Stay at ${kg(w)} kg. Get your weakest set from ${minR} to ${goal}${ru}. Hit ${d.hi} on every set and you go up.` };
  }
  if (d.type === 'round') {
    const m = Math.max(...sets.map(s => num(s.r))), step = d.step || 0.5;
    if (d.steady) return m >= d.hi ? { r: d.hi, tag: 'up', text: `${fmtMin(d.hi)} done last time. Keep it there, at a talking pace.` } : { r: Math.min(d.hi, m + step), tag: 'hold', text: `Last time ${fmtMin(m)}. Aim for ${fmtMin(Math.min(d.hi, m + step))} at a pace where you can still talk.` };
    if (m >= d.hi && sets.length >= d.sets) return { r: d.hi, tag: 'up', text: `Full ${fmtMin(d.hi)} rounds done. Add a round or cut rest to 45 s.` };
    const nm = Math.min(d.hi, m + step);
    return { r: nm, tag: 'hold', text: `Last time: ${sets.length} rounds of ${fmtMin(m)}. Try ${fmtMin(nm)} rounds today.` };
  }
  const best = Math.max(...sets.map(s => num(s.r))), minR = Math.min(...sets.map(s => num(s.r)));
  const u = d.type === 't' ? ' s' : '';
  if (minR >= d.hi) return { r: d.hi, tag: 'up', text: d.type === 't' ? `${d.hi} s on every set. Make it harder: lift one foot or reach your arms forward.` : `${d.hi}+ on every set. Slow the tempo or make the movement harder.` };
  const step = d.type === 't' ? 5 : 1;
  return { r: Math.min(d.hi, minR + step), tag: 'hold', text: `Best last time ${best}${u}. Get every set to ${Math.min(d.hi, minR + step)}${u}.` };
}
function fmtMin(m) { m = num(m); return m < 1 ? `${Math.round(m * 60)} s` : `${+m.toFixed(1)} min`; }
function targetFor(e) {
  const d = getEx(e.id); const rec = recommend(e.id);
  if (d.type === 'ladder') return ladderLevel(d.ladder).reps;
  return rec && rec.r ? rec.r : d.lo;
}
function restFor(d) { return d.rest || S.settings.rest || 90; }

function linreg(pts) {
  const n = pts.length; if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; }
  const den = n * sxx - sx * sx; if (!den) return null;
  const m = (n * sxy - sx * sy) / den; return { m, b: (sy - m * sx) / n };
}
function weightTrend(windowDays = 28) {
  const bw = sortedBW(); if (bw.length < 2) return null;
  const last = bw[bw.length - 1]; const from = addDays(last.date, -windowDays);
  const pts = bw.filter(b => b.date >= from).map(b => ({ x: dayDiff(from, b.date), y: b.kg }));
  const span = pts.length ? pts[pts.length - 1].x - pts[0].x : 0;
  if (pts.length < 3 || span < 6) return { latest: last.kg, rate: null, n: pts.length, span };
  const lr = linreg(pts); const rate = lr.m * 7;
  return { latest: last.kg, rate, pct: (rate / last.kg) * 100, n: pts.length, span };
}
function nutritionSummary(days = 7) {
  const tk = dkey(); let n = 0, k = 0, p = 0;
  for (let i = 1; i <= days; i++) { const d = addDays(tk, -i); if ((S.food[d] || []).length) { const t = dayTotals(d); n++; k += t.kcal; p += t.p; } }
  return n ? { n, kcal: k / n, p: p / n } : { n: 0 };
}
function adaptiveTDEE() {
  const tk = dkey(), days = 21, from = addDays(tk, -days);
  let n = 0, k = 0;
  for (let i = 1; i <= days; i++) { const d = addDays(tk, -i); if ((S.food[d] || []).length) { n++; k += dayTotals(d).kcal; } }
  if (n < 10) return { need: `${10 - n} more days of food logs` };
  const pts = sortedBW().filter(b => b.date >= from && b.date < tk).map(b => ({ x: dayDiff(from, b.date), y: b.kg }));
  if (pts.length < 4 || pts[pts.length - 1].x - pts[0].x < 10) return { need: 'at least 4 weigh-ins spread over two weeks' };
  const lr = linreg(pts); const avg = k / n; const est = avg - lr.m * 7700;
  if (est < 1200 || est > 6000) return { need: 'more complete food logs (the numbers do not add up yet)' };
  return { est, avg, rate: lr.m * 7, n };
}
function weeklySets() {
  const tk = dkey(), m = {};
  for (const w of S.workouts) {
    if (dayDiff(w.date, tk) >= 7) continue;
    for (const e of w.ex) {
      const d = getEx(e.id); if (!d || d.type === 'round' || d.m[0] === 'cardio') continue;
      d.m.forEach((mu, i) => { m[mu] = (m[mu] || 0) + e.sets.length * (i === 0 ? 1 : 0.5); });
    }
  }
  return m;
}
function stalledLifts() {
  const ids = new Set(); S.workouts.forEach(w => w.ex.forEach(e => { const d = getEx(e.id); if (strengthEx(d)) ids.add(e.id); }));
  const out = [];
  ids.forEach(id => {
    const h = entriesFor(id).map(x => bestE1(x.e)); if (h.length < 4) return;
    const recent = Math.max(...h.slice(-3)), prior = Math.max(...h.slice(0, -3));
    if (recent <= prior * 1.005) out.push(id);
  });
  return out;
}
function prsIn(w) {
  const out = [];
  for (const e of w.ex) {
    const d = getEx(e.id); if (!strengthEx(d)) continue;
    let prior = 0; for (const x of S.workouts) { if (x.ts >= w.ts) continue; const pe = x.ex.find(y => y.id === e.id); if (pe) prior = Math.max(prior, bestE1(pe)); }
    const b = bestE1(e); if (prior > 0 && b > prior + 0.01) out.push({ id: e.id, e1: b, prior });
  }
  return out;
}
function liftWeeksStreak() {
  let streak = 0; const tk = dkey();
  for (let k = 0; k < 20; k++) {
    const end = addDays(tk, -7 * k), start = addDays(end, -6);
    const n = S.workouts.filter(w => !isCardioDay(w) && w.date >= start && w.date <= end).length;
    if (n >= 3) streak++; else if (k === 0) continue; else break;
  }
  return streak;
}
function ladderStatus() {
  const used = new Set(); Object.values(S.prog[S.mode]).forEach(d => d.ex.forEach(id => { const x = getEx(id); if (x && x.type === 'ladder') used.add(x.ladder); }));
  return [...used].map(l => { const id = Object.keys(EX).find(k => EX[k].ladder === l); return { l, id, lvl: S.ladders[l], max: LADDERS[l].length, lv: ladderLevel(l), rec: recommend(id) }; });
}
function impactCheck() {
  const tk = dkey(), dates = new Set(); let runs = 0, rope = 0;
  S.cardio.forEach(c => { if (dayDiff(c.date, tk) > 14) return; if (c.type === 'Skipping' || c.type === 'Running') dates.add(c.date); if (dayDiff(c.date, tk) < 7) { if (c.type === 'Running') runs++; if (c.type === 'Skipping') rope++; } });
  S.workouts.forEach(w => { if (dayDiff(w.date, tk) > 14) return; if (w.ex.some(e => e.id === 'rope' || e.id === 'rope_wu')) { dates.add(w.date); if (dayDiff(w.date, tk) < 7) rope++; } });
  const ds = [...dates].sort(); let b2b = false;
  for (let i = 1; i < ds.length; i++) if (dayDiff(ds[i - 1], ds[i]) === 1) b2b = true;
  return { b2b, runs, rope };
}
function planMinutes(day) { let s = 0; day.ex.forEach(id => { const d = getEx(id); if (!d) return; const n = d.type === 'ladder' ? ladderLevel(d.ladder).sets : d.sets; s += n * (restFor(d) + (d.type === 'round' ? num(d.hi) * 60 : 40)); }); return Math.round(s / 60 / 5) * 5; }

function insights() {
  const out = [], tk = dkey(), T = S.targets, P = S.profile || {};
  const id = scheduledDay(), day = id && S.prog[S.mode][id];
  if (S.active) out.push({ key: 'plan', tone: 'info', title: `${esc(S.active.name)} in progress`, body: 'Finish and save it so I can update your targets.', act: { label: 'Resume', act: 'go', data: 'data-v="train"' } });
  else if (day) {
    const done = S.workouts.some(w => w.date === tk && w.dayId === id);
    const ups = day.ex.map(x => ({ x, r: recommend(x) })).filter(o => o.r && o.r.tag === 'up').slice(0, 2);
    out.push({ key: 'plan', tone: done ? 'good' : 'info', title: done ? `${esc(day.name)} done` : `Today: ${esc(day.name)}`,
      body: done ? 'Session saved. Get your protein in and sleep on time.' : `${day.ex.length} exercises, about ${planMinutes(day)} minutes.` + (ups.length ? ` Go heavier on ${ups.map(o => esc(exName(o.x).toLowerCase())).join(' and ')}.` : ''),
      act: done ? null : { label: 'Start session', act: 'start', data: `data-d="${id}"` } });
  } else out.push({ key: 'plan', tone: 'info', title: 'Rest day', body: `A walk or some light mobility is fine. Next up: ${esc(nextSessionText())}.` });

  if (!S.workouts.length) out.push({ key: 'first', tone: 'info', title: 'Log your first session', body: 'After a couple of saved sessions I can set weight targets, spot stalls and track your weekly volume.' });

  const lw = S.workouts[S.workouts.length - 1];
  if (lw && dayDiff(lw.date, tk) <= 3) {
    const prs = prsIn(lw);
    if (prs.length) out.push({ key: 'pr', tone: 'good', title: `New best${prs.length > 1 ? 's' : ''} ${relDate(lw.date).toLowerCase()}`, body: prs.map(p => `${esc(exName(p.id))}: estimated max up to ${kg(r1(p.e1))} kg`).join('. ') + '.' });
  }

  if (S.workouts.length >= 2) {
    const planned = Object.keys(S.prog.schedule).length;
    const weeks = clamp(dayDiff(S.workouts[0].date, tk) / 7, 1, 4);
    const perWk = S.workouts.filter(w => dayDiff(w.date, tk) < 28).length / weeks;
    if (perWk >= planned * 0.8) out.push({ key: 'freq', tone: 'good', title: 'Consistency is strong', body: `${perWk.toFixed(1)} sessions a week against a plan of ${planned}. Keep it boring and repeatable.` });
    else if (perWk >= planned * 0.5) out.push({ key: 'freq', tone: 'info', title: 'Consistency is decent', body: `${perWk.toFixed(1)} sessions a week against a plan of ${planned}. Protect your lifting days first; boxing can move.` });
    else out.push({ key: 'freq', tone: 'warn', title: 'Sessions are slipping', body: `About ${perWk.toFixed(1)} a week against ${planned} planned. A 3-day week you actually do beats a 5-day week you skip.` });
  }

  const wt = weightTrend();
  if (wt && wt.rate != null) out.push(weightInsight(wt, P));
  else if (!S.bw.length) out.push({ key: 'bw', tone: 'info', title: 'Weigh in a few times a week', body: 'Same time, same conditions, ideally in the morning. I use the trend, not single readings.', act: { label: 'Log weight', act: 'bw' } });

  if (T) {
    const ns = nutritionSummary(7);
    if (ns.n >= 3) {
      const diff = ns.kcal - T.kcal, pr = ns.p / T.p;
      const kTone = Math.abs(diff) <= T.kcal * 0.1 ? 'good' : 'warn';
      out.push({ key: 'food', tone: kTone === 'good' && pr >= 0.9 ? 'good' : 'warn', title: (kTone === 'good' ? 'Calories on target' : diff > 0 ? 'Eating above target' : 'Eating well under target') + (pr < 0.9 ? ', protein short' : ''),
        body: `Last ${ns.n} logged days: ${fmt(ns.kcal)} kcal on average (target ${fmt(T.kcal)}), ${fmt(ns.p)} g protein (target ${fmt(T.p)}).` +
          (pr < 0.9 ? ' Protein is short. Eggs, chicken thighs, tuna, pilchards and whey are the cheapest ways to close the gap.' : '') +
          (diff < -T.kcal * 0.15 ? ' Eating too far under makes training worse and muscle harder to keep.' : '') });
    } else if (S.workouts.length) out.push({ key: 'food', tone: 'info', title: 'Log food for sharper advice', body: 'With 3 or more logged days a week I can check calories and protein against your goal.', act: { label: 'Open food log', act: 'go', data: 'data-v="food"' } });
    const a = adaptiveTDEE();
    if (a.est) {
      const diff = a.est - T.tdee;
      out.push({ key: 'tdee', tone: 'info', title: `Your real maintenance looks like ${fmt(roundTo(a.est, 10))} kcal`,
        body: `Worked out from ${a.n} days of food logs and your weight trend. The calculator estimate was ${fmt(T.tdee)}. This is only as accurate as your logging.` + (Math.abs(diff) > 150 ? ' Update your target to match?' : ''),
        act: Math.abs(diff) > 150 ? { label: 'Use this number', act: 'useAdaptive' } : null });
    }
  } else out.push({ key: 'targets', tone: 'info', title: 'Set your calorie targets', body: 'The calculator estimates your maintenance calories and sets protein, carbs and fat for your goal.', act: { label: 'Open calculator', act: 'tdee' } });

  const ls = ladderStatus().filter(x => x.rec && x.rec.levelUp);
  ls.forEach(x => out.push({ key: 'ladder-' + x.l, tone: 'good', title: `Ready for ${LADDER_NAME[x.l].toLowerCase()} level ${x.lvl + 1}`, body: `You cleared ${x.lv.sets} × ${x.lv.reps} on ${esc(x.lv.name.toLowerCase())}. Next: ${esc(LADDERS[x.l][x.lvl].name)}.`, act: { label: 'Move up', act: 'levelUp', data: `data-l="${x.l}"` } }));

  const st = stalledLifts();
  if (st.length) out.push({ key: 'stall', tone: 'warn', title: st.length > 1 ? 'Some lifts have stalled' : `${esc(exName(st[0]))} has stalled`,
    body: `${st.length > 1 ? esc(st.map(exName).join(', ')) + ' have' : 'It has'} not improved in 3 sessions. In a calorie deficit, holding strength is a win. If sleep and protein are fine, switch the rep range for 3 weeks (for example 12–15) or use a close variation.` });

  if (S.workouts.filter(w => dayDiff(w.date, tk) < 7).length >= 2) {
    const ws = weeklySets(); const usedM = new Set(); Object.values(S.prog[S.mode]).forEach(d => d.ex.forEach(x => { const e = getEx(x); if (e && e.type !== 'round' && e.m[0] !== 'cardio') usedM.add(e.m[0]); }));
    const low = [...usedM].filter(m => (ws[m] || 0) < 6), high = Object.keys(ws).filter(m => ws[m] > 22);
    if (high.length) out.push({ key: 'vol', tone: 'warn', title: 'High weekly volume', body: `${high.join(', ')} got more than 22 hard sets this week. More is not always better; recovery may suffer.` });
    else if (low.length && low.length <= 4) out.push({ key: 'vol', tone: 'info', title: 'Light weekly volume', body: `${low.join(', ')} got fewer than 6 sets in the last 7 days. Around 10 to 20 sets per muscle per week works well for most people.` });
  }

  const streak = liftWeeksStreak(), ld = S.settings.lastDeload;
  if (streak >= 6 && (!ld || dayDiff(ld, tk) > 42)) out.push({ key: 'deload', tone: 'info', title: 'Time for a lighter week', body: `${streak} hard weeks in a row. Next week, keep the weights but do about half the sets. You'll come back stronger.`, act: { label: 'Mark as deload week', act: 'deload' } });

  const ic = impactCheck();
  if (ic.b2b) out.push({ key: 'impact', tone: 'warn', title: 'Back-to-back impact days', body: 'You did skipping or running on consecutive days. Leave a day between high-impact sessions so your shins and calves can recover.' });
  if (ic.runs > 2) out.push({ key: 'runs', tone: 'warn', title: 'A lot of running this week', body: `${ic.runs} runs in 7 days. Cap it at 2 for now and use the bag or the bike for extra cardio.` });
  if (ic.rope > 5) out.push({ key: 'rope', tone: 'warn', title: 'A lot of skipping this week', body: `${ic.rope} skipping sessions in 7 days. Keep it to 5 or fewer.` });

  const sq = entriesFor('bsq');
  if (sq.length >= 3) {
    const a = bestE1(sq[0].e), b = Math.max(...sq.map(x => bestE1(x.e)));
    if (b > a + 1) out.push({ key: 'squat', tone: 'good', title: 'Squat is moving', body: `Estimated max up from ${kg(r1(a))} kg to ${kg(r1(b))} kg since ${shortDate(sq[0].date)}.` });
  }
  return out;
}
function weightInsight(wt, P) {
  const goal = P.goal || 'lose', rate = wt.rate, loss = -wt.pct;
  let proj = '';
  if (P.goalWeight && goal === 'lose' && rate < -0.05 && wt.latest > P.goalWeight) {
    const weeks = (wt.latest - P.goalWeight) / -rate; const d = new Date(); d.setDate(d.getDate() + Math.round(weeks * 7));
    proj = ` At this pace you reach ${kg(P.goalWeight)} kg around ${MONL[d.getMonth()]} ${d.getFullYear()}.`;
  }
  const r = `${kg(Math.abs(r1(rate)))} kg a week`;
  if (goal === 'lose') {
    if (rate > 0.1) return { key: 'bw', tone: 'warn', title: 'Weight is trending up', body: `Up about ${r} over the last ${wt.span} days. Check your food logs are complete. If they are, lower your target by 200 kcal.` };
    if (loss < 0.25) return { key: 'bw', tone: wt.span >= 14 ? 'warn' : 'info', title: 'Weight is flat', body: wt.span >= 14 ? `Less than 0.25% a week over ${wt.span} days. Water can hide fat loss for a week or two, but if this holds past 3 weeks, cut 150 to 200 kcal or add 2,000 steps a day.` : 'Too early to judge. Water and salt move the scale a lot in the short term.' };
    if (loss < 0.5) return { key: 'bw', tone: 'info', title: 'Losing slowly', body: `About ${r} (${loss.toFixed(2)}% of bodyweight). Steady and easy to keep muscle. A small 100 to 150 kcal cut would speed it up.${proj}` };
    if (loss <= 1) return { key: 'bw', tone: 'good', title: 'Right on pace', body: `About ${r} (${loss.toFixed(2)}% of bodyweight). This is the sweet spot for losing fat while keeping muscle.${proj}` };
    return { key: 'bw', tone: 'warn', title: 'Losing fast', body: `About ${r} (${loss.toFixed(1)}% of bodyweight). Early drops are partly water, which is normal. If it stays above 1% a week after the first month, or your lifts drop, eat 200 kcal more.${proj}` };
  }
  if (goal === 'gain') {
    const g = wt.pct;
    if (g < 0.1) return { key: 'bw', tone: 'warn', title: 'Not gaining yet', body: `Trend is ${rate >= 0 ? 'flat' : 'down'}. Add 150 to 200 kcal a day.` };
    if (g > 0.5) return { key: 'bw', tone: 'warn', title: 'Gaining fast', body: `About ${r}. Over 0.5% a week usually means extra fat. Pull back 150 kcal.` };
    return { key: 'bw', tone: 'good', title: 'Lean gain on pace', body: `About ${r}. Good pace for building muscle with little fat.` };
  }
  return Math.abs(wt.pct) < 0.25 ? { key: 'bw', tone: 'good', title: 'Weight is stable', body: 'Holding steady, which is the goal.' } : { key: 'bw', tone: 'info', title: `Weight is drifting ${rate > 0 ? 'up' : 'down'}`, body: `About ${r}. Adjust by 150 kcal if you want to hold.` };
}

/* ----- chat answers ----- */
const ALIAS = [['split squat', 'bss'], ['bulgarian', 'bss'], ['goblet', 'goblet'], ['leg press', 'legpress'], ['floor press', 'db_floor'], ['shoulder press', 'db_ohp'], ['overhead press', 'db_ohp'], ['ohp', 'db_ohp'],
  ['incline', 'db_incline'], ['bench', 'db_bench'], ['squat', 'bsq'], ['lateral', 'db_lat'], ['tricep', 'db_tri'], ['rdl', 'db_rdl'], ['romanian', 'db_rdl'], ['deadlift', 'db_rdl'],
  ['barbell row', 'bb_row'], ['pulldown', 'latpd'], ['rear delt', 'db_rear'], ['row', 'db_row'], ['hammer', 'db_hammer'], ['curl', 'db_curl'], ['calf', 'calf'], ['lunge', 'lunge'], ['ab wheel', 'abwheel'], ['plank', 'plank'], ['bag', 'bag'], ['skipping', 'rope'], ['rope', 'rope']];
function matchExercise(s) {
  for (const id of Object.keys(S.customEx)) if (s.includes(S.customEx[id].name.toLowerCase())) return id;
  for (const [k, id] of ALIAS) if (s.includes(k)) return id;
  return null;
}
function answer(q) {
  const s = q.toLowerCase();
  const has = (...w) => w.some(x => s.includes(x));
  if (has('today', 'train', 'workout', 'session', 'what should')) return answerToday();
  if (has('ladder', 'push-up', 'pushup', 'push up', 'pull-up', 'pullup', 'pull up', 'dip', 'level')) return answerLadders();
  const ex = matchExercise(s); if (ex) return answerExercise(ex);
  if (has('protein')) return answerProtein();
  if (has('calor', 'kcal', 'tdee', 'eat', 'food', 'diet', 'maintenance', 'deficit', 'macro', 'carb')) return answerNutrition();
  if (has('weight', 'scale', 'losing', 'lose', 'fat', 'goal', 'pace')) return answerWeight();
  if (has('stuck', 'plateau', 'stall', 'not progress', 'not getting stronger')) return answerPlateau();
  if (has('deload', 'tired', 'sore', 'fatigue', 'exhausted', 'recover', 'sleep', 'rest')) return answerRecovery();
  if (has('volume', 'sets', 'muscle')) return answerVolume();
  if (has('progress', 'summary', 'how am i', 'week', 'doing')) return answerSummary();
  if (/\b(hi|hello|hey|yo|sup)\b/.test(s)) return `<p>Hey${S.profile && S.profile.name ? ' ' + esc(S.profile.name) : ''}. Ask me about today's session, a lift, your weight trend, calories, protein or recovery.</p>`;
  return `<p>I don't have an answer for that one. I read your own logs, so I'm best at questions like:</p><ul><li>What should I train today?</li><li>How's my squat going?</li><li>Am I losing weight at a good pace?</li><li>How are my calories and protein?</li><li>Should I deload?</li></ul>`;
}
function answerToday() {
  if (S.active) return `<p>You're in the middle of <b>${esc(S.active.name)}</b>. Finish it on the Train tab.</p>`;
  const id = scheduledDay(), day = id && S.prog[S.mode][id];
  if (!day) return `<p>Rest day on your plan. Next up: ${esc(nextSessionText())}.</p><p>A walk or 10 minutes of mobility won't hurt recovery.</p>`;
  const lines = day.ex.filter(getEx).map(x => { const r = recommend(x); return `<li><b>${esc(exName(x))}</b>: ${esc(r ? r.text : '')}</li>`; }).join('');
  return `<p>Today is <b>${esc(day.name)}</b>, about ${planMinutes(day)} minutes. Here's what I'd aim for:</p><ul>${lines}</ul>`;
}
function answerExercise(id) {
  const d = getEx(id), h = entriesFor(id), r = recommend(id);
  if (!h.length) return `<p>No ${esc(d.name.toLowerCase())} logged yet. ${esc(r ? r.text : '')}</p>`;
  const last = h[h.length - 1];
  const setsTxt = last.e.sets.map(s => (d.type === 'wr' ? `${kg(s.w)}×${kg(s.r)}` : d.type === 'round' ? fmtMin(s.r) : kg(s.r))).join(', ');
  let trend = '';
  if (strengthEx(d)) {
    const vals = h.map(x => bestE1(x.e)); const best = Math.max(...vals);
    const recent = vals.slice(-5); const ch = recent[recent.length - 1] - recent[0];
    trend = `<p>Best estimated max: <b>${kg(r1(best))} kg</b>. Over your last ${recent.length} sessions it's ${ch > 1 ? `up ${kg(r1(ch))} kg` : ch < -1 ? `down ${kg(r1(-ch))} kg` : 'about flat'}.</p>`;
  }
  return `<p><b>${esc(d.name)}</b>: ${h.length} session${h.length > 1 ? 's' : ''}. Last one (${relDate(last.date).toLowerCase()}): ${setsTxt}.</p>${trend}<p>Next time: ${esc(r ? r.text : '')}</p>`;
}
function answerLadders() {
  const ls = ladderStatus();
  if (!ls.length) return '<p>None of your current sessions use a progression ladder. Switch to Home mode to see them.</p>';
  return `<p>Where you are on each ladder:</p><ul>${ls.map(x => `<li><b>${LADDER_NAME[x.l]} level ${x.lvl}/${x.max}</b>, ${esc(x.lv.name)}. ${esc(x.rec ? x.rec.text : '')}</li>`).join('')}</ul>`;
}
function answerProtein() {
  const T = S.targets; const ns = nutritionSummary(7); const w = latestWeight();
  if (!T) return '<p>Set your targets first (Food tab, Targets). Most lifters do well on 1.6 to 2.2 g of protein per kg of bodyweight, or per kg of goal weight if you carry a lot of body fat.</p>';
  let s = `<p>Your target is <b>${fmt(T.p)} g a day</b>${w ? ` (${(T.p / w).toFixed(1)} g per kg at ${kg(w)} kg)` : ''}.</p>`;
  s += ns.n ? `<p>Last ${ns.n} logged days you averaged ${fmt(ns.p)} g, ${ns.p >= T.p * 0.9 ? 'which is on target' : `about ${fmt(T.p - ns.p)} g short`}.</p>` : '<p>Log a few days of food and I can check how close you are.</p>';
  s += '<p>Cheapest protein in the food list: eggs, chicken thighs, tuna, pilchards, lentils and whey. Spread it over 3 to 4 meals.</p>';
  return s;
}
function answerNutrition() {
  const T = S.targets; if (!T) return '<p>Open the calculator on the Food tab to set your maintenance calories and daily target first.</p>';
  const ns = nutritionSummary(7), a = adaptiveTDEE(), today = dayTotals(dkey());
  let s = `<p>Daily target: <b>${fmt(T.kcal)} kcal</b> with ${fmt(T.p)} g protein, ${fmt(T.c)} g carbs, ${fmt(T.f)} g fat. Estimated maintenance: ${fmt(T.tdee)} kcal.</p>`;
  s += `<p>Today so far: ${fmt(today.kcal)} kcal, ${fmt(T.kcal - today.kcal)} left.</p>`;
  if (ns.n) s += `<p>Last ${ns.n} logged days: ${fmt(ns.kcal)} kcal average.</p>`;
  s += a.est ? `<p>From your logs and weight trend, your real maintenance looks like about <b>${fmt(roundTo(a.est, 10))} kcal</b>.</p>` : `<p>To estimate your real maintenance from data I need ${esc(a.need)}.</p>`;
  return s;
}
function answerWeight() {
  const wt = weightTrend(), P = S.profile || {};
  if (!wt) return '<p>Log your weight at least 3 times over a week or more and I can read the trend.</p>';
  if (wt.rate == null) return `<p>Latest: ${kg(wt.latest)} kg. I need a few more weigh-ins spread over at least a week to read the trend.</p>`;
  const ins = weightInsight(wt, P);
  return `<p>Latest: <b>${kg(wt.latest)} kg</b>.</p><p>${ins.title}. ${ins.body}</p>${P.goalWeight ? `<p>${kg(Math.max(0, wt.latest - P.goalWeight))} kg to go to ${kg(P.goalWeight)} kg.</p>` : ''}`;
}
function answerPlateau() {
  const st = stalledLifts();
  if (!st.length) return '<p>Nothing has stalled. Every weighted lift with 4+ sessions has improved in its last 3.</p>';
  return `<p>Stalled: ${esc(st.map(exName).join(', '))}.</p><p>In order, I'd check: sleep (7+ hours), protein, and whether you're losing weight fast. If all three are fine, run a different rep range for 3 weeks or swap to a close variation, then come back.</p>`;
}
function answerRecovery() {
  const streak = liftWeeksStreak();
  return `<p>You've had <b>${streak}</b> week${streak === 1 ? '' : 's'} in a row with 3+ lifting sessions.</p><p>${streak >= 6 ? 'A deload is due: same weights, about half the sets, for one week.' : 'No deload needed yet. Plan one every 6 to 8 weeks, or sooner if lifts drop across the board.'}</p><p>Feeling beaten up for more than a few days usually means too little sleep or food, not too little effort. Pain that is sharp or getting worse is a reason to see a doctor or physio.</p>`;
}
function answerVolume() {
  const ws = weeklySets(); const keys = Object.keys(ws).sort((a, b) => ws[b] - ws[a]);
  if (!keys.length) return '<p>No lifting logged in the last 7 days.</p>';
  return `<p>Hard sets per muscle in the last 7 days (main muscle counts as 1, helpers as half):</p><ul>${keys.map(k => `<li>${k}: ${r1(ws[k])}</li>`).join('')}</ul><p>About 10 to 20 a week per muscle works for most people.</p>`;
}
function answerSummary() {
  const tk = dkey(); const w7 = S.workouts.filter(w => dayDiff(w.date, tk) < 7);
  const sets = w7.reduce((a, w) => a + w.sets, 0), vol = w7.reduce((a, w) => a + w.volume, 0);
  const wt = weightTrend(), ns = nutritionSummary(7);
  return `<p>Last 7 days:</p><ul><li>${w7.length} session${w7.length === 1 ? '' : 's'}, ${sets} sets, ${fmt(vol)} kg lifted</li>${wt && wt.rate != null ? `<li>Weight trend: ${rate2txt(wt.rate)}</li>` : ''}${ns.n ? `<li>Food: ${fmt(ns.kcal)} kcal and ${fmt(ns.p)} g protein a day (${ns.n} days logged)</li>` : ''}</ul>`;
}
const rate2txt = r => (Math.abs(r) < 0.05 ? 'flat' : `${r < 0 ? 'down' : 'up'} ${kg(Math.abs(r1(r)))} kg a week`);

/* ================= UI pieces ================= */
function plateRing(pct, color, big, small, size = 96) {
  const r = size / 2 - 6, c = 2 * Math.PI * r, p = clamp(pct || 0, 0, 1);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(big + ' ' + small)}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="9"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r - 10}" fill="none" stroke="var(--line)" stroke-width="1"/>
    <text x="50%" y="48%" text-anchor="middle" font-size="${size / 4.6}" font-weight="800">${big}</text>
    <text x="50%" y="66%" text-anchor="middle" font-size="${size / 9}" fill="var(--ink2)" style="fill:var(--ink2)">${small}</text></svg>`;
}
const bar = (pct, color) => `<div class="bar" style="--c:${color}"><i style="width:${clamp(pct || 0, 0, 1) * 100}%"></i></div>`;
const seg = (act, opts, cur) => `<div class="seg" role="tablist">${opts.map(([v, l]) => `<button role="tab" aria-selected="${v === cur}" class="${v === cur ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
const header = (title, sub = '', right = '') => `<header class="hd"><div><p class="hd-sub">${sub}</p><h1>${title}</h1></div>${right}</header>`;
const empty = (t, p) => `<div class="empty"><b>${t}</b><p>${p}</p></div>`;
const insightCard = i => `<div class="ins tone-${i.tone}"><h3>${i.title}</h3><p>${i.body}</p>${i.act ? `<button class="btn small" data-act="${i.act.act}" ${i.act.data || ''}>${i.act.label}</button>` : ''}</div>`;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function lineChart(pts, o = {}) {
  if (pts.length < 2) return `<div class="empty-chart">Log at least two entries to see a chart.</div>`;
  const W = 340, H = o.h || 170, P = { l: 36, r: 14, t: 14, b: 22 };
  const ys = pts.map(p => p.y).concat(o.goal != null ? [o.goal] : []);
  let y0 = Math.min(...ys), y1 = Math.max(...ys); if (y1 - y0 < 2) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.12; y0 -= pad; y1 += pad;
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  const X = x => P.l + ((x - x0) / ((x1 - x0) || 1)) * (W - P.l - P.r), Y = y => P.t + (1 - (y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${line}L${X(x1).toFixed(1)},${H - P.b}L${X(x0).toFixed(1)},${H - P.b}Z`;
  let grid = '';
  for (let i = 0; i <= 3; i++) { const v = y0 + ((y1 - y0) * i) / 3, y = Y(v); grid += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width=".5"/><text x="${P.l - 6}" y="${y + 4}" text-anchor="end">${Math.round(v)}</text>`; }
  const goal = o.goal != null ? `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(o.goal)}" y2="${Y(o.goal)}" stroke="var(--green)" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${W - P.r}" y="${Y(o.goal) - 5}" text-anchor="end" style="fill:var(--green)">goal ${o.goal}</text>` : '';
  const lp = pts[pts.length - 1];
  const fd = d => { const t = new Date(d); return `${t.getDate()} ${MON[t.getMonth()]}`; };
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Chart')}">${grid}${goal}
    <path d="${area}" fill="${o.color || 'var(--ink)'}" opacity=".08"/><path d="${line}" fill="none" stroke="${o.color || 'var(--ink)'}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.length <= 40 ? pts.map(p => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="2.2" fill="${o.color || 'var(--ink)'}"/>`).join('') : ''}
    <circle cx="${X(lp.x)}" cy="${Y(lp.y)}" r="4.5" fill="${o.color || 'var(--ink)'}" stroke="var(--card)" stroke-width="2"/>
    <text x="${P.l}" y="${H - 5}">${fd(x0)}</text><text x="${W - P.r}" y="${H - 5}" text-anchor="end">${fd(x1)}</text></svg>`;
}
function barChart(items, target) {
  const W = 340, H = 160, P = { l: 36, r: 8, t: 12, b: 22 };
  const max = Math.max(target || 0, ...items.map(i => i.y), 1) * 1.1;
  const bw = (W - P.l - P.r) / items.length;
  const Y = y => P.t + (1 - y / max) * (H - P.t - P.b);
  let s = '';
  items.forEach((it, i) => { if (!it.y) return; const x = P.l + i * bw + bw * 0.18, h = H - P.b - Y(it.y); s += `<rect x="${x}" y="${Y(it.y)}" width="${bw * 0.64}" height="${h}" rx="3" fill="${target && it.y > target * 1.05 ? 'var(--red)' : 'var(--ink)'}" opacity="${it.y ? 0.9 : 0}"/>`; });
  items.forEach((it, i) => { if (i % 2 === 0 || i === items.length - 1) s += `<text x="${P.l + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${it.label}</text>`; });
  const t = target ? `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(target)}" y2="${Y(target)}" stroke="var(--green)" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${P.l - 6}" y="${Y(target) + 4}" text-anchor="end" style="fill:var(--green)">${fmt(target)}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily calories">${s}${t}</svg>`;
}

/* ================= views ================= */
let view = 'today', foodDate = dkey(), coachTab = 'insights', progTab = 'strength', progEx = null;
let deferredPrompt = null;

function modeToggle() { return seg('mode', [['gym', 'Gym'], ['home', 'Home']], S.mode); }
function installBanner() {
  if (isStandalone() || S.settings.hideInstall) return '';
  const body = isIOS() ? 'In Safari, tap Share, then <b>Add to Home Screen</b>.' : deferredPrompt ? 'Install it so it opens full screen like a normal app.' : 'Use your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.';
  return `<div class="banner"><div class="grow"><b>Add LIFT to your home screen.</b> ${body}</div>${deferredPrompt ? '<button class="btn small primary" data-act="install">Install</button>' : ''}<button class="icon-btn" data-act="hideInstall" aria-label="Hide">${I.x}</button></div>`;
}

function vToday() {
  const p = S.profile || {}, tk = dkey(), hr = new Date().getHours();
  const g = hr < 12 ? 'Morning' : hr < 18 ? 'Afternoon' : 'Evening';
  let h = header(p.name ? `${g}, ${esc(p.name)}` : `Good ${g.toLowerCase()}`, longDate(tk), `<button class="icon-btn" data-act="settings" aria-label="Settings">${I.gear}</button>`);
  h += installBanner() + modeToggle() + todayCard();
  const t = dayTotals(tk), T = S.targets;
  h += '<div class="row2">';
  if (T) {
    const over = t.kcal > T.kcal;
    h += `<button class="tile" data-act="go" data-v="food">${plateRing(t.kcal / T.kcal, over ? 'var(--red)' : 'var(--green)', fmt(Math.abs(T.kcal - t.kcal)), over ? 'kcal over' : 'kcal left', 96)}
      <div class="tile-meta"><div style="display:flex;justify-content:space-between"><span>Protein</span><b>${fmt(t.p)}/${fmt(T.p)} g</b></div>${bar(t.p / T.p, 'var(--blue)')}</div></button>`;
  } else h += `<button class="tile" data-act="tdee"><div class="tile-meta"><b>Set calorie targets</b><span>Work out your maintenance calories and daily goal.</span></div></button>`;
  const lw = latestWeight(), wt = weightTrend();
  h += `<button class="tile" data-act="bw"><div class="tile-meta"><span>Bodyweight</span></div><div class="tile-big">${lw ? kg(lw) : '–'}<small>kg</small></div>
    <div class="tile-meta"><span>${wt && wt.rate != null ? rate2txt(wt.rate) : S.bw.length ? 'Trend after a week of weigh-ins' : 'Tap to log'}</span>${p.goalWeight && lw ? bar(goalPct(), 'var(--green)') + `<span>${kg(Math.max(0, r1(lw - p.goalWeight)))} kg to ${kg(p.goalWeight)} kg</span>` : ''}</div></button>`;
  h += '</div>';
  h += `<div class="quick"><button class="btn" data-act="bw">Log weight</button><button class="btn" data-act="addFood" data-m="">Add food</button><button class="btn" data-act="cardio">Log cardio</button></div>`;
  const ins = insights().filter(i => i.key !== 'plan').slice(0, 2);
  if (ins.length) h += `<h2 class="sec">From your coach</h2>${ins.map(insightCard).join('')}<button class="link" data-act="go" data-v="coach">All insights</button>`;
  return h;
}
function goalPct() {
  const p = S.profile || {}, bw = sortedBW(); if (!p.goalWeight || !bw.length) return 0;
  const start = Math.max(...bw.map(b => b.kg).slice(0, 3)), now = bw[bw.length - 1].kg;
  if (p.goal === 'gain') return clamp((now - start) / (p.goalWeight - start || 1), 0, 1);
  return clamp((start - now) / (start - p.goalWeight || 1), 0, 1);
}
function todayCard() {
  if (S.active) {
    const a = S.active, done = a.ex.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0), tot = a.ex.reduce((n, e) => n + e.sets.length, 0);
    return `<div class="session-card c-${a.color}"><div class="big-plate"></div><p class="muted">In progress, ${Math.round((Date.now() - a.start) / 60000)} min</p><h2>${esc(a.name)}</h2><p class="muted">${done} of ${tot} sets done</p><button class="btn primary" data-act="go" data-v="train">Resume session</button></div>`;
  }
  const id = scheduledDay(), prog = S.prog[S.mode];
  if (!id || !prog[id]) return `<div class="session-card c-rest"><div class="big-plate"></div><p class="muted">Rest day</p><h2>Recover</h2><p class="muted">Next up: ${esc(nextSessionText())}.</p><button class="btn" data-act="go" data-v="train">Train anyway</button></div>`;
  const d = prog[id], done = S.workouts.some(w => w.date === dkey() && w.dayId === id);
  return `<div class="session-card c-${d.color}"><div class="big-plate"></div><p class="muted">${done ? 'Done today' : `Today, about ${planMinutes(d)} min`}</p><h2>${esc(d.name)}</h2>
    <p class="muted">${d.ex.slice(0, 3).map(x => esc(exName(x))).join(', ')}${d.ex.length > 3 ? ` and ${d.ex.length - 3} more` : ''}</p>
    ${done ? '<button class="btn" data-act="go" data-v="progress" data-p="history">See session</button>' : `<button class="btn primary" data-act="start" data-d="${id}">Start session</button>`}</div>`;
}

function vTrain() {
  if (S.active) return vSession();
  const prog = S.prog[S.mode];
  let h = header('Train', S.mode === 'gym' ? 'Gym programme' : 'Home programme', `<button class="btn small" data-act="cardio">Log cardio</button>`) + modeToggle();
  DAY_ORDER.forEach(id => {
    const d = prog[id]; if (!d) return;
    const days = Object.entries(S.prog.schedule).filter(([, v]) => v === id).map(([k]) => DOW[k].slice(0, 3)).join(', ');
    const last = [...S.workouts].reverse().find(w => w.dayId === id && w.mode === S.mode);
    h += `<div class="day c-${d.color}"><div class="plate"></div><div class="grow"><h3>${esc(d.name)}</h3><p>${days || 'Not scheduled'}${last ? `, last done ${relDate(last.date).toLowerCase()}` : ''}</p><p>${d.ex.map(x => esc(exName(x))).join(', ')}</p></div><button class="btn small primary" data-act="start" data-d="${id}">Start</button></div>`;
  });
  const ls = ['push', 'pull', 'dip'];
  h += `<h2 class="sec">Progression ladders</h2><div class="card">${ls.map(l => { const lv = ladderLevel(l); return `<button class="lrow" data-act="ladder" data-l="${l}"><div class="grow"><b>${LADDER_NAME[l]}</b><small>${esc(lv.name)}, goal ${lv.sets} × ${lv.reps}${lv.unit === 's' ? ' s' : ''}</small></div><div class="lvl">${S.ladders[l]}<small>/${LADDERS[l].length}</small></div></button>`; }).join('')}</div>`;
  return h;
}

function vSession() {
  const a = S.active, d = S.prog[a.mode][a.dayId];
  let h = `<header class="hd"><div><p class="hd-sub elapsed" id="elapsed">${mmss(Math.floor((Date.now() - a.start) / 1000))}</p><h1>${esc(a.name)}</h1></div><button class="btn small primary" data-act="finish">Finish</button></header>`;
  a.ex.forEach((e, i) => { h += exCard(e, i, a.color); });
  h += `<button class="btn wide" data-act="addEx">${I.plus.replace('width="24" height="24"', 'width="18" height="18" style="vertical-align:-3px"')} Add exercise</button>`;
  h += `<div class="session-foot">${d ? `<button class="link" data-act="saveLayout">Save this exercise list to ${esc(d.name)}</button>` : ''}<button class="link danger" data-act="discard">Discard session</button></div>`;
  return h;
}
function exCard(e, i, color) {
  const d = getEx(e.id); if (!d) return '';
  const rec = recommend(e.id), prev = lastEntry(e.id), unit = unitOf(d), isW = d.type === 'wr', tgt = targetFor(e);
  let title = esc(d.name), sub = '', nav = '';
  if (d.type === 'ladder') {
    const L = LADDERS[d.ladder], lvl = S.ladders[d.ladder], lv = ladderLevel(d.ladder);
    title = esc(lv.name); sub = `${LADDER_NAME[d.ladder]} ladder, level ${lvl} of ${L.length}. Goal ${lv.sets} × ${lv.reps}${lv.unit === 's' ? ' s' : ''}`;
    nav = `<div class="lvl-nav"><button data-act="lvl" data-l="${d.ladder}" data-d="-1" ${lvl <= 1 ? 'disabled' : ''}>Easier</button><button data-act="lvl" data-l="${d.ladder}" data-d="1" ${lvl >= L.length ? 'disabled' : ''}>Harder</button></div>`;
  } else if (d.type === 'round') sub = d.sets === 1 ? (d.hi > d.lo ? `${fmtMin(d.lo)} to ${fmtMin(d.hi)}` : fmtMin(d.lo)) : d.lo === d.hi ? `${d.sets} rounds of ${fmtMin(d.lo)}, 1 min rest` : `${d.sets} rounds, ${fmtMin(d.lo)} to ${fmtMin(d.hi)} each`;
  else sub = `${d.sets} × ${d.lo}–${d.hi}${d.type === 't' ? ' s' : d.unit === 'm' ? ' m' : ' reps'}${isW ? `, +${kg(d.inc)} kg steps` : ''}`;
  const prevTxt = j => { if (!prev || !prev.sets[j]) return '–'; const s = prev.sets[j]; return isW ? `${kg(s.w)}×${kg(s.r)}` : d.type === 'round' ? fmtMin(s.r) : `${kg(s.r)}${unit === 's' ? ' s' : ''}`; };
  const ph = d.type === 'round' ? String(tgt) : String(tgt);
  const rows = e.sets.map((s, j) => `<div class="set ${s.done ? 'done' : ''}"><span class="set-n">${j + 1}</span><span class="set-prev">${prevTxt(j)}</span>
    ${isW ? `<input class="in" inputmode="decimal" enterkeyhint="next" aria-label="Set ${j + 1} weight in kg" data-in="w" data-e="${i}" data-s="${j}" value="${esc(s.w)}" placeholder="kg">` : ''}
    <input class="in" inputmode="decimal" enterkeyhint="done" aria-label="Set ${j + 1} ${unit}" data-in="r" data-e="${i}" data-s="${j}" value="${esc(s.r)}" placeholder="${ph}">
    <button class="tick" data-act="tick" data-e="${i}" data-s="${j}" aria-label="Mark set ${j + 1} done" aria-pressed="${!!s.done}">${I.check}</button></div>`).join('');
  return `<div class="ex-card ${isW ? '' : 'nw'} c-${color}"><div class="ex-top"><div><h3>${title}</h3><div class="sub">${sub}</div>${nav}</div><button class="icon-btn" style="background:none;width:34px;height:34px;color:var(--ink3)" data-act="rmEx" data-e="${i}" aria-label="Remove exercise">${I.x}</button></div>
    ${rec ? `<p class="coach-line tag-${rec.tag}">${I.spark}<span>${esc(rec.text)}</span></p>` : ''}
    <div class="sets-head"><span></span><span>Last</span>${isW ? '<span>kg</span>' : ''}<span>${unit}</span><span></span></div>${rows}
    <div class="ex-foot"><button class="btn" data-act="addSet" data-e="${i}">Add set</button>${e.sets.length > 1 ? `<button class="btn" data-act="rmSet" data-e="${i}">Remove set</button>` : ''}</div></div>`;
}

function vFood() {
  const T = S.targets, t = dayTotals(foodDate), isToday = foodDate === dkey();
  let h = header('Food', '', `<button class="btn small" data-act="tdee">Targets</button>`);
  h += `<div class="datenav"><button data-act="fday" data-d="-1" aria-label="Previous day">${I.left}</button><b>${isToday ? 'Today' : longDate(foodDate)}</b><button data-act="fday" data-d="1" aria-label="Next day" ${isToday ? 'disabled' : ''}>${I.right}</button></div>`;
  if (T) {
    const over = t.kcal > T.kcal;
    const mac = (l, v, tg, c) => `<div class="mac"><div><span>${l}</span><b>${fmt(v)} / ${fmt(tg)} g</b></div>${bar(v / tg, c)}</div>`;
    h += `<div class="card fsum">${plateRing(t.kcal / T.kcal, over ? 'var(--red)' : 'var(--green)', fmt(Math.abs(T.kcal - t.kcal)), over ? 'kcal over' : 'kcal left', 116)}
      <div class="macros"><div class="mac"><div><span>Eaten</span><b>${fmt(t.kcal)} / ${fmt(T.kcal)} kcal</b></div></div>${mac('Protein', t.p, T.p, 'var(--blue)')}${mac('Carbs', t.c, T.c, 'var(--yellow)')}${mac('Fat', t.f, T.f, 'var(--red)')}</div></div>`;
  } else h += `<div class="card"><p><b>No targets yet.</b></p><p class="muted">The calculator works out your maintenance calories (TDEE) and a daily goal.</p><button class="btn primary" data-act="tdee">Open calculator</button></div>`;
  const L = S.food[foodDate] || [];
  MEALS.forEach(m => {
    const items = L.filter(e => e.meal === m), k = items.reduce((a, e) => a + e.kcal, 0);
    h += `<div class="meal"><div class="meal-h"><h3>${m}</h3><span>${k ? fmt(k) + ' kcal' : ''}</span></div><div class="list">${items.map(e => `<button class="frow" data-act="editFood" data-id="${e.id}"><span><b>${esc(e.name)}</b><small>${e.fid ? fmtQty(e.qty, foodById(e.fid) || { unit: e.unit }) + ', ' : ''}${fmt(e.p)} g protein</small></span><span class="kc">${fmt(e.kcal)}</span></button>`).join('')}
      <button class="frow add" data-act="addFood" data-m="${m}">${I.plus}Add food</button></div></div>`;
  });
  return h;
}
const fmtQty = (q, f) => (f.unit === 'each' ? `×${+q}` : `${+q} ${f.unit}`);

function vCoach() {
  let h = header('Coach', 'Reads your logs on this phone. No internet needed.') + seg('coachTab', [['insights', 'Insights'], ['ask', 'Ask']], coachTab);
  if (coachTab === 'insights') return h + insights().map(insightCard).join('');
  const msgs = S.chat.length ? S.chat : [{ from: 'coach', html: `<p>Ask me about your training, weight or food. I look at what you've logged and give you a straight answer.</p>` }];
  h += `<div class="chat" id="chat">${msgs.map(m => `<div class="msg ${m.from}">${m.from === 'me' ? esc(m.text) : m.html}</div>`).join('')}</div>`;
  const chips = ['What should I train today?', "How's my squat going?", 'Am I losing weight at a good pace?', 'How are my calories?', 'Am I ready to level up?', 'Should I deload?', 'Weekly summary'];
  h += `<div class="chips">${chips.map(c => `<button class="chip" data-act="ask" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
  h += `<div class="chatbar"><input class="in" id="chatIn" placeholder="Ask your coach" enterkeyhint="send" autocomplete="off"><button data-act="send" aria-label="Send">${I.send}</button></div>`;
  return h;
}

function vProgress() {
  let h = header('Progress') + seg('progTab', [['strength', 'Strength'], ['body', 'Body'], ['food', 'Food'], ['history', 'History']], progTab);
  return h + ({ strength: vStrength, body: vBody, food: vFoodStats, history: vHistory }[progTab])();
}
function vStrength() {
  const ids = [...new Set(S.workouts.flatMap(w => w.ex.map(e => e.id)))].filter(id => getEx(id) && getEx(id).type !== 'round');
  if (!ids.length) return empty('Your lifts show up here', 'Save a session and every exercise gets its own progress chart.');
  if (!progEx || !ids.includes(progEx)) progEx = ids.includes('bsq') ? 'bsq' : ids[0];
  const d = getEx(progEx), hist = entriesFor(progEx), isW = strengthEx(d);
  const pts = hist.map(x => ({ x: pkey(x.date).getTime(), y: isW ? r1(bestE1(x.e)) : bestReps(x.e) }));
  const vals = pts.map(p => p.y), last = hist[hist.length - 1].e;
  const top = isW ? last.sets.reduce((b, s) => (num(s.w) > num(b.w) || (num(s.w) === num(b.w) && num(s.r) > num(b.r)) ? s : b), last.sets[0]) : null;
  let h = `<label class="field"><span>Exercise</span><select class="in" data-ch="progEx">${ids.map(id => `<option value="${id}" ${id === progEx ? 'selected' : ''}>${esc(getEx(id).name)}</option>`).join('')}</select></label>`;
  h += `<div class="card">${lineChart(pts, { label: d.name })}<p class="note">${isW ? 'Estimated 1-rep max from your best set each session (Epley formula).' : 'Best set each session.'}</p></div>`;
  h += `<div class="stats"><div class="stat"><span>Sessions</span><b>${hist.length}</b></div><div class="stat"><span>${isW ? 'Best est. max' : 'Best set'}</span><b>${kg(Math.max(...vals))}<small>${isW ? 'kg' : unitOf(d)}</small></b></div>
    <div class="stat"><span>Latest ${isW ? 'top set' : 'best'}</span><b>${isW ? `${kg(top.w)}×${kg(top.r)}` : kg(vals[vals.length - 1])}</b></div><div class="stat"><span>Since first</span><b>${vals[vals.length - 1] - vals[0] >= 0 ? '+' : ''}${kg(r1(vals[vals.length - 1] - vals[0]))}<small>${isW ? 'kg' : ''}</small></b></div></div>`;
  const r = recommend(progEx); if (r) h += `<p class="coach-line tag-${r.tag}" style="margin-top:14px">${I.spark}<span>Next time: ${esc(r.text)}</span></p>`;
  return h;
}
function vBody() {
  const bw = sortedBW(), P = S.profile || {};
  let h = `<button class="btn primary wide" style="margin:0 0 12px" data-act="bw">Log weight</button>`;
  if (!bw.length) return h + empty('No weigh-ins yet', 'Weigh in 3 or more times a week, in the morning, and I will track the trend.');
  const last = bw[bw.length - 1], first = bw[0], wt = weightTrend();
  const pts = bw.slice(-90).map(b => ({ x: pkey(b.date).getTime(), y: b.kg }));
  h += `<div class="card">${lineChart(pts, { goal: P.goalWeight || null, color: 'var(--ink)', label: 'Bodyweight' })}</div>`;
  h += `<div class="stats"><div class="stat"><span>Latest</span><b>${kg(last.kg)}<small>kg</small></b></div><div class="stat"><span>Change since ${shortDate(first.date)}</span><b>${last.kg - first.kg > 0 ? '+' : ''}${kg(r1(last.kg - first.kg))}<small>kg</small></b></div>
    <div class="stat"><span>4-week trend</span><b>${wt && wt.rate != null ? (wt.rate > 0 ? '+' : '') + kg(r1(wt.rate)) : '–'}<small>${wt && wt.rate != null ? 'kg/wk' : ''}</small></b></div><div class="stat"><span>Goal</span><b>${P.goalWeight ? kg(P.goalWeight) : '–'}<small>${P.goalWeight ? 'kg' : ''}</small></b></div></div>`;
  if (P.goalWeight) h += `<div class="card" style="margin-top:12px"><div class="mac"><div><span>Progress to goal</span><b>${Math.round(goalPct() * 100)}%</b></div>${bar(goalPct(), 'var(--green)')}</div></div>`;
  h += `<h2 class="sec">Recent weigh-ins</h2><div class="list">${bw.slice(-12).reverse().map(b => `<button class="frow" data-act="delBw" data-d="${b.date}"><span><b>${kg(b.kg)} kg</b><small>${longDate(b.date)}</small></span><span class="kc">${I.trash}</span></button>`).join('')}</div>`;
  return h;
}
function vFoodStats() {
  const T = S.targets, tk = dkey(), items = [];
  for (let i = 13; i >= 0; i--) { const d = addDays(tk, -i); items.push({ label: String(pkey(d).getDate()), y: Math.round(dayTotals(d).kcal) }); }
  const ns = nutritionSummary(7), a = adaptiveTDEE();
  let h = `<div class="card">${items.some(i => i.y) ? barChart(items, T && T.kcal) : '<div class="empty-chart">Log food to see the last 14 days.</div>'}<p class="note">Calories per day, last 14 days. Dashed line is your target.</p></div>`;
  h += `<div class="stats"><div class="stat"><span>7-day average</span><b>${ns.n ? fmt(ns.kcal) : '–'}<small>${ns.n ? 'kcal' : ''}</small></b></div><div class="stat"><span>Protein average</span><b>${ns.n ? fmt(ns.p) : '–'}<small>${ns.n ? 'g' : ''}</small></b></div>
    <div class="stat"><span>Days logged (7)</span><b>${ns.n}</b></div><div class="stat"><span>Real maintenance</span><b>${a.est ? fmt(roundTo(a.est, 10)) : '–'}<small>${a.est ? 'kcal' : ''}</small></b></div></div>`;
  if (!a.est) h += `<p class="note">To estimate your real maintenance I need ${esc(a.need)}.</p>`;
  return h;
}
function vHistory() {
  if (!S.workouts.length && !S.cardio.length) return empty('No sessions yet', 'Start a session on the Train tab. Saved sessions appear here.');
  const items = [...S.workouts.map(w => ({ k: 'w', ts: w.ts, w })), ...S.cardio.map(c => ({ k: 'c', ts: pkey(c.date).getTime() + 1, c }))].sort((a, b) => b.ts - a.ts).slice(0, 80);
  return items.map(it => {
    if (it.k === 'c') { const c = it.c; return `<details class="hist c-green"><summary><div class="plate" style="width:34px;height:34px"></div><div class="grow"><b>${esc(c.type)}</b><small>${relDate(c.date)}, ${c.min} min${c.km ? `, ${c.km} km` : ''}</small></div></summary><div class="hist-body"><button class="btn small danger" data-act="delCardio" data-id="${c.id}">Delete</button></div></details>`; }
    const w = it.w, mins = Math.round((w.end - w.ts) / 60000);
    return `<details class="hist c-${w.color}"><summary><div class="plate" style="width:34px;height:34px"></div><div class="grow"><b>${esc(w.name)}</b><small>${relDate(w.date)}, ${mins} min, ${w.sets} sets${w.volume ? `, ${fmt(w.volume)} kg` : ''}, ${w.mode}</small></div></summary>
      <div class="hist-body">${w.ex.map(e => `<div><span>${esc(e.name)}</span><span>${e.sets.map(s => (e.type === 'wr' ? `${kg(s.w)}×${kg(s.r)}` : e.type === 'round' ? fmtMin(s.r) : kg(s.r))).join(', ')}</span></div>`).join('')}
      <button class="btn small danger" style="margin-top:8px" data-act="delWorkout" data-id="${w.id}">Delete session</button></div></details>`;
  }).join('');
}

/* ================= render ================= */
const VIEWS = { today: vToday, train: vTrain, food: vFood, coach: vCoach, progress: vProgress };
function render() {
  const el = $('#v-' + view), st = el.scrollTop;
  el.innerHTML = `<div class="wrap">${VIEWS[view]()}</div>`;
  el.scrollTop = st;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + view));
  $$('#tabbar button').forEach(b => { const on = b.dataset.v === view; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  document.body.classList.toggle('resting', !!(S.active && S.active.rest));
}
function go(v) {
  if (v === view && !$('#sheet-root').innerHTML) { $('#v-' + v).scrollTo({ top: 0, behavior: 'smooth' }); return; }
  view = v; closeSheet(true); render();
  if (v === 'coach' && coachTab === 'ask') scrollChat();
}
function scrollChat() { const el = $('#v-coach'); requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); }

/* ================= sheets, toast, confirm ================= */
function sheet(html) {
  const root = $('#sheet-root'); closeSheet(true);
  root.innerHTML = `<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><button class="icon-btn sheet-x" data-act="closeSheet" aria-label="Close">${I.x}</button><div class="sheet-body">${html}</div></div>`;
  void root.offsetWidth; root.classList.add('open');
  const sh = $('.sheet', root), body = $('.sheet-body', root); let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if (body.scrollTop <= 0 && !e.target.closest('input,select,textarea')) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { sh.style.transition = 'none'; sh.style.transform = `translateY(${dy}px)`; } }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 == null) return; sh.style.transition = ''; sh.style.transform = ''; if (dy > 100) closeSheet(); y0 = null; });
}
function closeSheet(now) {
  const root = $('#sheet-root'); if (!root.innerHTML) return;
  root.classList.remove('open');
  if (now === true) { root.innerHTML = ''; return; }
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 300);
}
let toastTimer = null, toastFn = null;
function toast(msg, btn, fn) {
  const t = $('#toast'); toastFn = fn || null;
  t.innerHTML = `<span>${esc(msg)}</span>${btn ? `<button data-act="toastBtn">${esc(btn)}</button>` : ''}`;
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), btn ? 8000 : 2400);
}
let onConfirm = null;
function confirmSheet(title, body, ok, fn, danger = true) {
  onConfirm = fn;
  sheet(`<h2>${title}</h2><p class="muted">${body}</p><div class="btn-col"><button class="btn wide ${danger ? 'danger-fill' : 'primary'}" data-act="confirmOk">${ok}</button><button class="btn wide" data-act="closeSheet">Cancel</button></div>`);
}

/* ================= rest timer, audio, wake lock ================= */
let actx = null, wakeLock = null;
function unlockAudio() { try { if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); } if (actx && actx.state === 'suspended') actx.resume(); } catch (e) {} }
function beep() {
  if (!actx) return;
  try {
    const t = actx.currentTime;
    [0, 0.22, 0.44].forEach((o, i) => {
      const osc = actx.createOscillator(), g = actx.createGain();
      osc.frequency.value = i === 2 ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, t + o); g.gain.exponentialRampToValueAtTime(0.35, t + o + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.18);
      osc.connect(g); g.connect(actx.destination); osc.start(t + o); osc.stop(t + o + 0.2);
    });
  } catch (e) {}
}
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
function startRest(sec) { if (!S.active) return; S.active.rest = { end: Date.now() + sec * 1000, total: sec }; save(); document.body.classList.add('resting'); restLoop(); }
function stopRest() { if (S.active) { S.active.rest = null; save(); } $('#restbar').hidden = true; document.body.classList.remove('resting'); }
function restLoop() {
  const r = S.active && S.active.rest, bar = $('#restbar');
  if (!r) { if (!bar.hidden) { bar.hidden = true; document.body.classList.remove('resting'); } return; }
  const left = Math.ceil((r.end - Date.now()) / 1000);
  if (left <= 0) { stopRest(); beep(); haptic([200, 100, 200]); toast('Rest done. Next set.'); return; }
  bar.hidden = false;
  $('#rb-left').textContent = mmss(left);
  $('#rb-fill').style.width = `${clamp(1 - left / r.total, 0, 1) * 100}%`;
}

/* ================= session actions ================= */
function newExEntry(id) {
  const d = getEx(id), rec = recommend(id), last = lastEntry(id);
  let n = d.type === 'ladder' ? ladderLevel(d.ladder).sets : d.sets, w = '';
  if (d.type === 'wr') w = rec && rec.w != null ? rec.w : last ? Math.max(...last.sets.map(s => num(s.w))) : '';
  return { id, sets: Array.from({ length: n }, () => ({ w: w === '' ? '' : String(w), r: '', done: false })) };
}
function startSession(dayId) {
  if (S.active) { go('train'); return; }
  const d = S.prog[S.mode][dayId]; if (!d) return;
  S.active = { start: Date.now(), mode: S.mode, dayId, name: d.name, color: d.color, ex: d.ex.filter(getEx).map(newExEntry), rest: null };
  save(); unlockAudio(); keepAwake(true); view = 'train'; closeSheet(true); render(); $('#v-train').scrollTop = 0;
}
function finishSession() {
  const a = S.active;
  const ex = a.ex.map(e => {
    const d = getEx(e.id); if (!d) return null;
    return { id: e.id, name: exName(e.id), type: d.type, ladder: d.ladder || null, level: d.ladder ? S.ladders[d.ladder] : null,
      sets: e.sets.filter(s => s.done && num(s.r) > 0).map(s => ({ w: num(s.w), r: num(s.r) })) };
  }).filter(e => e && e.sets.length);
  const volume = Math.round(ex.reduce((v, e) => v + (e.type === 'wr' && !(getEx(e.id) || {}).unit ? e.sets.reduce((a, s) => a + s.w * s.r, 0) : 0), 0));
  const w = { id: uid(), date: dkey(new Date(a.start)), ts: a.start, end: Date.now(), mode: a.mode, dayId: a.dayId, name: a.name, color: a.color, ex, volume, sets: ex.reduce((n, e) => n + e.sets.length, 0) };
  const prs = prsIn(w);
  S.workouts.push(w); S.workouts.sort((x, y) => x.ts - y.ts);
  S.active = null; stopRest(); keepAwake(false); save(); render();
  const ups = ladderStatus().filter(x => x.rec && x.rec.levelUp && ex.some(e => e.ladder === x.l));
  const mins = Math.round((w.end - w.ts) / 60000);
  sheet(`<div class="sum-hero c-${w.color}"><div class="plate"></div><h2 style="margin:0">Session saved</h2><p class="muted">${esc(w.name)}</p></div>
    <div class="stats"><div class="stat"><span>Time</span><b>${mins}<small>min</small></b></div><div class="stat"><span>Sets</span><b>${w.sets}</b></div><div class="stat"><span>Volume</span><b>${fmt(volume)}<small>kg</small></b></div><div class="stat"><span>New bests</span><b>${prs.length}</b></div></div>
    ${prs.length ? `<div class="ins tone-good" style="margin-top:12px"><h3>New bests</h3><p>${prs.map(p => `${esc(exName(p.id))}: ${kg(r1(p.prior))} → ${kg(r1(p.e1))} kg estimated max`).join('<br>')}</p></div>` : ''}
    ${ups.map(x => `<div class="ins tone-good"><h3>Ladder goal cleared</h3><p>Move up to ${LADDER_NAME[x.l].toLowerCase()} level ${x.lvl + 1}: ${esc(LADDERS[x.l][x.lvl].name)}.</p><button class="btn small" data-act="levelUp" data-l="${x.l}">Move up</button></div>`).join('')}
    <button class="btn primary wide" data-act="closeSheet">Done</button>`);
}

/* ================= food actions ================= */
let pendingFood = null, pendingMeal = null;
function defaultMeal() { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 10.5 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 20.5 ? 'Dinner' : 'Snacks'; }
const mealSelect = m => `<label class="field"><span>Meal</span><select class="in" id="fmeal">${MEALS.map(x => `<option ${x === m ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
function foodRow(f, qty) { const q = qty ?? f.serve; return `<button class="frow" data-act="pickFood" data-f="${f.id}" data-q="${q}"><span><b>${esc(f.name)}</b><small>${fmtQty(q, f)}</small></span><span class="kc">${fmt((f.kcal * q) / f.base)} kcal</span></button>`; }
function foodList(q) {
  q = (q || '').trim().toLowerCase();
  const all = [...S.customFoods, ...FOODS];
  if (!q) {
    const rec = S.recent.map(r => ({ f: foodById(r.fid), qty: r.qty })).filter(x => x.f).slice(0, 8);
    return (rec.length ? `<h3 class="list-h">Recent</h3><div class="list">${rec.map(x => foodRow(x.f, x.qty)).join('')}</div>` : '') + `<h3 class="list-h">All foods</h3><div class="list">${all.map(f => foodRow(f)).join('')}</div>`;
  }
  const items = all.filter(f => f.name.toLowerCase().includes(q));
  return items.length ? `<div class="list" style="margin-top:12px">${items.map(f => foodRow(f)).join('')}</div>` : `<p class="muted" style="margin-top:14px">No match. Create it as a new food below.</p>`;
}
function addFoodSheet(meal) {
  pendingMeal = meal || defaultMeal();
  sheet(`<h2>Add to ${pendingMeal.toLowerCase()}</h2><input class="in" style="text-align:left" id="fsearch" type="search" placeholder="Search foods" data-in="fsearch" autocomplete="off">
    <div class="grid2" style="margin-top:10px"><button class="btn" data-act="quickAdd">Quick add</button><button class="btn" data-act="newFood">Create a food</button></div>
    <div id="flist">${foodList('')}</div><p class="note">Values are typical estimates. Check the label for packaged foods.</p>`);
}
function macroPrev(f, q) { const m = num(q) / f.base; return `<div><b>${fmt(f.kcal * m)}</b><span>kcal</span></div><div><b>${fmt(f.p * m)}</b><span>protein</span></div><div><b>${fmt(f.c * m)}</b><span>carbs</span></div><div><b>${fmt(f.f * m)}</b><span>fat</span></div>`; }
function qtySheet(fid, qty, meal, editId) {
  const f = foodById(fid); if (!f) return;
  pendingFood = { fid, editId };
  sheet(`<h2>${esc(f.name)}</h2><p class="muted">Per ${f.unit === 'each' ? 'serving' : f.base + ' ' + f.unit}: ${fmt(f.kcal)} kcal, ${f.p} g protein, ${f.c} g carbs, ${f.f} g fat</p>
    <label class="field"><span>Amount (${f.unit === 'each' ? 'servings' : f.unit})</span><input class="in big" id="fqty" inputmode="decimal" value="${qty}" data-in="fqty"></label>
    ${mealSelect(meal)}<div class="macro-prev" id="fprev">${macroPrev(f, qty)}</div>
    <button class="btn primary wide" data-act="saveFood">${editId ? 'Save changes' : 'Add food'}</button>${editId ? `<button class="btn wide danger" data-act="delFood" data-id="${editId}">Delete entry</button>` : ''}`);
}

/* ================= calculator ================= */
const ACT_LEVELS = [[1.2, 'Mostly sitting, little exercise'], [1.375, 'Light: exercise 1 to 3 days a week'], [1.55, 'Moderate: exercise 3 to 5 days a week'], [1.725, 'Very active: hard training 6 to 7 days'], [1.9, 'Athlete: twice a day or a physical job']];
function calcTDEE(p, tdeeOverride) {
  if (!(p.age > 0 && p.height > 0 && p.weight > 0)) return null;
  const mif = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  const katch = p.bf > 3 && p.bf < 70 ? 370 + 21.6 * p.weight * (1 - p.bf / 100) : null;
  const bmr = katch ?? mif, tdee = tdeeOverride || bmr * p.activity;
  let kcal = p.goal === 'lose' ? tdee - p.rate : p.goal === 'gain' ? tdee + Math.min(p.rate, 500) : tdee;
  const floor = p.sex === 'f' ? 1200 : 1500; let floored = false;
  if (kcal < floor) { kcal = floor; floored = true; }
  kcal = Math.round(kcal / 10) * 10;
  const basisW = p.pBasis === 'goal' && p.goalWeight > 0 ? p.goalWeight : p.weight;
  const prot = Math.round(p.proteinPerKg * basisW), fat = Math.round((kcal * 0.25) / 9), carbs = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { mif, katch, bmr, tdee, kcal, p: prot, c: carbs, f: fat, floored, belowBmr: kcal < bmr };
}
function tdeeOut(p) {
  const r = calcTDEE(p);
  if (!r) return '<p class="muted" style="margin:0">Add age, height and weight to see your numbers.</p>';
  const wk = ((r.tdee - r.kcal) * 7) / 7700;
  return `<div class="bigline"><span class="muted">Daily target</span><b>${fmt(r.kcal)}<small style="font-size:15px;color:var(--ink2)"> kcal</small></b></div>
    <div class="stats"><div class="stat"><span>BMR (at rest)</span><b>${fmt(r.bmr)}</b></div><div class="stat"><span>TDEE (maintenance)</span><b>${fmt(r.tdee)}</b></div>
    <div class="stat"><span>Protein</span><b>${r.p}<small>g</small></b></div><div class="stat"><span>Carbs / fat</span><b>${r.c}<small>g</small> ${r.f}<small>g</small></b></div></div>
    <p class="note">${r.katch ? 'BMR uses Katch-McArdle (from body fat). Mifflin-St Jeor gives ' + fmt(r.mif) + '.' : 'BMR uses Mifflin-St Jeor. Add body fat % for a lean-mass based estimate.'} Expected change: about ${wk > 0 ? '−' : '+'}${kg(Math.abs(r1(wk)))} kg a week.</p>
    ${r.floored ? '<p class="note warn">Raised to a safe minimum. Going lower than this is hard to sustain and risks losing muscle.</p>' : r.belowBmr ? '<p class="note warn">This is below your resting burn. A smaller deficit will be easier to stick with.</p>' : ''}`;
}
function tdeeSheet(first) {
  const p = Object.assign({ name: '', sex: 'm', age: '', height: '', weight: latestWeight() || '', bf: '', activity: 1.375, goal: 'lose', rate: 500, proteinPerKg: 1.6, pBasis: 'current', goalWeight: '' }, S.profile || {});
  const o = (v, l, c) => `<option value="${v}" ${String(v) === String(c) ? 'selected' : ''}>${l}</option>`;
  const nv = v => (v === '' || v == null || v === 0 ? '' : v);
  sheet(`${first ? '<h2>Welcome to LIFT</h2><p class="muted">A few details to set your calorie and protein targets. Everything stays on this phone.</p>' : '<h2>Profile and targets</h2><p class="muted">TDEE is the calories you burn in a day. Your target is set from it.</p>'}
    <form id="tdee" onsubmit="return false">
      <label class="field"><span>First name</span><input class="in" name="name" value="${esc(p.name)}" autocomplete="given-name" data-in="tdee"></label>
      <div class="grid2"><label class="field"><span>Sex</span><select class="in" name="sex" data-ch="tdee">${o('m', 'Male', p.sex)}${o('f', 'Female', p.sex)}</select></label>
      <label class="field"><span>Age</span><input class="in" name="age" inputmode="numeric" value="${nv(p.age)}" data-in="tdee"></label>
      <label class="field"><span>Height (cm)</span><input class="in" name="height" inputmode="decimal" value="${nv(p.height)}" data-in="tdee"></label>
      <label class="field"><span>Weight (kg)</span><input class="in" name="weight" inputmode="decimal" value="${nv(p.weight)}" data-in="tdee"></label></div>
      <label class="field"><span>Body fat % (optional, improves the estimate)</span><input class="in" name="bf" inputmode="decimal" value="${nv(p.bf)}" data-in="tdee"></label>
      <label class="field"><span>Activity</span><select class="in" name="activity" data-ch="tdee">${ACT_LEVELS.map(([v, l]) => o(v, l, p.activity)).join('')}</select></label>
      <div class="grid2"><label class="field"><span>Goal</span><select class="in" name="goal" data-ch="tdee">${o('lose', 'Lose fat', p.goal)}${o('maintain', 'Maintain', p.goal)}${o('gain', 'Build muscle', p.goal)}</select></label>
      <label class="field"><span>Pace</span><select class="in" name="rate" data-ch="tdee">${o(250, 'Gentle', p.rate)}${o(500, 'Steady', p.rate)}${o(750, 'Fast', p.rate)}</select></label>
      <label class="field"><span>Goal weight (kg)</span><input class="in" name="goalWeight" inputmode="decimal" value="${nv(p.goalWeight)}" data-in="tdee"></label>
      <label class="field"><span>Protein (g per kg)</span><input class="in" name="ppk" inputmode="decimal" value="${p.proteinPerKg}" data-in="tdee"></label></div>
      <label class="field"><span>Base protein on</span><select class="in" name="pBasis" data-ch="tdee">${o('current', 'Current weight', p.pBasis)}${o('goal', 'Goal weight (better if you carry a lot of body fat)', p.pBasis)}</select></label>
    </form>
    <div id="tdee-out" class="tdee-out">${tdeeOut(p)}</div>
    <button class="btn primary wide" data-act="tdeeSave">${first ? 'Save and start' : 'Save targets'}</button>`);
}
function readTDEE() {
  const f = $('#tdee'); const g = n => f.elements[n].value;
  return { name: g('name').trim(), sex: g('sex'), age: num(g('age')), height: num(g('height')), weight: num(g('weight')), bf: num(g('bf')), activity: num(g('activity')), goal: g('goal'), rate: num(g('rate')), goalWeight: num(g('goalWeight')), proteinPerKg: num(g('ppk')) || 1.6, pBasis: g('pBasis') };
}
function setTargets(r) { S.targets = { kcal: r.kcal, p: r.p, c: r.c, f: r.f, tdee: Math.round(r.tdee), bmr: Math.round(r.bmr) }; }

/* ================= other sheets ================= */
function bwSheet() {
  const lw = latestWeight();
  sheet(`<h2>Log weight</h2><p class="muted">Weigh in the morning, after the toilet, before eating.</p>
    <label class="field"><span>Weight (kg)</span><input class="in big" id="bwkg" inputmode="decimal" value="${lw ? kg(lw) : ''}"></label>
    <label class="field"><span>Date</span><input class="in" id="bwdate" type="date" value="${dkey()}" max="${dkey()}"></label>
    <button class="btn primary wide" data-act="saveBw">Save weight</button>`);
}
function cardioSheet() {
  sheet(`<h2>Log cardio</h2><label class="field"><span>Type</span><select class="in" id="ctype">${['Skipping', 'Bag work', 'Running', 'Stationary bike', 'Cycling', 'Walking', 'Other'].map(t => `<option>${t}</option>`).join('')}</select></label>
    <div class="grid2"><label class="field"><span>Minutes</span><input class="in" id="cmin" inputmode="numeric"></label><label class="field"><span>Distance (km, optional)</span><input class="in" id="ckm" inputmode="decimal"></label></div>
    <label class="field"><span>Date</span><input class="in" id="cdate" type="date" value="${dkey()}" max="${dkey()}"></label>
    <button class="btn primary wide" data-act="saveCardio">Save cardio</button>`);
}
function ladderSheet(l) {
  const L = LADDERS[l], cur = S.ladders[l];
  sheet(`<h2>${LADDER_NAME[l]} ladder</h2><p class="muted">Clear the goal on every set, then move up a level.</p><div class="list">${L.map((lv, i) => `<button class="frow" data-act="setLvl" data-l="${l}" data-v="${i + 1}"><span><b>${i + 1}. ${esc(lv.name)}</b><small>Goal ${lv.sets} × ${lv.reps}${lv.unit === 's' ? ' s' : ''}</small></span><span class="kc">${i + 1 === cur ? 'Current' : ''}</span></button>`).join('')}</div>`);
}
function addExSheet(q = '') {
  sheet(`<h2>Add exercise</h2><input class="in" style="text-align:left" type="search" placeholder="Search exercises" data-in="exsearch" value="${esc(q)}" autocomplete="off"><div id="exlist">${exList(q)}</div>
    <button class="btn wide" data-act="newEx">Create a custom exercise</button>`);
}
function exList(q) {
  q = (q || '').toLowerCase();
  const all = { ...EX, ...S.customEx };
  return MUSCLES.map(m => {
    const ids = Object.keys(all).filter(id => all[id].m[0] === m && all[id].name.toLowerCase().includes(q));
    return ids.length ? `<h3 class="list-h">${m[0].toUpperCase() + m.slice(1)}</h3><div class="list">${ids.map(id => `<button class="frow" data-act="pickEx" data-id="${id}"><span><b>${esc(all[id].name)}</b></span><span class="kc">${I.plus}</span></button>`).join('')}</div>` : '';
  }).join('') || '<p class="muted" style="margin-top:12px">No match. Create a custom exercise below.</p>';
}
function newExSheet() {
  sheet(`<h2>Custom exercise</h2><label class="field"><span>Name</span><input class="in" id="nxname"></label>
    <div class="grid2"><label class="field"><span>Type</span><select class="in" id="nxtype"><option value="wr">Weight and reps</option><option value="r">Reps only</option><option value="t">Time (seconds)</option></select></label>
    <label class="field"><span>Main muscle</span><select class="in" id="nxm">${MUSCLES.filter(m => m !== 'cardio').map(m => `<option>${m}</option>`).join('')}</select></label>
    <label class="field"><span>Sets</span><input class="in" id="nxsets" inputmode="numeric" value="3"></label><label class="field"><span>Weight step (kg)</span><input class="in" id="nxinc" inputmode="decimal" value="2"></label>
    <label class="field"><span>Rep range low</span><input class="in" id="nxlo" inputmode="numeric" value="8"></label><label class="field"><span>Rep range high</span><input class="in" id="nxhi" inputmode="numeric" value="12"></label></div>
    <button class="btn primary wide" data-act="saveEx">Add exercise</button>`);
}
function settingsSheet() {
  const sch = S.prog.schedule; const opts = [['', 'Rest'], ...DAY_ORDER.filter(id => S.prog[S.mode][id]).map(id => [id, S.prog[S.mode][id].name.split(':')[0]])];
  sheet(`<h2>Settings</h2>
    <div class="list"><button class="frow" data-act="tdee"><span><b>Profile and calorie targets</b><small>${S.targets ? `${fmt(S.targets.kcal)} kcal, ${S.targets.p} g protein` : 'Not set'}</small></span><span class="kc">${I.right}</span></button></div>
    <h3 class="list-h">Training week</h3><div class="card">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="field" style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><span style="flex:1;margin:0;color:var(--ink)">${DOW[d]}</span><select class="in" style="width:150px" data-ch="sched" data-day="${d}">${opts.map(([v, l]) => `<option value="${v}" ${(sch[d] || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div>
    <label class="field"><span>Default rest time</span><select class="in" data-ch="rest">${[30, 45, 60, 90, 120, 180].map(s => `<option value="${s}" ${S.settings.rest === s ? 'selected' : ''}>${s} seconds</option>`).join('')}</select></label>
    <p class="note" style="margin-top:-6px">Each exercise has its own rest time. This is used for custom exercises.</p>
    <h3 class="list-h">Your data</h3><div class="list">
      <button class="frow" data-act="export"><span><b>Back up data</b><small>Save a file you can restore later. Do this every few weeks.</small></span></button>
      <button class="frow" data-act="import"><span><b>Restore from backup</b><small>Replaces what is on this phone</small></span></button>
      <button class="frow" data-act="installHelp"><span><b>Install on your phone</b><small>Open full screen and work offline</small></span></button>
      <button class="frow" data-act="wipe"><span><b style="color:var(--red)">Delete all data</b><small>Cannot be undone</small></span></button></div>
    <p class="note">LIFT ${VERSION}. Your data never leaves this phone.</p>`);
}
function installHelp() {
  sheet(`<h2>Install LIFT</h2><p><b>iPhone:</b> open the site in Safari, tap the Share button, scroll down and tap <b>Add to Home Screen</b>.</p><p><b>Android:</b> open it in Chrome, tap the menu (three dots) and choose <b>Install app</b>.</p><p class="muted">Once installed it opens full screen, works with no signal, and your data is kept safely by the phone.</p>${deferredPrompt ? '<button class="btn primary wide" data-act="install">Install now</button>' : ''}`);
}

/* ================= action handlers ================= */
const ACT = {
  go: t => { if (t.dataset.p) progTab = t.dataset.p; go(t.dataset.v); },
  closeSheet: () => closeSheet(),
  confirmOk: () => { const f = onConfirm; onConfirm = null; closeSheet(true); f && f(); },
  toastBtn: () => { $('#toast').classList.remove('show'); toastFn && toastFn(); },
  mode: t => { S.mode = t.dataset.v; save(); render(); },
  coachTab: t => { coachTab = t.dataset.v; render(); if (coachTab === 'ask') scrollChat(); },
  progTab: t => { progTab = t.dataset.v; render(); },
  settings: settingsSheet, tdee: () => tdeeSheet(false), bw: bwSheet, cardio: cardioSheet, installHelp,
  start: t => startSession(t.dataset.d),
  ladder: t => ladderSheet(t.dataset.l),
  setLvl: t => { S.ladders[t.dataset.l] = +t.dataset.v; save(); closeSheet(); render(); },
  lvl: t => { const l = t.dataset.l; S.ladders[l] = clamp(S.ladders[l] + +t.dataset.d, 1, LADDERS[l].length); syncLadderSets(l); save(); render(); },
  levelUp: t => { const l = t.dataset.l; S.ladders[l] = clamp(S.ladders[l] + 1, 1, LADDERS[l].length); save(); closeSheet(); render(); toast(`Level ${S.ladders[l]}: ${ladderLevel(l).name}`); },
  deload: () => { S.settings.lastDeload = dkey(); save(); render(); toast('Deload week noted'); },
  tick: t => {
    const i = +t.dataset.e, j = +t.dataset.s, e = S.active.ex[i], s = e.sets[j], d = getEx(e.id);
    if (s.done) { s.done = false; save(); render(); return; }
    if (d.type === 'wr' && String(s.w).trim() === '') { toast('Enter a weight first'); const inp = $(`input[data-in="w"][data-e="${i}"][data-s="${j}"]`); inp && inp.focus(); return; }
    if (!(num(s.r) > 0)) s.r = String(targetFor(e));
    s.done = true; unlockAudio(); haptic(12);
    const nx = e.sets[j + 1]; if (nx && d.type === 'wr' && String(nx.w).trim() === '') nx.w = s.w;
    const allDone = S.active.ex.every(x => x.sets.every(y => y.done));
    if (!allDone) startRest(restFor(d)); else { stopRest(); toast('All sets done. Tap Finish to save.'); }
    save(); render();
  },
  addSet: t => { const e = S.active.ex[+t.dataset.e], l = e.sets[e.sets.length - 1]; e.sets.push({ w: l ? l.w : '', r: '', done: false }); save(); render(); },
  rmSet: t => { const e = S.active.ex[+t.dataset.e]; if (e.sets.length > 1) e.sets.pop(); save(); render(); },
  rmEx: t => { const i = +t.dataset.e; confirmSheet('Remove exercise?', `${esc(exName(S.active.ex[i].id))} and its sets will be removed from this session.`, 'Remove', () => { S.active.ex.splice(i, 1); save(); render(); }); },
  addEx: () => addExSheet(),
  newEx: newExSheet,
  pickEx: t => { S.active.ex.push(newExEntry(t.dataset.id)); save(); closeSheet(); render(); const el = $('#v-train'); requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); },
  saveEx: () => {
    const name = $('#nxname').value.trim(); if (!name) { toast('Give it a name'); return; }
    const lo = Math.max(1, num($('#nxlo').value) || 8), hi = Math.max(lo, num($('#nxhi').value) || 12);
    const id = 'c_' + uid();
    S.customEx[id] = { name, type: $('#nxtype').value, m: [$('#nxm').value], inc: num($('#nxinc').value) || 2, sets: clamp(num($('#nxsets').value) || 3, 1, 10), lo, hi, rest: null, custom: true };
    if (S.active) S.active.ex.push(newExEntry(id));
    save(); closeSheet(); render();
  },
  saveLayout: () => { const a = S.active; if (!S.prog[a.mode][a.dayId]) return; S.prog[a.mode][a.dayId].ex = a.ex.map(e => e.id); save(); toast(`${a.name} updated`); },
  discard: () => confirmSheet('Discard session?', 'Nothing from this session will be saved.', 'Discard', () => { S.active = null; stopRest(); keepAwake(false); save(); render(); }),
  finish: () => {
    const any = S.active.ex.some(e => e.sets.some(s => s.done && num(s.r) > 0));
    if (!any) { confirmSheet('No sets ticked', 'Tick the sets you did before finishing, or discard this session.', 'Discard session', () => { S.active = null; stopRest(); keepAwake(false); save(); render(); }); return; }
    const open = S.active.ex.reduce((n, e) => n + e.sets.filter(s => !s.done).length, 0);
    if (open) confirmSheet('Finish session?', `${open} set${open > 1 ? 's are' : ' is'} not ticked and won't be saved.`, 'Finish and save', finishSession, false);
    else finishSession();
  },
  restAdj: t => { const r = S.active && S.active.rest; if (!r) return; r.end += +t.dataset.d * 1000; r.total = Math.max(5, r.total + +t.dataset.d); if (r.end <= Date.now()) stopRest(); save(); restLoop(); },
  restSet: t => startRest(+t.dataset.d),
  restSkip: () => stopRest(),
  fday: t => { foodDate = addDays(foodDate, +t.dataset.d); if (foodDate > dkey()) foodDate = dkey(); render(); },
  addFood: t => addFoodSheet(t.dataset.m || ''),
  pickFood: t => qtySheet(t.dataset.f, t.dataset.q, pendingMeal || defaultMeal(), null),
  editFood: t => {
    const e = (S.food[foodDate] || []).find(x => x.id === t.dataset.id); if (!e) return;
    if (e.fid && foodById(e.fid)) { qtySheet(e.fid, e.qty, e.meal, e.id); return; }
    confirmSheet(esc(e.name), `${fmt(e.kcal)} kcal, ${fmt(e.p)} g protein.`, 'Delete entry', () => { S.food[foodDate] = S.food[foodDate].filter(x => x.id !== e.id); save(); render(); });
  },
  saveFood: () => {
    const f = foodById(pendingFood.fid), qty = num($('#fqty').value), meal = $('#fmeal').value;
    if (!(qty > 0)) { toast('Enter an amount'); return; }
    const m = qty / f.base;
    const entry = { id: pendingFood.editId || uid(), fid: f.id, name: f.name, qty, unit: f.unit, meal, kcal: f.kcal * m, p: f.p * m, c: f.c * m, f: f.f * m };
    const L = (S.food[foodDate] = S.food[foodDate] || []);
    const ix = L.findIndex(x => x.id === entry.id); if (ix >= 0) L[ix] = entry; else L.push(entry);
    S.recent = [{ fid: f.id, qty }, ...S.recent.filter(r => r.fid !== f.id)].slice(0, 12);
    save(); closeSheet(); if (view !== 'food' && view !== 'today') view = 'food'; render(); toast(`${f.name} added`);
  },
  delFood: t => { S.food[foodDate] = (S.food[foodDate] || []).filter(x => x.id !== t.dataset.id); save(); closeSheet(); render(); },
  quickAdd: () => {
    sheet(`<h2>Quick add</h2><label class="field"><span>Name (optional)</span><input class="in" id="qname" placeholder="Takeaway, braai, etc."></label>
      <div class="grid2"><label class="field"><span>Calories</span><input class="in" id="qkcal" inputmode="numeric"></label><label class="field"><span>Protein (g, optional)</span><input class="in" id="qp" inputmode="decimal"></label></div>
      ${mealSelect(pendingMeal || defaultMeal())}<button class="btn primary wide" data-act="saveQuick">Add</button>`);
  },
  saveQuick: () => {
    const k = num($('#qkcal').value); if (!(k > 0)) { toast('Enter calories'); return; }
    const L = (S.food[foodDate] = S.food[foodDate] || []);
    L.push({ id: uid(), fid: null, name: $('#qname').value.trim() || 'Quick add', qty: 1, unit: 'each', meal: $('#fmeal').value, kcal: k, p: num($('#qp').value), c: 0, f: 0 });
    save(); closeSheet(); render();
  },
  newFood: () => {
    sheet(`<h2>Create a food</h2><label class="field"><span>Name</span><input class="in" id="nfname"></label>
      <label class="field"><span>Values are per</span><select class="in" id="nfunit"><option value="g">100 g</option><option value="ml">100 ml</option><option value="each">1 serving</option></select></label>
      <div class="grid2"><label class="field"><span>Calories</span><input class="in" id="nfk" inputmode="decimal"></label><label class="field"><span>Protein (g)</span><input class="in" id="nfp" inputmode="decimal"></label>
      <label class="field"><span>Carbs (g)</span><input class="in" id="nfc" inputmode="decimal"></label><label class="field"><span>Fat (g)</span><input class="in" id="nff" inputmode="decimal"></label></div>
      <p class="note">Copy these from the nutrition table on the pack.</p><button class="btn primary wide" data-act="saveNewFood">Save food</button>`);
  },
  saveNewFood: () => {
    const name = $('#nfname').value.trim(), unit = $('#nfunit').value, k = num($('#nfk').value);
    if (!name || !(k >= 0) || $('#nfk').value === '') { toast('Add a name and calories'); return; }
    const f = { id: 'cf_' + uid(), name, unit, base: unit === 'each' ? 1 : 100, kcal: k, p: num($('#nfp').value), c: num($('#nfc').value), f: num($('#nff').value), serve: unit === 'each' ? 1 : 100, custom: true };
    S.customFoods.unshift(f); save(); qtySheet(f.id, f.serve, pendingMeal || defaultMeal(), null);
  },
  tdeeSave: () => {
    const p = readTDEE(), r = calcTDEE(p);
    if (!r) { toast('Add your age, height and weight'); return; }
    const firstTime = !S.profile;
    S.profile = p; setTargets(r);
    if (!S.bw.length && p.weight) S.bw.push({ date: dkey(), kg: p.weight });
    save(); closeSheet(); render(); toast(firstTime ? 'All set. Have a good session.' : 'Targets saved');
  },
  useAdaptive: () => {
    const a = adaptiveTDEE(); if (!a.est || !S.profile) return;
    const r = calcTDEE(Object.assign({}, S.profile, { weight: latestWeight() || S.profile.weight }), roundTo(a.est, 10));
    if (r) { setTargets(r); save(); render(); toast(`Target now ${fmt(r.kcal)} kcal`); }
  },
  saveBw: () => {
    const v = num($('#bwkg').value), d = $('#bwdate').value || dkey();
    if (!(v > 20 && v < 400)) { toast('Enter a weight in kg'); return; }
    S.bw = S.bw.filter(b => b.date !== d); S.bw.push({ date: d, kg: r1(v) }); S.bw = sortedBW();
    if (S.profile && d === S.bw[S.bw.length - 1].date) S.profile.weight = r1(v);
    save(); closeSheet(); render(); toast('Weight saved');
  },
  delBw: t => confirmSheet('Delete weigh-in?', longDate(t.dataset.d), 'Delete', () => { S.bw = S.bw.filter(b => b.date !== t.dataset.d); save(); render(); }),
  saveCardio: () => {
    const min = num($('#cmin').value); if (!(min > 0)) { toast('Enter minutes'); return; }
    S.cardio.push({ id: uid(), type: $('#ctype').value, min, km: num($('#ckm').value) || null, date: $('#cdate').value || dkey() });
    save(); closeSheet(); render(); toast('Cardio saved');
  },
  delCardio: t => confirmSheet('Delete cardio entry?', 'This cannot be undone.', 'Delete', () => { S.cardio = S.cardio.filter(c => c.id !== t.dataset.id); save(); render(); }),
  delWorkout: t => confirmSheet('Delete session?', 'This removes it from your history and charts.', 'Delete', () => { S.workouts = S.workouts.filter(w => w.id !== t.dataset.id); save(); render(); }),
  ask: t => sendChat(t.dataset.q),
  send: () => { const i = $('#chatIn'); if (i && i.value.trim()) sendChat(i.value.trim()); },
  export: exportData,
  import: () => $('#importFile').click(),
  wipe: () => confirmSheet('Delete all data?', 'Every workout, weigh-in and food entry on this phone will be erased. Back up first if you might want it.', 'Delete everything', () => { localStorage.removeItem(KEY); S = fresh(); render(); tdeeSheet(true); }),
  hideInstall: () => { S.settings.hideInstall = true; save(); render(); },
  install: async () => { if (!deferredPrompt) { installHelp(); return; } deferredPrompt.prompt(); try { await deferredPrompt.userChoice; } catch (e) {} deferredPrompt = null; closeSheet(); render(); },
};
function syncLadderSets(l) {
  if (!S.active) return; const lv = ladderLevel(l);
  S.active.ex.forEach(e => { const d = getEx(e.id); if (d && d.ladder === l && !e.sets.some(s => s.done)) { while (e.sets.length < lv.sets) e.sets.push({ w: '', r: '', done: false }); } });
}
function sendChat(q) {
  S.chat.push({ from: 'me', text: q });
  render(); scrollChat();
  const chat = $('#chat'); if (chat) { chat.insertAdjacentHTML('beforeend', '<div class="msg coach typing">Thinking…</div>'); scrollChat(); }
  setTimeout(() => { let html; try { html = answer(q); } catch (e) { html = '<p>Something went wrong reading your logs. Try asking another way.</p>'; } S.chat.push({ from: 'coach', html }); S.chat = S.chat.slice(-40); save(); render(); scrollChat(); }, 380);
}
async function exportData() {
  const name = `lift-backup-${dkey()}.json`, blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
  try { const file = new File([blob], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'LIFT backup' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast('Backup saved');
}

/* ================= input handlers ================= */
const INP = {
  w: t => { S.active.ex[+t.dataset.e].sets[+t.dataset.s].w = t.value; saveSoon(); },
  r: t => { S.active.ex[+t.dataset.e].sets[+t.dataset.s].r = t.value; saveSoon(); },
  fsearch: t => { $('#flist').innerHTML = foodList(t.value); },
  exsearch: t => { $('#exlist').innerHTML = exList(t.value); },
  fqty: t => { const f = foodById(pendingFood.fid); $('#fprev').innerHTML = macroPrev(f, t.value); },
  tdee: () => { $('#tdee-out').innerHTML = tdeeOut(readTDEE()); },
};
const CHG = {
  tdee: () => INP.tdee(),
  sched: t => { const d = t.dataset.day; if (t.value) S.prog.schedule[d] = t.value; else delete S.prog.schedule[d]; save(); render(); },
  rest: t => { S.settings.rest = +t.value; save(); },
  progEx: t => { progEx = t.value; render(); },
  import: t => {
    const file = t.files && t.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.workouts)) throw new Error('bad');
        confirmSheet('Restore this backup?', `${d.workouts.length} sessions and ${(d.bw || []).length} weigh-ins. Everything currently on this phone will be replaced.`, 'Restore', () => {
          const f = fresh(); S = Object.assign(f, d, { settings: Object.assign(f.settings, d.settings || {}) }); save(); render(); toast('Backup restored');
        });
      } catch (e) { toast('That file is not a LIFT backup'); }
      t.value = '';
    };
    rd.readAsText(file);
  },
};

/* ================= boot ================= */
function boot() {
  const tabs = { today: ['Today', I.today], train: ['Train', I.train], food: ['Food', I.food], coach: ['Coach', I.coach], progress: ['Progress', I.progress] };
  $$('#tabbar button').forEach(b => { const [l, ic] = tabs[b.dataset.v]; b.innerHTML = `${ic}<span>${l}</span>`; });
  document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (!t || t.disabled) return; const f = ACT[t.dataset.act]; if (f) { e.preventDefault(); f(t, e); } });
  document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.in; if (k && INP[k]) INP[k](e.target, e); });
  document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.ch; if (k && CHG[k]) CHG[k](e.target, e); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'chatIn') { e.preventDefault(); ACT.send(); }
    else if (e.target.dataset && (e.target.dataset.in === 'w' || e.target.dataset.in === 'r')) { e.preventDefault(); e.target.blur(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (S.active) keepAwake(true); restLoop(); if (!$('#sheet-root').innerHTML && !document.activeElement.matches('input')) render(); } else save(); });
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (view === 'today') render(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; render(); });

  setInterval(restLoop, 250);
  setInterval(() => { const el = $('#elapsed'); if (el && S.active) el.textContent = mmss(Math.floor((Date.now() - S.active.start) / 1000)); }, 1000);
  let lastDay = dkey();
  setInterval(() => { if (dkey() !== lastDay) { if (foodDate === lastDay) foodDate = dkey(); lastDay = dkey(); render(); } }, 60000);

  const q = new URLSearchParams(location.search).get('tab'); if (q && VIEWS[q]) view = q;
  if (S.active) keepAwake(true);
  render(); restLoop();
  if (!S.profile) tdeeSheet(true);

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      const offer = w => toast('A new version is ready', 'Update', () => w.postMessage('skipWaiting'));
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => { const nw = reg.installing; nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw); }); });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; save(); location.reload(); });
  }
}
boot();

// Exercise library: metadata + keyframed poses for the animated figure (see figure.js).
// Ground is y=182; a standing hip sits at y≈114.
const STAND_LEGS = { l1: { to: [102, 180] }, l2: { to: [98, 180] } };
const stand = (o = {}) => ({ x: 100, y: 114, t: 180, a1: [5, 3], a2: [-4, 0], ...STAND_LEGS, ...o });
const frontStand = (o = {}) => ({ x: 100, y: 114, t: 180, sym: true, a1: [12, 6], l1: { to: [108, 180], bend: 1 }, ...o });

export const GROUPS = {
  legs: { th: 'ขา/ก้น', en: 'Legs & glutes' },
  push: { th: 'อก/ไหล่/หลังแขน', en: 'Chest, shoulders, triceps' },
  pull: { th: 'หลัง/หน้าแขน', en: 'Back & biceps' },
  core: { th: 'แกนกลาง', en: 'Core' },
  cardio: { th: 'คาร์ดิโอ', en: 'Cardio' },
  mobility: { th: 'ยืดเหยียด', en: 'Mobility' },
};
export const EQUIP = {
  none: { th: 'ไม่ใช้อุปกรณ์', en: 'Bodyweight' },
  db: { th: 'ดัมเบล', en: 'Dumbbells' },
  gym: { th: 'ยิม/บาร์เบล', en: 'Gym / barbell' },
};

export const EXERCISES = [
  {
    id: 'squat', group: 'legs', equip: 'none', level: 1, type: 'reps', met: 5, hl: ['th'],
    name: { th: 'สควอท', en: 'Bodyweight squat' }, muscles: { th: 'ต้นขาหน้า ก้น', en: 'Quads, glutes' },
    cues: { th: ['เท้ากว้างเท่าไหล่ ปลายเท้าแบะเล็กน้อย', 'ดันสะโพกไปด้านหลังเหมือนนั่งเก้าอี้', 'เข่าไปทิศเดียวกับปลายเท้า หลังตรง'], en: ['Feet shoulder-width, toes slightly out', 'Sit the hips back like into a chair', 'Knees track over toes, chest up'] },
    frames: [stand({ x: 96, a1: [92, 90], a2: [88, 90] }), { x: 74, y: 148, t: 142, a1: [105, 95], a2: [100, 92], ...STAND_LEGS }], dur: [1100, 1100],
  },
  {
    id: 'goblet_squat', group: 'legs', equip: 'db', level: 1, type: 'reps', met: 5.5, hl: ['th'], prop: 'kb',
    name: { th: 'กอบเล็ตสควอท', en: 'Goblet squat' }, muscles: { th: 'ต้นขาหน้า ก้น แกนกลาง', en: 'Quads, glutes, core' },
    cues: { th: ['ถือดัมเบลชิดอก ข้อศอกชี้ลง', 'ย่อลงจนต้นขาขนานพื้นหรือต่ำกว่า', 'ดันส้นเท้าลุกขึ้น'], en: ['Hold the weight at your chest, elbows down', 'Squat to parallel or below', 'Drive up through the heels'] },
    frames: [stand({ x: 96, a1: [22, 150], a2: [18, 150] }), { x: 74, y: 148, t: 145, a1: [55, 165], a2: [50, 165], ...STAND_LEGS }], dur: [1200, 1200],
  },
  {
    id: 'lunge', group: 'legs', equip: 'none', level: 1, type: 'reps', met: 5, hl: ['th', 'sh'],
    name: { th: 'สปลิตสควอท / ลันจ์', en: 'Split squat' }, muscles: { th: 'ต้นขา ก้น', en: 'Quads, glutes' },
    cues: { th: ['ก้าวเท้ายาว ลำตัวตั้งตรง', 'ย่อลงจนเข่าหลังเกือบแตะพื้น', 'ทำให้ครบแล้วสลับขา'], en: ['Long stance, torso upright', 'Lower until the back knee nearly touches', 'Finish the set, then switch legs'] },
    frames: [
      { x: 96, y: 118, t: 180, a1: [10, 0], a2: [-10, 0], l1: { to: [126, 180] }, l2: { to: [64, 176] }, f2: 60 },
      { x: 96, y: 146, t: 180, a1: [10, 0], a2: [-10, 0], l1: { to: [126, 180] }, l2: { to: [64, 176] }, f2: 60 },
    ], dur: [1000, 1000],
  },
  {
    id: 'bridge', group: 'legs', equip: 'none', level: 1, type: 'reps', met: 3.5, hl: ['th'], prop: 'mat',
    name: { th: 'กลูทบริดจ์', en: 'Glute bridge' }, muscles: { th: 'ก้น ต้นขาหลัง', en: 'Glutes, hamstrings' },
    cues: { th: ['นอนหงาย ชันเข่า เท้าวางราบ', 'บีบก้นยกสะโพกจนลำตัวเป็นเส้นตรง', 'ค้างไว้ 1 วินาทีแล้วลดลงช้าๆ'], en: ['Lie on your back, knees bent', 'Squeeze glutes, lift hips into a straight line', 'Pause 1s, lower slowly'] },
    frames: [
      { x: 100, y: 172, t: -90, a1: [85, 90], a2: [85, 90], l1: { to: [140, 180], bend: 1 }, l2: { to: [136, 180], bend: 1 } },
      { x: 100, y: 146, t: -62, a1: [80, 90], a2: [80, 90], l1: { to: [140, 180], bend: 1 }, l2: { to: [136, 180], bend: 1 } },
    ], dur: [1000, 1200],
  },
  {
    id: 'calf_raise', group: 'legs', equip: 'none', level: 1, type: 'reps', met: 3, hl: ['sh'],
    name: { th: 'เขย่งปลายเท้า', en: 'Calf raise' }, muscles: { th: 'น่อง', en: 'Calves' },
    cues: { th: ['ยืนตรง น้ำหนักที่ปลายเท้า', 'เขย่งให้สูงสุด ค้าง 1 วินาที', 'ลดส้นลงช้าๆ'], en: ['Stand tall, weight on the balls of the feet', 'Rise as high as possible, hold 1s', 'Lower the heels slowly'] },
    frames: [stand({ f1: 90, f2: 90 }), stand({ y: 107, l1: { to: [102, 173] }, l2: { to: [98, 173] }, f1: 52, f2: 52 })], dur: [800, 900],
  },
  {
    id: 'squat_jump', group: 'cardio', equip: 'none', level: 2, type: 'reps', met: 8, hl: ['th', 'sh'],
    name: { th: 'สควอทจัมพ์', en: 'Squat jump' }, muscles: { th: 'ขา ก้น หัวใจ', en: 'Legs, glutes, cardio' },
    cues: { th: ['ย่อลงสควอท', 'ระเบิดแรงกระโดดขึ้นสุดตัว', 'ลงเท้าเบาๆ ย่อเข่ารับแรง'], en: ['Drop into a squat', 'Explode up as high as you can', 'Land softly with bent knees'] },
    frames: [
      stand({ x: 96, a1: [20, 10], a2: [15, 10], f1: 90, f2: 90 }),
      { x: 74, y: 148, t: 142, a1: [-30, -10], a2: [-35, -10], ...STAND_LEGS, f1: 90, f2: 90 },
      { x: 96, y: 102, t: 180, a1: [170, 176], a2: [165, 176], l1: { to: [102, 170] }, l2: { to: [98, 170] }, f1: 40, f2: 40 },
    ], dur: [500, 450, 450],
  },
  {
    id: 'deadlift', group: 'legs', equip: 'gym', level: 2, type: 'reps', met: 6, hl: ['th', 'torso'], prop: 'plate',
    name: { th: 'เดดลิฟต์', en: 'Barbell deadlift' }, muscles: { th: 'หลังล่าง ก้น ต้นขาหลัง', en: 'Posterior chain' },
    cues: { th: ['บาร์ชิดหน้าแข้ง หลังตรง อกเปิด', 'ดันพื้นด้วยขา ยืดสะโพกพร้อมกัน', 'ลดลงด้วยการพับสะโพก ไม่งอหลัง'], en: ['Bar over mid-foot, flat back', 'Push the floor away, hips and chest rise together', 'Hinge to lower, never round the back'] },
    frames: [
      { x: 78, y: 144, t: 125, h: -10, a1: [0, 0], a2: [0, 0], l1: { to: [100, 180] }, l2: { to: [98, 180] } },
      { x: 96, y: 114, t: 180, a1: [6, 0], a2: [6, 0], l1: { to: [100, 180] }, l2: { to: [98, 180] } },
    ], dur: [1300, 1300],
  },
  {
    id: 'rdl', group: 'legs', equip: 'db', level: 2, type: 'reps', met: 5, hl: ['th'], prop: 'db',
    name: { th: 'โรมาเนียนเดดลิฟต์', en: 'Romanian deadlift' }, muscles: { th: 'ต้นขาหลัง ก้น', en: 'Hamstrings, glutes' },
    cues: { th: ['เข่างอเล็กน้อยตลอดท่า', 'ดันสะโพกไปหลัง ดัมเบลเลื่อนตามขา', 'รู้สึกตึงต้นขาหลังแล้วบีบก้นขึ้น'], en: ['Soft knees throughout', 'Push hips back, weights slide down the legs', 'Feel the hamstring stretch, squeeze up'] },
    frames: [stand({ a1: [4, 0], a2: [4, 0] }), { x: 82, y: 118, t: 110, h: -15, a1: [0, 0], a2: [0, 0], ...STAND_LEGS }], dur: [1300, 1300],
  },
  {
    id: 'pushup', group: 'push', equip: 'none', level: 2, type: 'reps', met: 4, hl: ['torso', 'ua'], prop: 'mat',
    name: { th: 'วิดพื้น', en: 'Push-up' }, muscles: { th: 'อก ไหล่หน้า หลังแขน', en: 'Chest, shoulders, triceps' },
    cues: { th: ['มือกว้างกว่าไหล่เล็กน้อย ลำตัวตรง', 'ลดตัวจนอกเกือบแตะพื้น ศอก 45°', 'ดันขึ้น เกร็งหน้าท้อง'], en: ['Hands slightly wider than shoulders, body straight', 'Lower until chest nearly touches, elbows ~45°', 'Press up with braced core'] },
    frames: [
      { x: 92, y: 146, t: 100, h: -5, a1: { to: [138, 180], bend: -1 }, a2: { to: [134, 180], bend: -1 }, l1: { to: [26, 176] }, l2: { to: [28, 177] }, f1: 15, f2: 15 },
      { x: 92, y: 162, t: 96, h: -5, a1: { to: [138, 180], bend: -1 }, a2: { to: [134, 180], bend: -1 }, l1: { to: [26, 176] }, l2: { to: [28, 177] }, f1: 15, f2: 15 },
    ], dur: [900, 900],
  },
  {
    id: 'knee_pushup', group: 'push', equip: 'none', level: 1, type: 'reps', met: 3.5, hl: ['torso', 'ua'], prop: 'mat',
    name: { th: 'วิดพื้นคุกเข่า', en: 'Knee push-up' }, muscles: { th: 'อก ไหล่ หลังแขน', en: 'Chest, shoulders, triceps' },
    cues: { th: ['คุกเข่า ลำตัวตั้งแต่เข่าถึงหัวเป็นเส้นตรง', 'ลดอกลงช้าๆ', 'ดันขึ้นจนแขนเหยียด'], en: ['Knees down, straight line knees to head', 'Lower the chest slowly', 'Press until arms are straight'] },
    frames: [
      { x: 84, y: 152, t: 105, h: -5, a1: { to: [130, 180], bend: -1 }, a2: { to: [126, 180], bend: -1 }, l1: [-43, -120], l2: [-43, -118], f1: -30, f2: -30 },
      { x: 84, y: 162, t: 99, h: -5, a1: { to: [130, 180], bend: -1 }, a2: { to: [126, 180], bend: -1 }, l1: [-55, -115], l2: [-55, -113], f1: -30, f2: -30 },
    ], dur: [900, 900],
  },
  {
    id: 'bench_press', group: 'push', equip: 'gym', level: 2, type: 'reps', met: 5, hl: ['torso', 'fa'], prop: 'bench plate',
    name: { th: 'เบนช์เพรส', en: 'Bench press' }, muscles: { th: 'อก ไหล่หน้า หลังแขน', en: 'Chest, front delts, triceps' },
    cues: { th: ['สะบักบีบชิด เท้าวางมั่นคง', 'ลดบาร์ลงแตะกลางอก', 'ดันขึ้นเป็นเส้นตรง หายใจออก'], en: ['Shoulder blades pinched, feet planted', 'Lower the bar to mid-chest', 'Press straight up, exhale'] },
    frames: [
      { x: 66, y: 140, t: 90, h: 0, a1: { to: [114, 118], bend: 1 }, a2: { to: [112, 118], bend: 1 }, l1: { to: [40, 180], bend: -1 }, l2: { to: [36, 180], bend: -1 } },
      { x: 66, y: 140, t: 90, h: 0, a1: { to: [113, 93], bend: 1 }, a2: { to: [111, 93], bend: 1 }, l1: { to: [40, 180], bend: -1 }, l2: { to: [36, 180], bend: -1 } },
    ], dur: [1100, 1000],
  },
  {
    id: 'shoulder_press', group: 'push', equip: 'db', level: 1, type: 'reps', met: 4, hl: ['ua'], prop: 'db', view: 'front',
    name: { th: 'ดัมเบลชอลเดอร์เพรส', en: 'Dumbbell shoulder press' }, muscles: { th: 'ไหล่ หลังแขน', en: 'Shoulders, triceps' },
    cues: { th: ['ดัมเบลระดับหู ศอกต่ำกว่าข้อมือ', 'ดันขึ้นเหนือศีรษะจนแขนเกือบเหยียด', 'ลดลงช้าๆ ไม่แอ่นหลัง'], en: ['Weights at ear level, elbows under wrists', 'Press overhead to near lockout', 'Lower slowly, no arching'] },
    frames: [frontStand({ a1: [95, 178] }), frontStand({ a1: [160, 176] })], dur: [1000, 1000],
  },
  {
    id: 'lateral_raise', group: 'push', equip: 'db', level: 1, type: 'reps', met: 3.5, hl: ['ua'], prop: 'db', view: 'front',
    name: { th: 'ยกดัมเบลด้านข้าง', en: 'Lateral raise' }, muscles: { th: 'ไหล่ข้าง', en: 'Side delts' },
    cues: { th: ['ศอกงอเล็กน้อย', 'ยกออกข้างถึงระดับไหล่', 'ลดลงช้า 2-3 วินาที'], en: ['Slight bend in elbows', 'Raise out to shoulder height', 'Lower over 2-3 seconds'] },
    frames: [frontStand({ a1: [14, 10] }), frontStand({ a1: [86, 92] })], dur: [1000, 1100],
  },
  {
    id: 'triceps_ext', group: 'push', equip: 'db', level: 1, type: 'reps', met: 3.5, hl: ['ua', 'fa'], prop: 'db',
    name: { th: 'ดัมเบลโอเวอร์เฮดไตรเซ็ป', en: 'Overhead triceps extension' }, muscles: { th: 'หลังแขน', en: 'Triceps' },
    cues: { th: ['ถือดัมเบลเหนือศีรษะ ศอกชี้ขึ้น', 'งอศอกลดดัมเบลไปหลังศีรษะ', 'เหยียดแขนขึ้น ศอกอยู่กับที่'], en: ['Weight overhead, elbows pointing up', 'Bend elbows to lower behind the head', 'Extend up, keep elbows still'] },
    frames: [stand({ a1: [165, 176], a2: [162, 176] }), stand({ a1: [158, -35], a2: [155, -35] })], dur: [1000, 1000],
  },
  {
    id: 'db_row', group: 'pull', equip: 'db', level: 1, type: 'reps', met: 4.5, hl: ['ua', 'torso'], prop: 'db',
    name: { th: 'ดัมเบลโรว์ก้มตัว', en: 'Bent-over dumbbell row' }, muscles: { th: 'หลังกลาง ปีก หน้าแขน', en: 'Lats, mid-back, biceps' },
    cues: { th: ['พับสะโพก หลังตรง', 'ดึงศอกไปด้านหลังชิดลำตัว', 'บีบสะบัก ค้าง 1 วินาที'], en: ['Hinge at the hips, flat back', 'Drive elbows back close to the body', 'Squeeze shoulder blades, hold 1s'] },
    frames: [
      { x: 86, y: 120, t: 122, h: -10, a1: [0, 0], a2: [-3, 0], l1: { to: [104, 180] }, l2: { to: [100, 180] } },
      { x: 86, y: 120, t: 122, h: -10, a1: [-65, 5], a2: [-62, 5], l1: { to: [104, 180] }, l2: { to: [100, 180] } },
    ], dur: [1000, 1000],
  },
  {
    id: 'lat_pulldown', group: 'pull', equip: 'gym', level: 1, type: 'reps', met: 4, hl: ['ua', 'torso'], prop: 'cable bar', view: 'front',
    name: { th: 'แลตพูลดาวน์', en: 'Lat pulldown' }, muscles: { th: 'ปีก หลัง หน้าแขน', en: 'Lats, back, biceps' },
    cues: { th: ['จับบาร์กว้างกว่าไหล่', 'ดึงบาร์ลงหาไหปลาร้า อกเปิด', 'ปล่อยขึ้นช้าๆ จนแขนตึง'], en: ['Grip wider than shoulders', 'Pull to the collarbone, chest up', 'Return slowly to a full stretch'] },
    frames: [frontStand({ a1: [165, 178] }), frontStand({ a1: [60, 160] })], dur: [1000, 1100],
  },
  {
    id: 'db_curl', group: 'pull', equip: 'db', level: 1, type: 'reps', met: 3, hl: ['ua'], prop: 'db',
    name: { th: 'ดัมเบลเคิร์ล', en: 'Dumbbell curl' }, muscles: { th: 'หน้าแขน', en: 'Biceps' },
    cues: { th: ['ศอกแนบลำตัว', 'ม้วนดัมเบลขึ้นหาไหล่', 'ลดลงช้าๆ ไม่เหวี่ยง'], en: ['Elbows pinned to your sides', 'Curl up toward the shoulders', 'Lower slowly, no swinging'] },
    frames: [stand({ a1: [4, 2], a2: [-2, 0] }), stand({ a1: [12, 160], a2: [8, 160] })], dur: [900, 1000],
  },
  {
    id: 'superman', group: 'pull', equip: 'none', level: 1, type: 'reps', met: 3, hl: ['torso'], prop: 'mat',
    name: { th: 'ซูเปอร์แมน', en: 'Superman' }, muscles: { th: 'หลังล่าง ก้น', en: 'Lower back, glutes' },
    cues: { th: ['นอนคว่ำ แขนเหยียดไปข้างหน้า', 'ยกแขน อก และขาขึ้นพร้อมกัน', 'ค้าง 2 วินาทีแล้วลดลง'], en: ['Lie face down, arms overhead', 'Lift arms, chest and legs together', 'Hold 2s, lower'] },
    frames: [
      { x: 100, y: 174, t: -90, h: 0, a1: [-92, -92], a2: [-92, -92], l1: [88, 88], l2: [88, 88], f1: 180, f2: 180 },
      { x: 100, y: 172, t: -106, h: -6, a1: [-112, -112], a2: [-112, -112], l1: [100, 100], l2: [100, 100], f1: 185, f2: 185 },
    ], dur: [1000, 1400],
  },
  {
    id: 'plank', group: 'core', equip: 'none', level: 1, type: 'time', met: 3, hl: ['torso'], prop: 'mat', hold: true,
    name: { th: 'แพลงก์', en: 'Forearm plank' }, muscles: { th: 'หน้าท้อง แกนกลาง', en: 'Abs, core' },
    cues: { th: ['ศอกอยู่ใต้ไหล่', 'ลำตัวตรงจากหัวถึงส้นเท้า', 'เกร็งก้นและท้อง หายใจปกติ'], en: ['Elbows under shoulders', 'Straight line from head to heels', 'Brace glutes and abs, keep breathing'] },
    frames: [
      { x: 90, y: 154, t: 96, h: -4, a1: [2, 90], a2: [-2, 90], l1: { to: [24, 176] }, l2: { to: [26, 177] }, f1: 15, f2: 15 },
      { x: 90, y: 152, t: 96, h: -4, a1: [2, 90], a2: [-2, 90], l1: { to: [24, 176] }, l2: { to: [26, 177] }, f1: 15, f2: 15 },
    ], dur: [1600, 1600],
  },
  {
    id: 'crunch', group: 'core', equip: 'none', level: 1, type: 'reps', met: 3, hl: ['torso'], prop: 'mat',
    name: { th: 'ครันช์', en: 'Crunch' }, muscles: { th: 'หน้าท้องส่วนบน', en: 'Upper abs' },
    cues: { th: ['นอนหงาย ชันเข่า', 'ม้วนไหล่ขึ้นจากพื้น ใช้ท้องดึง', 'ลดลงช้าๆ ไม่ดึงคอ'], en: ['Lie on your back, knees bent', 'Curl the shoulders up using the abs', 'Lower slowly, don\'t pull the neck'] },
    frames: [
      { x: 104, y: 174, t: -90, h: 0, a1: [90, 90], a2: [90, 90], l1: { to: [142, 180], bend: 1 }, l2: { to: [138, 180], bend: 1 } },
      { x: 104, y: 174, t: -122, h: 10, a1: [118, 108], a2: [118, 108], l1: { to: [142, 180], bend: 1 }, l2: { to: [138, 180], bend: 1 } },
    ], dur: [900, 900],
  },
  {
    id: 'leg_raise', group: 'core', equip: 'none', level: 2, type: 'reps', met: 3.5, hl: ['torso', 'th'], prop: 'mat',
    name: { th: 'ยกขา', en: 'Lying leg raise' }, muscles: { th: 'หน้าท้องส่วนล่าง', en: 'Lower abs' },
    cues: { th: ['นอนหงาย มือวางข้างลำตัว', 'ยกขาตรงขึ้นตั้งฉาก', 'ลดลงช้าๆ หลังไม่แอ่น'], en: ['Lie flat, hands by your sides', 'Raise straight legs to vertical', 'Lower slowly, keep the low back down'] },
    frames: [
      { x: 104, y: 174, t: -90, h: 0, a1: [90, 90], a2: [90, 90], l1: [94, 94], l2: [94, 94], f1: 180, f2: 180 },
      { x: 104, y: 174, t: -90, h: 0, a1: [90, 90], a2: [90, 90], l1: [168, 168], l2: [168, 168], f1: 250, f2: 250 },
    ], dur: [1200, 1200],
  },
  {
    id: 'mountain_climber', group: 'core', equip: 'none', level: 2, type: 'time', met: 8, hl: ['torso', 'th'],
    name: { th: 'เมาท์เทนไคลม์เบอร์', en: 'Mountain climber' }, muscles: { th: 'แกนกลาง ขา หัวใจ', en: 'Core, legs, cardio' },
    cues: { th: ['ท่าวิดพื้น มือใต้ไหล่', 'สลับดึงเข่าเข้าหาอกเร็วๆ', 'สะโพกไม่โด่ง'], en: ['High plank, hands under shoulders', 'Drive knees to chest alternately', 'Keep hips level'] },
    frames: [
      { x: 92, y: 140, t: 102, h: -5, a1: { to: [138, 180], bend: -1 }, a2: { to: [134, 180], bend: -1 }, l1: { to: [112, 172], bend: 1 }, l2: { to: [28, 174] }, f1: 20, f2: 20 },
      { x: 92, y: 140, t: 102, h: -5, a1: { to: [138, 180], bend: -1 }, a2: { to: [134, 180], bend: -1 }, l1: { to: [28, 174] }, l2: { to: [112, 172], bend: 1 }, f1: 20, f2: 20 },
    ], dur: [380, 380],
  },
  {
    id: 'jumping_jack', group: 'cardio', equip: 'none', level: 1, type: 'time', met: 8, hl: ['th', 'ua'], view: 'front',
    name: { th: 'จัมปิ้งแจ็ค', en: 'Jumping jacks' }, muscles: { th: 'ทั้งตัว หัวใจ', en: 'Full body, cardio' },
    cues: { th: ['กระโดดแยกขาพร้อมยกแขนเหนือศีรษะ', 'กระโดดหุบกลับ', 'ลงปลายเท้าเบาๆ'], en: ['Jump feet out, arms overhead', 'Jump back together', 'Land softly on the balls of the feet'] },
    frames: [frontStand({ a1: [12, 6] }), frontStand({ y: 106, a1: [150, 166], l1: { to: [130, 178], bend: 1 } })], dur: [420, 420],
  },
  {
    id: 'high_knees', group: 'cardio', equip: 'none', level: 1, type: 'time', met: 8, hl: ['th'],
    name: { th: 'ยกเข่าสูง', en: 'High knees' }, muscles: { th: 'ขา สะโพก หัวใจ', en: 'Legs, hip flexors, cardio' },
    cues: { th: ['วิ่งอยู่กับที่ ยกเข่าถึงระดับสะโพก', 'แกว่งแขนตามจังหวะ', 'ลำตัวตั้งตรง'], en: ['Run in place, knees to hip height', 'Pump the arms', 'Stay tall'] },
    frames: [
      { x: 100, y: 112, t: 180, a1: [-35, 50], a2: [35, 125], l1: [95, 0], l2: [0, 0] },
      { x: 100, y: 110, t: 180, a1: [35, 125], a2: [-35, 50], l1: [0, 0], l2: [95, 0] },
    ], dur: [330, 330],
  },
  {
    id: 'jog', group: 'cardio', equip: 'none', level: 1, type: 'time', met: 7, hl: ['th', 'sh'],
    name: { th: 'วิ่งเหยาะอยู่กับที่', en: 'Jog in place' }, muscles: { th: 'หัวใจ ขา', en: 'Cardio, legs' },
    cues: { th: ['ลงน้ำหนักปลายเท้า', 'แกว่งแขนสบายๆ', 'หายใจเข้าจมูก ออกปาก'], en: ['Land on the forefoot', 'Relaxed arm swing', 'In through the nose, out through the mouth'] },
    frames: [
      { x: 100, y: 112, t: 172, a1: [-35, 55], a2: [35, 125], l1: [55, -5], l2: [-20, -70], f1: 100, f2: 40 },
      { x: 100, y: 110, t: 172, a1: [35, 125], a2: [-35, 55], l1: [-20, -70], l2: [55, -5], f1: 40, f2: 100 },
    ], dur: [300, 300],
  },
  {
    id: 'walk', group: 'cardio', equip: 'none', level: 1, type: 'time', met: 4.3, hl: ['th'],
    name: { th: 'เดินเร็ว', en: 'Brisk walk' }, muscles: { th: 'หัวใจ ขา (ฟื้นฟู)', en: 'Cardio, recovery' },
    cues: { th: ['ก้าวยาวสม่ำเสมอ', 'แกว่งแขนตามจังหวะ', 'ให้หายใจแรงขึ้นแต่ยังพูดได้'], en: ['Steady long strides', 'Swing the arms', 'Breathing up but able to talk'] },
    frames: [
      { x: 100, y: 114, t: 178, a1: [-22, 10], a2: [22, 40], l1: [25, 10], l2: [-20, -5] },
      { x: 100, y: 113, t: 178, a1: [22, 40], a2: [-22, 10], l1: [-20, -5], l2: [25, 10] },
    ], dur: [550, 550],
  },
  {
    id: 'jump_rope', group: 'cardio', equip: 'none', level: 1, type: 'time', met: 10, hl: ['sh'], view: 'front',
    name: { th: 'กระโดดเชือก (จำลอง)', en: 'Jump rope' }, muscles: { th: 'น่อง หัวใจ', en: 'Calves, cardio' },
    cues: { th: ['ศอกชิดลำตัว หมุนข้อมือ', 'กระโดดต่ำๆ ด้วยปลายเท้า', 'รักษาจังหวะสม่ำเสมอ'], en: ['Elbows in, turn from the wrists', 'Small hops on the balls of the feet', 'Keep a steady rhythm'] },
    frames: [frontStand({ a1: [22, 70], l1: { to: [104, 180], bend: 1 } }), frontStand({ y: 107, a1: [24, 60], l1: { to: [104, 173], bend: 1 } })], dur: [260, 260],
  },
  {
    id: 'forward_fold', group: 'mobility', equip: 'none', level: 1, type: 'time', met: 2.3, hl: ['th'], hold: true,
    name: { th: 'ก้มแตะปลายเท้า', en: 'Standing forward fold' }, muscles: { th: 'ต้นขาหลัง หลังล่าง', en: 'Hamstrings, low back' },
    cues: { th: ['ยืนเท้าชิด เข่าตึงพอสบาย', 'พับสะโพกก้มลงช้าๆ', 'หายใจลึก ค้างไว้'], en: ['Feet together, soft knees', 'Hinge slowly forward', 'Breathe deeply and hold'] },
    frames: [stand({ a1: [0, 0], a2: [0, 0] }), { x: 92, y: 112, t: 58, h: -15, a1: [0, 0], a2: [0, 0], ...STAND_LEGS }], dur: [2200, 2200],
  },
  {
    id: 'quad_stretch', group: 'mobility', equip: 'none', level: 1, type: 'time', met: 2.3, hl: ['th'], hold: true,
    name: { th: 'ยืดต้นขาหน้า', en: 'Standing quad stretch' }, muscles: { th: 'ต้นขาหน้า', en: 'Quads' },
    cues: { th: ['จับข้อเท้าดึงส้นเท้าเข้าหาก้น', 'เข่าชี้ลงพื้น สะโพกดันไปหน้า', 'ค้างข้างละ 30 วินาที'], en: ['Hold the ankle, heel to glute', 'Knee points down, hips forward', 'Hold 30s each side'] },
    frames: [
      { x: 100, y: 114, t: 180, a1: { to: [80, 116], bend: -1 }, a2: [45, 90], l1: [-15, -160], l2: [0, 0], f1: -70 },
      { x: 100, y: 114, t: 178, a1: { to: [78, 114], bend: -1 }, a2: [48, 90], l1: [-18, -162], l2: [0, 0], f1: -70 },
    ], dur: [2000, 2000],
  },
  {
    id: 'child_pose', group: 'mobility', equip: 'none', level: 1, type: 'time', met: 2, hl: ['torso'], prop: 'mat', hold: true,
    name: { th: 'ท่าเด็ก (Child\'s pose)', en: 'Child\'s pose' }, muscles: { th: 'หลัง สะโพก (ผ่อนคลาย)', en: 'Back, hips (relax)' },
    cues: { th: ['นั่งบนส้นเท้า ก้มตัวไปข้างหน้า', 'เหยียดแขนไปข้างหน้าให้สุด', 'หายใจลึกช้าๆ'], en: ['Sit back on your heels, fold forward', 'Reach the arms long', 'Slow deep breaths'] },
    frames: [
      { x: 66, y: 164, t: 88, h: -10, a1: [86, 92], a2: [86, 92], l1: [70, -90], l2: [70, -90], f1: -90, f2: -90 },
      { x: 66, y: 162, t: 83, h: -10, a1: [84, 92], a2: [84, 92], l1: [68, -90], l2: [68, -90], f1: -90, f2: -90 },
    ], dur: [2400, 2400],
  },
];

export const EX = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

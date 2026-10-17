import { localizedNames } from './i18n/index.js';
import { medicalFoodAllowed } from './conditions.js';
// Food database, values per 100 g (cooked weight unless noted). k=kcal p=protein c=carbs f=fat.
// tags: dietary flags used for filtering. unit: household measure for display.
const U = {
  tappee: { th: 'ทัพพี', en: 'ladle', g: 60 },
  egg: { th: 'ฟอง', en: 'egg', g: 50 },
  slice: { th: 'แผ่น', en: 'slice', g: 30 },
  tsp: { th: 'ช้อนชา', en: 'tsp', g: 5 },
  tbsp: { th: 'ช้อนโต๊ะ', en: 'tbsp', g: 15 },
  cup: { th: 'ถ้วย', en: 'cup', g: 240 },
  palm: { th: 'ฝ่ามือ', en: 'palm', g: 100 },
  piece: { th: 'ชิ้น/ผล', en: 'piece', g: 120 },
  hand: { th: 'กำมือ', en: 'handful', g: 25 },
};

export const FOODS = [
  // ---- protein ----
  { id: 'chicken_breast', cat: 'protein', k: 165, p: 31, c: 0, f: 3.6, tags: ['meat', 'chicken'], unit: U.palm, th: 'อกไก่', en: 'Chicken breast', cook: { th: ['ย่าง', 'อบ', 'ต้ม', 'ผัดกะเพรา (น้ำมันน้อย)'], en: ['grilled', 'baked', 'poached', 'basil stir-fry (light oil)'] } },
  { id: 'chicken_thigh', cat: 'protein', k: 177, p: 24, c: 0, f: 8.5, tags: ['meat', 'chicken'], unit: U.palm, th: 'สะโพกไก่ไม่ติดหนัง', en: 'Skinless chicken thigh', cook: { th: ['ย่าง', 'ต้มยำ', 'อบซีอิ๊ว'], en: ['grilled', 'tom yum', 'soy-baked'] } },
  { id: 'pork_loin', cat: 'protein', k: 143, p: 26, c: 0, f: 3.5, tags: ['meat', 'pork'], unit: U.palm, th: 'หมูสันใน', en: 'Pork tenderloin', cook: { th: ['ย่าง', 'ลวกจิ้ม', 'ผัดขิง'], en: ['grilled', 'blanched', 'ginger stir-fry'] } },
  { id: 'beef_lean', cat: 'protein', k: 158, p: 26, c: 0, f: 6, tags: ['meat', 'beef'], unit: U.palm, th: 'เนื้อวัวไม่ติดมัน', en: 'Lean beef', cook: { th: ['ย่าง', 'ผัดพริกไทยดำ', 'สเต๊ก'], en: ['grilled', 'black-pepper stir-fry', 'steak'] } },
  { id: 'salmon', cat: 'protein', k: 208, p: 20, c: 0, f: 13, tags: ['fish', 'seafood'], unit: U.palm, th: 'แซลมอน', en: 'Salmon', cook: { th: ['ย่างเกลือ', 'อบ', 'นึ่งมะนาว'], en: ['salt-grilled', 'baked', 'steamed with lime'] } },
  { id: 'white_fish', cat: 'protein', k: 96, p: 20, c: 0, f: 1.7, tags: ['fish', 'seafood'], unit: U.palm, th: 'ปลากะพง/ปลาเนื้อขาว', en: 'White fish (sea bass)', cook: { th: ['นึ่งมะนาว', 'ต้มยำ', 'ทอดน้ำมันน้อย'], en: ['steamed with lime', 'tom yum', 'pan-seared'] } },
  { id: 'tuna', cat: 'protein', k: 116, p: 26, c: 0, f: 1, tags: ['fish', 'seafood'], unit: U.palm, th: 'ทูน่าในน้ำแร่', en: 'Tuna in water', cook: { th: ['ยำ', 'สลัด', 'แซนด์วิช'], en: ['spicy salad', 'salad', 'sandwich'] } },
  { id: 'shrimp', cat: 'protein', k: 99, p: 24, c: 0.2, f: 0.3, tags: ['seafood'], unit: U.palm, th: 'กุ้ง', en: 'Shrimp', cook: { th: ['ลวก', 'ผัดกระเทียม', 'ต้มยำ'], en: ['blanched', 'garlic stir-fry', 'tom yum'] } },
  { id: 'egg', cat: 'protein', k: 143, p: 12.6, c: 0.7, f: 9.5, tags: ['egg'], unit: U.egg, th: 'ไข่ไก่', en: 'Eggs', cook: { th: ['ต้ม', 'ตุ๋น', 'เจียวน้ำมันน้อย'], en: ['boiled', 'steamed', 'light omelette'] }, step: 50 },
  { id: 'egg_white', cat: 'protein', k: 52, p: 11, c: 0.7, f: 0.2, tags: ['egg'], unit: U.egg, th: 'ไข่ขาว', en: 'Egg whites', cook: { th: ['ต้ม', 'ผัด'], en: ['boiled', 'scrambled'] }, unitG: 33 },
  { id: 'tofu', cat: 'protein', k: 144, p: 15.8, c: 2.8, f: 8.7, tags: ['soy', 'vegan'], unit: U.palm, th: 'เต้าหู้แข็ง', en: 'Firm tofu', cook: { th: ['ผัดกะเพรา', 'ต้มจืด', 'ย่าง'], en: ['basil stir-fry', 'clear soup', 'grilled'] } },
  { id: 'tempeh', cat: 'protein', k: 192, p: 20, c: 7.6, f: 11, tags: ['soy', 'vegan'], unit: U.palm, th: 'เทมเป้', en: 'Tempeh', cook: { th: ['ผัด', 'ย่าง'], en: ['stir-fried', 'grilled'] } },
  { id: 'greek_yogurt', cat: 'dairyp', k: 59, p: 10, c: 3.6, f: 0.4, tags: ['dairy'], unit: U.cup, th: 'กรีกโยเกิร์ตไขมัน 0%', en: 'Greek yogurt 0%' },
  { id: 'milk_lowfat', cat: 'dairyp', k: 42, p: 3.4, c: 5, f: 1, tags: ['dairy'], unit: U.cup, th: 'นมพร่องมันเนย', en: 'Low-fat milk' },
  { id: 'soy_milk', cat: 'dairyp', k: 33, p: 2.9, c: 1.8, f: 1.6, tags: ['soy', 'vegan'], unit: U.cup, th: 'นมถั่วเหลืองไม่หวาน', en: 'Unsweetened soy milk' },

  // ---- carbs ----
  { id: 'jasmine_rice', cat: 'carb', k: 130, p: 2.7, c: 28, f: 0.3, tags: ['rice', 'vegan'], unit: U.tappee, th: 'ข้าวหอมมะลิ', en: 'Jasmine rice', meal: ['lunch', 'dinner'] },
  { id: 'brown_rice', cat: 'carb', k: 112, p: 2.6, c: 23, f: 0.9, tags: ['rice', 'vegan'], unit: U.tappee, th: 'ข้าวกล้อง', en: 'Brown rice', meal: ['lunch', 'dinner'] },
  { id: 'riceberry', cat: 'carb', k: 118, p: 2.9, c: 24, f: 1.2, tags: ['rice', 'vegan'], unit: U.tappee, th: 'ข้าวไรซ์เบอร์รี่', en: 'Riceberry rice', meal: ['lunch', 'dinner'] },
  { id: 'oats', cat: 'carb', k: 389, p: 16.9, c: 66, f: 6.9, tags: ['vegan', 'oats'], unit: U.tbsp, th: 'ข้าวโอ๊ต (ดิบ)', en: 'Rolled oats (dry)', meal: ['breakfast', 'snack'], unitG: 10 },
  { id: 'ww_bread', cat: 'carb', k: 247, p: 13, c: 41, f: 3.4, tags: ['gluten', 'vegan'], unit: U.slice, th: 'ขนมปังโฮลวีท', en: 'Whole-wheat bread', meal: ['breakfast', 'snack'], step: 30 },
  { id: 'sweet_potato', cat: 'carb', k: 86, p: 1.6, c: 20, f: 0.1, tags: ['vegan'], unit: U.piece, th: 'มันหวานนึ่ง', en: 'Steamed sweet potato', meal: ['breakfast', 'lunch', 'dinner', 'snack'] },
  { id: 'potato', cat: 'carb', k: 77, p: 2, c: 17, f: 0.1, tags: ['vegan'], unit: U.piece, th: 'มันฝรั่งอบ', en: 'Baked potato', meal: ['lunch', 'dinner'] },
  { id: 'rice_noodle', cat: 'carb', k: 109, p: 1.8, c: 24, f: 0.2, tags: ['rice', 'vegan'], unit: U.tappee, th: 'เส้นก๋วยเตี๋ยว', en: 'Rice noodles', meal: ['lunch', 'dinner'] },
  { id: 'whole_pasta', cat: 'carb', k: 149, p: 6, c: 30, f: 1.7, tags: ['gluten', 'vegan'], unit: U.tappee, th: 'พาสต้าโฮลวีท', en: 'Whole-wheat pasta', meal: ['lunch', 'dinner'] },
  { id: 'corn', cat: 'carb', k: 96, p: 3.4, c: 21, f: 1.5, tags: ['vegan'], unit: U.piece, th: 'ข้าวโพดต้ม', en: 'Boiled corn', meal: ['snack', 'breakfast'] },

  // ---- vegetables ----
  { id: 'broccoli', cat: 'veg', k: 35, p: 2.4, c: 7, f: 0.4, tags: ['vegan'], unit: U.cup, th: 'บรอกโคลี', en: 'Broccoli' },
  { id: 'morning_glory', cat: 'veg', k: 19, p: 2.6, c: 3.1, f: 0.2, tags: ['vegan'], unit: U.cup, th: 'ผักบุ้ง', en: 'Morning glory' },
  { id: 'mixed_veg', cat: 'veg', k: 30, p: 1.8, c: 6, f: 0.2, tags: ['vegan'], unit: U.cup, th: 'ผักรวมผัด/ลวก', en: 'Mixed vegetables' },
  { id: 'kale', cat: 'veg', k: 35, p: 2.9, c: 4.4, f: 1.5, tags: ['vegan'], unit: U.cup, th: 'คะน้า', en: 'Chinese kale' },
  { id: 'salad', cat: 'veg', k: 20, p: 1.3, c: 3.5, f: 0.2, tags: ['vegan'], unit: U.cup, th: 'สลัดผัก/แตงกวา/มะเขือเทศ', en: 'Green salad' },
  { id: 'cabbage', cat: 'veg', k: 25, p: 1.3, c: 5.8, f: 0.1, tags: ['vegan'], unit: U.cup, th: 'กะหล่ำปลี', en: 'Cabbage' },
  { id: 'long_bean', cat: 'veg', k: 47, p: 2.8, c: 8.4, f: 0.4, tags: ['vegan'], unit: U.cup, th: 'ถั่วฝักยาว', en: 'Long beans' },

  // ---- fruit ----
  { id: 'banana', cat: 'fruit', k: 89, p: 1.1, c: 23, f: 0.3, tags: ['fruit', 'vegan'], unit: U.piece, th: 'กล้วยหอม', en: 'Banana', unitG: 110 },
  { id: 'papaya', cat: 'fruit', k: 43, p: 0.5, c: 11, f: 0.3, tags: ['fruit', 'vegan'], unit: U.cup, th: 'มะละกอ', en: 'Papaya', unitG: 140 },
  { id: 'apple', cat: 'fruit', k: 52, p: 0.3, c: 14, f: 0.2, tags: ['fruit', 'vegan'], unit: U.piece, th: 'แอปเปิล', en: 'Apple', unitG: 180 },
  { id: 'guava', cat: 'fruit', k: 68, p: 2.6, c: 14, f: 1, tags: ['fruit', 'vegan'], unit: U.piece, th: 'ฝรั่ง', en: 'Guava', unitG: 150 },
  { id: 'watermelon', cat: 'fruit', k: 30, p: 0.6, c: 7.6, f: 0.2, tags: ['fruit', 'vegan'], unit: U.cup, th: 'แตงโม', en: 'Watermelon', unitG: 150 },
  { id: 'orange', cat: 'fruit', k: 47, p: 0.9, c: 12, f: 0.1, tags: ['fruit', 'vegan'], unit: U.piece, th: 'ส้ม', en: 'Orange', unitG: 130 },
  { id: 'dragon_fruit', cat: 'fruit', k: 60, p: 1.2, c: 13, f: 0, tags: ['fruit', 'vegan'], unit: U.piece, th: 'แก้วมังกร', en: 'Dragon fruit', unitG: 200 },

  // ---- fats ----
  { id: 'olive_oil', cat: 'fat', k: 884, p: 0, c: 0, f: 100, tags: ['vegan'], unit: U.tsp, th: 'น้ำมันมะกอก/รำข้าว (ปรุง)', en: 'Olive / rice-bran oil (cooking)' },
  { id: 'almonds', cat: 'fat', k: 579, p: 21, c: 22, f: 50, tags: ['nuts', 'vegan'], unit: U.hand, th: 'อัลมอนด์', en: 'Almonds' },
  { id: 'peanut_butter', cat: 'fat', k: 588, p: 25, c: 20, f: 50, tags: ['nuts', 'vegan'], unit: U.tbsp, th: 'เนยถั่วไม่หวาน', en: 'Peanut butter (no sugar)' },
  { id: 'avocado', cat: 'fat', k: 160, p: 2, c: 9, f: 15, tags: ['fruit', 'vegan'], unit: U.piece, th: 'อะโวคาโด', en: 'Avocado', unitG: 70 },
];
for(const entry of FOODS)localizedNames(entry.name||entry);
export const FOOD = Object.fromEntries(FOODS.map((f) => [f.id, f]));
const BUILTIN = FOODS.slice();
export function mergeCustomFoods(custom = []) {
  const valid = custom.filter(f => /^my-[a-z0-9-]+$/.test(f.id) && typeof f.th === 'string' && typeof f.en === 'string' && ['protein','carb','veg','fruit','fat','dairyp'].includes(f.cat) && ['k','p','c','f'].every(k => Number.isFinite(f[k]) && f[k] >= 0) && Array.isArray(f.tags) && f.unit?.g > 0);
  FOODS.splice(0, FOODS.length, ...BUILTIN, ...valid);
  for (const id of Object.keys(FOOD)) delete FOOD[id];
  Object.assign(FOOD, Object.fromEntries(FOODS.map(f => [f.id, f])));
}

export const DIETS = {
  normal: { th: 'ทานได้ทุกอย่าง', en: 'Everything', no: [] },
  nopork: { th: 'ไม่ทานหมู / ฮาลาล', en: 'No pork / Halal', no: ['pork'] },
  pescatarian: { th: 'ทานปลา (ไม่ทานเนื้อสัตว์บก)', en: 'Pescatarian', no: ['meat'] },
  vegetarian: { th: 'มังสวิรัติ (ไข่/นมได้)', en: 'Vegetarian', no: ['meat', 'seafood', 'fish'] },
  vegan: { th: 'วีแกน / เจ', en: 'Vegan', no: ['meat', 'seafood', 'fish', 'egg', 'dairy'] },
  lowcarb: { th: 'คาร์บต่ำ', en: 'Low-carb', no: [] },
};
export const EXCLUDES = {
  fruit: { th: 'ไม่ทานผลไม้', en: 'No fruit' },
  dairy: { th: 'ไม่ทานนม/โยเกิร์ต', en: 'No dairy' },
  egg: { th: 'ไม่ทานไข่', en: 'No eggs' },
  seafood: { th: 'แพ้อาหารทะเล', en: 'No seafood' },
  fish: { th: 'ไม่ทานปลา', en: 'No fish' },
  beef: { th: 'ไม่ทานเนื้อวัว', en: 'No beef' },
  pork: { th: 'ไม่ทานหมู', en: 'No pork' },
  chicken: { th: 'ไม่ทานไก่', en: 'No chicken' },
  gluten: { th: 'ไม่ทานกลูเตน/แป้งสาลี', en: 'Gluten-free' },
  nuts: { th: 'แพ้ถั่ว', en: 'No nuts' },
  soy: { th: 'ไม่ทานถั่วเหลือง', en: 'No soy' },
};

export function allowedFoods(p) {
  const banned = new Set([...(DIETS[p.diet]?.no || []), ...(p.exclude || [])]);
  if (banned.has('seafood')) banned.add('fish');
  return FOODS.filter((f) => medicalFoodAllowed(p,f) && (!f.id.startsWith('my-') || f.useInPlan) && !f.tags.some((t) => banned.has(t)));
}

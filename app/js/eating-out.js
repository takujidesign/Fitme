// Typical portion estimates, not verified brand-label values. Recipes and pack sizes vary.
const dishes=[
 ['chicken_pack','อกไก่พร้อมทาน','Convenience-store chicken breast',100,120,23,3,2,['meat','chicken'],'เลือกสูตรโซเดียมต่ำ','Choose a lower-sodium pack'],
 ['boiled_eggs','ไข่ต้ม 2 ฟอง','Two boiled eggs',100,150,13,1,10,['egg'],'ไม่เติมซอสเค็ม','Skip salty sauces'],
 ['rice_box','ข้าวกล่องไก่','Chicken rice box',300,480,22,68,13,['meat','chicken','soy'],'เพิ่มผัก ลดซอส','Add vegetables, use less sauce'],
 ['sandwich','แซนด์วิชไก่','Chicken sandwich',120,290,14,32,12,['meat','chicken','gluten','egg','dairy'],'เลือกโฮลวีต มายองเนสน้อย','Choose wholegrain and less mayonnaise'],
 ['yogurt','โยเกิร์ต','Yogurt cup',135,120,6,18,3,['dairy'],'เลือกไม่เติมน้ำตาล','Choose unsweetened'],
 ['soy_drink','นมถั่วเหลือง','Soy milk carton',250,130,8,12,5,['soy'],'เลือกไม่หวาน','Choose unsweetened'],
 ['basil','กะเพราไก่ไข่ดาว','Basil chicken rice and fried egg',350,650,30,75,26,['meat','chicken','egg','soy','fish'],'น้ำมันน้อย ไข่ต้มแทนไข่ดาว','Less oil; boiled egg instead of fried'],
 ['fried_rice','ข้าวผัดไก่','Chicken fried rice',300,550,22,75,18,['meat','chicken','egg','soy'],'น้ำมันน้อย เพิ่มผัก','Less oil, extra vegetables'],
 ['rad_na','ราดหน้าไก่','Noodles in gravy',400,480,23,65,14,['meat','chicken','soy'],'ขอน้ำราดน้อย เพิ่มผัก','Less gravy, extra vegetables'],
 ['see_ew','ผัดซีอิ๊ว','Soy stir-fried noodles',300,620,24,80,23,['meat','chicken','egg','soy'],'น้ำมันน้อย ไม่เติมน้ำตาล','Less oil, no extra sugar'],
 ['chicken_rice','ข้าวมันไก่','Hainanese chicken rice',350,600,28,70,23,['meat','chicken','soy'],'ไก่ไม่ติดหนัง น้ำจิ้มแยก','Skinless chicken; sauce on the side'],
 ['somtam','ส้มตำและไก่ย่าง','Papaya salad and grilled chicken',350,450,35,35,18,['meat','chicken','fish','nuts','seafood'],'หวานน้อย เค็มน้อย','Less sugar and salt'],
 ['noodles','ก๋วยเตี๋ยวไก่','Chicken noodle soup',400,380,25,50,9,['meat','chicken','soy','fish'],'ไม่ซดน้ำหมด เพิ่มเนื้อและผัก','Leave some broth; add protein and vegetables'],
 ['suki','สุกี้น้ำไก่','Chicken suki soup',400,350,27,38,10,['meat','chicken','egg','soy'],'น้ำจิ้มแยก','Sauce on the side'],
 ['shabu','ชาบูชุดไก่และผัก','Chicken and vegetable shabu',450,500,40,45,18,['meat','chicken','soy'],'เลือกเนื้อไม่ติดมัน น้ำจิ้มน้อย','Lean protein, less dipping sauce']
];
export const EATING_OUT=dishes.map(([id,th,en,g,k,p,c,f,tags,tipTh,tipEn])=>({id:'out_'+id,cat:'eatingout',th,en,k:k/g*100,p:p/g*100,c:c/g*100,f:f/g*100,tags,unit:{th:'ที่',en:'portion',g},unitG:g,estimate:true,highPurine:tags.includes('seafood'),tip:{th:tipTh,en:tipEn}}));

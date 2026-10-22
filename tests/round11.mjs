import assert from 'node:assert/strict';
import {randomPalette,contrast,BACKGROUNDS,savePalette,restorePalette,gradientPalette} from '../app/js/palettes.js';
import {FAQ,searchHelp} from '../app/js/help-data.js';
for(let i=0;i<1000;i++){const p=randomPalette(i/1000);for(const tab of Object.values(p))for(const theme of ['light','dark']){assert(contrast(tab[theme].color,BACKGROUNDS[theme])>=4.5);assert(contrast(tab[theme].color,tab[theme].on)>=4.5);}}
for(let i=0;i<3;i++)for(const tab of Object.values(gradientPalette(i)))for(const theme of ['light','dark'])for(const color of tab[theme].gradient.match(/#[a-f0-9]{6}/g)){assert(contrast(color,BACKGROUNDS[theme])>=4.5);assert(contrast(color,tab[theme].on)>=4.5);}
const p=randomPalette(.1),next=randomPalette(.8,p,['today','me']);assert.deepEqual(next.today,p.today);assert.deepEqual(next.me,p.me);assert.notDeepEqual(next.food,p.food);
let s=savePalette({palette:p,saved:[]},'test');assert.deepEqual(restorePalette({...s,palette:next},0).palette,p);for(let i=1;i<5;i++)s=savePalette(s,'test');assert.throws(()=>savePalette(s,'sixth'));
assert(FAQ.length>=25);for(const item of FAQ)for(const lang of ['th','en','zh','ja','vi'])assert(item.q[lang]&&item.a[lang]);assert(searchHelp('Gemini','en').length);assert(searchHelp('เช็กอิน','th').length);assert.equal(searchHelp('xyzdoesnotexist').length,0);
console.log('PASS 1000 palette seeds in both themes, locks, exact save/restore, 25 FAQs in five languages and search');

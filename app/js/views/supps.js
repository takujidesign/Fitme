import { slot } from '../slots.js';
import { actions, views, go, rerender, pickFiles } from '../core.js';
import { getState, setState, todayISO, putImage, imageURL, compressImage, uid, delImage } from '../store.js';
import { L, esc, icon, sheet, closeSheet, toast, dateLabel } from '../ui.js';
import { planDay } from '../day.js';
import { CATALOG, CAT, SLOTS, CATEGORY, productOf, dosesFor, phaseOf, supplyInfo, warnings } from '../supplements.js';
import { isTrainingDay } from '../workout.js';
import { hasPro, analyzeLabel } from '../pay.js';
import { CONFIG, isDemo } from '../config.js';

const short = (prod) => L(prod.name).split('(')[0].trim();
const amt = (a, prod) => `${a} ${L(prod.unit)}`;

views.supps = () => {
  const s = getState(), p = s.profile, iso = todayISO();
  const d = planDay(iso);
  const items = d.events.filter((e) => e.type === 'supp');
  const warns = warnings(s.supplements, p);
  if (d.sm.protein > d.t.protein * 0.5) warns.push({
    th: `วันนี้อาหารเสริมให้โปรตีน ${d.sm.protein} g (เกินครึ่งของเป้าหมาย ${d.t.protein} g) แผนอาหารยังคงโปรตีนจากอาหารจริงไว้ จึงอาจลดเวย์ลงได้ 1-2 ช้อนตวง`,
    en: `Supplements give ${d.sm.protein} g protein today (over half your ${d.t.protein} g target). Meals still keep real-food protein, so you could drop 1-2 scoops of whey`,
  });
  return `<header class="top"><div><small class="muted">${L('อาหารเสริม', 'Supplements')}</small><h1>${L('ตารางทานวันนี้', 'Today\'s schedule')}</h1></div>
    <button class="btn primary sm" data-act="sp-add">${icon('plus', 18)} ${L('เพิ่ม', 'Add')}</button></header>
    ${!s.supplements.length ? `<div class="empty-card"><div class="emp-ic">${icon('pill', 36)}</div><b>${L('ยังไม่มีอาหารเสริม', 'No supplements yet')}</b>
      <p class="muted">${L('ถ่ายรูปฉลาก หรือเลือกจากรายการ ระบบจะคำนวณว่าทานกี่ครั้ง มื้อไหน ตามน้ำหนักและวันออกกำลังกายของคุณ', 'Snap the label or pick from the list. We schedule doses by your weight and training days.')}</p>
      <button class="btn primary" data-act="sp-add">${icon('camera', 18)} ${L('เพิ่มอาหารเสริม', 'Add supplement')}</button></div>` : `
    <ol class="slot-list">${items.map((e) => `<li><div class="slot-time"><b>${e.time}</b><small>${L(e.slotInfo)}</small></div>
      <div class="slot-items">${e.list.map((x) => `<div class="sp-chip"><span class="dot" style="background:${x.prod.color || 'var(--teal)'}"></span>${esc(short(x.prod))}<b>${amt(x.amount, x.prod)}</b></div>`).join('')}</div></li>`).join('') || `<li class="muted">${L('วันนี้ไม่มีรายการ', 'Nothing scheduled today')}</li>`}</ol>
    ${warns.map((w) => `<p class="note warn">${icon('warn', 16)} ${L(w)}</p>`).join('')}
    <h2 class="sec">${L('อาหารเสริมของฉัน', 'My supplements')}</h2>
    <div class="sp-list">${s.supplements.map((sp) => {
      const prod = productOf(sp);
      const ph = phaseOf(prod, sp, iso);
      const sup = supplyInfo(sp, p, iso, (x) => isTrainingDay(p, x), s.supplements);
      const today = dosesFor(sp, p, iso, d.train, s.supplements);
      return `<button class="sp-card ${sp.paused ? 'paused' : ''}" data-act="sp-open" data-uid="${sp.uid}">
        <div class="sp-img" data-img="${sp.photoId || ''}" style="--c:${prod.color || 'var(--teal)'}">${icon('pill', 26)}</div>
        <div class="sp-info"><small>${esc(prod.brand || L(CATEGORY[prod.category] || CATEGORY.other))}</small><b>${esc(L(prod.name))}</b>
        <span>${sp.paused ? L('หยุดชั่วคราว', 'Paused') : today.length ? today.map((x) => `${L(SLOTS[x.slot])} ${x.amount}`).join(' · ') : L('วันนี้ไม่ต้องทาน', 'Not today')}</span>
        <div class="row gap">${prod.loadingDays ? `<span class="tag ${ph === 'loading' ? 'amber' : 'teal'}">${ph === 'loading' ? 'Loading' : 'Maintenance'}</span>` : ''}${sup ? `<span class="tag">${L('เหลือ', 'Left')} ~${sup.left} ${L(prod.unit)}${sup.runsOut ? ` · ${L('หมด', 'until')} ${dateLabel(sup.runsOut, { day: 'numeric', month: 'short' })}` : ''}</span>` : ''}</div></div></button>`;
    }).join('')}</div>`}
    <p class="muted sm center">${L('อ้างอิงตามตารางบนฉลากผลิตภัณฑ์ · อาหารเสริมไม่มีผลป้องกันหรือรักษาโรค · ปรึกษาแพทย์/เภสัชกรหากมีโรคประจำตัว', 'Based on the dosing chart on each label · supplements do not treat disease · ask a doctor or pharmacist if unsure')}</p>${slot('supps.secondary')}${slot('supps.footer')}`;
};
views.supps.mount = async (root) => {
  for (const el of root.querySelectorAll('[data-img]')) {
    const u = await imageURL(el.dataset.img);
    if (u) { el.style.backgroundImage = `url(${u})`; el.classList.add('has'); }
  }
};

const canAddMore = () => hasPro() || getState().supplements.length < CONFIG.FREE_SUPPLEMENTS;

actions['sp-add'] = () => {
  if (!canAddMore()) {
    toast(L(`เวอร์ชันฟรีเพิ่มได้ ${CONFIG.FREE_SUPPLEMENTS} รายการ`, `Free plan allows ${CONFIG.FREE_SUPPLEMENTS} supplements`), 'warn');
    return go('#/pay');
  }
  sheet(`<div class="sheet-head"><h2>${L('เพิ่มอาหารเสริม', 'Add supplement')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="add-opts">
      <button class="opt" data-act="sp-photo">${icon('camera', 26)}<b>${L('ถ่าย/อัปโหลดรูปฉลาก', 'Photo of the label')}</b><small>${L('AI อ่านวิธีทานจากฉลาก', 'AI reads the directions')}${hasPro() ? '' : ' · Pro'}</small></button>
      <button class="opt" data-act="sp-custom">${icon('settings', 26)}<b>${L('กรอกเอง', 'Enter manually')}</b><small>${L('ชื่อ ขนาด ความถี่', 'Name, dose, frequency')}</small></button>
    </div>
    <h3>${L('หรือเลือกจากรายการ', 'Or pick from the list')}</h3>
    <div class="cat-list">${CATALOG.map((c) => `<button class="cat-item" data-act="sp-pick" data-id="${c.id}"><span class="dot lg" style="background:${c.color}"></span><div><b>${esc(L(c.name))}</b><small>${esc(c.brand)} · ${L(CATEGORY[c.category])}</small></div>${icon('plus', 18)}</button>`).join('')}</div>`);
};

function addSupp(productId, extra = {}) {
  const sp = { uid: uid(), productId, startDate: todayISO(), ...extra };
  setState((s) => s.supplements.push(sp));
  closeSheet();
  rerender();
  const prod = productOf(sp);
  toast(L(`เพิ่ม ${short(prod)} แล้ว`, `Added ${short(prod)}`));
  return sp;
}
actions['sp-pick'] = (el) => addSupp(el.dataset.id);

let pendingPhoto = null;
actions['sp-photo'] = async () => {
  const files = await pickFiles({ accept: 'image/*', multiple: true });
  if (!files.length) return;
  const blobs = await Promise.all(files.slice(0, 3).map((f) => compressImage(f, 1600, 0.85)));
  const photoId = 'sp-' + uid();
  await putImage(photoId, blobs[0]);
  pendingPhoto = { photoId, blobs };
  const url = await imageURL(photoId);
  const aiOk = hasPro() && !isDemo();
  sheet(`<div class="sheet-head"><h2>${L('รูปฉลาก', 'Label photo')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="photo-prev" style="background-image:url(${url})"></div>
    <button class="btn primary block" data-act="sp-ai" ${aiOk ? '' : 'disabled'}>${icon('spark', 18)} ${L('ให้ AI อ่านฉลาก', 'Read label with AI')}</button>
    ${!aiOk ? `<p class="muted sm center">${isDemo() ? L('AI ต้องเชื่อมต่อเซิร์ฟเวอร์ (ตั้งค่า API_BASE)', 'AI needs the API server (set API_BASE)') : L('ฟีเจอร์ AI สำหรับสมาชิก Pro', 'AI reading is a Pro feature')}</p>` : ''}
    <h3>${L('หรือเลือกว่าเป็นผลิตภัณฑ์ไหน', 'Or match it to a product')}</h3>
    <div class="cat-list">${CATALOG.map((c) => `<button class="cat-item" data-act="sp-match" data-id="${c.id}"><span class="dot lg" style="background:${c.color}"></span><div><b>${esc(L(c.name))}</b></div>${icon('check', 18)}</button>`).join('')}
    <button class="cat-item" data-act="sp-custom">${icon('settings', 18)}<div><b>${L('ไม่มีในรายการ — กรอกเอง', 'Not listed — enter manually')}</b></div>${icon('chev', 18)}</button></div>`);
};
actions['sp-match'] = (el) => addSupp(el.dataset.id, { photoId: pendingPhoto?.photoId });
actions['sp-ai'] = async (el) => {
  el.disabled = true;
  el.innerHTML = `<span class="spin"></span> ${L('กำลังอ่านฉลาก...', 'Reading label...')}`;
  try {
    const prod = await analyzeLabel(pendingPhoto.blobs);
    reviewCustom({ ...prod, id: 'ai-' + uid() }, pendingPhoto.photoId);
  } catch (e) {
    toast(L('อ่านฉลากไม่สำเร็จ: ', 'Could not read label: ') + e.message, 'warn');
    el.disabled = false;
    el.innerHTML = `${icon('spark', 18)} ${L('ลองอีกครั้ง', 'Try again')}`;
  }
};

// Custom / AI result editor. Produces a product in the same schema as the catalog.
function reviewCustom(prod = {}, photoId) {
  const r0 = prod.rules?.[0]?.doses || { breakfast: 1 };
  sheet(`<div class="sheet-head"><h2>${prod.id?.startsWith('ai-') ? L('ตรวจสอบข้อมูลจาก AI', 'Review AI result') : L('อาหารเสริมของฉัน', 'Custom supplement')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    ${prod.id?.startsWith('ai-') ? `<p class="note">${icon('spark', 16)} ${L('AI อ่านจากฉลาก โปรดตรวจสอบก่อนบันทึก', 'Read by AI from the label — please double-check')}</p>` : ''}
    <label class="field"><span>${L('ชื่อผลิตภัณฑ์', 'Product name')}</span><div class="input-wrap"><input id="cu-name" value="${esc(L(prod.name || '') || '')}"></div></label>
    <div class="grid2">
      <label class="field"><span>${L('หน่วย', 'Unit')}</span><div class="input-wrap"><select id="cu-unit">${[['capsule', 'แคปซูล'], ['tablet', 'เม็ด'], ['scoop', 'ช้อนตวง'], ['ml', 'มล.']].map(([en, th]) => `<option value="${en}" ${prod.unit?.en === en ? 'selected' : ''}>${L(th, en)}</option>`).join('')}</select></div></label>
      <label class="field"><span>${L('จำนวนต่อกระปุก', 'Servings per pack')}</span><div class="input-wrap"><input id="cu-per" type="number" value="${prod.perContainer || 30}"></div></label>
      <label class="field"><span>${L('โปรตีน/หน่วย (g)', 'Protein/serving (g)')}</span><div class="input-wrap"><input id="cu-p" type="number" step="0.1" value="${prod.nutrition?.p || 0}"></div></label>
      <label class="field"><span>kcal/${L('หน่วย', 'serving')}</span><div class="input-wrap"><input id="cu-k" type="number" value="${prod.nutrition?.k || 0}"></div></label>
    </div>
    <h3>${L('ทานเมื่อไหร่ และกี่หน่วย', 'When and how much')}</h3>
    <div class="dose-grid">${Object.entries(SLOTS).map(([k, sl]) => `<label class="dose"><span>${L(sl)}</span><input type="number" step="0.5" min="0" data-slot="${k}" value="${r0[k] || ''}" placeholder="0"></label>`).join('')}</div>
    ${prod.rules?.length > 1 ? `<p class="muted sm">${L(`AI พบตารางตามน้ำหนัก/วันออกกำลังกาย ${prod.rules.length} แบบ ระบบจะเลือกให้อัตโนมัติ (ช่องด้านบนใช้เมื่อแก้ไขเอง)`, `AI found ${prod.rules.length} weight/training-day variants; they are applied automatically (fields above override)`)}</p>` : ''}
    <label class="field"><span>${L('หมายเหตุ / วิธีทาน', 'Notes / directions')}</span><div class="input-wrap"><input id="cu-note" value="${esc(L(prod.note || '') || '')}"></div></label>
    <button class="btn primary block" id="cu-save">${L('บันทึก', 'Save')}</button>`, {
    onMount(root) {
      root.querySelector('#cu-save').addEventListener('click', () => {
        const name = root.querySelector('#cu-name').value.trim();
        if (!name) return toast(L('ใส่ชื่อผลิตภัณฑ์', 'Enter a name'), 'warn');
        const unitEn = root.querySelector('#cu-unit').value;
        const unitTh = { capsule: 'แคปซูล', tablet: 'เม็ด', scoop: 'ช้อนตวง', ml: 'มล.' }[unitEn];
        const doses = {};
        let edited = false;
        root.querySelectorAll('[data-slot]').forEach((i) => { const v = Number(i.value); if (v > 0) doses[i.dataset.slot] = v; if (String(v || '') !== String(r0[i.dataset.slot] || '')) edited = true; });
        if (!Object.keys(doses).length) return toast(L('ระบุอย่างน้อย 1 ช่วงเวลา', 'Set at least one time slot'), 'warn');
        const custom = {
          id: prod.id || 'custom-' + uid(), brand: prod.brand || '', name: { th: name, en: name }, category: prod.category || 'other',
          unit: { th: unitTh, en: unitEn }, perContainer: Number(root.querySelector('#cu-per').value) || 30,
          nutrition: { k: Number(root.querySelector('#cu-k').value) || 0, p: Number(root.querySelector('#cu-p').value) || 0, c: prod.nutrition?.c || 0, f: prod.nutrition?.f || 0 },
          loadingDays: prod.loadingDays || 0, color: prod.color || '#19E3C4',
          note: { th: root.querySelector('#cu-note').value, en: root.querySelector('#cu-note').value },
          rules: !edited && prod.rules?.length ? prod.rules : [{ doses }],
        };
        addSupp(null, { custom, photoId });
      });
    },
  });
}
actions['sp-custom'] = () => reviewCustom({}, pendingPhoto?.photoId);

actions['sp-open'] = async (el) => {
  const s = getState(), p = s.profile;
  const sp = s.supplements.find((x) => x.uid === el.dataset.uid);
  const prod = productOf(sp);
  const url = await imageURL(sp.photoId);
  const fake = (train, phase) => {
    const start = phase === 'loading' ? todayISO() : '2000-01-01';
    const d = dosesFor({ ...sp, startDate: start, paused: false }, p, todayISO(), train, []);
    return d.length ? d.map((x) => `${L(SLOTS[x.slot])} <b>${x.amount}</b>`).join('<br>') : '—';
  };
  sheet(`<div class="sheet-head"><div><small class="muted">${esc(prod.brand || '')}</small><h2>${esc(L(prod.name))}</h2></div><button class="icon-btn" data-close>${icon('x')}</button></div>
    ${url ? `<div class="photo-prev" style="background-image:url(${url})"></div>` : ''}
    <p class="muted">${esc(L(prod.note || ''))}</p>
    <table class="dose-table"><thead><tr><th></th><th>${L('วันออกกำลังกาย', 'Training day')}</th><th>${L('วันพัก', 'Rest day')}</th></tr></thead><tbody>
      ${prod.loadingDays ? `<tr><td>Loading<br><small>${prod.loadingDays} ${L('วันแรก', 'first days')}</small></td><td>${fake(true, 'loading')}</td><td>${fake(false, 'loading')}</td></tr>` : ''}
      <tr><td>${prod.loadingDays ? 'Maintenance' : L('ปกติ', 'Daily')}</td><td>${fake(true, 'maint')}</td><td>${fake(false, 'maint')}</td></tr></tbody></table>
    <p class="muted sm">${L(`คำนวณจากน้ำหนัก ${p.weight} kg ของคุณ`, `Calculated for your ${p.weight} kg body weight`)}</p>
    <label class="field"><span>${L('เริ่มทานวันที่', 'Started on')}</span><div class="input-wrap"><input type="date" id="sp-start" value="${sp.startDate}"></div></label>
    <div class="row gap"><button class="btn ghost block" data-act="sp-pause" data-uid="${sp.uid}">${sp.paused ? L('ทานต่อ', 'Resume') : L('หยุดชั่วคราว', 'Pause')}</button>
    <button class="btn danger block" data-act="sp-del" data-uid="${sp.uid}">${icon('trash', 18)} ${L('ลบ', 'Delete')}</button></div>`, {
    onMount(root) {
      root.querySelector('#sp-start').addEventListener('change', (e) => { setState((st) => (st.supplements.find((x) => x.uid === sp.uid).startDate = e.target.value)); rerender(); });
    },
  });
};
actions['sp-pause'] = (el) => { setState((s) => { const x = s.supplements.find((y) => y.uid === el.dataset.uid); x.paused = !x.paused; }); closeSheet(); rerender(); };
actions['sp-del'] = (el) => {
  if (!confirm(L('ลบอาหารเสริมนี้?', 'Delete this supplement?'))) return;
  const sp = getState().supplements.find((y) => y.uid === el.dataset.uid);
  if (sp?.photoId) delImage(sp.photoId).catch(() => {});
  setState((s) => (s.supplements = s.supplements.filter((y) => y.uid !== el.dataset.uid)));
  closeSheet();
  rerender();
};
export { CAT };

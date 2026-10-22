import { requireCredits, creditCost } from '../ai-credits.js';
import { actions, pickFiles, rerender } from '../core.js';
import { getState, setState, todayISO, compressImage, blobToBase64 } from '../store.js';
import { L, esc, sheet, closeSheet, toast } from '../ui.js';
import { askCoach } from '../pay.js';
import { planDay } from '../day.js';
import { FOOD } from '../foods.js';
import { GOALS } from '../calc.js';
import { GROUPS } from '../exercises.js';
import { activeEngine } from '../ai-engines.js';

const list = (items) => `<ul>${items.map((v) => `<li>${esc(L(v))}</li>`).join('')}</ul>`;
actions['ai-plan'] = async (el) => {
  if (!await requireCredits('planReview')) return;
  el.disabled = true;
  try {
    const d = planDay(todayISO());
    const { name, ...profile } = getState().profile;
    const r = await askCoach('plan-review', { profile, targets: d.t, meals: d.meals, supplements: d.events.filter((e) => e.type === 'supp') });
    sheet(`<h2>${L('AI โค้ช', 'AI coach')}</h2>${list(r.advice)}<h3>${L('ลองเปลี่ยน', 'Suggested swaps')}</h3><ul>${r.swaps.map((s) => `<li>${esc(L(FOOD[s.from] || { th: s.from, en: s.from }))} → ${esc(L(FOOD[s.to] || { th: s.to, en: s.to }))}: ${esc(L(s.reason))}</li>`).join('')}</ul>${list(r.warnings)}<p class="muted sm">${L('คำแนะนำทั่วไป ไม่ใช่คำวินิจฉัย', 'General guidance, not a diagnosis')}</p><button class="btn ghost" data-close>${L('ปิด', 'Close')}</button>`);
  } catch (e) { toast(e.message, 'warn'); } finally { el.disabled = false; }
};
actions['ai-body'] = async () => {
  if (!await requireCredits('bodyReview')) return;
  if (getState().profile.age < 18) return toast(L('การประเมินนี้สำหรับผู้ใหญ่เท่านั้น', 'This assessment is for adults only'), 'warn');
  sheet(`<h2>${L('ยินยอมส่งรูปให้ AI', 'Consent to AI photo analysis')}</h2>
    <p>${L('เลือก 1–3 รูปด้านหน้า/ข้าง/หลัง รูปใช้กับเอนจินที่เลือกเท่านั้น ผู้ให้บริการอาจเก็บข้อมูลตามนโยบาย แนะนำกางเกงขาสั้นหรือสปอร์ตบรา', 'Choose 1–3 front/side/back photos. Photos use the selected engine only; provider retention policies apply. Shorts or a sports bra are recommended.')} · ${esc(activeEngine())}</p>
    <p>${L('เป็นการประเมินคร่าว ๆ จากภาพ ไม่ใช่การวัดไขมันหรือการวินิจฉัย', 'This is a rough visual estimate, not a body-fat measurement or diagnosis.')}</p>
    <button class="btn primary block" data-act="ai-body-consent">${L('ยินยอมและเลือกรูป', 'I consent — choose photos')}</button><button class="btn ghost block" data-close>${L('ยกเลิก', 'Cancel')}</button>`);
};
actions['ai-body-consent'] = async (el) => {
  el.disabled = true;
  try {
    const files = await pickFiles({ accept: 'image/jpeg,image/png,image/webp', multiple: true });
    if (!files.length) return;
    if (files.length > 3) throw new Error(L('เลือกได้ไม่เกิน 3 รูป', 'Choose at most 3 photos'));
    el.textContent = L('กำลังวิเคราะห์…', 'Analyzing…');
    const images = await Promise.all(files.map(async (file) => { const blob = await compressImage(file, 1024, 0.8, true); return { media_type: blob.type, data: await blobToBase64(blob) }; }));
    const { height, weight, age, sex } = getState().profile;
    const r = await askCoach('body', { consent: true, profile: { height, weight, age, sex }, images });
    sheet(`<h2>${L('ประเมินรูปร่าง', 'Body assessment')}</h2><p>${L('การประเมินคร่าว ๆ จากภาพเท่านั้น ไม่ใช่การวัดหรือวินิจฉัย', 'Rough visual estimate only, not a measurement or diagnosis')}</p>
      <h3>${L('ช่วงไขมันโดยประมาณ', 'Estimated body-fat range')}: ${r.bodyFatRange ? esc(r.bodyFatRange.min) + '–' + esc(r.bodyFatRange.max) + '%' : L('ประเมินไม่ได้', 'Unable to estimate')}</h3>
      <h3>${L('ท่าทาง', 'Posture')}</h3>${list(r.posture)}<h3>${L('กล้ามเนื้อที่อาจพัฒนาเพิ่ม', 'Potential muscle development')}</h3>${list(r.underDeveloped)}${list(r.warnings)}
      <p>${esc(L(GOALS[r.goal]))} · ${r.focus.map((g) => esc(L(GROUPS[g]))).join(', ')}</p>
      <button class="btn primary block" id="ai-apply">${L('ใช้คำแนะนำนี้', 'Apply these suggestions')}</button><button class="btn ghost block" data-close>${L('ปิด', 'Close')}</button>`, { onMount(root) {
        root.querySelector('#ai-apply').addEventListener('click', () => {
          setState((s) => { s.profile.goal = r.goal; s.profile.focus = [...new Set(r.focus)]; });
          closeSheet(); rerender(); toast(L('อัปเดตเป้าหมายและกลุ่มฝึกแล้ว', 'Goal and focus updated'));
        }, { once: true });
      } });
  } catch (e) { toast(e.message, 'warn'); } finally { el.disabled = false; }
};

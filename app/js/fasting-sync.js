// Keeps "eating starts" and "fasting starts" in step; editing fasting start moves eatStart, which the usual binders save.
import { toMin, toHHMM } from './ui.js';
import { getState } from './store.js';
import { fastHint } from './fasting.js';
export function sync(el, FASTING) {
  const form = el.closest('.sheet, main, body'), eat = form?.querySelector('[data-eat-start]'), fast = form?.querySelector('[data-fast-start]');
  if (!eat || !fast) return;
  const hours = FASTING[form.querySelector('[data-fasting]')?.value] || 8;
  if (el === fast) { eat.value = toHHMM(toMin(fast.value) - hours * 60); eat.dispatchEvent(new Event('change', { bubbles: true })); }
  else fast.value = toHHMM(toMin(eat.value) + hours * 60);
  const hint = form.querySelector('[data-fast-hint]'), pattern = form.querySelector('[data-fasting]')?.value;
  if (hint) hint.textContent = fastHint({ ...getState().profile, eatStart: eat.value, ...(pattern ? { fasting: pattern } : {}) });
}

// Named insertion points keep feature registration independent from page order.
const slots = new Map();
export function registerSlot(name, render) { const list=slots.get(name)||[]; list.push(render); slots.set(name,list); }
export function slot(name, context={}) { return (slots.get(name)||[]).map(render=>render(context)).join(''); }

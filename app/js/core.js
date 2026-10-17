// Shared router + action registry so view modules don't import each other.
export const actions = {};
export const views = {};
let renderFn = () => {};
export const setRenderer = (fn) => (renderFn = fn);
export const rerender = () => renderFn();
export function go(hash) {
  if (location.hash === hash) rerender();
  else location.hash = hash;
}
export function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [name, ...params] = path.split('/');
  return { name: name || 'today', params, query: new URLSearchParams(query) };
}
// File picker helper: returns a Promise<File[]>
export function pickFiles({ accept = 'image/*', multiple = false, capture } = {}) {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.multiple = multiple;
    if (capture) i.capture = capture;
    i.onchange = () => res([...(i.files || [])]);
    i.oncancel = () => res([]);
    i.click();
  });
}

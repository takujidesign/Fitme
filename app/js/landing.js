// Landing page motion: reveal sections on scroll and show a sticky start button on phones.
const page=document.querySelector('.lp');
if(page&&!document.documentElement.classList.contains('app-mode')&&'IntersectionObserver' in window){
 page.classList.add('js');
 const reveal=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');reveal.unobserve(e.target);}}),{threshold:.12});
 page.querySelectorAll('.reveal').forEach(el=>reveal.observe(el));
 const hero=page.querySelector('.hero .ctas'),cta=document.getElementById('lp-cta');
 if(hero&&cta)new IntersectionObserver(([e])=>cta.classList.toggle('show',!e.isIntersecting&&e.boundingClientRect.top<0)).observe(hero);
}
// Chromium offers a one-tap install; elsewhere the link scrolls to the install steps.
let installPrompt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
document.getElementById('lp-install')?.addEventListener('click',async e=>{if(!installPrompt)return;e.preventDefault();const p=installPrompt;installPrompt=null;p.prompt();await p.userChoice.catch(()=>{});});

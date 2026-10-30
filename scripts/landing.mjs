// Sales-style landing page for /, /en/, /zh/, /ja/, /vi/. Content lives in app/seo/landing.json.
// The styles are scoped under .lp because on / the same document later boots the app.
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const md=v=>esc(v).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
const scope=css=>css.replace(/(^|[{}])([^{}@]+)\{/g,(m,brace,selectors)=>brace+selectors.split(',').map(s=>{s=s.trim();if(/^(from|to|\d+%)$/.test(s))return s;s=s.replace(/^:root(:not\(\[data-theme="dark"\]\))?/,'.lp').replace(/^(html|body)\b/,'.lp');return s.startsWith('.lp')?s:'.lp '+s;}).join(',')+'{');

const styles=`
:root{--accent:#C6F432;--accent-on:#11160A;--mint:#5EE6B8;--sky:#6CC4FF;--amber:#FFC857;--rose:#FF7A90;--bg:#0B0F14;--bg2:#0F141B;--surface:#141B24;--surface2:#1B2430;--line:#263244;--text:#EEF3F8;--muted:#9AA8B8;--glow:rgba(198,244,50,.18);--strong:#C6F432;--font:'IBM Plex Sans Thai',system-ui,-apple-system,'Segoe UI',sans-serif;--display:'Kanit','IBM Plex Sans Thai',system-ui,sans-serif}
@media (prefers-color-scheme:light){:root{--bg:#F4F6F8;--bg2:#EBEFF3;--surface:#FFFFFF;--surface2:#E8EEF3;--line:#D3DCE5;--text:#0E1620;--muted:#566474;--glow:rgba(130,180,0,.18);--mint:#0FAF7E;--sky:#1E8FE0;--amber:#D99100;--rose:#E04563;--strong:#4E7300}}
body{background:var(--bg);color:var(--text);font:16px/1.6 var(--font);-webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh}
*{box-sizing:border-box}
a{color:inherit}
img{max-width:100%;display:block}
h1,h2,h3{font-family:var(--display);font-weight:600}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.hl,.kicker,.eyebrow{color:var(--strong)}
.nav{position:sticky;top:0;z-index:20;backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);background:color-mix(in srgb,var(--bg) 78%,transparent);border-bottom:1px solid color-mix(in srgb,var(--line) 60%,transparent)}
.nav .wrap{display:flex;align-items:center;gap:12px;height:60px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;text-decoration:none}
.brand img{width:32px;height:32px;border-radius:9px}
.nav .links{display:none;gap:22px;margin-left:24px;font-size:15px;color:var(--muted)}
.nav .links a{text-decoration:none}
.nav .links a:hover{color:var(--text)}
.sp{flex:1}
.lang{font-size:14px;color:var(--muted);text-decoration:none;padding:6px 8px;border-radius:8px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;text-decoration:none;border:0;cursor:pointer;font:inherit;font-weight:600;transition:transform .15s,box-shadow .15s}
.btn:active{transform:scale(.97)}
.btn.primary{background:var(--accent);color:var(--accent-on);padding:14px 26px;box-shadow:0 10px 30px -10px rgba(198,244,50,.6)}
.btn.primary:hover{box-shadow:0 14px 36px -10px rgba(198,244,50,.8)}
.btn.small{padding:8px 16px;font-size:14px}
.btn.ghost{background:transparent;color:var(--text);padding:13px 22px;border:1px solid var(--line)}
@media(min-width:860px){.nav .links{display:flex}}
.hero{position:relative;padding:44px 0 30px;overflow:hidden}
.hero::before{content:"";position:absolute;inset:-30% -20% auto;height:640px;background:radial-gradient(50% 50% at 30% 40%,var(--glow),transparent 70%),radial-gradient(40% 40% at 80% 30%,rgba(94,230,184,.12),transparent 70%);pointer-events:none}
.hero .wrap{position:relative;display:grid;gap:36px;align-items:center}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;background:color-mix(in srgb,var(--accent) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);padding:6px 12px;border-radius:999px}
h1{font-size:clamp(34px,8.6vw,60px);line-height:1.18;margin:16px 0 14px;letter-spacing:-.01em}
.lead{font-size:clamp(17px,4.4vw,20px);color:var(--muted);margin:0 0 24px;max-width:34em}
.ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.chips{display:flex;flex-wrap:wrap;gap:8px 16px;margin:22px 0 0;color:var(--muted);font-size:14px;padding:0;list-style:none}
.chips li{display:flex;align-items:center;gap:6px}
.chips li::before{content:"";width:16px;height:16px;border-radius:50%;background:var(--accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.2l2.4 2.3L12 5' fill='none' stroke='%2311160A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/100% no-repeat}
@media(min-width:900px){.hero{padding:80px 0 60px}.hero .wrap{grid-template-columns:1.1fr .9fr}}
.stage{position:relative;padding:10px 0}
.phone{position:relative;width:min(300px,78vw);margin:0 auto;aspect-ratio:9/18.5;border-radius:44px;padding:10px;background:linear-gradient(160deg,#2A3442,#0D1117);box-shadow:0 40px 80px -30px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.06) inset}
.screen{position:relative;height:100%;border-radius:35px;overflow:hidden;background:#0B0F14;color:#EEF3F8;padding:38px 14px 14px;font-size:12px;line-height:1.45}
.screen::before{content:"";position:absolute;top:10px;left:50%;translate:-50% 0;width:84px;height:24px;border-radius:14px;background:#000}
.scr-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.scr-h small{color:#9AA8B8}
.scr-h b{font-size:17px;display:block}
.tl{display:grid;gap:7px}
.ev{display:grid;grid-template-columns:38px 1fr auto;gap:8px;align-items:center;background:#141B24;border:1px solid #1F2936;border-radius:13px;padding:8px 10px}
.ev time{color:#9AA8B8;font-size:11px}
.ev .t{font-weight:600}
.ev small{display:block;color:#9AA8B8;font-size:10.5px}
.dot{width:20px;height:20px;border-radius:50%;border:2px solid #334155;position:relative}
.dot.ok{background:#C6F432;border-color:#C6F432}
.dot.ok::after{content:"";position:absolute;left:5px;top:2px;width:5px;height:9px;border:solid #11160A;border-width:0 2px 2px 0;rotate:45deg}
.ev.now{border-color:#C6F432;box-shadow:0 0 0 1px #C6F432 inset}
.tag{display:inline-block;font-size:10px;padding:1px 7px;border-radius:99px;margin-left:4px;vertical-align:1px;background:#C6F432;color:#11160A}
.floaty{position:absolute;background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:16px;padding:10px 12px;font-size:13px;box-shadow:0 20px 40px -20px rgba(0,0,0,.6);display:flex;gap:10px;align-items:center;max-width:220px}
.floaty .ic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex:none;font-size:17px;background:color-mix(in srgb,var(--accent) 22%,transparent)}
.floaty small{display:block;color:var(--muted);font-size:11.5px}
.f1{left:-6%;top:16%;animation:bob 6s ease-in-out infinite}
.f2{right:-4%;bottom:14%;animation:bob 7s ease-in-out -2s infinite}
@keyframes bob{50%{transform:translateY(-8px)}}
@media(max-width:520px){.f1{left:0;top:6%}.f2{right:0;bottom:6%}}
@media(prefers-reduced-motion:reduce){.f1,.f2{animation:none}}
section{padding:64px 0}
section.tight{padding-top:10px}
.kicker{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
h2{font-size:clamp(28px,6.4vw,42px);line-height:1.25;margin:8px 0 14px;letter-spacing:-.01em}
.sub{color:var(--muted);font-size:17px;max-width:40em;margin:0}
.center{text-align:center}
.center .sub{margin:0 auto}
.left{text-align:left}
.pains{display:grid;gap:14px;margin-top:30px}
.pain{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:20px}
.pain .q{font-weight:600;font-size:17px;margin-bottom:6px}
.pain .a{color:var(--muted);font-size:15px;margin:0}
.pain .a b,.how li b{color:var(--text)}
@media(min-width:760px){.pains{grid-template-columns:repeat(3,1fr)}}
.feat{display:grid;gap:28px;align-items:center;padding:34px 0}
.feat + .feat{border-top:1px solid color-mix(in srgb,var(--line) 60%,transparent)}
.feat h3{font-size:clamp(24px,5.6vw,32px);line-height:1.3;margin:10px 0 12px}
.feat p{color:var(--muted);margin:0 0 14px}
.more-link{display:inline-block;margin-top:14px;color:var(--strong);font-weight:600;text-decoration:none}
.ticks{list-style:none;padding:0;margin:0;display:grid;gap:9px}
.ticks li{display:flex;gap:10px;align-items:flex-start}
.ticks li::before{content:"";flex:none;margin-top:5px;width:16px;height:16px;border-radius:5px;background:color-mix(in srgb,var(--accent) 22%,transparent);box-shadow:0 0 0 1.5px var(--accent) inset}
.pill{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;padding:5px 11px;border-radius:999px;background:var(--surface2)}
.pill i{width:8px;height:8px;border-radius:50%}
@media(min-width:900px){.feat{grid-template-columns:1fr 1fr;gap:60px}.feat.rev .vis{order:-1}}
.vis{position:relative}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:18px;box-shadow:0 30px 60px -40px rgba(0,0,0,.6)}
.muted{color:var(--muted)}
.ex{display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:center}
.ex .img{aspect-ratio:1;border-radius:16px;background:radial-gradient(70% 70% at 50% 40%,var(--surface2),var(--bg2));overflow:hidden}
.ex .img img{width:100%;height:100%;object-fit:contain}
.ex .name{font-weight:700;font-size:18px}
.sets{display:flex;gap:6px;margin-top:8px}
.sets span{flex:1;text-align:center;font-size:12px;padding:6px 0;border-radius:9px;background:var(--surface2)}
.sets span.d{background:var(--accent);color:var(--accent-on);font-weight:600}
.timer{margin-top:14px;display:flex;align-items:center;gap:14px;background:var(--bg2);border-radius:16px;padding:12px 14px}
.timer b{font-size:26px;font-variant-numeric:tabular-nums;display:block}
.bar{height:8px;border-radius:9px;background:var(--surface2);overflow:hidden}
.bar i{display:block;height:100%;border-radius:9px}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.big{font-size:34px;font-weight:700;margin:4px 0 6px}
.big small{font-size:15px;color:var(--muted);font-weight:500}
.macros{display:grid;gap:10px;margin-top:12px}
.macro{display:grid;grid-template-columns:78px 1fr 82px;gap:10px;align-items:center;font-size:14px}
.macro span:last-child{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
.meals{margin-top:12px}
.meal{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed var(--line);font-size:14px}
.meal:last-child{border:0}
.meal small{color:var(--muted);display:block}
.lock{background:linear-gradient(180deg,#1b2a3c,#0c121a);border-radius:28px;padding:26px 16px 20px;color:#fff;max-width:360px;margin:0 auto}
.lock .clock{text-align:center;font-size:48px;font-weight:600;line-height:1;margin-bottom:4px}
.lock .date{text-align:center;font-size:13px;opacity:.75;margin-bottom:20px}
.nt{background:rgba(255,255,255,.14);border-radius:18px;padding:10px 12px;display:grid;grid-template-columns:30px 1fr;gap:10px;margin-top:8px;font-size:13px}
.nt img{width:30px;height:30px;border-radius:8px}
.nt b{display:flex;justify-content:space-between;font-size:13px}
.nt b small{opacity:.6;font-weight:400}
.nt p{margin:2px 0 0;opacity:.85}
.chat{display:grid;gap:10px;font-size:14px}
.bub{max-width:85%;padding:10px 14px;border-radius:18px;line-height:1.5}
.bub.me{justify-self:end;background:var(--accent);color:var(--accent-on);border-bottom-right-radius:6px}
.bub.ai{background:var(--surface2);border-bottom-left-radius:6px}
.chart{width:100%;height:auto}
.stat{display:flex;gap:10px;margin-top:12px}
.stat div{flex:1;background:var(--bg2);border-radius:14px;padding:10px 12px}
.stat small{color:var(--muted);font-size:12px;display:block}
.stat b{font-size:20px}
.note{color:var(--muted);display:block;margin-top:8px;font-size:12px}
.steps{display:grid;gap:14px;margin-top:30px;counter-reset:s}
.step{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:22px 20px 20px 74px}
.step::before{counter-increment:s;content:counter(s);position:absolute;left:20px;top:20px;width:38px;height:38px;border-radius:12px;background:var(--accent);color:var(--accent-on);font-weight:700;display:grid;place-items:center;font-size:18px}
.step b{display:block;font-size:17px;margin-bottom:4px}
.step p{margin:0;color:var(--muted);font-size:15px}
@media(min-width:860px){.steps{grid-template-columns:repeat(3,1fr)}}
.cells{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:30px}
.cell{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px}
.cell .ic{font-size:22px;margin-bottom:6px}
.cell b{display:block;font-size:15px}
.cell small{color:var(--muted);font-size:13px;line-height:1.5;display:block;margin-top:2px}
@media(min-width:860px){.cells{grid-template-columns:repeat(4,1fr)}}
.install{display:grid;gap:14px;margin-top:28px}
.how{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:20px}
.how h3{margin:0 0 10px;font-size:18px}
.how ol{margin:0;padding-left:20px;color:var(--muted)}
.how li{margin:4px 0}
@media(min-width:760px){.install{grid-template-columns:1fr 1fr}}
.faq{max-width:760px;margin:28px auto 0;display:grid;gap:10px}
details{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:0 18px}
summary{cursor:pointer;list-style:none;padding:16px 0;font-weight:600;display:flex;justify-content:space-between;gap:12px}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";color:var(--strong);font-size:22px;line-height:1;transition:rotate .2s}
details[open] summary::after{rotate:45deg}
details p{margin:0 0 16px;color:var(--muted)}
.final{position:relative;overflow:hidden;border-radius:32px;padding:44px 24px;text-align:center;background:radial-gradient(80% 120% at 50% 0%,color-mix(in srgb,var(--accent) 22%,var(--surface)),var(--surface));border:1px solid var(--line)}
.final h2{margin-top:0}
.final .sub{margin:0 auto 24px}
.foot{padding:36px 0 90px;color:var(--muted);font-size:14px;border-top:1px solid var(--line);margin-top:64px}
.foot .wrap{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:center}
.foot a{text-decoration:none}
.foot a:hover{color:var(--text)}
.langs{display:flex;gap:12px;flex-wrap:wrap}
.inst-link{display:inline-block;margin-top:16px;color:var(--strong);font-weight:600;font-size:15px;text-decoration:none}
.mobile-cta{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:30;display:flex;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s}
.mobile-cta.show{opacity:1;pointer-events:auto}
.mobile-cta .btn{width:100%;max-width:420px}
@media(min-width:860px){.mobile-cta{display:none}}
.lp.js .reveal{opacity:0;transform:translateY(16px);transition:opacity .6s,transform .6s}
.lp.js .reveal.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.lp.js .reveal{opacity:1;transform:none;transition:none}}
`;
// Page-level rules that must not be scoped: body background and the app-shell switch on /.
export const landingCSS='body{margin:0;background:#0B0F14}@media (prefers-color-scheme:light){body{background:#F4F6F8}}#app{display:none}html.app-mode #seo,html.app-mode .seo-only{display:none}html.app-mode #app{display:block}'+scope(styles.replace(/\n/g,''));
export const landingFonts='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Kanit:wght@600;700&display=swap">';

const LANG_NAMES={th:'ไทย',en:'English',zh:'中文',ja:'日本語',vi:'Tiếng Việt'};
const FEATURE_SLUGS=['workout-plan','meal-plan','supplements','ai-coach','health-import'];
const MORE={th:'อ่านเพิ่มเติม →',en:'Learn more →'};
const COLORS=['var(--accent)','var(--mint)','var(--amber)','var(--sky)','var(--rose)'];

export function landingFAQ(c){return c.faq;}
export function renderLanding(c,lang,{langs,landingPath}){
 const home=landingPath(lang),start='/#/onboarding',icon='/icons/icon-192.png';
 const other=lang==='th'?'en':'th';
 const feature=(i,vis)=>{const f=c.features[i];return `<div class="feat${i%2?' rev':''} reveal"><div><span class="pill"><i style="background:${COLORS[i]}"></i>${esc(f.pill)}</span><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p><ul class="ticks">${f.ticks.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>${MORE[lang]?`<a class="more-link" href="${lang==='en'?'/en':''}/features/${FEATURE_SLUGS[i]}">${MORE[lang]}</a>`:''}</div><div class="vis">${vis}</div></div>`;};
 const m=c.mock,p=c.phone;
 const visuals=[
  `<div class="panel"><div class="ex"><div class="img"><img src="/img/ex/goblet_squat-finish-round11.webp" alt="${esc(m.exAlt)}" width="220" height="220" loading="lazy"></div><div><small class="muted">${esc(m.exStep)}</small><div class="name">Goblet squat</div><small class="muted">${esc(m.exMeta)}</small><div class="sets"><span class="d">12</span><span class="d">12</span><span>10</span><span>10</span></div></div></div><div class="timer"><svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface2)" stroke-width="5"/><circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-dasharray="113" stroke-dashoffset="40" transform="rotate(-90 22 22)"/></svg><div><small class="muted">${esc(m.rest)}</small><b>0:58</b></div><span class="sp"></span><span class="btn small ghost">${esc(m.skip)}</span></div></div>`,
  `<div class="panel"><div class="row"><b>${esc(m.eaten)}</b><span class="muted">${esc(m.goal)}</span></div><div class="big">1,340 <small>kcal</small></div><div class="bar"><i style="width:68%;background:linear-gradient(90deg,var(--mint),var(--accent))"></i></div><div class="macros">${[[77,'var(--accent)','92/120 g'],[60,'var(--sky)','130/215 g'],[63,'var(--amber)','41/65 g']].map(([w,color,v],i)=>`<div class="macro"><span>${esc(m.macros[i])}</span><div class="bar"><i style="width:${w}%;background:${color}"></i></div><span>${v}</span></div>`).join('')}</div><div class="meals">${m.meals.map(([name,sub,kcal])=>`<div class="meal"><span>${esc(name)}<small>${esc(sub)}</small></span><b>${esc(kcal)}</b></div>`).join('')}</div></div>`,
  `<div class="lock"><div class="clock">18:00</div><div class="date">${esc(m.lockDate)}</div>${m.notes.map(([when,text])=>`<div class="nt"><img src="${icon}" alt="" width="30" height="30" loading="lazy"><div><b>Fixmee <small>${esc(when)}</small></b><p>${esc(text)}</p></div></div>`).join('')}</div>`,
  `<div class="panel chat">${m.chat.map((text,i)=>`<div class="bub ${i%2?'ai':'me'}">${esc(text)}</div>`).join('')}</div>`,
  `<div class="panel"><div class="row"><b>${esc(m.weight)}</b><span class="muted">${esc(m.weeks)}</span></div><svg class="chart" viewBox="0 0 320 140" role="img" aria-label="${esc(m.chartLabel)}"><defs><linearGradient id="lpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#C6F432" stop-opacity=".35"/><stop offset="1" stop-color="#C6F432" stop-opacity="0"/></linearGradient></defs><g stroke="var(--line)" stroke-width="1"><line x1="0" x2="320" y1="30" y2="30"/><line x1="0" x2="320" y1="70" y2="70"/><line x1="0" x2="320" y1="110" y2="110"/></g><path d="M0 26 L45 34 L90 40 L135 52 L180 58 L225 70 L270 78 L320 88 L320 140 L0 140Z" fill="url(#lpg)"/><path d="M0 26 L45 34 L90 40 L135 52 L180 58 L225 70 L270 78 L320 88" fill="none" stroke="#C6F432" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="320" cy="88" r="5" fill="#C6F432"/></svg><div class="stat"><div><small>${esc(m.stats[0])}</small><b>78.4</b></div><div><small>${esc(m.stats[1])}</small><b>74.9</b></div><div><small>${esc(m.stats[2])}</small><b>${esc(m.stats[3])}</b></div></div><small class="note">${esc(m.sample)}</small></div>`
 ];
 const events=p.events.map(([time,title,sub],i)=>`<div class="ev${i===4?' now':''}"><time>${esc(time)}</time><div><span class="t">${esc(title)}${i===4?`<span class="tag">${esc(p.now)}</span>`:''}</span>${sub?`<small>${esc(sub)}</small>`:''}</div><span class="dot${i<4?' ok':''}"></span></div>`).join('');
 return `<header class="nav"><div class="wrap"><a class="brand" href="${home}"><img src="${icon}" alt="" width="32" height="32">Fixmee</a><nav class="links"><a href="#features">${esc(c.nav[0])}</a><a href="#how">${esc(c.nav[1])}</a><a href="#install">${esc(c.nav[2])}</a><a href="#faq">${esc(c.nav[3])}</a></nav><span class="sp"></span><a class="lang" lang="${other}" hreflang="${other}" href="${landingPath(other)}">${other.toUpperCase()}</a><a class="btn primary small" href="${start}">${esc(c.nav[4])}</a></div></header>
<div class="hero"><div class="wrap"><div><span class="eyebrow">${esc(c.eyebrow)}</span><h1>${esc(c.h1[0])}<br><span class="hl">${esc(c.h1[1])}</span></h1><p class="lead">${esc(c.lead)}</p><div class="ctas"><a class="btn primary" href="${start}">${esc(c.cta)} →</a><a class="btn ghost" href="#features">${esc(c.cta2)}</a></div><ul class="chips">${c.chips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><a class="inst-link" id="lp-install" href="#install">${esc(c.installLink)}</a></div>
<div class="stage"><div class="phone" role="img" aria-label="${esc(p.label)}"><div class="screen"><div class="scr-h"><div><small>${esc(p.day)}</small><b>${esc(p.today)}</b></div><svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="19" fill="none" stroke="#1F2936" stroke-width="6"/><circle cx="23" cy="23" r="19" fill="none" stroke="#C6F432" stroke-width="6" stroke-linecap="round" stroke-dasharray="119.4" stroke-dashoffset="47" transform="rotate(-90 23 23)"/><text x="23" y="27" text-anchor="middle" fill="#EEF3F8" font-size="11" font-weight="700">60%</text></svg></div><div class="tl">${events}</div></div></div>
<div class="floaty f1" aria-hidden="true"><span class="ic">🔔</span><div><b>${esc(c.float[0][0])}</b><small>${esc(c.float[0][1])}</small></div></div><div class="floaty f2" aria-hidden="true"><span class="ic">🔥</span><div><b>${esc(c.float[1][0])}</b><small>${esc(c.float[1][1])}</small></div></div></div></div></div>
<section><div class="wrap center reveal"><span class="kicker">${esc(c.painsKicker)}</span><h2>${esc(c.painsTitle)}</h2><div class="pains left">${c.pains.map(([q,a])=>`<div class="pain"><div class="q">${esc(q)}</div><p class="a">${md(a)}</p></div>`).join('')}</div></div></section>
<section id="features" class="tight"><div class="wrap"><div class="center reveal"><span class="kicker">${esc(c.featKicker)}</span><h2>${esc(c.featTitle)}</h2><p class="sub">${esc(c.featSub)}</p></div>${visuals.map((vis,i)=>feature(i,vis)).join('')}</div></section>
<section class="tight"><div class="wrap center reveal"><h2>${esc(c.moreTitle)}</h2><div class="cells left">${c.more.map(([ic,t,s])=>`<div class="cell"><div class="ic" aria-hidden="true">${ic}</div><b>${esc(t)}</b><small>${esc(s)}</small></div>`).join('')}</div></div></section>
<section id="how"><div class="wrap center reveal"><span class="kicker">${esc(c.howKicker)}</span><h2>${esc(c.howTitle)}</h2><div class="steps left">${c.steps.map(([t,s])=>`<div class="step"><b>${esc(t)}</b><p>${esc(s)}</p></div>`).join('')}</div></div></section>
<section id="install" class="tight"><div class="wrap reveal"><div class="center"><span class="kicker">${esc(c.installKicker)}</span><h2>${esc(c.installTitle)}</h2><p class="sub">${esc(c.installSub)}</p></div><div class="install"><div class="how"><h3>📱 iPhone / iPad</h3><ol>${c.ios.map(s=>`<li>${md(s)}</li>`).join('')}</ol></div><div class="how"><h3>🤖 Android</h3><ol>${c.android.map(s=>`<li>${md(s)}</li>`).join('')}</ol></div></div></div></section>
<section id="faq" class="tight"><div class="wrap reveal"><div class="center"><h2>${esc(c.faqTitle)}</h2></div><div class="faq">${c.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>
<section class="tight"><div class="wrap reveal"><div class="final"><h2>${esc(c.final[0])}<span class="hl">${esc(c.final[1])}</span></h2><p class="sub">${esc(c.finalSub)}</p><a class="btn primary" href="${start}">${esc(c.cta)} →</a></div></div></section>
<footer class="foot"><div class="wrap"><a class="brand" href="${home}"><img src="${icon}" alt="" width="28" height="28" loading="lazy">Fixmee</a><a href="/exercises/">${esc(c.footer[0])}</a><a href="/guide">${esc(c.footer[1])}</a><a href="/privacy">${esc(c.footer[2])}</a><a href="/terms">${esc(c.footer[3])}</a><span class="sp"></span><span class="langs">${langs.map(l=>`<a lang="${l}" hreflang="${l}" href="${landingPath(l)}">${LANG_NAMES[l]}</a>`).join('')}</span></div></footer>
<div class="mobile-cta" id="lp-cta"><a class="btn primary" href="${start}">${esc(c.cta)} →</a></div>`;
}

export const TABS=['today','workout','food','supps','me'];
export const PRESETS=['#dc2626','#ea580c','#d97706','#65a30d','#16a34a','#059669','#0891b2','#0284c7','#4f46e5','#7c3aed','#c026d3','#db2777'];
export const GRADIENTS=[{name:'Aurora',hue:145},{name:'Sunset',hue:25},{name:'Nebula',hue:260}];
export function gradientPalette(index){const def=GRADIENTS[index];if(!def)throw Error('Invalid gradient');return Object.fromEntries(TABS.map(tab=>[tab,Object.fromEntries(['dark','light'].map(theme=>{const pair=accessibleColour(def.hue,theme),end=accessibleColour(def.hue+70,theme);return [theme,{...pair,gradient:`linear-gradient(120deg,${pair.color},${end.color})`}];}))]));}
export const BACKGROUNDS={dark:'#101217',light:'#ffffff'};
const rgb=hex=>hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255);
export function luminance(hex){return rgb(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function oklch(L,C,h){
 const a=C*Math.cos(h*Math.PI/180),b=C*Math.sin(h*Math.PI/180);
 const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
 const channels=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
 return '#'+channels.map(v=>Math.round(255*Math.max(0,Math.min(1,v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055))).toString(16).padStart(2,'0')).join('');
}
export function accessibleColour(h,theme){
 let L=theme==='dark'?.78:.44,C=theme==='dark'?.14:.16;
 for(let i=0;i<100;i++) {const color=oklch(L,C,h),on=theme==='dark'?'#000000':'#ffffff';if(contrast(color,BACKGROUNDS[theme])>=4.5&&contrast(color,on)>=4.5)return {color,on};L+=theme==='dark'?.002:-.002;C*=.99;}
 throw Error('No accessible colour');
}
export function randomPalette(seed=Math.random(),previous={},locked=[]){return Object.fromEntries(TABS.map((tab,i)=>[tab,locked.includes(tab)&&previous[tab]?structuredClone(previous[tab]):Object.fromEntries(['dark','light'].map(t=>[t,accessibleColour((seed*360+i*72)%360,t)]))]));}
export function singlePalette(hex){if(!/^#[a-f\d]{6}$/i.test(hex))throw Error('Invalid colour');const [r,g,b]=rgb(hex),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=!d?0:max===r?60*((g-b)/d%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);return Object.fromEntries(TABS.map(t=>[t,Object.fromEntries(['dark','light'].map(theme=>[theme,accessibleColour(h,theme)]))]));}
export function savePalette(settings,name){if((settings.saved||[]).length>=5)throw Error('Five palettes maximum');return {...settings,saved:[...(settings.saved||[]),{name:String(name).slice(0,40),palette:structuredClone(settings.palette)}]};}
export function restorePalette(settings,index){if(!settings.saved?.[index])throw Error('Palette not found');return {...settings,mode:'random',palette:structuredClone(settings.saved[index].palette)};}

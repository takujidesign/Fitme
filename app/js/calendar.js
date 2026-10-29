// RFC 5545, shared with the Worker. No account identifiers or reminder bodies.
const encoder=new TextEncoder();
export const escapeICS=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function foldICS(line){let out='',bytes=0;for(const c of line){const n=encoder.encode(c).length;if(bytes+n>75){out+='\r\n ';bytes=1;}out+=c;bytes+=n;}return out;}
const stamp=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const localStamp=r=>r.date.replace(/-/g,'')+'T'+r.time.replace(':','')+'00';
function parts(at,tz){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));}
function offset(at,tz){const p=parts(at,tz);return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-Math.floor(at/1000)*1000)/60000);}
const offsetText=n=>(n<0?'-':'+')+String(Math.floor(Math.abs(n)/60)).padStart(2,'0')+String(Math.abs(n)%60).padStart(2,'0');
export function timezoneLines(tz,year){
 if(!/^[A-Za-z0-9_+\-/]+$/.test(tz))throw Error('Invalid timezone');
 let at=Date.UTC(year-1,0,1),end=Date.UTC(year+2,0,1),previous=offset(at,tz);
 const lines=['BEGIN:VTIMEZONE','TZID:'+tz,'X-LIC-LOCATION:'+tz,'BEGIN:STANDARD','DTSTART:'+(year-1)+'0101T000000','TZOFFSETFROM:'+offsetText(previous),'TZOFFSETTO:'+offsetText(previous),'END:STANDARD'];
 for(at+=86400000;at<end;at+=86400000){const next=offset(at,tz);if(next===previous)continue;let low=at-86400000,high=at;while(high-low>60000){const mid=Math.floor((low+high)/120000)*60000;if(offset(mid,tz)===previous)low=mid;else high=mid;}const kind=next>previous?'DAYLIGHT':'STANDARD';lines.push('BEGIN:'+kind,'DTSTART:'+stamp(high+previous*60000).replace('Z',''),'TZOFFSETFROM:'+offsetText(previous),'TZOFFSETTO:'+offsetText(next),'END:'+kind);previous=next;}
 return [...lines,'END:VTIMEZONE'];
}
// Two independent hashes keep UIDs compact without exposing titles in identifiers.
export function stableHash(s){let a=2166136261,b=5381;for(const c of s){a=Math.imul(a^c.codePointAt(0),16777619);b=Math.imul(b,33)^c.codePointAt(0);}return (a>>>0).toString(16)+(b>>>0).toString(16);}
export function buildICS(reminders,{tz='UTC',earlier=0,now=Date.now(),sequence=0}={}){
 const sorted=[...reminders].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),groups=new Map();
 for(const r of sorted){const recurring=['water','sleep','supplements'].includes(r.category),key=(recurring?'daily':r.date)+':'+r.time+':'+r.category+':'+r.title;const group=groups.get(key)||[];group.push(r);groups.set(key,group);}
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Fixmee//Reminders//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Fixmee','X-PUBLISHED-TTL:PT6H',...timezoneLines(tz,Number((sorted[0]?.date||new Date(now).toISOString()).slice(0,4)))];
 for(const [key,group] of groups){
  // Only compress truly consecutive daily occurrences; changing/gapped plans stay singles.
  const daily=key.startsWith('daily:')&&group.length>1&&group.every((r,i)=>!i||Date.parse(r.date)-Date.parse(group[i-1].date)===86400000);
  for(const r of daily?[group[0]]:group){const uid=stableHash((daily?key:r.date+':'+key));lines.push('BEGIN:VEVENT','UID:'+uid+'@fixmee.app','SEQUENCE:'+Math.max(0,Math.floor(sequence)),'DTSTAMP:'+stamp(now),'DTSTART;TZID='+tz+':'+localStamp(r),'DURATION:PT1M','SUMMARY:'+escapeICS(r.title));if(daily)lines.push('RRULE:FREQ=DAILY;COUNT='+group.length);
   for(const lead of [0,...([5,10,15].includes(Number(earlier))?[Number(earlier)]:[])])lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+escapeICS(r.title),'TRIGGER:'+(lead?'-PT'+lead+'M':'PT0M'),'END:VALARM');lines.push('END:VEVENT');
  }
 }
 return [...lines,'END:VCALENDAR',''].map(foldICS).join('\r\n');
}

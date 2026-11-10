const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const out=process.argv[3];
const S={},V={},A={};const LOGO=()=>'',WORD='',PHONE=false,esc=(s)=>String(s),head=()=>'',body=(x)=>x,can=()=>true,go=()=>{},tabTo=()=>{},render=()=>{},root={querySelector:()=>null};
eval(src+'\nglobalThis.__L={LESSONS,LTRACKS,lessonDur,sceneDur,mmss};');
const {LESSONS,LTRACKS,lessonDur,sceneDur,mmss}=globalThis.__L;
const md=(h)=>h.replace(/<div class="lc-tbl">(.*?)<\/div><\/div>/g,(m)=>{const rows=[...m.matchAll(/<span>(.*?)<\/span><b>(.*?)<\/b>/g)].map(r=>`| ${r[1]} | ${r[2]} |`);return '\n| Item | Amount |\n|---|---|\n'+rows.join('\n')+'\n';})
 .replace(/<ol>(.*?)<\/ol>/gs,(m,x)=>'\n'+[...x.matchAll(/<li>(.*?)<\/li>/gs)].map((l,i)=>`${i+1}. ${l[1]}`).join('\n')+'\n')
 .replace(/<ul>(.*?)<\/ul>/gs,(m,x)=>'\n'+[...x.matchAll(/<li>(.*?)<\/li>/gs)].map(l=>`- ${l[1]}`).join('\n')+'\n')
 .replace(/<\/?b>/g,'**').replace(/<[^>]+>/g,'').replace(/\n{3,}/g,'\n\n');
const track=(t)=>LTRACKS.find(x=>x[0]===t)[1];
let index=`# Send Koro Learning Center (restaurants)\n\nShort guides with a short video each. They appear on the restaurant welcome page (web and PWA) under **Learning center**, and inside the portal (sidebar → Learning center; PWA → More → Learning center).\n\nSource of truth for the content: \`designs/source/restaurant.js\` (\`LESSONS\`). These files are generated from it; edit the source, then regenerate.\n\nEach video is an animated walkthrough (scenes, captions, optional read-aloud). Each lesson also has a video script below, so a recorded or produced video can replace the animation later.\n\n`;
LTRACKS.forEach(([k,lbl])=>{index+=`## ${lbl}\n\n| # | Lesson | Video | File |\n|---|---|---|---|\n`;LESSONS.filter(l=>l.t===k).forEach(l=>{const n=LESSONS.indexOf(l)+1;const f=`${String(n).padStart(2,'0')}-${l.id}.md`;index+=`| ${n} | ${l.title} | ${mmss(lessonDur(l))} | [${f}](${f}) |\n`;});index+='\n';});
fs.writeFileSync(out+'/README.md',index);
LESSONS.forEach((l,i)=>{const f=`${String(i+1).padStart(2,'0')}-${l.id}.md`;let t=0;
 let s=`# ${l.title}\n\n_${track(l.t)} · Lesson ${i+1} of ${LESSONS.length} · Video ${mmss(lessonDur(l))}_\n\n${l.sum}\n\n`;
 s+=l.body.map(([h,html])=>`## ${h}\n${md(html)}`).join('\n');
 s+=`\n## Video script\n\n| Time | Scene | On screen | Voice-over and captions |\n|---|---|---|---|\n`;
 l.scenes.forEach((sc,j)=>{const d=sceneDur(sc);const on=sc.k==='title'?`${sc.h}: ${sc.sub}`:sc.k==='steps'?`${sc.h}: ${sc.items.join(' · ')}`:sc.k==='money'?`${sc.h}: ${sc.rows.map(r=>r[0]+' '+r[1]).join(' · ')}${sc.note?' ('+sc.note+')':''}`:sc.k==='flow'?`${sc.h}: ${sc.nodes.map(n=>n[0]+(n[1]?' ('+n[1]+')':'')).join(' → ')}`:`${sc.h}: phone screen “${sc.title}” with ${sc.ui.map(r=>r[0]+' '+r[1]).join(' · ')}`;
  s+=`| ${mmss(t)}–${mmss(t+d)} | ${j+1} | ${on.replace(/\|/g,'/')} | ${sc.cap} |\n`; t+=d;});
 s+=`\nIn the portal: ${l.go ? '`'+l.go+'` page' : '—'}.\n`;
 fs.writeFileSync(out+'/'+f,s);});
console.log('wrote',LESSONS.length+1,'files');

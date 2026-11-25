import { mkdir, writeFile } from "node:fs/promises";

import assert from "node:assert/strict";

function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));}

function streaks(days){const a=[...days].sort((a,b)=>a.date.localeCompare(b.date));let longest=0,run=0,prev=null;for(const d of a){if(prev!==null&&Date.parse(d.date)-Date.parse(prev)!==86400000)run=0;run=d.contributionCount>0?run+1:0;longest=Math.max(longest,run);prev=d.date;}let i=a.length-1;if(i>=0&&a[i].contributionCount===0)i--;let current=0;for(;i>=0&&a[i].contributionCount>0;i--){if(current&&Date.parse(a[i+1].date)-Date.parse(a[i].date)!==86400000)break;current++;}return {current,longest};}

function languageStats(repos){const counts=new Map();for(const r of repos){if(r.fork)continue;for(const [name,size] of Object.entries(r.languages)){if(Number.isFinite(size)&&size>0)counts.set(name,(counts.get(name)||0)+size);}}const total=[...counts.values()].reduce((a,b)=>a+b,0);if(!total)return [];const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));const top=sorted.slice(0,5);const other=sorted.slice(5).reduce((a,b)=>a+b[1],0);if(other)top.push(["Other",other]);return top.map(([name,size])=>({name,percent:size/total*100}));}

function renderCards(data){
 const C={bg:"#101316",panel:"#161a1d",border:"#30363b",line:"#292f34",text:"#f0f1f2",muted:"#9da5ae",mint:"#73c8ab",track:"#252a2e"};
 const W=760;
 const t=(x,y,str,size=20,fill=C.text,weight=400,anchor="start")=>`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(str)}</text>`;
 const r=(x,y,w,h,fill,stroke="none",rx=10)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
 const num=n=>n===null||n===undefined?"—":Number(n).toLocaleString("en-US");
 const wrap=(title,height,body,subtitle)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${r(1,1,W-2,height-2,C.bg,C.border,18)}<g font-family="system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${t(28,39,title,25,C.text,650)}${subtitle?t(28,65,subtitle,15,C.muted):""}${body}</g></svg>\n`;
 const status=data.pending?"Initial snapshot · live sync pending":"Last 12 months · public profile data";
 const metrics=[["Contributions",data.total],["Public repos",data.repos],["Stars",data.stars],["Followers",data.followers]];
 const profile=wrap("Profile overview",216,`<circle cx="724" cy="31" r="5" fill="${C.mint}"/>`+metrics.map(([label,val],i)=>{const x=28+i*178;return r(x,84,170,104,C.panel,C.line,10)+t(x+14,112,label,15,C.muted,500)+t(x+14,158,num(val),43,C.text,650);}).join(""),status);
 const streak=wrap("Contribution streak",224,[["Contributions",data.total],["Current streak",data.current],["Longest streak",data.longest]].map(([label,val],i)=>{const x=[146,380,614][i];return (i===1?`<circle cx="${x}" cy="130" r="42" fill="none" stroke="${C.line}" stroke-width="5"/><circle cx="${x}" cy="130" r="42" fill="none" stroke="${C.mint}" stroke-width="5" stroke-dasharray="6 4"/>`:"")+t(x,143,num(val),40,C.text,650,"middle")+t(x,194,label,17,C.muted,500,"middle");}).join("")+`<path d="M255 91V167M505 91V167" stroke="${C.line}"/>`,data.pending?"First live sync pending":"Last 12 months · streaks in days");
 const colors={"HTML":"#e46b4c","JavaScript":"#e6ce55","CSS":"#a18bd5","Python":"#639ec6","TypeScript":"#4c94df","Lua":"#8d93df","Shell":"#73c8ab","Other":"#87919a"};
 const langs=data.languages||[];const language=wrap("Language distribution",Math.max(180,104+langs.length*48),langs.length?langs.map((l,i)=>{const y=93+i*48,c=colors[l.name]||C.mint;const name=l.name.length>21?l.name.slice(0,20)+"…":l.name;return `<circle cx="34" cy="${y+10}" r="5" fill="${c}"/>`+t(48,y+16,name,19,C.text,500)+r(246,y+2,388,15,C.track,"none",5)+r(246,y+2,388*Math.max(0,Math.min(100,l.percent))/100,15,c,"none",5)+t(730,y+16,`${l.percent.toFixed(1)}%`,18,C.text,500,"end");}).join(""):t(28,126,"Waiting for the first GitHub sync.",19,C.muted),data.pending?"Initial snapshot · rounded percentages":"Bytes in public, non-fork repositories");
 const palette=["#202629","#24473c","#376e5b","#59a98b","#87d4b5"];
 const weeks=data.weeks||[];const cell=11,gap=2;const step=Math.min(13,704/Math.max(1,weeks.length));const box=Math.min(cell,step-2);const positive=weeks.flatMap(w=>w.contributionDays).map(d=>d.contributionCount).filter(n=>n>0).sort((a,b)=>a-b);const high=positive[Math.floor((positive.length-1)*.9)]||1;
 const heat=wrap("Contribution activity",236,weeks.length?weeks.map((w,i)=>w.contributionDays.map(d=>{const x=28+i*step,y=88+d.weekday*13;const level=d.contributionCount?Math.min(4,Math.ceil(d.contributionCount/high*4)):0;return `<g><title>${esc(d.date)}: ${d.contributionCount} contributions</title>${r(x,y,box,11,palette[level],"none",2)}</g>`;}).join("")).join("")+t(28,211,"Last 12 months",15,C.muted)+t(592,211,"Less",14,C.muted)+palette.map((color,i)=>r(635+i*15,199,11,11,color,"none",2)).join("")+t(730,211,"More",14,C.muted,400,"end"):t(28,133,"Daily contribution data will appear after the first sync.",19,C.muted),data.pending?"No simulated contribution history":`${num(data.total)} contributions in the last year`);
 return {"profile.svg":profile,"streak.svg":streak,"languages.svg":language,"activity.svg":heat};
}

async function api(url, token, body) {
  const response = await fetch(url, {method: body ? "POST" : "GET", headers: {
    Accept: "application/vnd.github+json", Authorization: "Bearer "+token,
    "X-GitHub-Api-Version":"2022-11-28", "Content-Type":"application/json",
    "User-Agent":"aporka-profile-cards"
  }, ...(body ? {body:JSON.stringify(body)} : {})});
  if(!response.ok) throw new Error("GitHub API "+response.status+" for "+new URL(url).pathname);
  const data=await response.json();
  if(data.errors?.length) throw new Error("GitHub GraphQL: "+data.errors.map(e=>e.message).join("; "));
  return data;
}
async function fetchStats() {
  const token=process.env.GITHUB_TOKEN;
  const user=process.env.PROFILE_USER || "aporka-droid";
  if(!token) throw new Error("GITHUB_TOKEN required");
  const query = "query($login:String!){ user(login:$login){ followers{totalCount} contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount weekday}}}} } }";
  const result=await api("https://api.github.com/graphql",token,{query,variables:{login:user}});
  const profile=result.data?.user;
  if(!profile) throw new Error("Profile data unavailable");
  const calendar=profile.contributionsCollection.contributionCalendar;
  const repos=[];
  for(let page=1;;page++){
    const batch=await api("https://api.github.com/users/"+encodeURIComponent(user)+"/repos?type=owner&per_page=100&page="+page,token);
    if(!Array.isArray(batch)) throw new Error("Expected public repository list");
    repos.push(...batch.filter(r=>!r.private && r.owner.login.toLowerCase()===user.toLowerCase()));
    if(batch.length<100) break;
  }
  const languageRepos=[];
  for(const r of repos.filter(r=>!r.fork)) {
    const languages=await api("https://api.github.com/repos/"+encodeURIComponent(user)+"/"+encodeURIComponent(r.name)+"/languages",token);
    languageRepos.push({fork:false,languages});
  }
  const days=calendar.weeks.flatMap(w=>w.contributionDays);
  if(!days.length || days.some(d=>!Number.isInteger(d.contributionCount)||d.contributionCount<0||!Number.isInteger(d.weekday)||d.weekday<0||d.weekday>6)) throw new Error("Invalid contribution calendar");
  return {total:calendar.totalContributions,repos:repos.length,stars:repos.reduce((n,r)=>n+r.stargazers_count,0),followers:profile.followers.totalCount,...streaks(days),languages:languageStats(languageRepos),weeks:calendar.weeks};
}
function test() {
  const d=(date,contributionCount,weekday=0)=>({date,contributionCount,weekday});
  const days=[d("2026-11-20",1,5),d("2026-11-21",2,6),d("2026-11-22",0),d("2026-11-23",3,1),d("2026-11-24",1,2),d("2026-11-25",0,3)];
  assert.deepEqual(streaks(days),{current:2,longest:2});
  assert.deepEqual(streaks([]),{current:0,longest:0});
  assert.deepEqual(streaks([d("2026-11-20",1),d("2026-11-22",1)]),{current:1,longest:1});
  assert.deepEqual(languageStats([{fork:false,languages:{HTML:60,JavaScript:40}},{fork:true,languages:{Python:900}}]),[{name:"HTML",percent:60},{name:"JavaScript",percent:40}]);
  assert.deepEqual(languageStats([]),[]);
  const cards=renderCards({total:7,repos:2,stars:3,followers:2,current:2,longest:2,languages:[{name:"A&B",percent:100}],weeks:[{contributionDays:days.slice(0,2)},{contributionDays:days.slice(2)}]});
  assert.equal(Object.keys(cards).length,4);
  for(const svg of Object.values(cards)) {assert.match(svg,/^<svg /);assert.match(svg,/<\/svg>\s*$/);assert.doesNotMatch(svg,/NaN|undefined|Infinity/);}
  assert.match(cards["languages.svg"],/A&amp;B/);
  assert.match(cards["activity.svg"],/2026-11-25: 0 contributions/);
  console.log("All profile card tests passed.");
}
if(process.argv.includes("--test")) test();
else {
  const stats=await fetchStats();
  const cards=renderCards(stats);
  await mkdir("assets/stats",{recursive:true});
  for(const [name,svg] of Object.entries(cards)) await writeFile("assets/stats/"+name,svg);
  console.log("Generated "+Object.keys(cards).length+" SVG cards from GitHub.");
}

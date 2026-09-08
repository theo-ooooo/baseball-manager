import {readFileSync,writeFileSync} from 'node:fs';
const input=JSON.parse(readFileSync('apps/api/seed/schedule-2026.json','utf8'));
const q=v=>v==null?'NULL':"'"+String(v).replaceAll("'","''")+"'";
const rows=input.fixtures.map(f=>[f.id,f.date,f.league,f.home,f.away,f.time,f.source]);
const sql=[];for(let i=0;i<rows.length;i+=25)sql.push(`INSERT INTO fixtures(id,date,league,home,away,time,source) VALUES\n${rows.slice(i,i+25).map(r=>'('+r.map(q).join(',')+')').join(',\n')};`);
sql.push("UPDATE catalog_meta SET value='world-2026-09-08-v5' WHERE key='version';");
writeFileSync('drizzle/0008_official_schedules.sql','-- Official date fixtures snapshot; KBO preserves the initial planned dates without replaying historical rainouts.\n'+sql.join('\n--> statement-breakpoint\n')+'\n');console.log({fixtures:rows.length});

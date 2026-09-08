import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'dugout-ratings-'));
try{
 const out=join(dir,'world.cjs');buildSync({entryPoints:['apps/api/seed/world.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
 const world=createRequire(import.meta.url)(out).buildSeedWorld(),q=s=>"'"+String(s).replaceAll("'","''")+"'";
 const sql=world.players.filter(p=>p.real).map(p=>`UPDATE players SET contact=${p.contact},power=${p.power},speed=${p.speed},fielding=${p.field},stuff=${p.stuff},control=${p.control},potential=${p.potential},rating_json=${q(JSON.stringify(p.rating))} WHERE id=${q(p.id)};`);
 sql.push(`UPDATE catalog_meta SET value=${q(world.version)} WHERE key='version';`);
 const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')),entry=journal.entries.find(e=>e.tag.endsWith('_performance_2025'));
 writeFileSync('drizzle/'+entry.tag+'.sql','-- Deterministic ratings from the previous completed official season. Never changes career contracts or stats.\n'+sql.join('\n--> statement-breakpoint\n')+'\n');
 console.log(JSON.stringify({rated:world.players.filter(p=>p.rating?.status==='rated').length,provisional:world.players.filter(p=>p.rating?.status==='provisional').length,missing:world.players.filter(p=>p.rating?.status==='missing').length,examples:world.players.filter(p=>['전민재','Aaron Judge','김도영'].includes(p.original)).map(p=>({name:p.name,rating:p.rating,contact:p.contact,power:p.power,potential:p.potential}))}));
}finally{rmSync(dir,{recursive:true,force:true});}

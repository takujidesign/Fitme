import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function testDB(){
 const db=new DatabaseSync(':memory:');
 for(const name of ['0001_init.sql','0002_round5a.sql','0003_round5b.sql','0004_round5c.sql','0005_ai_credits.sql'])db.exec(readFileSync(new URL('./migrations/'+name,import.meta.url),'utf8'));
 const statement=(sql,args=[])=>({bind:(...values)=>statement(sql,values),first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});
 return {db,DB:{prepare:sql=>statement(sql),batch:async statements=>{db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
}

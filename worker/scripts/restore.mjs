// Offline conversion only. Import the generated SQL explicitly with wrangler d1 execute.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
export function restoreFiles(source,output){
if(!source||!output)throw Error('Usage: node scripts/restore.mjs backup.json.gz restore.sql');
const backup=JSON.parse(gunzipSync(readFileSync(source)));
if(backup.version!==1||!backup.tables||!Array.isArray(backup.config))throw Error('Unsupported backup');
const ident=s=>'"'+s.replaceAll('"','""')+'"',literal=v=>v===null?'NULL':typeof v==='number'&&Number.isFinite(v)?String(v):typeof v==='string'?"'"+v.replaceAll("'","''")+"'":(()=>{throw Error('Unsupported SQL value');})();
const sql=['PRAGMA defer_foreign_keys=ON;'];
for(const [table,rows] of Object.entries(backup.tables)){
 if(table==='d1_migrations')continue;
 if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(table))throw Error('Unexpected table');
 for(const row of rows){const keys=Object.keys(row);sql.push(`INSERT INTO ${ident(table)} (${keys.map(ident).join(',')}) VALUES (${keys.map(k=>literal(row[k])).join(',')});`);}
}
writeFileSync(output,sql.join('\n')+'\n',{flag:'wx'});
writeFileSync(output+'.kv.json',JSON.stringify(backup.config.map(k=>({key:k.name,value:k.value,...(k.expiration?{expiration:k.expiration}:{})})),null,2),{flag:'wx'});
console.log('Created SQL and encrypted CONFIG KV import files. Apply all migrations to an EMPTY database first. Preserve MASTER_KEY separately.');

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)restoreFiles(...process.argv.slice(2));

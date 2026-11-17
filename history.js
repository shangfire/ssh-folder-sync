'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
class HistoryStore{
 constructor(directory){this.directory=directory;this.file=path.join(directory,'connections.json');this.pending=Promise.resolve();}
 async load(){try{const records=JSON.parse(await fs.readFile(this.file,'utf8'));if(!Array.isArray(records)||records.some(x=>!x||typeof x.id!=='string'||typeof x.name!=='string'||typeof x.host!=='string'||typeof x.local!=='string'||typeof x.remote!=='string'||(x.excluded!==undefined&&(!Array.isArray(x.excluded)||x.excluded.some(p=>typeof p!=='string')))))throw Error('Invalid connections.json');return records;}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 save(records){const content=JSON.stringify(records,null,2);const run=this.pending.then(async()=>{await fs.mkdir(this.directory,{recursive:true});const tmp=this.file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(tmp,content,{flag:'wx',mode:0o600});await fs.rename(tmp,this.file);}finally{await fs.rm(tmp,{force:true});}});this.pending=run.catch(()=>{});return run;}
}
module.exports={HistoryStore};

'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function excluded(p,list){return list.some(x=>p===x||p.startsWith(x+'/'));}
function status(a,b,mode){if(!a)return '仅远端';if(!b)return '仅本地';if(a.type!==b.type)return '类型冲突';if(a.type==='dir')return '目录';return (a.hash===b.hash)?'相同':'不同';}
async function scan(root,mode,check=()=>{}){const result={};async function walk(rel){check();for(const e of await fs.readdir(path.join(root,rel),{withFileTypes:true})){check();const p=rel?rel+'/'+e.name:e.name;if(e.isSymbolicLink())continue;const s=await fs.lstat(path.join(root,p));if(!s.isDirectory()&&!s.isFile())continue;result[p]={type:s.isDirectory()?'dir':'file',size:s.size,mtime:Math.floor(s.mtimeMs/1000)};if(s.isDirectory())await walk(p);else result[p].hash=crypto.createHash('md5').update(await fs.readFile(path.join(root,p))).digest('hex');}}await walk('');return result;}
module.exports={excluded,status,scan};

function summarize(local,remote,mode){
 const states={};
 const paths=[...new Set([...Object.keys(local),...Object.keys(remote)])].sort((a,b)=>b.split('/').length-a.split('/').length);
 for(const p of paths){
  let s=status(local[p],remote[p],mode);
  if(s==='目录') s='相同';
  states[p]=states[p]==='不同'&&s==='相同'?'不同':s;
  const parent=path.posix.dirname(p);
  if(parent!=='.'&&states[p]!=='相同')states[parent]='不同';
 }
 return states;
}
module.exports.summarize=summarize;


function planSync(source,target,ignored){
 return Object.keys(source).filter(p=>{
  if(excluded(p,ignored))return false;
  const a=source[p],b=target[p];
  if(!b||a.type!==b.type)return true;
  return a.type==='file'&&a.hash!==b.hash;
 });
}
module.exports.planSync=planSync;

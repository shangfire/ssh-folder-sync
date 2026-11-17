const {test}=require('node:test'),assert=require('node:assert/strict'),{status,excluded}=require('./core');
test('排除仅影响路径及后代',()=>{assert.ok(excluded('a/b',['a']));assert.ok(!excluded('abc',['a']));});
test('比较模式及类型冲突',()=>{const a={type:'file',hash:'a',size:4,mtime:10},b={...a,hash:'b',mtime:11};assert.equal(status(a,b,'md5'),'不同');assert.equal(status(a,b,'timestamp'),'不同');assert.equal(status(a,{type:'dir'},'md5'),'类型冲突');assert.equal(status(a,null,'md5'),'仅本地');});
const {summarize}=require('./core');
test('目录递归汇总差异且保留单端状态',()=>{
 const d={type:'dir'},f={type:'file',hash:'a'};
 const l={top:d,'top/sub':d,'top/sub/f':f,empty:d,only:d,'only/f':f};
 const r={top:d,'top/sub':d,'top/sub/f':{...f,hash:'b'},empty:d,there:d};
 const s=summarize(l,r,'md5');
 assert.equal(s.top,'不同');assert.equal(s['top/sub'],'不同');assert.equal(s.empty,'相同');assert.equal(s.only,'仅本地');assert.equal(s.there,'仅远端');
 assert.equal(summarize(l,l,'md5').top,'相同');
});
test('子项缺失与类型冲突使父目录不同',()=>{
 const l={a:{type:'dir'},'a/b':{type:'file',hash:'x'}};
 assert.equal(summarize(l,{a:{type:'dir'}},'md5').a,'不同');
 const s=summarize(l,{a:{type:'dir'},'a/b':{type:'dir'}},'md5');
 assert.equal(s.a,'不同');assert.equal(s['a/b'],'类型冲突');
});

test('语言跟随编辑器，未知语言回退英语',()=>{const {translator}=require('./i18n');assert.equal(translator('zh-cn')('相同'),'相同');assert.equal(translator('en')('相同'),'Identical');assert.equal(translator('de')('仅远端'),'Remote only');assert.match(translator('en')('syncConfirm','Local',3,'Remote'),/3 differing items/);});

test('真实目录扫描：递归读取文件并计算 MD5',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
 const {scan}=require('./core');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sfs-scan-test-'));
 try{
  await fs.mkdir(path.join(root,'nested'));
  await fs.writeFile(path.join(root,'nested','hello.txt'),'hello');
  await fs.writeFile(path.join(root,'empty.txt'),'');
  const entries=await scan(root,'md5');
  assert.equal(entries.nested.type,'dir');
  assert.equal(entries['nested/hello.txt'].hash,'5d41402abc4b2a76b9719d911017c592');
  assert.equal(entries['empty.txt'].hash,'d41d8cd98f00b204e9800998ecf8427e');
  assert.equal(entries.nested.hash,undefined);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('同步计划过滤排除项、相同文件和已存在目录',()=>{
 const {planSync}=require('./core');
 const source={a:{type:'dir'},'a/done':{type:'file',hash:'x'},'a/skip':{type:'file',hash:'new'},'a/change':{type:'file',hash:'new'},empty:{type:'dir'}};
 const target={a:{type:'dir'},'a/done':{type:'file',hash:'x'},'a/skip':{type:'file',hash:'old'},'a/change':{type:'file',hash:'old'}};
 assert.deepEqual(planSync(source,target,['a/skip']),['a/change','empty']);
 assert.deepEqual(planSync(source,source,[]),[]);
 assert.deepEqual(planSync(source,target,['a']),['empty']);
 assert.deepEqual(planSync(source,target,['a','empty']),[]);
});

test('无同步项时不等待通知关闭即可结束',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const code=fs.readFileSync(require.resolve('./extension'),'utf8');
 const body=code.slice(code.indexOf('async function sync(up){'),code.indexOf('const executionHost=os.hostname();'))+'}';
 let notified=false;
 const run=vm.runInNewContext('('+body+')',{
  ign:[],refresh:async()=>{},local:{},remote:{},planSync:()=>[],t:x=>x,
  vscode:{window:{showInformationMessage(){notified=true;return new Promise(()=>{});}}}
 });
 let timer;
 try{await Promise.race([run(true),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('流程等待通知关闭')),500);})]);assert.ok(notified);}
 finally{clearTimeout(timer);}
});

test('历史记录持久化、独立排除项及顺序写入',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{HistoryStore}=require('./history');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sfs-history-'));
 try{const store=new HistoryStore(root);assert.deepEqual(await store.load(),[]);const a={id:'a',name:'A',host:'server',local:'/a',remote:'/b',excluded:['skip']};const b={...a,id:'b',excluded:[]};await Promise.all([store.save([a]),store.save([a,b])]);assert.deepEqual(await new HistoryStore(root).load(),[a,b]);await store.save([b]);assert.deepEqual(await store.load(),[b]);}finally{await fs.rm(root,{recursive:true,force:true});}
});

test('历史列表渲染使用翻译函数且不受局部变量遮蔽',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const code=fs.readFileSync(require.resolve('./extension'),'utf8');
 const start=code.indexOf('getTreeItem(p){')+'getTreeItem(p)'.length;
 const end=code.indexOf(',getChildren(parent)',start);
 class TreeItem{constructor(label){this.label=label;}}
 const render=vm.runInNewContext('(function(p)'+code.slice(start,end)+')',{
  cfg:undefined,history:[{id:'one',name:'Example',host:'server',local:'/a',remote:'/b'}],
  t:require('./i18n').translator('en'),vscode:{TreeItem,ThemeIcon:class{}}
 });
 assert.equal(render('one').label,'Example');assert.match(render('one').tooltip,/Local/);
 assert.equal(render('__new__').label,'New Sync Connection');
});

test('读取 SSH Host 与 Include，忽略通配 Host 和注释',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{aliases}=require('./ssh-config');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sfs-hosts-'));
 try{await fs.writeFile(path.join(root,'extra'),'Host other\n');await fs.writeFile(path.join(root,'config'),'Host one two # ignored\nHost * !excluded\nInclude "'+path.join(root,'extra').replaceAll('\\','/')+'"\n');assert.deepEqual(await aliases(path.join(root,'config')),['one','other','two']);}finally{await fs.rm(root,{recursive:true,force:true});}
});

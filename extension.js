'use strict';
const vscode=require('vscode'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),{excluded,status,scan,summarize,planSync}=require('./core');
async function activate(ctx){
 const output=vscode.window.createOutputChannel('SSH Folder Sync');
 ctx.subscriptions.push(output);
 output.appendLine('SSH Folder Sync '+ctx.extension.packageJSON.version+' | '+ctx.extensionPath);
 console.log('[SSH Folder Sync] '+ctx.extension.packageJSON.version+' | '+ctx.extensionPath);
 output.appendLine('Core module: '+require.resolve('./core'));

 const {absoluteRemotePath,remotePathApi}=require('./remote-path');
 const t=require('./i18n').translator(vscode.env.language);
 let cfg,ign=[],local={},remote={},states={},busy=false,operation;
 function check(){if(operation?.token.isCancellationRequested)throw new vscode.CancellationError();}
 function report(message){check();operation?.progress.report({message});output.appendLine(new Date().toISOString()+' '+message);}
 const {HistoryStore}=require('./history');
 const store=new HistoryStore(ctx.globalStorageUri.fsPath);
 let history=await store.load();
 const legacy=ctx.workspaceState.get('config');
 if(legacy&&!ctx.workspaceState.get('historyMigrated')){
  if(!history.some(x=>x.host===legacy.host&&x.remote===legacy.remote&&x.local===legacy.local)){
   history.push({...legacy,id:require('node:crypto').randomUUID(),name:legacy.host+' · '+path.basename(legacy.local),excluded:ctx.workspaceState.get('excluded',[]),lastUsed:0});await store.save(history);
  }
  await ctx.workspaceState.update('historyMigrated',true);
 }
 async function persist(){await store.save(history);}
 function header(){view.message=cfg?undefined:t('historyHost',os.hostname());vscode.commands.executeCommand('setContext','sfs.active',!!cfg);changed.fire();}
 async function open(record){cfg=record;ign=[...(record.excluded||[])];local={};remote={};states={};record.lastUsed=Date.now();await persist();header();await refresh();}
 const changed=new vscode.EventEmitter();
 const decorationsChanged=new vscode.EventEmitter();
 const styles={'相同':['=','sshFolderSync.same'],'不同':['!','sshFolderSync.different'],'仅本地':['L','sshFolderSync.localOnly'],'仅远端':['R','sshFolderSync.remoteOnly'],'类型冲突':['!','sshFolderSync.different']};
 ctx.subscriptions.push(decorationsChanged,vscode.window.registerFileDecorationProvider({onDidChangeFileDecorations:decorationsChanged.event,provideFileDecoration(uri){if(uri.scheme!=='ssh-folder-sync')return;const s=states[uri.path.slice(1)],style=styles[s];if(style)return {badge:style[0],tooltip:t(s),color:new vscode.ThemeColor(style[1]),propagate:false};}}));
 const provider={onDidChangeTreeData:changed.event,getTreeItem(p){if(cfg&&(p==='__sfs_local__'||p==='__sfs_remote__')){const isLocal=p==='__sfs_local__';const label=isLocal?`${t('本地')}: ${cfg.local}`:`${t('远端')}: ${cfg.host}:${cfg.remote}`;const info=new vscode.TreeItem(label);info.id=p;info.tooltip=label;info.iconPath=new vscode.ThemeIcon(isLocal?'device-desktop':'remote');return info;}if(!cfg){const record=history.find(x=>x.id===p);const item=new vscode.TreeItem(record?record.name:t('newConnection'));item.id=p;item.iconPath=new vscode.ThemeIcon(record?'remote':'add');item.contextValue=record?'sfs.history':'sfs.new';item.description=record?record.host:undefined;item.tooltip=record?`${t('本地')}: ${record.local}\n${t('远端')}: ${record.host}:${record.remote}`:t('newConnection');item.command={command:record?'sfs.open':'sfs.configure',title:record?record.name:t('newConnection'),arguments:record?[p]:[]};return item;}const translate=require('./i18n').translator(vscode.env.language);const a=local[p],b=remote[p],dir=(a||b).type==='dir';const item=new vscode.TreeItem(path.posix.basename(p),dir?1:0);item.id=p;item.description=translate(states[p]);item.resourceUri=vscode.Uri.from({scheme:'ssh-folder-sync',path:'/'+p});item.tooltip=p;item.checkboxState=excluded(p,ign)?0:1;item.iconPath=new vscode.ThemeIcon(dir?'folder':'file',styles[states[p]]?new vscode.ThemeColor(styles[states[p]][1]):undefined);return item;},getChildren(parent){if(!cfg)return parent?[]:[...history].sort((a,b)=>(b.lastUsed||0)-(a.lastUsed||0)).map(x=>x.id).concat('__new__');if(parent==='__sfs_local__'||parent==='__sfs_remote__')return [];const children=[...new Set([...Object.keys(local),...Object.keys(remote)])].filter(p=>path.posix.dirname(p)===(parent||'.')).sort((a,b)=>{const aDir=(local[a]||remote[a]).type==='dir',bDir=(local[b]||remote[b]).type==='dir';return Number(bDir)-Number(aDir)||path.posix.basename(a).localeCompare(path.posix.basename(b),undefined,{numeric:true,sensitivity:'base'})||a.localeCompare(b);});return parent?children:['__sfs_local__','__sfs_remote__',...children];}};
 const view=vscode.window.createTreeView('sshFolderSync',{treeDataProvider:provider,manageCheckboxStateManually:true,showCollapseAll:true});ctx.subscriptions.push(view,changed);
 header();
 view.onDidChangeCheckboxState(async e=>{if(!cfg)return;for(const [p,s] of e.items){ign=ign.filter(x=>x!==p&&!x.startsWith(p+'/'));if(!s)ign.push(p);else ign=ign.filter(x=>!p.startsWith(x+'/'));}cfg.excluded=[...ign];await persist();changed.fire();});
 async function rpc(op,extra={},connection=cfg){check();report('SSH: '+op+(extra.path?' '+extra.path:''));const script=await fs.readFile(path.join(__dirname,'remote.py'),'utf8');const encoded=Buffer.from(script).toString('base64');return new Promise((resolve,reject)=>{const child=spawn('ssh',['-T','-o','BatchMode=yes','-o','ConnectTimeout=15','--',connection.host,`${connection.pythonCommand||((connection.remote&&/^[A-Za-z]:[\\/]/.test(connection.remote))?'python':'python3')} -c "import base64;exec(base64.b64decode('${encoded}'))"`],{windowsHide:true});const cancel=operation?.token.onCancellationRequested(()=>{child.kill();reject(new vscode.CancellationError());});let out=[],err=[];child.stdout.on('data',d=>out.push(d));child.stderr.on('data',d=>err.push(d));child.on('error',reject);child.stdin.on('error',()=>{});const timer=setTimeout(()=>child.kill(),120000);child.on('close',code=>{clearTimeout(timer);cancel?.dispose();if(code!==0)return reject(new Error(Buffer.concat(err).toString()||t('SSH 超时或连接关闭')));try{resolve(JSON.parse(Buffer.concat(out).toString()));}catch(e){reject(e);}});child.stdin.end(JSON.stringify({root:connection.remote,mode:'md5',op,...extra}));});}
 async function refresh(){if(!cfg)throw Error(t('请先配置连接'));report(t('scanLocal'));const l=await scan(cfg.local,'md5',()=>{check();});check();report(t('scanRemote'));const r=await rpc('scan');check();report(t('compareResults'));local=l;remote=r;states=summarize(local,remote,'md5');changed.fire();decorationsChanged.fire(undefined);view.message=undefined;}
 async function safeLocal(p){const root=await fs.realpath(cfg.local),dest=path.resolve(root,p);if(!dest.startsWith(root+path.sep))throw Error(t('非法路径'));let current=root;for(const part of p.split('/')){current=path.join(current,part);try{if((await fs.lstat(current)).isSymbolicLink())throw Error(t('不支持符号链接'));}catch(e){if(e.code!=='ENOENT')throw e;}}return dest;}
 async function sync(up){const ignored=[...ign];await refresh();const source=up?local:remote,target=up?remote:local;const selected=planSync(source,target,ignored);if(!selected.length){void vscode.window.showInformationMessage(t('没有需要同步的项目'));return;}if(selected.some(p=>target[p]&&target[p].type!==source[p].type))throw Error(t('存在文件/目录类型冲突，请先手动处理'));const executionHost=os.hostname();
 const localEndpoint=t('localEndpoint',executionHost,await fs.realpath(cfg.local));
 const remoteEndpoint=t('remoteEndpoint',cfg.host,cfg.remote);
 const sourceLabel=up?localEndpoint:remoteEndpoint,targetLabel=up?remoteEndpoint:localEndpoint;
 const detail=t('syncPaths',sourceLabel,targetLabel)+(vscode.env.remoteName?'\n\n'+t('remoteContext',vscode.env.remoteName,executionHost):'');
 const yes=await vscode.window.showWarningMessage(t('syncCount',selected.length),{modal:true,detail},t('开始同步'));if(!yes)return;for(const p of selected.sort((a,b)=>a.split('/').length-b.split('/').length)){check();report(p);const s=source[p];if(up){if(s.type==='dir')await rpc('mkdir',{path:p});else await rpc('write',{path:p,data:(await fs.readFile(await safeLocal(p))).toString('base64'),mtime:s.mtime});}else{const dest=await safeLocal(p);if(s.type==='dir')await fs.mkdir(dest,{recursive:true});else{const data=Buffer.from(await rpc('read',{path:p}),'base64');await fs.mkdir(path.dirname(dest),{recursive:true});const tmp=dest+'.sfs-'+require('node:crypto').randomUUID();try{await fs.writeFile(tmp,data,{flag:'wx'});await fs.utimes(tmp,s.mtime,s.mtime);await fs.rename(tmp,dest);}finally{await fs.rm(tmp,{force:true});}}}}await refresh();vscode.window.showInformationMessage(t('同步完成'));}
 function command(name,fn){ctx.subscriptions.push(vscode.commands.registerCommand('sfs.'+name,async(...args)=>{if(busy){vscode.window.showInformationMessage(t('operationBusy'));return;}busy=true;try{await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:t('SSH 目录同步'),cancellable:true},async(progress,token)=>{const cancel=new vscode.CancellationTokenSource();const listener=token.onCancellationRequested(()=>cancel.cancel());operation={progress,token:cancel.token,cancel};try{return await fn(...args);}finally{listener.dispose();cancel.dispose();}});}catch(e){if(e instanceof vscode.CancellationError){output.appendLine('Cancelled');return;}output.appendLine(e.stack||String(e));output.show(true);vscode.window.showErrorMessage(e.message);}finally{busy=false;operation=undefined;if(closeRequested){closeRequested=false;close();}}}));}


 async function browse(host,initial,pythonCommand){
 let current=initial||'~';
 while(true){
 check();const result=await rpc('browse',{}, {host,remote:current,pythonCommand});current=result.path;
 const selected=await vscode.window.showQuickPick([
 {label:'$(check) '+t('selectDirectory'),action:'select'},
 {label:'$(arrow-up) ..',path:remotePathApi(current).dirname(current)},
 {label:'$(edit) '+t('enterDirectory'),action:'manual'},
 ...((result.drives||[]).length?[{label:'$(database) '+t('chooseDrive'),action:'drives'}]:[]),
 ...result.directories.map(name=>({label:'$(folder) '+name,path:remotePathApi(current).join(current,name)}))
 ],{title:host+':'+current,placeHolder:t('browseDirectory')});
 if(!selected)return;
 if(selected.action==='select')return current;
 if(selected.action==='drives'){const drive=await vscode.window.showQuickPick(result.drives,{placeHolder:t('chooseDrive')});if(drive)current=drive;continue;}
 if(selected.action==='manual'){const value=await vscode.window.showInputBox({prompt:t('远端绝对目录'),value:current,validateInput:s=>absoluteRemotePath(s)?null:t('必须是绝对路径')});if(value)current=value;}
 else current=selected.path;
 }
 }
 async function configure(id){
 const previous=history.find(x=>x.id===id);
 const name=await vscode.window.showInputBox({prompt:t('connectionName'),value:previous?.name});if(!name?.trim())return;
 const folder=await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,defaultUri:previous?vscode.Uri.file(previous.local):undefined});if(!folder)return;

 const hosts=await require('./ssh-config').aliases();
 const chosen=await vscode.window.showQuickPick([...hosts.map(host=>({label:host,host})),{label:t('manualHost'),manual:true}],{placeHolder:t('chooseHost')});if(!chosen)return;
 const host=chosen.manual?await vscode.window.showInputBox({prompt:t('SSH config 中的 Host 别名（使用密钥或 agent 认证）'),value:previous?.host,validateInput:s=>/^[a-zA-Z0-9_][a-zA-Z0-9_.@-]*$/.test(s)?null:t('请输入有效 Host 别名')}):chosen.host;if(!host)return;

 const pythonCommand=await vscode.window.showQuickPick(['python3','python','py -3'],{placeHolder:t('choosePython')});if(!pythonCommand)return;
 const method=await vscode.window.showQuickPick([{label:t('offlinePath'),manual:true},{label:t('onlineBrowse'),manual:false}],{placeHolder:t('pathMethod')});if(!method)return;
 let manual=method.manual,dir;
 if(!manual){try{dir=await browse(host,previous?.remote,pythonCommand);}catch(error){if(error instanceof vscode.CancellationError)throw error;output.appendLine(error.stack||String(error));const fallback=await vscode.window.showWarningMessage(t('browseFailed',error.message),{modal:true},t('offlinePath'));if(!fallback)return;manual=true;}}
 if(manual)dir=await vscode.window.showInputBox({prompt:t('offlinePathPrompt'),value:previous?.remote,validateInput:s=>absoluteRemotePath(s)?null:t('必须是绝对路径')});
 if(!dir)return;

 const record={id:previous?.id||require('node:crypto').randomUUID(),name:name.trim(),host,pythonCommand,remote:dir,local:folder[0].fsPath,excluded:previous?.excluded||[],lastUsed:Date.now()};
 history=history.filter(x=>x.id!==record.id).concat(record);await persist();if(previous||manual){if(cfg?.id===record.id){cfg=record;ign=[...record.excluded];local={};remote={};states={};}header();void vscode.window.showInformationMessage(t('connectionSaved'));}else await open(record);
 }
 command('configure',()=>configure());command('edit',id=>configure(id));
 command('open',async id=>{const record=history.find(x=>x.id===id);if(record)await open(record);});
 command('rename',async id=>{const record=history.find(x=>x.id===id);if(!record)return;const name=await vscode.window.showInputBox({prompt:t('connectionName'),value:record.name});if(name?.trim()){record.name=name.trim();await persist();changed.fire();}});
 command('delete',async id=>{const record=history.find(x=>x.id===id);if(!record)return;if(await vscode.window.showWarningMessage(t('deleteConnection',record.name),{modal:true},t('deleteAction'))){history=history.filter(x=>x.id!==id);await persist();changed.fire();}});
 let closeRequested=false;
 function close(){cfg=undefined;ign=[];local={};remote={};states={};header();decorationsChanged.fire(undefined);}
 ctx.subscriptions.push(vscode.commands.registerCommand('sfs.close',async()=>{if(busy){const yes=await vscode.window.showWarningMessage(t('stopAndClose'),{modal:true},t('closeAction'));if(!yes)return;closeRequested=true;operation?.cancel.cancel();}else close();}));
 command('refresh',refresh);command('upload',()=>sync(true));command('download',()=>sync(false));command('diff',async p=>{if(!p||local[p]?.type!=='file'||remote[p]?.type!=='file')throw Error(t('请选择两端均存在的文件'));const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sfs-'));const file=path.join(dir,path.basename(p));await fs.writeFile(file,Buffer.from(await rpc('read',{path:p}),'base64'));ctx.subscriptions.push({dispose:()=>fs.rm(dir,{recursive:true,force:true}).catch(()=>{})});await vscode.commands.executeCommand('vscode.diff',vscode.Uri.file(await safeLocal(p)),vscode.Uri.file(file),`${p}: ${t('diffTitle')}`);});
}
exports.activate=activate;



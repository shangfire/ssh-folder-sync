'use strict';
const en={
  "相同": "Identical",
  "不同": "Different",
  "仅本地": "Local only",
  "仅远端": "Remote only",
  "类型冲突": "Type conflict",
  "SSH 超时或连接关闭": "SSH timed out or connection closed",
  "请先配置连接": "Configure a connection first",
  "非法路径": "Invalid path",
  "不支持符号链接": "Symbolic links are not supported",
  "没有需要同步的项目": "Nothing to sync",
  "存在文件/目录类型冲突，请先手动处理": "Resolve file/directory type conflicts before syncing",
  "开始同步": "Start sync",
  "同步完成": "Sync complete",
  "SSH 目录同步": "SSH Folder Sync",
  "SSH config 中的 Host 别名（使用密钥或 agent 认证）": "SSH config Host alias (key or agent authentication)",
  "请输入有效 Host 别名": "Enter a valid SSH Host alias",
  "远端绝对目录": "Absolute remote directory",
  "必须是绝对路径": "An absolute path is required",
  "请选择两端均存在的文件": "Select a file that exists on both sides",
  "本地": "Local",
  "远端": "Remote"
};
en.syncConfirm='Sync {1} differing items from {0} to {2}. Existing destination files will be overwritten. No files will be deleted.';en.diffTitle='Local ↔ Remote snapshot';
const zh={syncConfirm:'将{0}的 {1} 个差异项同步到{2}。目标同名文件将被覆盖，不删除任何文件。',diffTitle:'本地 ↔ 远端快照'};
Object.assign(en,{
 localEndpoint:'Extension host: {0}\nDirectory: {1}',
 remoteEndpoint:'SSH target (Host alias): {0}\nDirectory: {1}',
 syncCount:'Copy {0} differing items?',
 syncPaths:'FROM\n{0}\n\nTO\n{1}\n\nExisting destination files will be overwritten. No files will be deleted.',
 remoteContext:'Remote workspace: {0}. The “local” side is on extension host {1}, which may differ from your desktop computer.'
});
Object.assign(zh,{
 localEndpoint:'扩展运行主机：{0}\n目录：{1}',
 remoteEndpoint:'SSH 目标（Host 别名）：{0}\n目录：{1}',
 syncCount:'确认拷贝 {0} 个差异项？',
 syncPaths:'来源\n{0}\n\n目标\n{1}\n\n将覆盖目标同名文件，不删除任何文件。',
 remoteContext:'当前为远程工作区：{0}。“本地”一端位于扩展运行主机 {1}，可能不是你面前的电脑。'
});
Object.assign(en,{scanLocal:'Scanning local files (MD5)…',scanRemote:'Scanning SSH target (MD5)…',compareResults:'Comparing results…',operationBusy:'An operation is running. Wait or cancel it in the progress notification.'});
Object.assign(zh,{scanLocal:'正在扫描本地文件（MD5）…',scanRemote:'正在扫描 SSH 目标（MD5）…',compareResults:'正在汇总比较结果…',operationBusy:'已有操作正在执行，请等待或在进度通知中取消。'});
Object.assign(en,{historyHost:'Connection history · Extension host: {0}',newConnection:'New Sync Connection',connectionName:'Connection name',deleteConnection:'Delete connection “{0}”? Files will not be deleted.',deleteAction:'Delete',stopAndClose:'Stop the current operation and return to connection history? Completed copies will not be rolled back.',closeAction:'Stop and Close'});
Object.assign(zh,{historyHost:'连接历史 · 扩展运行主机：{0}',newConnection:'新建同步连接',connectionName:'连接名称',deleteConnection:'删除连接“{0}”？不会删除文件。',deleteAction:'删除',stopAndClose:'停止当前操作并返回历史列表？已完成的拷贝不会回滚。',closeAction:'停止并关闭'});
Object.assign(en,{manualHost:'Enter SSH Host manually…',chooseHost:'Choose a Host from ~/.ssh/config',selectDirectory:'Select this directory',enterDirectory:'Enter a path…',browseDirectory:'Open a subdirectory or select the current directory'});
Object.assign(zh,{manualHost:'手动输入 SSH Host…',chooseHost:'选择 ~/.ssh/config 中的 Host',selectDirectory:'选择当前目录',enterDirectory:'输入路径…',browseDirectory:'进入子目录，或选择当前目录'});
Object.assign(en,{offlinePath:'Enter path (offline)',onlineBrowse:'Browse remote directories (connect)',pathMethod:'How would you like to set the remote directory?',offlinePathPrompt:'Absolute remote directory (saved without connection or validation)',browseFailed:'Unable to browse remote directories: {0}',connectionSaved:'Connection saved. Open it or refresh to connect and compare.'});
Object.assign(zh,{offlinePath:'手动输入路径（离线）',onlineBrowse:'浏览远端目录（需要连接）',pathMethod:'选择远端目录的设置方式',offlinePathPrompt:'远端绝对目录（直接保存，不连接、不验证）',browseFailed:'无法浏览远端目录：{0}',connectionSaved:'连接已保存，打开连接或刷新时再连接比较。'});
function translator(language){return (text,...args)=>{const template=language.toLowerCase().startsWith('zh')?(zh[text]||text):(en[text]||text);return template.replace(/\{(\d+)\}/g,(_,i)=>String(args[Number(i)]));};}
module.exports={translator};

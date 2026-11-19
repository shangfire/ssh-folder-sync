"use strict";
const zh = {
  Identical: "相同",
  Different: "不同",
  "Local only": "仅本地",
  "Remote only": "仅远端",
  "Type conflict": "类型冲突",
  "SSH timed out or connection closed": "SSH 超时或连接关闭",
  "Configure a connection first": "请先配置连接",
  "Invalid path": "非法路径",
  "Symbolic links are not supported": "不支持符号链接",
  "Nothing to sync": "没有需要同步的项目",
  "Resolve file/directory type conflicts before syncing":
    "存在文件/目录类型冲突，请先手动处理",
  "Start sync": "开始同步",
  "Sync complete": "同步完成",
  "SSH Folder Sync": "SSH 目录同步",
  "SSH config Host alias (key or agent authentication)":
    "SSH config 中的 Host 别名（使用密钥或 agent 认证）",
  "Enter a valid SSH Host alias": "请输入有效 Host 别名",
  "Absolute remote directory": "远端绝对目录",
  "An absolute path is required": "必须是绝对路径",
  "Select a file that exists on both sides": "请选择两端均存在的文件",
  Local: "本地",
  Remote: "远端",
  "Sync {1} differing items from {0} to {2}. Existing destination files will be overwritten. No files will be deleted.":
    "将{0}的 {1} 个差异项同步到{2}。目标同名文件将被覆盖，不删除任何文件。",
  "Local ↔ Remote snapshot": "本地 ↔ 远端快照",
  "Extension host: {0}\nDirectory: {1}": "扩展运行主机：{0}\n目录：{1}",
  "SSH target (Host alias): {0}\nDirectory: {1}":
    "SSH 目标（Host 别名）：{0}\n目录：{1}",
  "Copy {0} differing items?": "确认拷贝 {0} 个差异项？",
  "FROM\n{0}\n\nTO\n{1}\n\nExisting destination files will be overwritten. No files will be deleted.":
    "来源\n{0}\n\n目标\n{1}\n\n将覆盖目标同名文件，不删除任何文件。",
  "Remote workspace: {0}. The “local” side is on extension host {1}, which may differ from your desktop computer.":
    "当前为远程工作区：{0}。“本地”一端位于扩展运行主机 {1}，可能不是你面前的电脑。",
  "Scanning local files (MD5)…": "正在扫描本地文件（MD5）…",
  "Scanning SSH target (MD5)…": "正在扫描 SSH 目标（MD5）…",
  "Comparing results…": "正在汇总比较结果…",
  "An operation is running. Wait or cancel it in the progress notification.":
    "已有操作正在执行，请等待或在进度通知中取消。",
  "Connection history · Extension host: {0}": "连接历史 · 扩展运行主机：{0}",
  "New Sync Connection": "新建同步连接",
  "Connection name": "连接名称",
  "Delete connection “{0}”? Files will not be deleted.":
    "删除连接“{0}”？不会删除文件。",
  Delete: "删除",
  "Stop the current operation and return to connection history? Completed copies will not be rolled back.":
    "停止当前操作并返回历史列表？已完成的拷贝不会回滚。",
  "Stop and Close": "停止并关闭",
  "Enter SSH Host manually…": "手动输入 SSH Host…",
  "Choose a Host from ~/.ssh/config": "选择 ~/.ssh/config 中的 Host",
  "Select this directory": "选择当前目录",
  "Enter a path…": "输入路径…",
  "Open a subdirectory or select the current directory":
    "进入子目录，或选择当前目录",
  "Enter path (offline)": "手动输入路径（离线）",
  "Browse remote directories (connect)": "浏览远端目录（需要连接）",
  "How would you like to set the remote directory?": "选择远端目录的设置方式",
  "Absolute remote directory (saved without connection or validation)":
    "远端绝对目录（直接保存，不连接、不验证）",
  "Unable to browse remote directories: {0}": "无法浏览远端目录：{0}",
  "Connection saved. Open it or refresh to connect and compare.":
    "连接已保存，打开连接或刷新时再连接比较。",
  "Python command on SSH target (Windows: python or py -3; Linux: python3)":
    "SSH 目标的 Python 命令（Windows 选 python 或 py -3，Linux 通常选 python3）",
  "Choose a drive…": "选择磁盘…",
};
Object.assign(zh, {
  "Choose a saved connection": "选择一条已保存的连接",
  "Connection origin: {0} / {1}; target: {2}":
    "连接发起端：{0} / {1}；SSH 目标：{2}",
  "Non-interactive SSH authentication passed.": "免交互 SSH 认证通过。",
  "Non-interactive SSH authentication already works.":
    "此连接已经支持免交互 SSH 登录，无需重新配置。",
  "Select the SSH target operating system": "选择 SSH 目标操作系统",
  "Select a public key on the extension host": "选择扩展运行主机上的公钥",
  "Generate a dedicated key (no passphrase)": "生成专用密钥（无口令）",
  "Generate a dedicated key without a passphrase? Anyone who can read the private key can use it. Existing keys will not be overwritten.":
    "生成无口令的专用密钥？能够读取私钥的人可以使用它。不会覆盖已有密钥。",
  Generate: "生成",
  "Install public key": "安装公钥",
  "Set up SSH key login": "配置 SSH 公钥登录",
  "SSH key login verified.": "SSH 免密登录验证通过。",
  Save: "保存",
  "Use {0} for this connection?": "此连接使用 {0} 命令？",
  "No usable Python 3 command was found on the target.":
    "目标主机未检测到可用的 Python 3 命令。",
  "The target directory is missing or cannot be read.":
    "目标目录不存在或不可读。",
  "Connection checks passed. Copy permissions are checked during actual writes.":
    "连接检查通过。实际复制时还会检查写入权限。",
  "Connection check failed at {0}. See SSH Folder Sync output.":
    "连接检查在 {0} 步骤失败，详情见 SSH Folder Sync 输出。",
  "Confirm the server fingerprint in an SSH terminal. Never bypass host-key verification.":
    "请在 SSH 终端中确认主机指纹，不要跳过主机密钥验证。",
  "Non-interactive authentication failed. Configure a key or load it into ssh-agent; a successful password login alone is insufficient.":
    "免交互认证失败。请配置公钥或将密钥加载到 ssh-agent，仅密码登录成功还不够。",
  "Check the Host alias, network, SSH port and server service.":
    "请检查 Host 别名、网络、SSH 端口和服务状态。",
  "Inspect SSH Folder Sync output for details. The server may use a custom shell or SSH policy.":
    "请查看 SSH Folder Sync 输出。目标可能使用自定义 Shell 或 SSH 策略。",
  "Key installation did not finish successfully. Check the terminal. Administrator accounts may require additional permissions.":
    "公钥安装未成功，请检查终端输出。管理员账户可能需要额外权限。",
  "Key verified. Add its IdentityFile to {0} for this Host alias?":
    "密钥已验证。是否将此 Host 的 IdentityFile 追加到 {0}？",
  "Install this public key on {0}?\nOrigin: {1} / {2}\nKey: {3}\nUses default OpenSSH authorized_keys locations and adjusts their permissions. Custom server paths are not supported. Password and fingerprint confirmation happen in the terminal.":
    "将此公钥安装到 {0}？\n发起端：{1} / {2}\n密钥：{3}\n使用默认 OpenSSH 公钥文件位置并调整权限，不支持自定义服务路径。在终端输入密码并确认指纹。",
});
Object.assign(zh, {
  "Non-interactive SSH authentication already works. Existing keys will be preserved.":
    "当前免密登录已经可用，继续配置会保留已有公钥。",
  "Configure another key": "继续配置其他密钥",
});
Object.assign(zh, {
  "The selected key could not be verified. Another key may have authenticated; inspect the SSH output.":
    "未能验证所选密钥，可能通过其他密钥完成了认证，请检查 SSH 输出。",
});
Object.assign(zh, {
  "Local sync directory on {0}": "本地同步目录（运行主机：{0}）",
  "Enter an absolute directory path, or choose Browse below":
    "输入目录的绝对路径，或点击下方浏览选项",
  "Enter a local directory path": "请输入本地目录路径",
  "Use this path for comparison and copying": "使用此目录进行比较和双向同步",
  "Browse for a folder…": "浏览选择文件夹…",
  "Open the system folder picker": "点击后打开系统文件夹选择器",
  "Enter an absolute path on the extension host.":
    "请输入扩展运行主机上的绝对路径。",
  "The selected path is not a directory.": "该路径不是文件夹。",
  "Cannot use directory: {0}": "无法使用此目录：{0}",
  "Choose the local directory to compare and sync":
    "选择参与比较和同步的本地目录",
  "Use this directory": "使用此目录",
});
Object.assign(zh, {
  "Example: {0}; type a path or choose Browse below":
    "例如：{0}；输入路径或点击下方浏览选项",
  "Example: {0}": "例如：{0}",
  "Linux: /home/name/project; Windows: C:\\Users\\name\\project":
    "Linux：/home/name/project；Windows：C:\\Users\\name\\project",
});
Object.assign(zh, { Back: "返回" });
function translator(language) {
  return (text, ...args) => {
    const template = language.toLowerCase().startsWith("zh")
      ? zh[text] || text
      : text;
    return template.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)]));
  };
}
module.exports = { translator };

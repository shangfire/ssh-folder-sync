# SSH 配置与排错

[English](SSH-GUIDE.md)

在历史连接上右键或三点菜单选择“检查 SSH 连接”，未打开连接时会先选择记录。输出面板 SSH Folder Sync 显示详细结果。

依次检查扩展运行主机与用户、SSH 目标主机/账户/端口、免交互认证、Python 3.7+ 命令、目录读取与遍历权限。写入权限仍需实际复制验证。检测到可用 Python 命令后，可确认保存。

## 首次配置免密登录

1. 尚不能连接时，先通过离线编辑保存连接。
2. 右键选择“配置 SSH 免密登录”。
3. 选择 Windows 或 Linux 目标，选择现有公钥或生成专用 Ed25519 密钥。新建的是无口令密钥，需明确确认；不覆盖已有密钥。若需要口令，请先自行 ssh-keygen 生成，并加载到扩展运行主机的 ssh-agent。
4. 核对目标、发起主机/用户和公钥指纹。确认意味着授予该私钥访问目标账户的权限。
5. 集成任务终端执行首次密码登录。在终端确认主机指纹、输入账户密码，Windows Hello PIN 不适用。插件不读取、不保存密码。需要停止时终止终端任务，已经产生的配置不会回滚。
6. 向导追加公钥并保留原有内容；Windows 公钥文件 ACL 会重设为对应账户或管理员组及 SYSTEM 的访问权限。只支持 OpenSSH 默认路径，不支持自定义 AuthorizedKeysFile 策略。Windows 管理员组账户使用 ProgramData/ssh/administrators_authorized_keys，普通账户使用用户目录 .ssh/authorized_keys；权限不足仍需管理员协助。Linux 使用 ~/.ssh/authorized_keys。
7. 验证所选私钥；如需要，会确认后向发起端 ~/.ssh/config 追加 IdentityFile，再验证普通 Host 别名连接，成功后才报告完成。

私钥始终留在发起端。生成后取消可能留下未使用密钥，不会自动删除。向导不安装 SSH Server、不修改服务认证策略，不替代企业管理员策略。

## 常见问题

- 指纹未确认：在终端核对，不跳过验证；主机密钥变化需先调查原因。
- BatchMode 认证失败：密码登录成功不等于免密配置完成。部署公钥或使用 ssh-agent；Windows → Linux 与反方向互相独立。
- Python：Windows 通常是 python 或 py -3，诊断可检测并保存。
- 路径：核对完整路径、账户和权限，仍可离线编辑。
- 本地配置：SSH config、私钥、agent 属于扩展运行主机的当前用户，Remote 环境下并不是桌面用户。

当前向导尚未进行真实 Windows/Linux 服务器端到端自动验证，请先使用非生产账户试用。分享输出日志前隐去主机、用户及路径。


诊断和免密部署的 SSH 进程独立于正常同步长连接，不会借用现有 Remote SSH 窗口的认证会话。正常连接复用范围见 [README](README.zh-CN.md#ssh-连接生命周期)。

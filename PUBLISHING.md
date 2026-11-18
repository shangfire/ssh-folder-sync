# Publishing / 发布指南

## Before uploading to GitHub

Upload this directory as the repository root (package.json alongside README.md). Do not upload the parent work/ directory or any connection history, SSH configuration, private keys, or tokens.

The project uses the Marketplace publisher ID `Sware`. Confirm this publisher belongs to your account before releasing. Changing publisher changes the extension identity/global storage namespace; development history may not appear under the published identity.

The repository metadata in package.json is configured as follows:

```json
{
  "publisher": "Sware",
  "repository": { "type": "git", "url": "https://github.com/shangfire/ssh-folder-sync.git" },
  "homepage": "https://github.com/shangfire/ssh-folder-sync#readme",
  "bugs": { "url": "https://github.com/shangfire/ssh-folder-sync/issues" }
}
```

The publisher and repository metadata are configured. Review the existing MIT license copyright attribution. An extension icon and genuine screenshots can be added later; neither is fabricated in this project.

## Validate and package

With Node.js 22+ and npm available:

```sh
npm run check
npm test
npm run package
```

The package script runs `npx @vscode/vsce package --no-dependencies`, which downloads the official packager if absent and creates a VSIX. Inspect `npx @vscode/vsce ls --no-dependencies` to confirm runtime JS, remote.py, package.nls*.json, README, CHANGELOG, and LICENSE are included, with test/development files excluded.

Install the VSIX into a clean VS Code profile and smoke-test with a disposable SSH target: both directions, equal-MD5 skip, folder exclusion, missing directory creation, text diff, cancellation, offline save, history return, and an empty sync with the notification still visible. Also check Chinese/English, local and Remote SSH environments. This repository has core automated tests; a complete clean-install/live-server release check remains necessary.

## Publish

Create/choose your publisher, then upload the VSIX on the Marketplace publisher management page. Packaging does not publish. Keep publication credentials out of the repository; this project deliberately has no auto-publish workflow.

Official instructions: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

Kiro and other editor forks may use a different extension registry. A VS Marketplace release does not automatically publish to Open VSX; follow the target registry's own publisher process if needed.

## 中文提示

先将本目录作为仓库根目录上传 GitHub。package.json 的 publisher 已设置为 Sware；repository/homepage/bugs 已设置为 shangfire/ssh-folder-sync。更换 publisher 后扩展标识、全局存储位置会变化。

执行检查、测试和打包命令，先安装 VSIX 做真实 SSH 验证，再手动上传市场。本仓库不会自动发布，也不包含发布凭据。本地已生成 VSIX；本项目不会代替用户执行市场上传。


## Kiro / Open VSX

Kiro uses Open VSX by default, independently of Microsoft's Marketplace:
https://kiro.dev/docs/ide/editor/extension-registry/

The same VSIX can be published to both registries. No separate Kiro build is required.

1. Sign in at https://open-vsx.org with GitHub and complete the publisher agreement/account steps requested there.
2. Create a personal access token in your Open VSX account. Keep it private.
3. Create or obtain access to the namespace `Sware`, matching package.json's publisher. Microsoft Marketplace publisher ownership does not grant Open VSX namespace ownership.
4. Use the Open VSX CLI to publish the existing package:

```powershell
# Set OVSX_PAT privately in this terminal; do not commit or share the token.
npx.cmd --yes ovsx create-namespace Sware
npx.cmd --yes ovsx publish ..\ssh-folder-sync-0.5.1.vsix
```

Skip namespace creation if it already exists and your account has access. The CLI reads `OVSX_PAT` from the environment. If the namespace belongs to another account, resolve access before publishing; do not silently change publisher identity.

After publishing, verify the listing and install through Kiro's extension search. The existing local VSIX can also be installed directly in Kiro for testing.

Official guide: https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions

中文：Kiro 默认使用 Open VSX，需独立注册并取得 Sware 命名空间权限；VS Code 市场的发布者身份不会自动同步。可以复用当前 VSIX，无需单独构建。先完成账户协议、配置私密 OVSX_PAT 环境变量，再执行上述命令。不要把 token 写入仓库或聊天。

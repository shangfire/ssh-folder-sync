# Publishing / 发布指南

## Before uploading to GitHub

Upload this directory as the repository root (package.json alongside README.md). Do not upload the parent work/ directory or any connection history, SSH configuration, private keys, or tokens.

The project currently uses `publisher: local-tools` as a development identity. Replace it with your actual Marketplace publisher ID before releasing. Changing publisher changes the extension identity/global storage namespace; development history may not appear under the published identity.

After creating the repository, add real metadata to package.json:

```json
{
  "publisher": "YOUR_REAL_PUBLISHER_ID",
  "repository": { "type": "git", "url": "https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git" },
  "homepage": "https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY#readme",
  "bugs": { "url": "https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY/issues" }
}
```

Do not publish the example values. The metadata is intentionally not filled with a fabricated repository. Review the existing MIT license copyright attribution. An extension icon and genuine screenshots can be added later; neither is fabricated in this project.

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

先将本目录作为仓库根目录上传 GitHub。发布前把 package.json 的 local-tools 改为真实 publisher，并填写真实 repository/homepage/bugs 地址。更换 publisher 后扩展标识、全局存储位置会变化。

执行检查、测试和打包命令，先安装 VSIX 做真实 SSH 验证，再手动上传市场。本仓库不会自动发布，也不包含发布凭据。当前环境未完成 VSIX 打包或市场上传。

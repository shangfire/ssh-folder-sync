# Contributing

Use Node.js 22+ and run `npm run check` and `npm test` before submitting a pull request. No runtime npm installation or compilation is needed. Press F5 to launch the development host.

For changes to SSH operations, test against a disposable SSH directory pair. Cover both copy directions, exclusions, equal MD5, missing directories, cancellation, offline editing, and empty-sync completion. Do not use production data for experiments.

For bug reports, include editor/version, extension-host OS, steps, and sanitized output from SSH Folder Sync. Never include credentials, private keys, or confidential paths/files. The automated tests do not replace a live SSH integration check.

Session changes must cover reuse across multiple requests, failure/timeout cleanup, close/switch disposal, and no automatic write replay. Directory-picker changes must preserve the same picker instance across navigation. Run Python syntax checks for all src/*.py files as in the CI workflow.

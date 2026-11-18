# SSH Folder Sync

English · [简体中文](README.zh-CN.md)

Visually compare and copy files between a directory on the extension host and a directory on an SSH server. Uses MD5 content comparison, explicit sync directions, and per-connection exclusions.

### Requirements

- VS Code 1.85 or later; desktop extension host (not browser-only).
- OpenSSH `ssh` available on the extension host's PATH.
- Python 3 on the SSH target, using the per-connection command `python3`, `python`, or `py -3`. Linux/POSIX paths and Windows drive-letter paths are supported.
- Key-based authentication or an SSH agent for browsing and copying. The key-setup wizard uses an interactive terminal only for the initial login; browsing/copying never prompt for passwords.

Before starting, connect from the extension host's terminal with `ssh your-host` to verify the server fingerprint and configure authentication. Confirm `ssh -T -o BatchMode=yes your-host "python3 --version"` succeeds.

### Create a connection

1. Open Explorer → **SSH Folder Sync** → **New Connection**.
2. Enter a connection name, then type the local sync directory as an absolute path. The prompt identifies the extension host; choose Browse only if you want the system folder picker.
3. Choose a Host alias read from `~/.ssh/config`, or enter an alias manually. Explicit Host names and common Include files are supported; wildcard Host patterns are not selectable entries. Custom Remote SSH configuration-file settings are not read.
4. Choose **Browse remote directories** to connect and navigate from the remote home directory. Enter folders, go up with `..`, and choose **Select this directory**. Alternatively, choose **Enter path (offline)** and provide an absolute path.
5. Opening a saved connection scans both complete directory trees. Offline saves defer validation until you open or refresh the connection.

### Compare and choose items

Directories appear before files; names use natural sorting. The first two information rows identify both endpoints. Hover to see complete paths.

| State | Color / badge | Meaning |
| --- | --- | --- |
| Identical | Green `=` | Same MD5; a directory's entire subtree matches |
| Different | Red `!` | Content differs, or a directory contains differences |
| Local only | Blue `L` | Exists only on the extension-host side |
| Remote only | Orange `R` | Exists only on the SSH-target side |
| Type conflict | Red `!` | File versus directory; resolve manually |

Uncheck a file or folder to exclude it from copying. Unchecking a folder excludes its subtree. Exclusions persist separately for each connection. Excluded files still participate in comparison and directory status. Rechecking a child under an excluded ancestor removes that ancestor exclusion, which can include its other children again; review the displayed checkboxes before syncing.

**Refresh** rescans without copying. Right-click a file present on both sides to open a text diff. The remote side is a temporary snapshot; editing that snapshot does not upload it.

### Copy files

Use the view's `…` menu:

1. **Local → Remote** copies checked differences to the SSH target.
2. **Remote → Local** copies checked differences to the extension host.
3. **New Connection** creates another directory pairing.

Before copying, both sides are scanned again using MD5. Identical files and existing directories are skipped. The confirmation shows the source and destination host/path and item count, including missing directories that must be created. Existing destination files are overwritten. Files absent from the source are **not deleted** from the destination. Direction is explicit; the extension does not decide which version is newer.

Progress shows scan and copy stages. Cancel stops further work when possible; completed copies are not rolled back, and cancellation is not an atomic transaction. Avoid changing files from other programs during comparison/copying.

### History and Remote SSH workspaces

The initial view lists saved connections, ordered by most recent use. Click to compare; right-click to edit, rename, or delete the configuration. Deleting history never deletes synchronized files. **Close** returns to history; closing during an operation asks to stop it first. Editing can save offline without connecting.

History is stored in `connections.json` under VS Code's extension global-storage directory (`globalStorageUri`), not in the project. Each entry includes endpoint paths, Host alias, exclusions, and last-used time. No passwords, private keys, file contents, or cached MD5 results are stored there. Host aliases are resolved by the system SSH client.

**“Local” means the machine running this extension.** In a Remote SSH workspace this may be the remote extension host, rather than your desktop. History is independent in each extension-host environment. Read both endpoint paths in the confirmation before copying. Existing workspace configuration from earlier development versions is migrated once.

### Troubleshooting

- **Nothing to sync:** checked source files already match, or all differing items are excluded. The operation ends immediately; the notification need not be dismissed.
- **Remote root is not a directory:** confirm the path exists and the SSH user can access it. Use the directory browser or an absolute path without shell quotes.
- **Authentication fails:** run the BatchMode SSH command above from the same machine where the extension runs.
- **Slow comparison:** directory traversal includes excluded directories; MD5 reuses persistent metadata-validated hashes for unchanged files. The current implementation is serial.
- **Missing colors:** enable file-decoration colors/badges in the editor settings.
- **Other failures:** inspect Output → **SSH Folder Sync** for the loaded extension path and operation/error logs. Redact hostnames and paths before sharing logs publicly.

### Limitations

No deletion propagation, automatic watching, merge/conflict resolution, permissions/ownership synchronization, or resume support. Symbolic links are skipped/rejected. Individual SSH operations time out after 120 seconds. Transfers encode whole files as base64 in memory; this version is intended for small to medium directory trees, not huge files or very large repositories. Windows, macOS, and Linux local hosts use the same code; only the user's Kiro/manual environment and automated core tests have been exercised, not a complete cross-platform integration matrix.

### Development

Open this folder in VS Code/Kiro and press F5. There are no runtime npm dependencies or compilation steps. Node.js 22+ is recommended for development.

```sh
npm test
npm run check
npm run package
```

See [PUBLISHING.md](PUBLISHING.md) for release preparation and [CHANGELOG.md](CHANGELOG.md) for changes. Licensed under [MIT](LICENSE).

### Source layout and MD5 cache

Runtime sources live in src/. English text is the source language; Chinese UI translations are in src/i18n.js. MD5 snapshots are stored per endpoint pair under the extension global storage md5-cache directory. Files with unchanged size, high-resolution mtime, ctime and file identity reuse their hashes. Changed/new files are hashed; deleted entries disappear on the next successful scan. Directory traversal and metadata requests are still required. Metadata caching cannot detect content changes that preserve every checked metadata field. Delete the relevant cache file to force a full rehash.

### SSH setup assistance

Use **Check SSH Connection** or **Set Up SSH Key Login** from the history context menu or view menu. See the [SSH setup guide](SSH-GUIDE.md) for the terminal-based first login, default server paths, key handling and limitations.

# Changelog

## 0.8.0

- Revert connection management to the native tree and remove the webview implementation.
- Keep Check and More row actions; put key setup, edit, rename and delete in More.
- Preserve persistent SSH sessions, MD5 caches and inline file diffs.

## 0.7.2

- Stop returning legacy history items from the comparison tree.
- Explicitly reveal the web connection manager when returning to history.
- Add an Open Connection Manager command to recover hidden views.

## 0.7.1

- Wait for remote Python readiness before sending operation requests.
- Preserve remote stderr and exit codes when SSH stdin closes early.
- Install error handlers before sending the initialization payload.

## 0.7.0

- Add a theme-aware web connection manager with visible left-click actions and endpoint details.
- Keep the existing comparison tree after opening a connection; Close returns to the manager.
- Combine editing and renaming, and open diffs on comparable-file clicks.

## 0.6.4

- Expand connection Check and Setup actions inline instead of opening a Quick Pick.

## 0.6.3

- Add per-connection inline action menus for SSH checks and key setup.
- Add inline diff actions for files present on both sides, keeping context menus.

## 0.6.2

- Move New Connection and directional copy actions to toolbar icons.
- Keep SSH check/setup in each connection context menu, removing ambiguous view-level entries.

## 0.6.1

- Release SSH setup state on task end even without a process exit event.
- Handle early completion and add terminal-stage cancellation.

## 0.6.0

- Reuse one SSH/Python session for active-connection scans, diff reads and file transfers.
- Release sessions on close, switch, cancellation and failures; do not replay writes.
- Stream initialization over stdin to avoid Windows command-line length limits and enable UTF-8 protocol I/O.

## 0.5.6

- Keep one remote directory picker open while navigating directories and switching drives.
- Update its list and busy indicator in place instead of recreating the picker.

## 0.5.5

- Remove temporary decoration diagnostics without changing state colors.
- Reuse one SSH/Python process per remote directory picker session; no directory cache.
- Dispose browsing sessions on selection, cancellation, timeout and extension shutdown.

## 0.5.4

- Complete URI and decoration callback diagnostics.

## 0.5.3

- Add bounded decoration diagnostics for remote tree rendering, callback activity, theme settings and color contributions.

## 0.5.2

- Add manual local directory entry, optional browsing and OS-aware path examples.

## 0.5.1

- Permit explicitly continuing key setup when existing authentication works.
- Verify the selected public-key fingerprint rather than accepting any successful login.
- Reset Windows authorized-key file ACLs to the expected principals.
- Correct Python/platform requirements and document four-direction compatibility limits.

## 0.5.0

- Add staged SSH diagnostics, Python command detection, and directory checks.
- Add an interactive SSH public-key setup wizard for default Windows and Linux OpenSSH servers.
- Add bilingual SSH setup and troubleshooting guides.

## 0.4.0

- Organize runtime sources under src/ and format JavaScript and Python for readability.
- Use English source messages with Chinese translations.
- Persist per-connection local and remote MD5 caches, validated by size, high-resolution timestamps and file identity.
- Detect file changes during hashing and discard stale deleted entries after successful scans.

## 0.3.3

- Add Windows drive selection.

## 0.3.2

- Select Python commands per connection.

## 0.3.1

- Accept Windows drive-letter and UNC paths in remote directory input.
- Preserve Windows path separators when browsing remote directories.
- This does not constitute end-to-end Windows SSH target compatibility validation.

## 0.3.0

Initial public release candidate.

- MD5 comparison with recursive directory status and colored decorations.
- Explicit bidirectional copying with endpoint confirmation and exclusions.
- Connection history, offline editing, and legacy workspace migration.
- SSH config Host selection and remote directory browsing.
- English and Chinese UI, compact toolbar actions, and diagnostic output.
- Fixed empty-sync notifications holding the operation open, repeated existing-directory counts, and tree item variable shadowing.


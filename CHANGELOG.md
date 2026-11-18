# Changelog

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


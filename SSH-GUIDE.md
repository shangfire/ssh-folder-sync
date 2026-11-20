# SSH setup guide

[简体中文](SSH-GUIDE.zh-CN.md)

Right-click the intended history connection and choose **Check SSH Connection**. Command-palette invocation uses the active connection, or prompts for a saved connection if none is active. Detailed results are in Output → SSH Folder Sync.

Checks identify the extension host/user, resolve the SSH target/user/port, test non-interactive authentication, try Python 3.7+ commands, and check directory read/traversal access. Write access is not guaranteed by this check. A working Python command can be saved after confirmation.

## First-time key login

1. Save a connection offline if it cannot connect yet.
2. Right-click it → **Set Up SSH Key Login**.
3. Choose the target OS and an existing public key, or generate a dedicated Ed25519 key. New dedicated keys have no passphrase and require explicit confirmation; existing keys are never overwritten. To use a passphrase, generate a key with ssh-keygen yourself and load it into the extension host's ssh-agent before using this wizard.
4. Review the target, origin host/user and public-key fingerprint. This grants the corresponding private key SSH access to that account.
5. The integrated task terminal performs an ordinary password login. Verify the server fingerprint and enter the account password there. Windows Hello PINs are not account passwords. The extension does not read or save passwords. Stop the terminal task if necessary; partial changes are not rolled back.
6. The installer appends the public key, preserving existing keys, and replaces authorized_keys ACL permissions with the expected account/administrator and SYSTEM access on Windows. It supports default OpenSSH paths, not custom AuthorizedKeysFile policies. Windows administrator group accounts use ProgramData/ssh/administrators_authorized_keys; other accounts use their profile .ssh/authorized_keys. Permission restrictions can still require administrator help. Linux uses ~/.ssh/authorized_keys.
7. The wizard verifies the selected private key and, if needed, asks before appending an IdentityFile entry to the extension host's ~/.ssh/config. It verifies the normal Host alias again before reporting success.

Private keys stay on the origin host. Key generation may leave an unused key if you cancel later; it is not deleted automatically. No SSH service is installed and no server authentication policy is changed. The wizard is not a replacement for an administrator-managed policy.

## Common failures

- Host-key verification: connect in a terminal and verify the fingerprint with the target owner. Investigate changed host keys; do not disable verification.
- Permission denied in BatchMode: password login alone is insufficient. Deploy a public key or load the right key into ssh-agent. Windows → Linux and Linux → Windows are separate directions.
- Python command: Windows often uses python or py -3 rather than python3. Diagnostics can detect and offer to save it.
- Directory unavailable: check the full path and account permissions. Offline editing remains available.
- No public key: generate one in the wizard or use ssh-keygen. The SSH config, keys and agent belong to the extension host user, not necessarily your desktop user.

The wizard's remote installation has not yet been validated against a live Windows/Linux server in automated tests. Test with a non-production account first. Logs include host/user/path information; sanitize before sharing.


Diagnostic and key-installation SSH processes are independent of the normal persistent sync session. They do not borrow an existing Remote SSH editor connection. See [session lifecycle](README.md#ssh-session-lifecycle).

During terminal key installation, Cancel in the progress notification terminates the task and releases operation state. Completed key-file changes are not rolled back.

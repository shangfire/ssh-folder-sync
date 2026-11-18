# Platform compatibility review

The design supports four directions under the prerequisites below; this is an engineering assessment, not four completed live end-to-end certifications.

| Origin | Target | Mechanism | Status |
| --- | --- | --- | --- |
| Windows | Linux | Native ssh/ssh-keygen, POSIX key deployment, remote Python | Code reviewed; live wizard test pending |
| Linux | Windows | Native ssh/ssh-keygen, encoded PowerShell, remote Python | Existing user connection/browsing reported working; new wizard test pending |
| Windows | Windows | Native ssh/ssh-keygen, encoded PowerShell, remote Python | Code reviewed; live wizard test pending |
| Linux | Linux | Native ssh/ssh-keygen, POSIX key deployment, remote Python | Code reviewed; live wizard test pending |

Origin requires an installed desktop extension host, OpenSSH and ssh-keygen. Terminal tasks need an available interactive terminal. Windows targets require Windows PowerShell and OpenSSH; Linux targets require sh, base64, grep, chmod and OpenSSH. Browsing/copying additionally require Python 3. Default OpenSSH authorized-key locations are assumed. Custom shells, domain policy, restricted accounts, unavailable elevation and overridden authorized-key paths can prevent deployment.

The selected key is checked against verbose SSH accepted-key fingerprint output, followed by a normal alias connection check. This depends on the standard English OpenSSH debug format and fails conservatively if it cannot identify the accepted key. Private-key passphrases require an agent. Host fingerprints are never automatically trusted.

Automated tests cover core comparison/cache behavior, script construction/error classification, POSIX bootstrap execution when Git Bash is available, and static Windows PowerShell parsing. They do not certify live SSH service behavior or editor task UI.

Local review result: PowerShell installer syntax parsed successfully. The POSIX execution test is skipped in the current Windows sandbox because MSYS cannot create a required kernel object; it remains enabled on ordinary Windows/Git Bash and Linux CI.

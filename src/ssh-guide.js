"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");

function run(program, args, includeStderr = false) {
  return new Promise((resolve, reject) => {
    execFile(
      program,
      args,
      { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          error.message = String(stderr || error.message).trim();
          reject(error);
        } else
          resolve(
            (includeStderr ? stdout + "\n" + stderr : stdout || stderr).trim(),
          );
      },
    );
  });
}
function sshArgs(record, interactive = false) {
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.@-]*$/.test(record.host))
    throw Error("Invalid SSH Host alias");
  return [
    "-T",
    "-o",
    "ConnectTimeout=15",
    "-o",
    interactive ? "BatchMode=no" : "BatchMode=yes",
    "--",
    record.host,
  ];
}
function classify(message) {
  if (
    /host key verification|REMOTE HOST IDENTIFICATION|authenticity/i.test(
      message,
    )
  )
    return "Confirm the server fingerprint in an SSH terminal. Never bypass host-key verification.";
  if (/permission denied|authentication failed/i.test(message))
    return "Non-interactive authentication failed. Configure a key or load it into ssh-agent; a successful password login alone is insufficient.";
  if (/timed out|no route|refused|resolve hostname/i.test(message))
    return "Check the Host alias, network, SSH port and server service.";
  return "Inspect SSH Folder Sync output for details. The server may use a custom shell or SSH policy.";
}
function windowsScript(publicKey) {
  const encoded = Buffer.from(publicKey).toString("base64");
  const script = `
$ErrorActionPreference='Stop'
$key=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')).Trim()
$id=[Security.Principal.WindowsIdentity]::GetCurrent()
$admin=@($id.Groups | ForEach-Object {$_.Value}) -contains 'S-1-5-32-544'
$file=if($admin){Join-Path $env:ProgramData 'ssh/administrators_authorized_keys'}else{Join-Path $env:USERPROFILE '.ssh/authorized_keys'}
New-Item -ItemType Directory -Force -Path (Split-Path $file) | Out-Null
$old=if(Test-Path -LiteralPath $file){[IO.File]::ReadAllText($file)}else{''}
$parts=$key.Split(' ')
$exists=@($old -split '\\r?\\n' | Where-Object {$_ -match [regex]::Escape($parts[1])}).Count -gt 0
if(-not $exists){[IO.File]::AppendAllText($file,([Environment]::NewLine+$key+[Environment]::NewLine),(New-Object Text.UTF8Encoding($false)))}
if($admin){
 $acl=New-Object Security.AccessControl.FileSecurity
 $acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @('S-1-5-32-544','S-1-5-18')){
  $rule=New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)),'FullControl','Allow')
  $acl.AddAccessRule($rule)
 }
 Set-Acl -LiteralPath $file -AclObject $acl
}else{
 $acl=New-Object Security.AccessControl.FileSecurity
 $acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($id.User.Value,'S-1-5-18')){
  $rule=New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)),'FullControl','Allow')
  $acl.AddAccessRule($rule)
 }
 Set-Acl -LiteralPath $file -AclObject $acl
}

Write-Host ('Public key installed: '+$file)
`;
  return (
    "powershell.exe -NoProfile -NonInteractive -EncodedCommand " +
    Buffer.from(script, "utf16le").toString("base64")
  );
}
function linuxScript(publicKey) {
  const encoded = Buffer.from(publicKey).toString("base64");
  return `sh -c 'set -eu; umask 077; mkdir -p "$HOME/.ssh"; key=$(printf %s ${encoded} | base64 -d); touch "$HOME/.ssh/authorized_keys"; grep -qxF "$key" "$HOME/.ssh/authorized_keys" || printf "\\n%s\\n" "$key" >> "$HOME/.ssh/authorized_keys"; chmod 700 "$HOME/.ssh"; chmod 600 "$HOME/.ssh/authorized_keys"'`;
}
async function terminalTask(vscode, name, program, args) {
  const task = new vscode.Task(
    { type: "ssh-folder-sync" },
    vscode.TaskScope.Global,
    name,
    "SSH Folder Sync",
    new vscode.ProcessExecution(program, args),
    [],
  );
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    focus: true,
    panel: vscode.TaskPanelKind.Dedicated,
  };
  let execution;
  let finish;
  const ended = new Promise((resolve) => {
    finish = resolve;
  });
  const listener = vscode.tasks.onDidEndTaskProcess((event) => {
    if (event.execution === execution) finish(event.exitCode);
  });
  try {
    execution = await vscode.tasks.executeTask(task);
    return await ended;
  } finally {
    listener.dispose();
  }
}
async function diagnose(vscode, record, output, t, save) {
  output.show(true);
  output.appendLine(
    t(
      "Connection origin: {0} / {1}; target: {2}",
      os.hostname(),
      os.userInfo().username,
      record.host,
    ),
  );
  let stage = "SSH";
  try {
    output.appendLine(await run("ssh", ["-V"]));
    const effective = await run("ssh", ["-G", "--", record.host]);
    output.appendLine(
      effective
        .split(/\r?\n/)
        .filter((line) => /^(hostname|user|port) /.test(line))
        .join("\n"),
    );
    await run("ssh", [...sshArgs(record), "echo SFS_AUTH_OK"]);
    output.appendLine(t("Non-interactive SSH authentication passed."));
    stage = "Python";
    const candidates = [
      ...new Set(
        [record.pythonCommand, "python3", "python", "py -3"].filter(Boolean),
      ),
    ];
    let found;
    for (const candidate of candidates) {
      if (!["python3", "python", "py -3"].includes(candidate)) continue;
      try {
        const result = await run("ssh", [
          ...sshArgs(record),
          candidate +
            " -c \"import sys; print('SFS_PYTHON_'+str(sys.version_info.major))\"",
        ]);
        if (result.includes("SFS_PYTHON_3")) {
          found = candidate;
          break;
        }
      } catch (error) {
        output.appendLine(candidate + ": " + error.message);
      }
    }
    if (!found)
      throw Error(t("No usable Python 3 command was found on the target."));
    if (found !== record.pythonCommand) {
      const yes = await vscode.window.showInformationMessage(
        t("Use {0} for this connection?", found),
        t("Save"),
      );
      if (yes) {
        record.pythonCommand = found;
        await save();
      }
    }
    stage = "Directory";
    const code = `import os,base64; p=os.path.realpath(os.path.expanduser(base64.b64decode('${Buffer.from(record.remote).toString("base64")}').decode())); print('SFS_DIRECTORY_OK' if os.path.isdir(p) and os.access(p,os.R_OK|os.X_OK) else 'SFS_DIRECTORY_UNAVAILABLE')`;
    const encoded = Buffer.from(code).toString("base64");
    const result = await run("ssh", [
      ...sshArgs(record),
      found + ` -c "import base64;exec(base64.b64decode('${encoded}'))"`,
    ]);
    if (!result.includes("SFS_DIRECTORY_OK"))
      throw Error(t("The target directory is missing or cannot be read."));
    output.appendLine(
      t(
        "Connection checks passed. Copy permissions are checked during actual writes.",
      ),
    );
    void vscode.window.showInformationMessage(
      t(
        "Connection checks passed. Copy permissions are checked during actual writes.",
      ),
    );
  } catch (error) {
    output.appendLine(stage + ": " + error.message);
    void vscode.window.showErrorMessage(
      t(
        stage === "SSH"
          ? classify(error.message)
          : "Connection check failed at {0}. See SSH Folder Sync output.",
        stage,
      ),
    );
  }
}
async function setup(vscode, record, output, t) {
  try {
    await run("ssh", [...sshArgs(record), "echo SFS_AUTH_OK"]);
    const choice = await vscode.window.showInformationMessage(
      t(
        "Non-interactive SSH authentication already works. Existing keys will be preserved.",
      ),
      { modal: true },
      t("Configure another key"),
    );
    if (!choice) return;
  } catch (error) {
    output.appendLine(error.message);
  }
  const platform = await vscode.window.showQuickPick(
    ["Windows OpenSSH", "Linux / POSIX OpenSSH"],
    { placeHolder: t("Select the SSH target operating system") },
  );
  if (!platform) return;
  const directory = path.join(os.homedir(), ".ssh");
  await fs.mkdir(directory, { recursive: true });
  const entries = await fs.readdir(directory);
  const selection = await vscode.window.showQuickPick(
    [
      ...entries
        .filter((name) => name.endsWith(".pub"))
        .map((name) => ({ label: name, file: path.join(directory, name) })),
      { label: t("Generate a dedicated key (no passphrase)"), generate: true },
    ],
    { placeHolder: t("Select a public key on the extension host") },
  );
  if (!selection) return;
  let publicFile = selection.file;
  if (selection.generate) {
    if (
      !(await vscode.window.showWarningMessage(
        t(
          "Generate a dedicated key without a passphrase? Anyone who can read the private key can use it. Existing keys will not be overwritten.",
        ),
        { modal: true },
        t("Generate"),
      ))
    )
      return;
    const privateFile = path.join(directory, "sfs_" + crypto.randomUUID());
    await run("ssh-keygen", [
      "-t",
      "ed25519",
      "-f",
      privateFile,
      "-N",
      "",
      "-C",
      "SSH Folder Sync",
    ]);
    publicFile = privateFile + ".pub";
  }
  const key = (await fs.readFile(publicFile, "utf8")).trim();
  if (
    !/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+) [A-Za-z0-9+/=]+(?: .*)?$/.test(key)
  )
    throw Error("Invalid OpenSSH public key");
  const fingerprint = await run("ssh-keygen", ["-lf", publicFile]);
  const confirmed = await vscode.window.showWarningMessage(
    t(
      "Install this public key on {0}?\nOrigin: {1} / {2}\nKey: {3}\nUses default OpenSSH authorized_keys locations and adjusts their permissions. Custom server paths are not supported. Password and fingerprint confirmation happen in the terminal.",
      record.host,
      os.hostname(),
      os.userInfo().username,
      fingerprint,
    ),
    { modal: true },
    t("Install public key"),
  );
  if (!confirmed) return;
  const status = await terminalTask(vscode, t("Set up SSH key login"), "ssh", [
    ...sshArgs(record, true),
    platform === "Windows OpenSSH" ? windowsScript(key) : linuxScript(key),
  ]);
  if (status !== 0)
    throw Error(
      t(
        "Key installation did not finish successfully. Check the terminal. Administrator accounts may require additional permissions.",
      ),
    );
  const identity = publicFile.slice(0, -4);
  const expectedFingerprint = fingerprint.match(/SHA256:[A-Za-z0-9+/]+/);
  const verification = await run(
    "ssh",
    [
      "-v",
      "-i",
      identity,
      "-o",
      "PreferredAuthentications=publickey",
      ...sshArgs(record),
      "echo SFS_AUTH_OK",
    ],
    true,
  );
  if (
    !expectedFingerprint ||
    !verification
      .split(/\r?\n/)
      .some(
        (line) =>
          line.includes("Server accepts key:") &&
          line.includes(expectedFingerprint[0]),
      )
  ) {
    throw Error(
      t(
        "The selected key could not be verified. Another key may have authenticated; inspect the SSH output.",
      ),
    );
  }
  try {
    await run("ssh", [...sshArgs(record), "echo SFS_AUTH_OK"]);
  } catch (error) {
    const config = path.join(directory, "config");
    const line =
      "\nHost " +
      record.host +
      '\n    IdentityFile "' +
      identity.replaceAll("\\", "/") +
      '"\n';
    if (
      await vscode.window.showWarningMessage(
        t(
          "Key verified. Add its IdentityFile to {0} for this Host alias?",
          config,
        ),
        { modal: true },
        t("Save"),
      )
    )
      await fs.appendFile(config, line, { mode: 0o600 });
    else return;
    await run("ssh", [...sshArgs(record), "echo SFS_AUTH_OK"]);
  }
  void vscode.window.showInformationMessage(t("SSH key login verified."));
}
module.exports = { diagnose, setup, classify, windowsScript, linuxScript };

"use strict";
const vscode = require("vscode"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process"),
  { excluded, status, scan, summarize, planSync } = require("./core");
async function activate(ctx) {
  const output = vscode.window.createOutputChannel("SSH Folder Sync");
  ctx.subscriptions.push(output);
  output.appendLine(
    "SSH Folder Sync " +
      ctx.extension.packageJSON.version +
      " | " +
      ctx.extensionPath,
  );
  console.log(
    "[SSH Folder Sync] " +
      ctx.extension.packageJSON.version +
      " | " +
      ctx.extensionPath,
  );
  output.appendLine("Core module: " + require.resolve("./core"));

  const { absoluteRemotePath, remotePathApi } = require("./remote-path");
  const t = require("./i18n").translator(vscode.env.language);
  let cfg,
    ign = [],
    local = {},
    remote = {},
    states = {},
    busy = false,
    operation;
  function check() {
    if (operation?.token.isCancellationRequested)
      throw new vscode.CancellationError();
  }
  function report(message) {
    check();
    operation?.progress.report({ message });
    output.appendLine(new Date().toISOString() + " " + message);
  }
  const { HistoryStore } = require("./history");
  const store = new HistoryStore(ctx.globalStorageUri.fsPath);
  let history = await store.load();
  const legacy = ctx.workspaceState.get("config");
  if (legacy && !ctx.workspaceState.get("historyMigrated")) {
    if (
      !history.some(
        (x) =>
          x.host === legacy.host &&
          x.remote === legacy.remote &&
          x.local === legacy.local,
      )
    ) {
      history.push({
        ...legacy,
        id: require("node:crypto").randomUUID(),
        name: legacy.host + " · " + path.basename(legacy.local),
        excluded: ctx.workspaceState.get("excluded", []),
        lastUsed: 0,
      });
      await store.save(history);
    }
    await ctx.workspaceState.update("historyMigrated", true);
  }
  async function persist() {
    await store.save(history);
  }
  function header() {
    view.message = cfg
      ? undefined
      : t("Connection history · Extension host: {0}", os.hostname());
    vscode.commands.executeCommand("setContext", "sfs.active", !!cfg);
    changed.fire();
  }
  async function open(record) {
    cfg = record;
    ign = [...(record.excluded || [])];
    local = {};
    remote = {};
    states = {};
    record.lastUsed = Date.now();
    await persist();
    header();
    await refresh();
  }
  const changed = new vscode.EventEmitter();
  const decorationsChanged = new vscode.EventEmitter();
  const styles = {
    Identical: ["=", "sshFolderSync.same"],
    Different: ["!", "sshFolderSync.different"],
    "Local only": ["L", "sshFolderSync.localOnly"],
    "Remote only": ["R", "sshFolderSync.remoteOnly"],
    "Type conflict": ["!", "sshFolderSync.different"],
  };
  ctx.subscriptions.push(
    decorationsChanged,
    vscode.window.registerFileDecorationProvider({
      onDidChangeFileDecorations: decorationsChanged.event,
      provideFileDecoration(uri) {
        if (uri.scheme !== "ssh-folder-sync") return;
        const s = states[uri.path.slice(1)],
          style = styles[s];
        if (style)
          return {
            badge: style[0],
            tooltip: t(s),
            color: new vscode.ThemeColor(style[1]),
            propagate: false,
          };
      },
    }),
  );
  const provider = {
    onDidChangeTreeData: changed.event,
    getTreeItem(p) {
      if (cfg && (p === "__sfs_local__" || p === "__sfs_remote__")) {
        const isLocal = p === "__sfs_local__";
        const label = isLocal
          ? `${t("Local")}: ${cfg.local}`
          : `${t("Remote")}: ${cfg.host}:${cfg.remote}`;
        const info = new vscode.TreeItem(label);
        info.id = p;
        info.tooltip = label;
        info.iconPath = new vscode.ThemeIcon(
          isLocal ? "device-desktop" : "remote",
        );
        return info;
      }
      if (!cfg) {
        const record = history.find((x) => x.id === p);
        const item = new vscode.TreeItem(
          record ? record.name : t("New Sync Connection"),
        );
        item.id = p;
        item.iconPath = new vscode.ThemeIcon(record ? "remote" : "add");
        item.contextValue = record ? "sfs.history" : "sfs.new";
        item.description = record ? record.host : undefined;
        item.tooltip = record
          ? `${t("Local")}: ${record.local}\n${t("Remote")}: ${record.host}:${record.remote}`
          : t("New Sync Connection");
        item.command = {
          command: record ? "sfs.open" : "sfs.configure",
          title: record ? record.name : t("New Sync Connection"),
          arguments: record ? [p] : [],
        };
        return item;
      }
      const translate = require("./i18n").translator(vscode.env.language);
      const a = local[p],
        b = remote[p],
        dir = (a || b).type === "dir";
      const item = new vscode.TreeItem(path.posix.basename(p), dir ? 1 : 0);
      item.id = p;
      item.description = translate(states[p]);
      item.resourceUri = vscode.Uri.from({
        scheme: "ssh-folder-sync",
        path: "/" + p,
      });
      item.tooltip = p;
      item.checkboxState = excluded(p, ign) ? 0 : 1;
      item.iconPath = new vscode.ThemeIcon(
        dir ? "folder" : "file",
        styles[states[p]]
          ? new vscode.ThemeColor(styles[states[p]][1])
          : undefined,
      );
      return item;
    },
    getChildren(parent) {
      if (!cfg)
        return parent
          ? []
          : [...history]
              .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
              .map((x) => x.id)
              .concat("__new__");
      if (parent === "__sfs_local__" || parent === "__sfs_remote__") return [];
      const children = [
        ...new Set([...Object.keys(local), ...Object.keys(remote)]),
      ]
        .filter((p) => path.posix.dirname(p) === (parent || "."))
        .sort((a, b) => {
          const aDir = (local[a] || remote[a]).type === "dir",
            bDir = (local[b] || remote[b]).type === "dir";
          return (
            Number(bDir) - Number(aDir) ||
            path.posix
              .basename(a)
              .localeCompare(path.posix.basename(b), undefined, {
                numeric: true,
                sensitivity: "base",
              }) ||
            a.localeCompare(b)
          );
        });
      return parent
        ? children
        : ["__sfs_local__", "__sfs_remote__", ...children];
    },
  };
  const view = vscode.window.createTreeView("sshFolderSync", {
    treeDataProvider: provider,
    manageCheckboxStateManually: true,
    showCollapseAll: true,
  });
  ctx.subscriptions.push(view, changed);
  header();
  view.onDidChangeCheckboxState(async (e) => {
    if (!cfg) return;
    for (const [p, s] of e.items) {
      ign = ign.filter((x) => x !== p && !x.startsWith(p + "/"));
      if (!s) ign.push(p);
      else ign = ign.filter((x) => !p.startsWith(x + "/"));
    }
    cfg.excluded = [...ign];
    await persist();
    changed.fire();
  });
  async function rpc(op, extra = {}, connection = cfg) {
    check();
    report("SSH: " + op + (extra.path ? " " + extra.path : ""));
    const script = await fs.readFile(path.join(__dirname, "remote.py"), "utf8");
    const encoded = Buffer.from(script).toString("base64");
    return new Promise((resolve, reject) => {
      const child = spawn(
        "ssh",
        [
          "-T",
          "-o",
          "BatchMode=yes",
          "-o",
          "ConnectTimeout=15",
          "--",
          connection.host,
          `${connection.pythonCommand || (connection.remote && /^[A-Za-z]:[\\/]/.test(connection.remote) ? "python" : "python3")} -c "import base64;exec(base64.b64decode('${encoded}'))"`,
        ],
        { windowsHide: true },
      );
      const cancel = operation?.token.onCancellationRequested(() => {
        child.kill();
        reject(new vscode.CancellationError());
      });
      let out = [],
        err = [];
      child.stdout.on("data", (d) => out.push(d));
      child.stderr.on("data", (d) => err.push(d));
      child.on("error", reject);
      child.stdin.on("error", () => {});
      const timer = setTimeout(() => child.kill(), 120000);
      child.on("close", (code) => {
        clearTimeout(timer);
        cancel?.dispose();
        if (code !== 0)
          return reject(
            new Error(
              Buffer.concat(err).toString() ||
                t("SSH timed out or connection closed"),
            ),
          );
        try {
          resolve(JSON.parse(Buffer.concat(out).toString()));
        } catch (e) {
          reject(e);
        }
      });
      child.stdin.end(
        JSON.stringify({ root: connection.remote, mode: "md5", op, ...extra }),
      );
    });
  }
  async function refresh() {
    const cacheKey = require("node:crypto")
      .createHash("sha256")
      .update(
        JSON.stringify([
          cfg?.local,
          cfg?.host,
          cfg?.remote,
          cfg?.pythonCommand,
        ]),
      )
      .digest("hex");
    const cacheFile = path.join(
      ctx.globalStorageUri.fsPath,
      "md5-cache",
      cacheKey + ".json",
    );
    let cache = {};
    try {
      cache = JSON.parse(await fs.readFile(cacheFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT")
        output.appendLine("Ignoring unreadable MD5 cache: " + error.message);
    }
    if (!cfg) throw Error(t("Configure a connection first"));
    report(t("Scanning local files (MD5)…"));
    const l = await scan(
      cfg.local,
      "md5",
      () => {
        check();
      },
      cache.local || {},
    );
    check();
    report(t("Scanning SSH target (MD5)…"));
    const r = await rpc("scan", { cache: cache.remote || {} });
    check();
    report(t("Comparing results…"));
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    const temporary = cacheFile + ".tmp";
    await fs.writeFile(temporary, JSON.stringify({ local: l, remote: r }));
    await fs.rename(temporary, cacheFile);
    local = l;
    remote = r;
    states = summarize(local, remote, "md5");
    changed.fire();
    decorationsChanged.fire(undefined);
    view.message = undefined;
  }
  async function safeLocal(p) {
    const root = await fs.realpath(cfg.local),
      dest = path.resolve(root, p);
    if (!dest.startsWith(root + path.sep)) throw Error(t("Invalid path"));
    let current = root;
    for (const part of p.split("/")) {
      current = path.join(current, part);
      try {
        if ((await fs.lstat(current)).isSymbolicLink())
          throw Error(t("Symbolic links are not supported"));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
    return dest;
  }
  async function sync(up) {
    const ignored = [...ign];
    await refresh();
    const source = up ? local : remote,
      target = up ? remote : local;
    const selected = planSync(source, target, ignored);
    if (!selected.length) {
      void vscode.window.showInformationMessage(t("Nothing to sync"));
      return;
    }
    if (selected.some((p) => target[p] && target[p].type !== source[p].type))
      throw Error(t("Resolve file/directory type conflicts before syncing"));
    const executionHost = os.hostname();
    const localEndpoint = t(
      "Extension host: {0}\nDirectory: {1}",
      executionHost,
      await fs.realpath(cfg.local),
    );
    const remoteEndpoint = t(
      "SSH target (Host alias): {0}\nDirectory: {1}",
      cfg.host,
      cfg.remote,
    );
    const sourceLabel = up ? localEndpoint : remoteEndpoint,
      targetLabel = up ? remoteEndpoint : localEndpoint;
    const detail =
      t(
        "FROM\n{0}\n\nTO\n{1}\n\nExisting destination files will be overwritten. No files will be deleted.",
        sourceLabel,
        targetLabel,
      ) +
      (vscode.env.remoteName
        ? "\n\n" +
          t(
            "Remote workspace: {0}. The “local” side is on extension host {1}, which may differ from your desktop computer.",
            vscode.env.remoteName,
            executionHost,
          )
        : "");
    const yes = await vscode.window.showWarningMessage(
      t("Copy {0} differing items?", selected.length),
      { modal: true, detail },
      t("Start sync"),
    );
    if (!yes) return;
    for (const p of selected.sort(
      (a, b) => a.split("/").length - b.split("/").length,
    )) {
      check();
      report(p);
      const s = source[p];
      if (up) {
        if (s.type === "dir") await rpc("mkdir", { path: p });
        else
          await rpc("write", {
            path: p,
            data: (await fs.readFile(await safeLocal(p))).toString("base64"),
            mtime: s.mtime,
          });
      } else {
        const dest = await safeLocal(p);
        if (s.type === "dir") await fs.mkdir(dest, { recursive: true });
        else {
          const data = Buffer.from(await rpc("read", { path: p }), "base64");
          await fs.mkdir(path.dirname(dest), { recursive: true });
          const tmp = dest + ".sfs-" + require("node:crypto").randomUUID();
          try {
            await fs.writeFile(tmp, data, { flag: "wx" });
            await fs.utimes(tmp, s.mtime, s.mtime);
            await fs.rename(tmp, dest);
          } finally {
            await fs.rm(tmp, { force: true });
          }
        }
      }
    }
    await refresh();
    vscode.window.showInformationMessage(t("Sync complete"));
  }
  function command(name, fn) {
    ctx.subscriptions.push(
      vscode.commands.registerCommand("sfs." + name, async (...args) => {
        if (busy) {
          vscode.window.showInformationMessage(
            t(
              "An operation is running. Wait or cancel it in the progress notification.",
            ),
          );
          return;
        }
        busy = true;
        try {
          const runWithProgress = [
            "configure",
            "edit",
            "rename",
            "delete",
            "diagnose",
            "setupKey",
          ].includes(name)
            ? async (_options, task) => {
                const source = new vscode.CancellationTokenSource();
                try {
                  return await task({ report() {} }, source.token);
                } finally {
                  source.dispose();
                }
              }
            : vscode.window.withProgress.bind(vscode.window);
          await runWithProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: t("SSH Folder Sync"),
              cancellable: true,
            },
            async (progress, token) => {
              const cancel = new vscode.CancellationTokenSource();
              const listener = token.onCancellationRequested(() =>
                cancel.cancel(),
              );
              operation = { progress, token: cancel.token, cancel };
              try {
                return await fn(...args);
              } finally {
                listener.dispose();
                cancel.dispose();
              }
            },
          );
        } catch (e) {
          if (e instanceof vscode.CancellationError) {
            output.appendLine("Cancelled");
            return;
          }
          output.appendLine(e.stack || String(e));
          output.show(true);
          vscode.window.showErrorMessage(e.message);
        } finally {
          busy = false;
          operation = undefined;
          if (closeRequested) {
            closeRequested = false;
            close();
          }
        }
      }),
    );
  }

  async function browse(host, initial, pythonCommand) {
    let current = initial || "~";
    while (true) {
      check();
      const result = await rpc(
        "browse",
        {},
        { host, remote: current, pythonCommand },
      );
      current = result.path;
      const selected = await vscode.window.showQuickPick(
        [
          { label: "$(check) " + t("Select this directory"), action: "select" },
          {
            label: "$(arrow-up) ..",
            path: remotePathApi(current).dirname(current),
          },
          { label: "$(edit) " + t("Enter a path…"), action: "manual" },
          ...((result.drives || []).length
            ? [
                {
                  label: "$(database) " + t("Choose a drive…"),
                  action: "drives",
                },
              ]
            : []),
          ...result.directories.map((name) => ({
            label: "$(folder) " + name,
            path: remotePathApi(current).join(current, name),
          })),
        ],
        {
          title: host + ":" + current,
          placeHolder: t("Open a subdirectory or select the current directory"),
        },
      );
      if (!selected) return;
      if (selected.action === "select") return current;
      if (selected.action === "drives") {
        const drive = await vscode.window.showQuickPick(result.drives, {
          placeHolder: t("Choose a drive…"),
        });
        if (drive) current = drive;
        continue;
      }
      if (selected.action === "manual") {
        const value = await vscode.window.showInputBox({
          prompt: t("Absolute remote directory"),
          value: current,
          validateInput: (s) =>
            absoluteRemotePath(s) ? null : t("An absolute path is required"),
        });
        if (value) current = value;
      } else current = selected.path;
    }
  }
  async function configure(id) {
    const previous = history.find((x) => x.id === id);
    const name = await vscode.window.showInputBox({
      prompt: t("Connection name"),
      value: previous?.name,
    });
    if (!name?.trim()) return;
    const folder = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      defaultUri: previous ? vscode.Uri.file(previous.local) : undefined,
    });
    if (!folder) return;

    const hosts = await require("./ssh-config").aliases();
    const chosen = await vscode.window.showQuickPick(
      [
        ...hosts.map((host) => ({ label: host, host })),
        { label: t("Enter SSH Host manually…"), manual: true },
      ],
      { placeHolder: t("Choose a Host from ~/.ssh/config") },
    );
    if (!chosen) return;
    const host = chosen.manual
      ? await vscode.window.showInputBox({
          prompt: t("SSH config Host alias (key or agent authentication)"),
          value: previous?.host,
          validateInput: (s) =>
            /^[a-zA-Z0-9_][a-zA-Z0-9_.@-]*$/.test(s)
              ? null
              : t("Enter a valid SSH Host alias"),
        })
      : chosen.host;
    if (!host) return;

    const pythonCommand = await vscode.window.showQuickPick(
      ["python3", "python", "py -3"],
      {
        placeHolder: t(
          "Python command on SSH target (Windows: python or py -3; Linux: python3)",
        ),
      },
    );
    if (!pythonCommand) return;
    const method = await vscode.window.showQuickPick(
      [
        { label: t("Enter path (offline)"), manual: true },
        { label: t("Browse remote directories (connect)"), manual: false },
      ],
      { placeHolder: t("How would you like to set the remote directory?") },
    );
    if (!method) return;
    let manual = method.manual,
      dir;
    if (!manual) {
      try {
        dir = await browse(host, previous?.remote, pythonCommand);
      } catch (error) {
        if (error instanceof vscode.CancellationError) throw error;
        output.appendLine(error.stack || String(error));
        const fallback = await vscode.window.showWarningMessage(
          t("Unable to browse remote directories: {0}", error.message),
          { modal: true },
          t("Enter path (offline)"),
        );
        if (!fallback) return;
        manual = true;
      }
    }
    if (manual)
      dir = await vscode.window.showInputBox({
        prompt: t(
          "Absolute remote directory (saved without connection or validation)",
        ),
        value: previous?.remote,
        validateInput: (s) =>
          absoluteRemotePath(s) ? null : t("An absolute path is required"),
      });
    if (!dir) return;

    const record = {
      id: previous?.id || require("node:crypto").randomUUID(),
      name: name.trim(),
      host,
      pythonCommand,
      remote: dir,
      local: folder[0].fsPath,
      excluded: previous?.excluded || [],
      lastUsed: Date.now(),
    };
    history = history.filter((x) => x.id !== record.id).concat(record);
    await persist();
    if (previous || manual) {
      if (cfg?.id === record.id) {
        cfg = record;
        ign = [...record.excluded];
        local = {};
        remote = {};
        states = {};
      }
      header();
      void vscode.window.showInformationMessage(
        t("Connection saved. Open it or refresh to connect and compare."),
      );
    } else await open(record);
  }
  command("configure", () => configure());
  command("edit", (id) => configure(id));
  command("open", async (id) => {
    const record = history.find((x) => x.id === id);
    if (record) await open(record);
  });
  command("rename", async (id) => {
    const record = history.find((x) => x.id === id);
    if (!record) return;
    const name = await vscode.window.showInputBox({
      prompt: t("Connection name"),
      value: record.name,
    });
    if (name?.trim()) {
      record.name = name.trim();
      await persist();
      changed.fire();
    }
  });
  command("delete", async (id) => {
    const record = history.find((x) => x.id === id);
    if (!record) return;
    if (
      await vscode.window.showWarningMessage(
        t("Delete connection “{0}”? Files will not be deleted.", record.name),
        { modal: true },
        t("Delete"),
      )
    ) {
      history = history.filter((x) => x.id !== id);
      await persist();
      changed.fire();
    }
  });
  let closeRequested = false;
  function close() {
    cfg = undefined;
    ign = [];
    local = {};
    remote = {};
    states = {};
    header();
    decorationsChanged.fire(undefined);
  }
  ctx.subscriptions.push(
    vscode.commands.registerCommand("sfs.close", async () => {
      if (busy) {
        const yes = await vscode.window.showWarningMessage(
          t(
            "Stop the current operation and return to connection history? Completed copies will not be rolled back.",
          ),
          { modal: true },
          t("Stop and Close"),
        );
        if (!yes) return;
        closeRequested = true;
        operation?.cancel.cancel();
      } else close();
    }),
  );
  async function guideRecord(id) {
    if (id && typeof id === "string")
      return history.find((record) => record.id === id);
    if (cfg) return cfg;
    const selected = await vscode.window.showQuickPick(
      history.map((record) => ({
        label: record.name,
        description: record.host,
        record,
      })),
      { placeHolder: t("Choose a saved connection") },
    );
    return selected?.record;
  }
  command("diagnose", async (id) => {
    const record = await guideRecord(id);
    if (record)
      await require("./ssh-guide").diagnose(vscode, record, output, t, persist);
  });
  command("setupKey", async (id) => {
    const record = await guideRecord(id);
    if (record) await require("./ssh-guide").setup(vscode, record, output, t);
  });
  command("refresh", refresh);
  command("upload", () => sync(true));
  command("download", () => sync(false));
  command("diff", async (p) => {
    if (!p || local[p]?.type !== "file" || remote[p]?.type !== "file")
      throw Error(t("Select a file that exists on both sides"));
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sfs-"));
    const file = path.join(dir, path.basename(p));
    await fs.writeFile(
      file,
      Buffer.from(await rpc("read", { path: p }), "base64"),
    );
    ctx.subscriptions.push({
      dispose: () =>
        fs.rm(dir, { recursive: true, force: true }).catch(() => {}),
    });
    await vscode.commands.executeCommand(
      "vscode.diff",
      vscode.Uri.file(await safeLocal(p)),
      vscode.Uri.file(file),
      `${p}: ${t("Local ↔ Remote snapshot")}`,
    );
  });
}
exports.activate = activate;

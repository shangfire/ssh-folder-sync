const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { status, excluded } = require("./src/core");
test("排除仅影响路径及后代", () => {
  assert.ok(excluded("a/b", ["a"]));
  assert.ok(!excluded("abc", ["a"]));
});
test("比较模式及类型冲突", () => {
  const a = { type: "file", hash: "a", size: 4, mtime: 10 },
    b = { ...a, hash: "b", mtime: 11 };
  assert.equal(status(a, b, "md5"), "Different");
  assert.equal(status(a, b, "timestamp"), "Different");
  assert.equal(status(a, { type: "dir" }, "md5"), "Type conflict");
  assert.equal(status(a, null, "md5"), "Local only");
});
const { summarize } = require("./src/core");
test("目录递归汇总差异且保留单端状态", () => {
  const d = { type: "dir" },
    f = { type: "file", hash: "a" };
  const l = {
    top: d,
    "top/sub": d,
    "top/sub/f": f,
    empty: d,
    only: d,
    "only/f": f,
  };
  const r = {
    top: d,
    "top/sub": d,
    "top/sub/f": { ...f, hash: "b" },
    empty: d,
    there: d,
  };
  const s = summarize(l, r, "md5");
  assert.equal(s.top, "Different");
  assert.equal(s["top/sub"], "Different");
  assert.equal(s.empty, "Identical");
  assert.equal(s.only, "Local only");
  assert.equal(s.there, "Remote only");
  assert.equal(summarize(l, l, "md5").top, "Identical");
});
test("子项缺失与类型冲突使父目录不同", () => {
  const l = { a: { type: "dir" }, "a/b": { type: "file", hash: "x" } };
  assert.equal(summarize(l, { a: { type: "dir" } }, "md5").a, "Different");
  const s = summarize(l, { a: { type: "dir" }, "a/b": { type: "dir" } }, "md5");
  assert.equal(s.a, "Different");
  assert.equal(s["a/b"], "Type conflict");
});

test("语言跟随编辑器，未知语言回退英语", () => {
  const { translator } = require("./src/i18n");
  assert.equal(translator("zh-cn")("Identical"), "相同");
  assert.equal(translator("en")("Identical"), "Identical");
  assert.equal(translator("de")("Remote only"), "Remote only");
  assert.match(
    translator("en")(
      "Sync {1} differing items from {0} to {2}. Existing destination files will be overwritten. No files will be deleted.",
      "Local",
      3,
      "Remote",
    ),
    /3 differing items/,
  );
});

test("真实目录扫描：递归读取文件并计算 MD5", async () => {
  const fs = require("node:fs/promises"),
    os = require("node:os"),
    path = require("node:path");
  const { scan } = require("./src/core");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sfs-scan-test-"));
  try {
    await fs.mkdir(path.join(root, "nested"));
    await fs.writeFile(path.join(root, "nested", "hello.txt"), "hello");
    await fs.writeFile(path.join(root, "empty.txt"), "");
    const entries = await scan(root, "md5");
    assert.equal(entries.nested.type, "dir");
    assert.equal(
      entries["nested/hello.txt"].hash,
      "5d41402abc4b2a76b9719d911017c592",
    );
    assert.equal(entries["empty.txt"].hash, "d41d8cd98f00b204e9800998ecf8427e");
    assert.equal(entries.nested.hash, undefined);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("同步计划过滤排除项、相同文件和已存在目录", () => {
  const { planSync } = require("./src/core");
  const source = {
    a: { type: "dir" },
    "a/done": { type: "file", hash: "x" },
    "a/skip": { type: "file", hash: "new" },
    "a/change": { type: "file", hash: "new" },
    empty: { type: "dir" },
  };
  const target = {
    a: { type: "dir" },
    "a/done": { type: "file", hash: "x" },
    "a/skip": { type: "file", hash: "old" },
    "a/change": { type: "file", hash: "old" },
  };
  assert.deepEqual(planSync(source, target, ["a/skip"]), ["a/change", "empty"]);
  assert.deepEqual(planSync(source, source, []), []);
  assert.deepEqual(planSync(source, target, ["a"]), ["empty"]);
  assert.deepEqual(planSync(source, target, ["a", "empty"]), []);
});

test("无同步项时不等待通知关闭即可结束", async () => {
  const fs = require("node:fs"),
    vm = require("node:vm");
  const code = fs.readFileSync(require.resolve("./src/extension"), "utf8");
  const body =
    code.slice(
      code.indexOf("async function sync(up) {"),
      code.indexOf("const executionHost = os.hostname();"),
    ) + "}";
  let notified = false;
  const run = vm.runInNewContext("(" + body + ")", {
    ign: [],
    refresh: async () => {},
    local: {},
    remote: {},
    planSync: () => [],
    t: (x) => x,
    vscode: {
      window: {
        showInformationMessage() {
          notified = true;
          return new Promise(() => {});
        },
      },
    },
  });
  let timer;
  try {
    await Promise.race([
      run(true),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error("流程等待通知关闭")), 500);
      }),
    ]);
    assert.ok(notified);
  } finally {
    clearTimeout(timer);
  }
});

test("历史记录持久化、独立排除项及顺序写入", async () => {
  const fs = require("node:fs/promises"),
    os = require("node:os"),
    path = require("node:path"),
    { HistoryStore } = require("./src/history");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sfs-history-"));
  try {
    const store = new HistoryStore(root);
    assert.deepEqual(await store.load(), []);
    const a = {
      id: "a",
      name: "A",
      host: "server",
      local: "/a",
      remote: "/b",
      excluded: ["skip"],
    };
    const b = { ...a, id: "b", excluded: [] };
    await Promise.all([store.save([a]), store.save([a, b])]);
    assert.deepEqual(await new HistoryStore(root).load(), [a, b]);
    await store.save([b]);
    assert.deepEqual(await store.load(), [b]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("历史列表渲染使用翻译函数且不受局部变量遮蔽", () => {
  const fs = require("node:fs"),
    vm = require("node:vm");
  const code = fs.readFileSync(require.resolve("./src/extension"), "utf8");
  const start = code.indexOf("getTreeItem(p) {") + "getTreeItem(p)".length;
  const end = code.indexOf("getChildren(parent)", start);
  class TreeItem {
    constructor(label) {
      this.label = label;
    }
  }
  const render = vm.runInNewContext(
    "(function(p)" + code.slice(start, end).trim().replace(/,$/, "") + ")",
    {
      cfg: undefined,
      history: [
        {
          id: "one",
          name: "Example",
          host: "server",
          local: "/a",
          remote: "/b",
        },
      ],
      t: require("./src/i18n").translator("en"),
      vscode: { TreeItem, ThemeIcon: class {} },
    },
  );
  assert.equal(render("one").label, "Example");
  assert.match(render("one").tooltip, /Local/);
  assert.equal(render("__new__").label, "New Sync Connection");
});

test("读取 SSH Host 与 Include，忽略通配 Host 和注释", async () => {
  const fs = require("node:fs/promises"),
    os = require("node:os"),
    path = require("node:path"),
    { aliases } = require("./src/ssh-config");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sfs-hosts-"));
  try {
    await fs.writeFile(path.join(root, "extra"), "Host other\n");
    await fs.writeFile(
      path.join(root, "config"),
      'Host one two # ignored\nHost * !excluded\nInclude "' +
        path.join(root, "extra").replaceAll("\\", "/") +
        '"\n',
    );
    assert.deepEqual(await aliases(path.join(root, "config")), [
      "one",
      "other",
      "two",
    ]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("远端路径接受 POSIX、Windows 盘符与 UNC 路径", () => {
  const { absoluteRemotePath, remotePathApi } = require("./src/remote-path");
  assert.ok(absoluteRemotePath("C:\\Users\\test"));
  assert.ok(absoluteRemotePath("D:/data"));
  assert.ok(absoluteRemotePath("/home/test"));
  assert.ok(!absoluteRemotePath("C:data"));
  assert.ok(!absoluteRemotePath("relative"));
  assert.equal(
    remotePathApi("C:\\data").join("C:\\data", "child"),
    "C:\\data\\child",
  );
});

test("MD5 cache reuses unchanged metadata and invalidates modified files", async () => {
  const fs = require("node:fs/promises"),
    os = require("node:os"),
    path = require("node:path"),
    { scan } = require("./src/core");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sfs-cache-"));
  try {
    await fs.writeFile(path.join(root, "file"), "first");
    const first = await scan(root);
    const cached = JSON.parse(JSON.stringify(first));
    cached.file.hash = "a".repeat(32);
    assert.equal(
      (await scan(root, "md5", () => {}, cached)).file.hash,
      "a".repeat(32),
    );
    await fs.writeFile(path.join(root, "file"), "changed-longer");
    assert.notEqual(
      (await scan(root, "md5", () => {}, cached)).file.hash,
      "a".repeat(32),
    );
    await fs.unlink(path.join(root, "file"));
    assert.deepEqual(await scan(root, "md5", () => {}, cached), {});
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("SSH diagnostics classify authentication, host-key and network errors", () => {
  const { classify } = require("./src/ssh-guide");
  assert.match(
    classify("Permission denied (publickey)"),
    /authentication failed/,
  );
  assert.match(classify("Host key verification failed"), /fingerprint/);
  assert.match(classify("Connection timed out"), /network/);
});
test("Key bootstrap scripts preserve key data and use default account paths", () => {
  const { windowsScript, linuxScript } = require("./src/ssh-guide");
  const key = "ssh-ed25519 AAAATEST setup";
  const command = windowsScript(key);
  const decoded = Buffer.from(command.split(" ").at(-1), "base64").toString(
    "utf16le",
  );
  assert.ok(decoded.includes(Buffer.from(key).toString("base64")));
  assert.match(decoded, /administrators_authorized_keys/);
  assert.match(decoded, /AppendAllText/);
  assert.match(decoded, /S-1-5-32-544/);
  assert.match(linuxScript(key), /grep -qxF/);
});

test("POSIX public-key installer executes twice without duplicating keys", async (t) => {
  const fs = require("node:fs/promises"),
    path = require("node:path"),
    os = require("node:os"),
    { execFileSync } = require("node:child_process");
  const bash =
    process.platform === "win32"
      ? "C:/Program Files/Git/bin/bash.exe"
      : "/bin/bash";
  try {
    await fs.access(bash);
  } catch {
    t.skip("Git Bash unavailable");
    return;
  }
  try {
    execFileSync(bash, ["-c", "true"], { stdio: "pipe" });
  } catch (error) {
    if (String(error.stderr).includes("NtCreateDirectoryObject")) {
      t.skip("MSYS blocked by host sandbox");
      return;
    }
    throw error;
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sfs-key-test-"));
  try {
    const home = root
      .replaceAll("\\", "/")
      .replace(/^([A-Za-z]):/, (_, drive) => "/" + drive.toLowerCase());
    const command = require("./src/ssh-guide").linuxScript(
      "ssh-ed25519 AAAATEST fixture",
    );
    for (let i = 0; i < 2; i++)
      execFileSync(bash, ["-c", command], {
        env: { ...process.env, HOME: home },
      });
    const content = await fs.readFile(
      path.join(root, ".ssh", "authorized_keys"),
      "utf8",
    );
    assert.equal(
      content
        .split("\n")
        .filter((line) => line === "ssh-ed25519 AAAATEST fixture").length,
      1,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("Directory browsing reuses one SSH process without caching and survives directory errors", async () => {
  const { createBrowseSession } = require("./src/browse-session");
  const { PassThrough, Writable } = require("node:stream");
  const { EventEmitter } = require("node:events");
  let starts = 0,
    requests = 0,
    kills = 0;
  const session = await createBrowseSession(
    { host: "fixture", pythonCommand: "python" },
    undefined,
    () => {
      starts++;
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {
        kills++;
        child.emit("close", 0);
      };
      child.stdin = new Writable({
        write(chunk, encoding, callback) {
          if (!chunk.toString().trimStart().startsWith("{")) {
            callback();
            return;
          }
          const request = JSON.parse(chunk.toString());
          requests++;
          process.nextTick(() =>
            child.stdout.write(
              JSON.stringify(
                request.directory === "bad"
                  ? { error: "Permission denied" }
                  : {
                      result: {
                        path: request.directory,
                        directories: [],
                        drives: [],
                      },
                    },
              ) + "\n",
            ),
          );
          callback();
        },
      });
      return child;
    },
  );
  try {
    assert.equal((await session.request("/one")).path, "/one");
    await assert.rejects(session.request("bad"), /Permission denied/);
    assert.equal((await session.request("/two")).path, "/two");
    assert.equal((await session.request("/one")).path, "/one");
    assert.equal(starts, 1);
    assert.equal(requests, 4);
  } finally {
    session.dispose();
  }
  assert.equal(kills, 1);
  await assert.rejects(session.request("/other"), /disposed|closed/);
});

test("Remote directory navigation keeps one picker open and refreshes its items", async () => {
  const { pickRemoteDirectory } = require("./src/directory-picker");
  let created = 0,
    shown = 0,
    disposed = 0;
  const listeners = {};
  const picker = {
    value: "",
    items: [],
    selectedItems: [],
    onDidHide(fn) {
      listeners.hide = fn;
    },
    onDidChangeValue(fn) {
      listeners.change = fn;
    },
    onDidAccept(fn) {
      listeners.accept = fn;
    },
    show() {
      shown++;
    },
    dispose() {
      disposed++;
    },
  };
  const paths = [];
  const session = {
    async request(p) {
      paths.push(p);
      return {
        path: p === "~" ? "/home" : p,
        directories: p === "~" ? ["child"] : [],
        drives: [],
      };
    },
  };
  const result = pickRemoteDirectory(
    {
      window: {
        createQuickPick() {
          created++;
          return picker;
        },
      },
    },
    session,
    "fixture",
    "~",
    (x) => x,
  );
  await new Promise((resolve) => setImmediate(resolve));
  picker.selectedItems = [
    picker.items.find((item) => item.path === "/home/child"),
  ];
  listeners.accept();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(picker.title, "fixture:/home/child");
  assert.equal(created, 1);
  assert.equal(shown, 1);
  assert.equal(disposed, 0);
  assert.deepEqual(paths, ["~", "/home/child"]);
  picker.selectedItems = [
    picker.items.find((item) => item.action === "select"),
  ];
  listeners.accept();
  assert.equal(await result, "/home/child");
  assert.equal(disposed, 1);
});

test("General SSH session reuses one process for scan, read and write requests", async () => {
  const { createJsonSession } = require("./src/ssh-session"),
    { PassThrough, Writable } = require("node:stream"),
    { EventEmitter } = require("node:events");
  let calls = 0,
    bootstrap = 0;
  const operations = [];
  const session = await createJsonSession(
    { host: "fixture", pythonCommand: "python" },
    'print("fixture")',
    undefined,
    () => {
      calls++;
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => child.emit("close", 0);
      child.stdin = new Writable({
        write(chunk, encoding, callback) {
          const text = chunk.toString();
          if (!text.startsWith("{")) {
            bootstrap++;
            callback();
            return;
          }
          const payload = JSON.parse(text);
          operations.push(payload.op);
          process.nextTick(() =>
            child.stdout.write(JSON.stringify({ result: payload }) + "\n"),
          );
          callback();
        },
      });
      return child;
    },
  );
  try {
    for (const op of ["scan", "read", "write", "scan"])
      assert.equal((await session.request({ op, path: "目录/文件" })).op, op);
    assert.equal(calls, 1);
    assert.equal(bootstrap, 1);
    assert.deepEqual(operations, ["scan", "read", "write", "scan"]);
    assert.ok(session.isAlive);
  } finally {
    session.dispose();
  }
  assert.ok(!session.isAlive);
});

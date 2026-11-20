"use strict";
const { spawn } = require("node:child_process");
const readline = require("node:readline");

async function createJsonSession(
  connection,
  script,
  token,
  spawnProcess = spawn,
) {
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.@-]*$/.test(connection.host))
    throw Error("Invalid SSH Host alias");
  const python = connection.pythonCommand || "python3";
  if (!["python3", "python", "py -3"].includes(python))
    throw Error("Unsupported Python command");
  const encoded = Buffer.from(script).toString("base64");
  const child = spawnProcess(
    "ssh",
    [
      "-T",
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=15",
      "-o",
      "ServerAliveInterval=15",
      "-o",
      "ServerAliveCountMax=3",
      "--",
      connection.host,
      `${python} -u -X utf8 -c "import sys,base64;source=compile(base64.b64decode(sys.stdin.buffer.readline()),'<sfs-session>','exec');print('__SFS_READY__',flush=True);exec(source)"`,
    ],
    { windowsHide: true },
  );

  let pending,
    failure,
    closed = false,
    stderr = "";
  let readyResolve, readyReject, writeError, errorTimer;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  ready.catch(() => {});
  const startupTimer = setTimeout(() => {
    fail(Error("SSH/Python startup timed out. " + stderr));
    child.kill();
  }, 120000);
  const lines = readline.createInterface({ input: child.stdout });
  function fail(error) {
    failure = error;
    clearTimeout(startupTimer);
    clearTimeout(errorTimer);
    readyReject(error);
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = undefined;
    }
  }
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-8192);
  });
  child.on("error", fail);
  child.stdin.on("error", (error) => {
    writeError = error;
    errorTimer = setTimeout(() => {
      fail(Error("SSH input closed: " + (stderr || error.message)));
      child.kill();
    }, 300);
  });
  child.on("close", (code) => {
    closed = true;
    fail(
      Error(
        "SSH/Python session exited (code " +
          code +
          "): " +
          (stderr.trim() || writeError?.message || "No remote error output"),
      ),
    );
    lines.close();
  });
  lines.on("line", (line) => {
    if (line === "__SFS_READY__") {
      clearTimeout(startupTimer);
      readyResolve();
      return;
    }
    if (!pending) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      fail(Error("Invalid SSH response: " + line.slice(0, 200)));
      child.kill();
      return;
    }
    const current = pending;
    pending = undefined;
    clearTimeout(current.timer);
    if (message.error) current.reject(Error(message.error));
    else current.resolve(message.result);
  });
  const cancellation = token?.onCancellationRequested(() => {
    fail(Error("SSH JSON browsing cancelled"));
    child.kill();
  });
  function dispose() {
    cancellation?.dispose();
    clearTimeout(startupTimer);
    clearTimeout(errorTimer);
    lines.close();
    if (!closed) {
      closed = true;
      fail(Error("SSH JSON session disposed"));
      child.stdin.end();
      child.kill();
    }
  }
  if (token?.isCancellationRequested) {
    dispose();
    throw Error("SSH JSON browsing cancelled");
  }
  child.stdin.write(encoded + "\n");
  return {
    async request(payload) {
      await ready;
      if (failure || closed)
        return Promise.reject(failure || Error("SSH JSON session closed"));
      if (pending)
        return Promise.reject(Error("SSH request already in progress"));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          fail(Error("SSH JSON request timed out"));
          child.kill();
        }, 120000);
        pending = { resolve, reject, timer };
        child.stdin.write(JSON.stringify(payload) + "\n");
      });
    },
    get isAlive() {
      return !closed && !failure;
    },
    dispose,
  };
}
module.exports = { createJsonSession };

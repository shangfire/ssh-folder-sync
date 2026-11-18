"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
function excluded(p, list) {
  return list.some((x) => p === x || p.startsWith(x + "/"));
}
function status(a, b, mode) {
  if (!a) return "Remote only";
  if (!b) return "Local only";
  if (a.type !== b.type) return "Type conflict";
  if (a.type === "dir") return "Directory";
  return a.hash === b.hash ? "Identical" : "Different";
}

async function scan(root, mode, check = () => {}, cache = {}) {
  const result = {};
  async function walk(rel) {
    check();
    for (const entry of await fs.readdir(path.join(root, rel), {
      withFileTypes: true,
    })) {
      check();
      if (entry.isSymbolicLink()) continue;
      const p = rel ? rel + "/" + entry.name : entry.name,
        full = path.join(root, p);
      const stat = await fs.lstat(full, { bigint: true });
      if (!stat.isDirectory() && !stat.isFile()) continue;
      const item = {
        type: stat.isDirectory() ? "dir" : "file",
        size: Number(stat.size),
        mtime: Number(stat.mtimeNs / 1000000000n),
        signature: [stat.size, stat.mtimeNs, stat.ctimeNs, stat.ino].join(":"),
      };
      result[p] = item;
      if (stat.isDirectory()) {
        await walk(p);
        continue;
      }
      const previous = cache[p];
      if (
        previous?.signature === item.signature &&
        /^[a-f0-9]{32}$/.test(previous.hash || "")
      ) {
        item.hash = previous.hash;
        continue;
      }
      const hash = crypto.createHash("md5");
      for await (const block of require("node:fs").createReadStream(full)) {
        check();
        hash.update(block);
      }
      const after = await fs.lstat(full, { bigint: true });
      if (
        [after.size, after.mtimeNs, after.ctimeNs, after.ino].join(":") !==
        item.signature
      )
        throw Error("File changed during comparison: " + p);
      item.hash = hash.digest("hex");
    }
  }
  await walk("");
  return result;
}
module.exports = { excluded, status, scan };

function summarize(local, remote, mode) {
  const states = {};
  const paths = [
    ...new Set([...Object.keys(local), ...Object.keys(remote)]),
  ].sort((a, b) => b.split("/").length - a.split("/").length);
  for (const p of paths) {
    let s = status(local[p], remote[p], mode);
    if (s === "Directory") s = "Identical";
    states[p] =
      states[p] === "Different" && s === "Identical" ? "Different" : s;
    const parent = path.posix.dirname(p);
    if (parent !== "." && states[p] !== "Identical")
      states[parent] = "Different";
  }
  return states;
}
module.exports.summarize = summarize;

function planSync(source, target, ignored) {
  return Object.keys(source).filter((p) => {
    if (excluded(p, ignored)) return false;
    const a = source[p],
      b = target[p];
    if (!b || a.type !== b.type) return true;
    return a.type === "file" && a.hash !== b.hash;
  });
}
module.exports.planSync = planSync;

"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os");
async function aliases(
  file = path.join(os.homedir(), ".ssh", "config"),
  seen = new Set(),
) {
  file = path.resolve(file);
  if (seen.has(file)) return [];
  seen.add(file);
  let text;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.match(/"[^"]*"|'[^']*'|[^\s=]+/g);
    if (!tokens) continue;
    const key = tokens.shift().toLowerCase();
    const comment = tokens.findIndex((x) => x.startsWith("#"));
    const values = (comment < 0 ? tokens : tokens.slice(0, comment)).map((x) =>
      x.replace(/^["']|["']$/g, ""),
    );
    if (key === "host")
      out.push(
        ...values.filter((x) => /^[a-zA-Z0-9_][a-zA-Z0-9_.@-]*$/.test(x)),
      );
    if (key === "include")
      for (let inc of values) {
        if (inc.startsWith("~/")) inc = path.join(os.homedir(), inc.slice(2));
        if (!path.isAbsolute(inc)) inc = path.join(os.homedir(), ".ssh", inc);
        if (!/[*?]/.test(inc)) out.push(...(await aliases(inc, seen)));
        else {
          const dir = path.dirname(inc),
            pattern = path.basename(inc);
          const re = new RegExp(
            "^" +
              pattern
                .split("*")
                .map((x) =>
                  x
                    .split("?")
                    .map((y) => y.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                    .join("."),
                )
                .join(".*") +
              "$",
          );
          let entries = [];
          try {
            entries = await fs.readdir(dir);
          } catch (e) {
            if (e.code !== "ENOENT") throw e;
          }
          for (const name of entries.sort())
            if (re.test(name))
              out.push(...(await aliases(path.join(dir, name), seen)));
        }
      }
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}
module.exports = { aliases };

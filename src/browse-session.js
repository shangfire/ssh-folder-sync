"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const { createJsonSession } = require("./ssh-session");
async function createBrowseSession(connection, token, spawnProcess) {
  const script = await fs.readFile(
    path.join(__dirname, "browse-server.py"),
    "utf8",
  );
  const session = await createJsonSession(
    connection,
    script,
    token,
    spawnProcess,
  );
  return {
    request(directory) {
      return session.request({ directory });
    },
    dispose: () => session.dispose(),
  };
}
module.exports = { createBrowseSession };

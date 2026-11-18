"use strict";
const path = require("node:path");
function windowsPath(value) {
  return /^[A-Za-z]:[\\/]/.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value);
}
function absoluteRemotePath(value) {
  return value.startsWith("/") || windowsPath(value);
}
function remotePathApi(value) {
  return windowsPath(value) ? path.win32 : path.posix;
}
module.exports = { absoluteRemotePath, remotePathApi };

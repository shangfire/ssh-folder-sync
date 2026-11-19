"use strict";
const { remotePathApi, absoluteRemotePath } = require("./remote-path");
function pickRemoteDirectory(vscode, session, host, initial, t) {
  return new Promise((resolve, reject) => {
    const picker = vscode.window.createQuickPick();
    let current = initial || "~",
      listing,
      mode = "directory",
      finished = false,
      loading = false;
    picker.ignoreFocusOut = true;
    picker.placeholder = t(
      "Open a subdirectory or select the current directory",
    );
    function finish(error, value) {
      if (finished) return;
      finished = true;
      picker.dispose();
      if (error) reject(error);
      else resolve(value);
    }
    function showDirectories() {
      mode = "directory";
      picker.title = host + ":" + current;
      picker.value = "";
      picker.items = [
        { label: "$(check) " + t("Select this directory"), action: "select" },
        {
          label: "$(arrow-up) ..",
          path: remotePathApi(current).dirname(current),
        },
        { label: "$(edit) " + t("Enter a path…"), action: "manual" },
        ...(listing.drives?.length
          ? [{ label: "$(database) " + t("Choose a drive…"), action: "drives" }]
          : []),
        ...listing.directories.map((name) => ({
          label: "$(folder) " + name,
          path: remotePathApi(current).join(current, name),
        })),
      ];
    }
    async function load(directory) {
      if (loading || finished) return;
      loading = true;
      picker.busy = true;
      picker.enabled = false;
      try {
        const result = await session.request(directory);
        if (finished) return;
        listing = result;
        current = result.path;
        showDirectories();
      } catch (error) {
        if (!finished) finish(error);
      } finally {
        loading = false;
        if (!finished) {
          picker.busy = false;
          picker.enabled = true;
        }
      }
    }
    picker.onDidHide(() => finish());
    picker.onDidChangeValue(() => {
      if (mode === "manual")
        picker.items = [
          {
            label: "$(check) " + t("Use this directory"),
            action: "usePath",
            alwaysShow: true,
          },
        ];
    });
    picker.onDidAccept(() => {
      if (loading || finished) return;
      const item = picker.selectedItems[0] || picker.activeItems[0];
      if (!item) return;
      if (item.action === "select") {
        finish(undefined, current);
        return;
      }
      if (item.action === "manual") {
        mode = "manual";
        picker.title = t("Absolute remote directory");
        picker.placeholder = /^[A-Za-z]:[\\/]/.test(current)
          ? t("Example: {0}", "D:\\projects\\demo")
          : t("Example: {0}", "/home/name/project");
        picker.value = current;
        picker.items = [
          {
            label: "$(check) " + t("Use this directory"),
            action: "usePath",
            alwaysShow: true,
          },
        ];
        return;
      }
      if (item.action === "usePath") {
        const value = picker.value.trim();
        if (!absoluteRemotePath(value)) {
          picker.title = t("An absolute path is required");
          return;
        }
        void load(value);
        return;
      }
      if (item.action === "drives") {
        mode = "drives";
        picker.value = "";
        picker.title = t("Choose a drive…");
        picker.items = [
          { label: "$(arrow-left) " + t("Back"), action: "back" },
          ...listing.drives.map((drive) => ({ label: drive, path: drive })),
        ];
        return;
      }
      if (item.action === "back") {
        showDirectories();
        return;
      }
      if (item.path) void load(item.path);
    });
    picker.title = host + ":" + current;
    picker.show();
    void load(current);
  });
}
module.exports = { pickRemoteDirectory };

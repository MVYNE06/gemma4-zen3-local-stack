import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";

const ALLOWED_ROOT = "e:\\";

function isOnEDrive(targetPath: string, cwd: string): boolean {
  const resolved = path.win32.resolve(cwd, targetPath).toLowerCase();
  return resolved.startsWith(ALLOWED_ROOT);
}

function hasDisallowedDriveOrEscape(command: string): boolean {
  // Block explicit drive letters other than E: (e.g. C:\, D:/, /c/, /mnt/c)
  if (/(?:^|[\s"'=(;])([a-df-zA-DF-Z]:[\\/]|\/[a-df-zA-DF-Z]\/|\/mnt\/[a-df-zA-DF-Z]\b)/.test(command)) {
    return true;
  }
  // Block Windows env vars and home shortcuts that point to C:\
  if (/(%USERPROFILE%|%APPDATA%|%LOCALAPPDATA%|%SYSTEMROOT%|%WINDIR%|\$env:USERPROFILE|\$HOME|~\/)/i.test(command)) {
    return true;
  }
  return false;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event: any, ctx: any) => {
    const toolName = String(event?.toolName || "").toLowerCase();
    const input = event?.input || {};
    const cwd = ctx?.cwd || process.cwd();

    // 1. File tools: read, write, edit
    if (toolName === "read" || toolName === "write" || toolName === "edit") {
      const target = input.path || input.file_path || input.filePath;
      if (typeof target === "string" && !isOnEDrive(target, cwd)) {
        return {
          block: true,
          reason: `Sandbox policy: access is restricted to E:\\ only. Blocked path: ${target}`,
        };
      }
    }

    // 2. Shell tools: bash / shellstart
    if (toolName === "bash" || toolName === "shellstart") {
      if (!cwd.toLowerCase().startsWith(ALLOWED_ROOT)) {
        return {
          block: true,
          reason: `Sandbox policy: shell commands can only run when working directory is on E:\\ (current: ${cwd}).`,
        };
      }
      const cmd = String(input.command || "");
      if (hasDisallowedDriveOrEscape(cmd)) {
        return {
          block: true,
          reason: "Sandbox policy: shell command references a drive or path outside E:\\.",
        };
      }
    }
  });
}

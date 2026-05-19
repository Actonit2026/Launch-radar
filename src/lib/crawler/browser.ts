import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { LaunchOptions } from "playwright";

function findCachedWindowsChromium() {
  const localAppData = process.env.LOCALAPPDATA;

  if (!localAppData) {
    return undefined;
  }

  const browserRoot = path.join(localAppData, "ms-playwright");

  if (!existsSync(browserRoot)) {
    return undefined;
  }

  const candidates = readdirSync(browserRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .map((entry) => {
      const revision = Number(entry.name.replace("chromium-", ""));
      const executablePath = path.join(
        browserRoot,
        entry.name,
        "chrome-win64",
        "chrome.exe",
      );

      return { revision, executablePath };
    })
    .filter((candidate) => existsSync(candidate.executablePath))
    .sort((a, b) => b.revision - a.revision);

  return candidates[0]?.executablePath;
}

export function getChromiumLaunchOptions(): LaunchOptions {
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
    findCachedWindowsChromium();

  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  };
}

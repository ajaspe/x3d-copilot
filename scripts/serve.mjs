/** Start `vite preview` (serves dist/) as a child process and wait until it answers. */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function startPreview(port = 4173) {
  const url = `http://127.0.0.1:${port}/`;
  const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "preview", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  child.stderr.on("data", (d) => process.stderr.write(String(d)));
  const stop = () => {
    // on Windows the npx.cmd shell wrapper survives child.kill(); kill the whole tree
    if (process.platform === "win32") spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill();
  };
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return { url, stop };
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  child.kill();
  throw new Error(`vite preview did not start on ${url}`);
}

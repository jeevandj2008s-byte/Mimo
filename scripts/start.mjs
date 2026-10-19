import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const buildIdPath = join(process.cwd(), ".next", "BUILD_ID");
const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const standaloneServer = join(process.cwd(), ".next", "standalone", "server.js");

// `next start` needs a production build. Building automatically makes the
// documented `npm start` command safe on a fresh checkout without changing
// the normal `next start` production behavior after a build exists.
if (!existsSync(buildIdPath)) {
  const build = spawnSync(process.execPath, [nextBin, "build"], { stdio: "inherit", shell: false });
  if (build.error) {
    console.error(`Could not start the build command: ${build.error.message}`);
    process.exit(1);
  }
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const serverCommand = existsSync(standaloneServer) ? standaloneServer : nextBin;
const serverArgs = serverCommand === standaloneServer ? [] : ["start"];
const server = spawn(process.execPath, [serverCommand, ...serverArgs], { stdio: "inherit", shell: false });
server.on("error", (error) => {
  console.error(`Could not start the Next.js server: ${error.message}`);
  process.exit(1);
});
server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

import { spawn } from "child_process";
import os from "os";

const isLinux = os.platform() === "linux";

if (!isLinux) {
  console.log(`[Cluster] Detected non-Linux OS (${os.platform()}). Skipping CPU pinning (taskset/nice).`);
}

function startInstance(port, core) {
  let command = "node";
  let args = ["src/index.js"];

  if (isLinux) {
    command = "taskset";
    // Pin to specific core and increase priority
    args = ["-c", core.toString(), "nice", "-n", "-10", "node", "src/index.js"];
  }

  const env = { ...process.env, PORT: port.toString() };
  
  const child = spawn(command, args, { env, stdio: "inherit" });
  
  child.on("close", (code) => {
    console.log(`[Cluster] Instance on port ${port} exited with code ${code}`);
  });
}

// Start two concurrent instances on ports 5001 and 5002
startInstance(5001, 0);
startInstance(5002, 1);

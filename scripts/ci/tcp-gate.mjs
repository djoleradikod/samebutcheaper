/**
 * A TCP forwarder the launch rehearsal (scripts/ci/rehearse-deploy.sh) puts between the site and Postgres, so it can
 * take the database away without stopping a Postgres that other things use:
 *
 *   node scripts/ci/tcp-gate.mjs <listen port> <target host:port> [open|hang]
 *
 * open: forwards every connection. hang: accepts connections and never answers, like a database that is overloaded
 * or behind a dropped network (the worst case: nothing fails fast). Killing the process is "the database is down":
 * open connections are cut and new ones are refused.
 */
import { createServer, connect } from "node:net";

const [port, target, mode = "open"] = process.argv.slice(2);
const [host, targetPort] = (target ?? "").split(":");
if (!Number(port) || !host || !Number(targetPort) || !["open", "hang"].includes(mode)) {
  process.stderr.write("usage: tcp-gate.mjs <listen port> <host:port> [open|hang]\n");
  process.exit(2);
}

const held = new Set();
const server = createServer((socket) => {
  socket.on("error", () => {});
  if (mode === "hang") {
    held.add(socket);
    socket.on("close", () => held.delete(socket));
    return;
  }
  const upstream = connect(Number(targetPort), host);
  upstream.on("error", () => socket.destroy());
  socket.on("close", () => upstream.destroy());
  upstream.on("close", () => socket.destroy());
  socket.pipe(upstream).pipe(socket);
});
server.listen(Number(port), "127.0.0.1", () => process.stdout.write(`gate ${mode} on 127.0.0.1:${port} -> ${target}\n`));
const stop = () => {
  for (const s of held) s.destroy();
  server.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

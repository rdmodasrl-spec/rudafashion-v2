#!/usr/bin/env node
// 启动本地服务、等待端口就绪、运行脚本、结束后关闭服务。
// 改编自 anthropics/skills webapp-testing/scripts/with_server.py（Apache-2.0）。
//
// 用法：
//   node .agents/skills/webapp-testing/scripts/with-server.mjs \
//     --server "PORT=4100 npm run dev" --port 4100 -- node /tmp/probe.mjs
//
// 说明：只用于本地。脚本退出码与子进程退出码一致，服务一定被回收。

import { spawn } from 'node:child_process';
import net from 'node:net';

function usage() {
  console.log(`Usage:
  node with-server.mjs --server "<cmd>" --port <port> [--server "<cmd>" --port <port> ...] -- <script> [args...]

Example:
  node with-server.mjs --server "PORT=4100 npm run dev" --port 4100 -- node /tmp/probe.mjs`);
}

function parseArgs(argv) {
  const servers = [];
  let i = 0;
  for (; i < argv.length; i += 1) {
    if (argv[i] === '--') { i += 1; break; }
    if (argv[i] === '--server') { servers.push({ cmd: argv[++i], port: null }); continue; }
    if (argv[i] === '--port') { servers[servers.length - 1].port = Number(argv[++i]); continue; }
    if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (servers.length === 0 || servers.some(s => !s.cmd || !s.port)) throw new Error('Each --server needs a --port');
  const command = argv.slice(i);
  if (command.length === 0) throw new Error('Missing script after --');
  return { servers, command };
}

function waitForPort(port, timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host: '127.0.0.1', port }, () => { socket.destroy(); resolve(); });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`Port ${port} not ready after ${timeoutMs}ms`));
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

const { servers, command } = parseArgs(process.argv.slice(2));
const children = [];

function shutdown(code) {
  for (const child of children) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

for (const server of servers) {
  const child = spawn('bash', ['-lc', server.cmd], { detached: true, stdio: 'inherit' });
  children.push(child);
  await waitForPort(server.port);
  console.log(`[with-server] ready on port ${server.port}`);
}

const runner = spawn(command[0], command.slice(1), { stdio: 'inherit' });
runner.on('exit', code => shutdown(code ?? 0));

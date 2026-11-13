const { spawn } = require('node:child_process');
const nextCli = require.resolve('next/dist/bin/next');
const port = String(process.env.PORT || '3001');
const child = spawn(process.execPath, [nextCli, 'start', '-H', '0.0.0.0', '-p', port], { stdio: 'inherit', env: process.env });
child.on('error', error => { console.error('Unable to start Next.js:', error); process.exit(1); });
child.on('exit', code => process.exit(code ?? 1));

const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;

const env = fs.readFileSync('.env', 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
if (!line) {
  console.error('No DATABASE_URL in .env');
  process.exit(1);
}
let raw = line.slice('DATABASE_URL='.length).trim();
if (
  (raw.startsWith('"') && raw.endsWith('"')) ||
  (raw.startsWith("'") && raw.endsWith("'"))
) {
  raw = raw.slice(1, -1);
}

const url = new URL(raw);
const host = url.hostname;
const port = Number(url.port || 5432);

console.log('host:', host);
console.log('port:', port);
console.log('database:', url.pathname.replace(/^\//, ''));
console.log('sslmode:', url.searchParams.get('sslmode') || '(none)');
console.log('pooler:', host.includes('pooler'));

dns
  .lookup(host)
  .then((r) => {
    console.log('dns:', r.address, r.family);
  })
  .catch((e) => {
    console.log('dns_error:', e.message);
  })
  .finally(() => {
    const socket = net.connect({ host, port }, () => {
      console.log('tcp: OK (connected)');
      socket.end();
      process.exit(0);
    });
    socket.setTimeout(8000);
    socket.on('timeout', () => {
      console.log('tcp: TIMEOUT (cannot reach port — firewall, VPN, or Neon suspended/blocked)');
      socket.destroy();
      process.exit(2);
    });
    socket.on('error', (e) => {
      console.log('tcp_error:', e.message);
      process.exit(2);
    });
  });

// Servidor da Central na rede local (modo "in loco") + descoberta automática por UDP.
'use strict';

const http = require('node:http');
const dgram = require('node:dgram');
const os = require('node:os');

const DISCOVERY_PORT = 8788;
const MAX_BODY = 2 * 1024 * 1024;

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push({ name, address: a.address });
    }
  }
  return out;
}

function createLocalServer(store, { port, onLog = () => {} } = {}) {
  const send = (res, code, obj) => {
    const body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };
  const readBody = (req) => new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
  const auth = (req) => {
    const id = req.headers['x-device-id']; const tok = req.headers['x-device-token'];
    return store.verifyDevice(id, tok) ? id : null;
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const key = `${req.method} ${url.pathname}`;
      if (key === 'GET /health' || key === 'GET /') {
        return send(res, 200, { ok: true, service: 'ifscreen-central', name: store.setting('centralName') });
      }
      if (key === 'POST /api/v1/device/register') {
        if ((req.headers['x-app-key'] || '') !== store.setting('appKey')) return send(res, 401, { error: 'app_key inválida' });
        const b = await readBody(req);
        const r = store.registerDevice(b, 'local');
        return send(res, r.ok ? 200 : (r.status || 400), r);
      }
      if (key === 'POST /api/v1/device/ingest') {
        const id = auth(req); if (!id) return send(res, 401, { error: 'não autorizado' });
        const b = await readBody(req);
        const accepted = store.ingest(id, b, 'local');
        return send(res, 200, { ok: true, accepted });
      }
      if (key === 'GET /api/v1/device/status') {
        const id = auth(req); if (!id) return send(res, 401, { error: 'não autorizado' });
        store.touch(id, 'local');
        return send(res, 200, store.status(id));
      }
      send(res, 404, { error: 'rota não encontrada' });
    } catch (e) {
      onLog('error', `servidor local: ${e.message}`);
      if (!res.headersSent) send(res, 400, { error: 'requisição inválida' });
    }
  });

  // Descoberta: o celular envia "IFSCREEN_DISCOVER" em broadcast UDP e a Central responde.
  const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  udp.on('message', (msg, rinfo) => {
    if (msg.toString('utf8').trim() !== 'IFSCREEN_DISCOVER') return;
    const reply = Buffer.from(JSON.stringify({ service: 'ifscreen-central', port: server.address() ? server.address().port : port, name: store.setting('centralName') }));
    udp.send(reply, rinfo.port, rinfo.address);
  });
  udp.on('error', (e) => onLog('warn', `descoberta UDP indisponível: ${e.message}`));

  return {
    server,
    start() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '0.0.0.0', () => {
          try { udp.bind(DISCOVERY_PORT, '0.0.0.0'); } catch (e) { onLog('warn', e.message); }
          resolve(server.address().port);
        });
      });
    },
    stop() { try { udp.close(); } catch (_) { /* */ } return new Promise((r) => server.close(() => r())); },
  };
}

module.exports = { createLocalServer, lanAddresses, DISCOVERY_PORT };

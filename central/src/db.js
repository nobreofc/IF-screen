// Banco de dados da Central: SQLite (sql.js / WebAssembly) persistido em arquivo.
// Sem módulos nativos: o mesmo código roda no Windows, Linux e nos testes em Node.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  token_hash TEXT,
  participant TEXT,
  linked INTEGER DEFAULT 0,
  linked_at INTEGER,
  study_start TEXT,
  info_json TEXT,
  hb_json TEXT,
  registered_at INTEGER,
  last_seen INTEGER,
  last_channel TEXT
);
CREATE TABLE IF NOT EXISTS days (
  device_id TEXT NOT NULL,
  date TEXT NOT NULL,
  version INTEGER NOT NULL,
  screen_ms INTEGER NOT NULL,
  launcher_ms INTEGER DEFAULT 0,
  own_app_ms INTEGER DEFAULT 0,
  own_log_ms INTEGER,
  device_off_ms INTEGER DEFAULT 0,
  sessions_n INTEGER DEFAULT 0,
  long_sessions INTEGER DEFAULT 0,
  complete INTEGER DEFAULT 0,
  partial_coverage INTEGER DEFAULT 0,
  source TEXT,
  algo TEXT,
  tz TEXT,
  received_at INTEGER,
  channel TEXT,
  PRIMARY KEY (device_id, date)
);
CREATE TABLE IF NOT EXISTS sessions (
  device_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions ON sessions(device_id, date);
CREATE TABLE IF NOT EXISTS questionnaires (
  device_id TEXT NOT NULL,
  ref_date TEXT NOT NULL,
  version INTEGER NOT NULL,
  tv INTEGER, tv_min INTEGER,
  pc INTEGER, pc_min INTEGER,
  answered_at INTEGER,
  received_at INTEGER,
  channel TEXT,
  PRIMARY KEY (device_id, ref_date)
);
CREATE TABLE IF NOT EXISTS reference (
  device_id TEXT NOT NULL,
  date TEXT NOT NULL,
  ref_min REAL NOT NULL,
  note TEXT,
  entered_at INTEGER,
  PRIMARY KEY (device_id, date)
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS log (ts INTEGER, level TEXT, msg TEXT);
`;

class Database {
  static async open(file) {
    const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
    const SQL = await initSqlJs({ wasmBinary: fs.readFileSync(wasmPath) });
    let db;
    if (file && fs.existsSync(file)) db = new SQL.Database(fs.readFileSync(file));
    else db = new SQL.Database();
    const inst = new Database(db, file);
    db.exec(SCHEMA);
    return inst;
  }

  constructor(db, file) {
    this.db = db;
    this.file = file;
    this.dirty = false;
    this.timer = null;
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    this.markDirty();
  }

  all(sql, params = []) {
    const st = this.db.prepare(sql);
    try {
      st.bind(params);
      const out = [];
      while (st.step()) out.push(st.getAsObject());
      return out;
    } finally { st.free(); }
  }

  get(sql, params = []) { return this.all(sql, params)[0] || null; }

  tx(fn) {
    this.db.exec('BEGIN');
    try { const r = fn(); this.db.exec('COMMIT'); this.markDirty(); return r; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  markDirty() {
    this.dirty = true;
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 3000);
    if (this.timer.unref) this.timer.unref();
  }

  // Gravação atômica: escreve em .tmp e renomeia (evita arquivo corrompido em queda de energia)
  flush() {
    if (!this.file || !this.dirty) return;
    const data = this.db.export();
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, Buffer.from(data));
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  // Cópia de segurança diária (mantém as 14 mais recentes)
  backup(dir) {
    if (!this.file) return;
    this.flush();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const dest = path.join(dir, `ifscreen-${stamp}.db`);
    if (!fs.existsSync(dest)) fs.copyFileSync(this.file, dest);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
    while (files.length > 14) fs.unlinkSync(path.join(dir, files.shift()));
  }
}

module.exports = { Database };

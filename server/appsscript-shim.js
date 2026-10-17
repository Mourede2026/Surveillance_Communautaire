/**
 * Mini-implémentation des services Google Apps Script utilisés par Code.gs
 * (SpreadsheetApp, Utilities, DriveApp, ContentService, Logger), branchée sur une base
 * de données locale (fichier JSON) au lieu de Google Sheets / Drive.
 *
 * Ainsi Code.gs — le "cerveau" de l'application (règles, hiérarchie, rapports...) — tourne
 * à l'identique sur le serveur, et il n'y a qu'UNE seule logique métier à maintenir.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function creerShim(opts) {
  const dataDir = opts.dataDir;
  const dbFile = path.join(dataDir, 'db.json');
  const uploadsDir = path.join(dataDir, 'uploads');
  const publicUrl = (opts.publicUrl || '').replace(/\/$/, '');
  fs.mkdirSync(uploadsDir, { recursive: true });

  // ---------------- Base de données (feuilles = tableaux de lignes) ----------------
  let db = { version: 1, sheets: {} }; // sheets: { nom: [ [entêtes], [ligne], ... ] }
  if (fs.existsSync(dbFile)) db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  let dirty = false;

  function sauvegarder() {
    if (!dirty) return false;
    const tmp = dbFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, dbFile); // écriture atomique : jamais de fichier à moitié écrit
    dirty = false;
    return true;
  }
  function remplacerBase(nouvelle) { db = nouvelle; dirty = true; sauvegarder(); }

  const norm = v => (v === undefined || v === null) ? '' : (v instanceof Date ? v.toISOString() : v);

  class Plage {
    constructor(rows, r, c, nr, nc) { Object.assign(this, { rows, r, c, nr, nc }); }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = this.rows[this.r - 1 + i] || [];
        const o = [];
        for (let j = 0; j < this.nc; j++) { const v = row[this.c - 1 + j]; o.push(v === undefined ? '' : v); }
        out.push(o);
      }
      return out;
    }
    setValues(vals) {
      vals.forEach((ligne, i) => {
        const idx = this.r - 1 + i;
        while (this.rows.length <= idx) this.rows.push([]);
        const row = this.rows[idx];
        ligne.forEach((v, j) => { while (row.length < this.c - 1 + j) row.push(''); row[this.c - 1 + j] = norm(v); });
      });
      dirty = true;
      return this;
    }
  }
  class Feuille {
    constructor(nom) { this.nom = nom; }
    get rows() { return db.sheets[this.nom]; }
    getLastRow() { return this.rows.length; }
    getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
    appendRow(arr) { this.rows.push(arr.map(norm)); dirty = true; return this; }
    deleteRow(n) { this.rows.splice(n - 1, 1); dirty = true; return this; }
    deleteRows(n, count) { this.rows.splice(n - 1, count); dirty = true; return this; }
    clear() { db.sheets[this.nom] = []; dirty = true; return this; }
    setFrozenRows() { return this; }
    getDataRange() {
      const nc = Math.max(this.getLastColumn(), 1), nr = Math.max(this.getLastRow(), 1);
      return new Plage(this.rows, 1, 1, nr, nc);
    }
    getRange(r, c, nr, nc) { return new Plage(this.rows, r, c, nr || 1, nc || 1); }
  }
  const tableur = {
    getSheetByName(nom) { return db.sheets[nom] ? new Feuille(nom) : null; },
    insertSheet(nom) { if (!db.sheets[nom]) { db.sheets[nom] = []; dirty = true; } return new Feuille(nom); },
    getSheets() { return Object.keys(db.sheets).map(n => new Feuille(n)); }
  };
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => tableur,
    getUi: () => { throw new Error('Interface Google Sheets indisponible sur le serveur.'); }
  };

  // ---------------- Utilities ----------------
  function formatDate(date, tz, fmt) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
    if (parts.hour === '24') parts.hour = '00';
    return fmt.replace('yyyy', parts.year).replace('MM', parts.month).replace('dd', parts.day)
      .replace('HH', parts.hour).replace('mm', parts.minute).replace('ss', parts.second);
  }
  const Utilities = {
    formatDate,
    getUuid: () => crypto.randomUUID(),
    base64Decode: s => Buffer.from(s, 'base64'),
    newBlob: (bytes, mime, nom) => ({ getBytes: () => bytes, getName: () => nom, getContentType: () => mime })
  };

  // ---------------- Drive -> dossier local "uploads" ----------------
  const dossier = {
    createFile(blob) {
      const propre = String(blob.getName() || 'fichier').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
      const nom = crypto.randomBytes(8).toString('hex') + '_' + propre;
      fs.writeFileSync(path.join(uploadsDir, nom), Buffer.from(blob.getBytes()));
      return { setSharing() {}, getUrl: () => publicUrl + '/files/' + encodeURIComponent(nom) };
    },
    getUrl: () => publicUrl + '/files/'
  };
  const DriveApp = {
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' }, Permission: { VIEW: 'VIEW' },
    getFoldersByName: () => ({ hasNext: () => true, next: () => dossier }),
    createFolder: () => dossier,
    getRootFolder: () => dossier
  };

  const ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: txt => ({ _txt: txt, setMimeType() { return this; }, getContent() { return this._txt; } })
  };
  const Logger = { log: (...a) => console.log('[Code.gs]', ...a) };

  return {
    globals: { SpreadsheetApp, Utilities, DriveApp, ContentService, Logger, console },
    sauvegarder, remplacerBase, dbFile, uploadsDir,
    getDb: () => db, markDirty: () => { dirty = true; }, isDirty: () => dirty
  };
}
module.exports = { creerShim };

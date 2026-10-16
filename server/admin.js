/**
 * API d'administration de la base de données (réservée au compte NATIONAL).
 * Permet de consulter, rechercher, modifier, ajouter, supprimer des lignes de chaque table,
 * d'exporter (JSON / Excel / CSV), d'importer, et de gérer les sauvegardes.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let XLSX = null;
try { XLSX = require('xlsx'); } catch (e) { /* export/import Excel indisponibles tant que "npm install" n'a pas été fait */ }

const MASQUES = { Utilisateurs: ['MotDePasse'], Sessions: ['Token'] };

function json(envoyer, res, code, obj) { envoyer(res, code, JSON.stringify(obj)); }

function utilisateurAdmin(req, gs) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  gs('reinitialiserCacheFeuilles_()');
  const u = gs(`getUserByToken_(${JSON.stringify(m[1])})`);
  return u && u.Role === 'NATIONAL' ? u : null;
}

function tableVersObjets(rows) {
  if (!rows.length) return { colonnes: [], lignes: [] };
  const colonnes = rows[0].map(String);
  const lignes = rows.slice(1).map((r, i) => { const o = { _i: i + 1 }; colonnes.forEach((c, j) => { o[c] = r[j] === undefined ? '' : r[j]; }); return o; });
  return { colonnes, lignes };
}

// ---------------- Sauvegardes ----------------
function dossierSauvegardes(dataDir) { const d = path.join(dataDir, 'backups'); fs.mkdirSync(d, { recursive: true }); return d; }
function creerSauvegarde(shim, dataDir, garder) {
  shim.sauvegarder();
  const d = dossierSauvegardes(dataDir);
  const nom = 'db-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19) + '.json';
  fs.copyFileSync(shim.dbFile, path.join(d, nom));
  const tous = fs.readdirSync(d).filter(f => /^db-.*\.json$/.test(f)).sort();
  tous.slice(0, Math.max(0, tous.length - (garder || 30))).forEach(f => fs.unlinkSync(path.join(d, f)));
  return nom;
}
function creerSauvegardeSiAbsente(shim, dataDir, garder) {
  const d = dossierSauvegardes(dataDir), jour = new Date().toISOString().slice(0, 10);
  if (!fs.readdirSync(d).some(f => f.startsWith('db-' + jour))) creerSauvegarde(shim, dataDir, garder);
}
function listeSauvegardes(dataDir) {
  const d = dossierSauvegardes(dataDir);
  return fs.readdirSync(d).filter(f => /^db-.*\.json$/.test(f)).sort().reverse().map(f => ({ nom: f, taille: fs.statSync(path.join(d, f)).size }));
}

// ---------------- Export / import ----------------
function csvEchappe(v) { const s = String(v === undefined || v === null ? '' : v); return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function tableCsv(rows) { return '﻿' + rows.map(r => r.map(csvEchappe).join(';')).join('\r\n'); }

function classeurVersFeuilles(buffer) {
  if (!XLSX) throw new Error('Import Excel indisponible : exécutez "npm install" dans le dossier du serveur.');
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true });
  const sheets = {};
  wb.SheetNames.forEach(n => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
    sheets[n] = rows.filter(r => r.join('') !== '');
  });
  return sheets;
}

async function traiter({ req, res, url, chemin, corps, gs, shim, envoyer, DATA_DIR }) {
  const admin = utilisateurAdmin(req, gs);
  // Téléchargements via lien : le jeton peut aussi être passé en paramètre ?token=
  let adminOk = admin;
  if (!adminOk && url.searchParams.get('token')) {
    gs('reinitialiserCacheFeuilles_()');
    const u = gs(`getUserByToken_(${JSON.stringify(url.searchParams.get('token'))})`);
    if (u && u.Role === 'NATIONAL') adminOk = u;
  }
  if (!adminOk) return json(envoyer, res, 401, { ok: false, error: 'Accès réservé au compte NATIONAL (reconnectez-vous).' });
  const db = shim.getDb();
  const body = () => { try { return JSON.parse(corps.toString('utf8') || '{}'); } catch (e) { return {}; } };
  const feuille = nom => { if (!db.sheets[nom]) throw new Error('Table inconnue : ' + nom); return db.sheets[nom]; };

  try {
    // ---- liste des tables ----
    if (chemin === '/admin-api/tables') {
      const tables = Object.keys(db.sheets).map(n => ({ nom: n, lignes: Math.max(0, db.sheets[n].length - 1), colonnes: (db.sheets[n][0] || []).length }));
      let taille = 0; try { taille = fs.statSync(shim.dbFile).size; } catch (e) {}
      return json(envoyer, res, 200, { ok: true, tables, tailleBase: taille, sauvegardes: listeSauvegardes(DATA_DIR).slice(0, 10), excel: !!XLSX });
    }

    // ---- contenu d'une table (recherche + pagination) ----
    if (chemin === '/admin-api/table') {
      const nom = url.searchParams.get('nom'), q = (url.searchParams.get('q') || '').toLowerCase();
      const offset = Number(url.searchParams.get('offset') || 0), limite = Math.min(Number(url.searchParams.get('limite') || 50), 500);
      const { colonnes, lignes } = tableVersObjets(feuille(nom));
      const masques = MASQUES[nom] || [];
      let filtres = lignes;
      if (q) filtres = lignes.filter(l => colonnes.some(c => !masques.includes(c) && String(l[c]).toLowerCase().includes(q)));
      const page = filtres.slice(offset, offset + limite).map(l => { const o = Object.assign({}, l); masques.forEach(c => { if (o[c] !== '') o[c] = '••••••'; }); return o; });
      return json(envoyer, res, 200, { ok: true, colonnes, total: filtres.length, lignes: page, masques });
    }

    // ---- créer / modifier une ligne ----
    if (chemin === '/admin-api/row' && req.method === 'POST') {
      const { table, index, valeurs } = body();
      const rows = feuille(table);
      const cols = rows[0].map(String);
      const masques = MASQUES[table] || [];
      const convertit = (nouvelle, ancienne) => {
        if (typeof ancienne === 'boolean') return String(nouvelle).toLowerCase() === 'true';
        if (typeof ancienne === 'number' && nouvelle !== '' && !isNaN(Number(nouvelle))) return Number(nouvelle);
        if (nouvelle === 'true' || nouvelle === 'false') return nouvelle === 'true';
        return nouvelle;
      };
      if (index) {
        const ligne = rows[index];
        if (!ligne) throw new Error('Ligne introuvable.');
        cols.forEach((c, j) => {
          if (!(c in valeurs)) return;
          if (masques.includes(c) && (valeurs[c] === '' || valeurs[c] === '••••••')) return; // on garde l'ancien secret
          ligne[j] = convertit(valeurs[c], ligne[j]);
        });
      } else {
        rows.push(cols.map(c => (c in valeurs ? convertit(valeurs[c], undefined) : '')));
      }
      shim.markDirty(); shim.sauvegarder();
      return json(envoyer, res, 200, { ok: true });
    }

    // ---- supprimer une ligne ----
    if (chemin === '/admin-api/delete' && req.method === 'POST') {
      const { table, index } = body();
      const rows = feuille(table);
      if (!index || index < 1 || index >= rows.length) throw new Error('Ligne introuvable.');
      rows.splice(index, 1);
      shim.markDirty(); shim.sauvegarder();
      return json(envoyer, res, 200, { ok: true });
    }

    // ---- exports ----
    if (chemin === '/admin-api/export') {
      const format = url.searchParams.get('format') || 'json', nom = url.searchParams.get('nom');
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'json') return envoyer(res, 200, JSON.stringify({ version: 1, exporteLe: new Date().toISOString(), sheets: db.sheets }), 'application/json', { 'Content-Disposition': `attachment; filename="surveillance-sauvegarde-${stamp}.json"` });
      if (format === 'csv') return envoyer(res, 200, tableCsv(feuille(nom)), 'text/csv; charset=utf-8', { 'Content-Disposition': `attachment; filename="${nom}-${stamp}.csv"` });
      if (format === 'xlsx') {
        if (!XLSX) throw new Error('Export Excel indisponible : exécutez "npm install" dans le dossier du serveur.');
        const wb = XLSX.utils.book_new();
        Object.keys(db.sheets).forEach(n => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(db.sheets[n].length ? db.sheets[n] : [[]]), n.slice(0, 31)));
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return envoyer(res, 200, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { 'Content-Disposition': `attachment; filename="surveillance-donnees-${stamp}.xlsx"` });
      }
      throw new Error('Format inconnu.');
    }

    // ---- import (JSON de sauvegarde ou classeur Excel/Google Sheets .xlsx) : remplace TOUTE la base ----
    if (chemin === '/admin-api/import' && req.method === 'POST') {
      const type = url.searchParams.get('type');
      let sheets;
      if (type === 'xlsx') sheets = classeurVersFeuilles(corps);
      else { const j = JSON.parse(corps.toString('utf8')); sheets = j.sheets; if (!sheets || typeof sheets !== 'object') throw new Error('Fichier de sauvegarde invalide.'); }
      if (!sheets.Utilisateurs || sheets.Utilisateurs.length < 2) throw new Error('Import refusé : la table "Utilisateurs" est absente ou vide.');
      creerSauvegarde(shim, DATA_DIR, 30); // filet de sécurité avant remplacement
      // On conserve les tables existantes non fournies (elles seront recréées vides par ensureSchema_)
      shim.remplacerBase({ version: 1, sheets });
      gs('reinitialiserCacheFeuilles_(); ensureSchema_();'); shim.sauvegarder();
      return json(envoyer, res, 200, { ok: true, tables: Object.keys(sheets).length });
    }

    // ---- sauvegardes ----
    if (chemin === '/admin-api/backup' && req.method === 'POST') return json(envoyer, res, 200, { ok: true, nom: creerSauvegarde(shim, DATA_DIR, 30) });
    if (chemin === '/admin-api/backup-download') {
      const nom = path.basename(url.searchParams.get('nom') || '');
      const f = path.join(dossierSauvegardes(DATA_DIR), nom);
      if (!/^db-.*\.json$/.test(nom) || !fs.existsSync(f)) throw new Error('Sauvegarde introuvable.');
      return envoyer(res, 200, fs.readFileSync(f), 'application/json', { 'Content-Disposition': `attachment; filename="${nom}"` });
    }
    return json(envoyer, res, 404, { ok: false, error: 'Route inconnue.' });
  } catch (e) {
    return json(envoyer, res, 400, { ok: false, error: e.message });
  }
}

module.exports = { traiter, creerSauvegarde, creerSauvegardeSiAbsente };

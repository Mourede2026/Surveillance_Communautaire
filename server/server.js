/**
 * SERVEUR de la plateforme de surveillance communautaire (remplace Google Sheets + Apps Script).
 *
 *   node server/server.js
 *
 * - Exécute Code.gs (logique métier inchangée) avec une base locale (data/db.json) et un dossier
 *   de fichiers (data/uploads) à la place de Google Sheets / Drive.
 * - Sert l'application (HTML/JS), l'API (POST /api), les fichiers joints (/files/...) et l'API
 *   d'administration de la base (/admin-api/..., réservée au compte NATIONAL).
 * - Sauvegarde automatique quotidienne dans data/backups.
 *
 * Variables d'environnement : PORT (3000), DATA_DIR (./data), PUBLIC_URL (URL publique, pour les
 * liens de fichiers), ALLOWED_ORIGIN (*), INITIAL_NATIONAL_PASSWORD (mot de passe du 1er compte
 * NATIONAL), TZ (Africa/Porto-Novo).
 */
'use strict';
process.env.TZ = process.env.TZ || 'Africa/Porto-Novo';
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { creerShim } = require('./appsscript-shim');
const admin = require('./admin');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MAX_BODY = 60 * 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });
const shim = creerShim({ dataDir: DATA_DIR, publicUrl: PUBLIC_URL });

// ---- Chargement de Code.gs dans un contexte isolé ----
const ctx = vm.createContext(Object.assign({ Date, JSON, Math, Object, Array, String, Number, Set, Map, RegExp, Error, Promise, parseInt, parseFloat, isNaN }, shim.globals));
vm.runInContext(fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
const gs = (expr) => vm.runInContext(expr, ctx);

// Schéma + compte NATIONAL initial
gs('reinitialiserCacheFeuilles_(); ensureSchema_();');
if (process.env.INITIAL_NATIONAL_PASSWORD) {
  const u = gs("readSheet_(SHEETS.USERS)");
  if (u.length === 1 && u[0].ID === 'U-NAT-0001' && String(u[0].MotDePasse) === 'national2026') {
    gs(`updateRowById_(SHEETS.USERS, 'U-NAT-0001', { MotDePasse: ${JSON.stringify(process.env.INITIAL_NATIONAL_PASSWORD)} })`);
    console.log('Mot de passe du compte NATIONAL initial défini depuis INITIAL_NATIONAL_PASSWORD.');
  }
}
shim.sauvegarder();

// ---- Appel de l'API (équivalent de doPost) ----
function appelApi(texte) {
  const sortie = vm.runInContext('doPost({ postData: { contents: __body } })', Object.assign(ctx, { __body: texte }));
  const resultat = sortie.getContent();
  shim.sauvegarder();
  return resultat;
}

// ---- Limitation des tentatives de connexion (par IP) ----
const tentatives = new Map();
function loginBloque(ip) {
  const now = Date.now(), t = (tentatives.get(ip) || []).filter(x => now - x < 15 * 60 * 1000);
  tentatives.set(ip, t);
  return t.length >= 30;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8' };
const FICHIER_MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.odt': 'application/vnd.oasis.opendocument.text' };
const BLOQUES = [/^\/Code\.gs$/i, /^\/server(\/|$)/i, /^\/data(\/|$)/i, /^\/\./, /^\/node_modules(\/|$)/i, /^\/package(-lock)?\.json$/i, /^\/Dockerfile$/i, /^\/README\.md$/i];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
function lireCorps(req) {
  return new Promise((resolve, reject) => {
    const morceaux = []; let taille = 0;
    req.on('data', c => { taille += c.length; if (taille > MAX_BODY) { reject(new Error('Requête trop volumineuse.')); req.destroy(); } else morceaux.push(c); });
    req.on('end', () => resolve(Buffer.concat(morceaux)));
    req.on('error', reject);
  });
}
function envoyer(res, code, corps, type, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': type || 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }, extra || {}));
  res.end(corps);
}

const serveur = http.createServer(async (req, res) => {
  cors(res);
  const url = new URL(req.url, 'http://x');
  const chemin = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'OPTIONS') return envoyer(res, 204, '');

    // ---- API principale (même contrat que l'ancien Apps Script) ----
    if (chemin === '/api') {
      if (req.method === 'GET') return envoyer(res, 200, JSON.stringify({ ok: true, message: 'API Surveillance Communautaire - serveur autonome opérationnel' }));
      const texte = (await lireCorps(req)).toString('utf8');
      try {
        const b = JSON.parse(texte || '{}');
        if (b.action === 'login') {
          const ip = req.socket.remoteAddress || '?';
          if (loginBloque(ip)) return envoyer(res, 200, JSON.stringify({ ok: false, error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' }));
          tentatives.get(ip).push(Date.now());
        }
      } catch (e) { /* le JSON invalide sera signalé par doPost */ }
      return envoyer(res, 200, appelApi(texte));
    }

    // ---- Administration de la base ----
    if (chemin.startsWith('/admin-api/')) {
      const corps = req.method === 'POST' ? await lireCorps(req) : Buffer.alloc(0);
      return admin.traiter({ req, res, url, chemin, corps, gs, shim, envoyer, DATA_DIR });
    }

    // ---- Fichiers joints (photos / documents des suivis) ----
    if (chemin.startsWith('/files/')) {
      const nom = path.basename(chemin);
      const f = path.join(shim.uploadsDir, nom);
      if (!fs.existsSync(f)) return envoyer(res, 404, 'Fichier introuvable', 'text/plain');
      const ext = path.extname(nom).toLowerCase();
      const type = FICHIER_MIME[ext];
      return envoyer(res, 200, fs.readFileSync(f), type || 'application/octet-stream', type ? { 'Content-Disposition': 'inline' } : { 'Content-Disposition': 'attachment' });
    }

    // ---- Application (fichiers statiques) ----
    if (req.method !== 'GET' && req.method !== 'HEAD') return envoyer(res, 405, 'Méthode non autorisée', 'text/plain');
    let rel = chemin === '/' ? '/index.html' : chemin;
    if (BLOQUES.some(r => r.test(rel))) return envoyer(res, 404, 'Introuvable', 'text/plain');
    const f = path.normalize(path.join(ROOT, rel));
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return envoyer(res, 404, 'Introuvable', 'text/plain');
    const ext = path.extname(f).toLowerCase();
    if (ext === '.html') {
      // On indique à l'application d'utiliser CE serveur comme API (même origine).
      let html = fs.readFileSync(f, 'utf8');
      html = html.replace(/<head>/i, '<head>\n<script>window.SC_API_URL = "/api"; window.SC_SERVER_MODE = true;</script>');
      return envoyer(res, 200, html, MIME[ext], { 'Cache-Control': 'no-cache' });
    }
    return envoyer(res, 200, fs.readFileSync(f), MIME[ext] || 'application/octet-stream', { 'Cache-Control': ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=3600' });
  } catch (e) {
    console.error('Erreur serveur :', e);
    if (!res.headersSent) envoyer(res, 500, JSON.stringify({ ok: false, error: 'Erreur interne du serveur : ' + e.message }));
  }
});

// ---- Tâches planifiées : sauvegarde quotidienne + rapport hebdomadaire ----
function tacheQuotidienne() {
  try { admin.creerSauvegarde(shim, DATA_DIR, 30); console.log('Sauvegarde quotidienne effectuée.'); } catch (e) { console.error('Sauvegarde échouée :', e); }
  try { gs('reinitialiserCacheFeuilles_(); triggerHebdomadaire_();'); shim.sauvegarder(); } catch (e) { console.error('Rapport hebdomadaire :', e.message); }
}
function planifierQuotidien() {
  const maintenant = new Date(), prochain = new Date(maintenant);
  prochain.setHours(0, 10, 0, 0);
  if (prochain <= maintenant) prochain.setDate(prochain.getDate() + 1);
  setTimeout(() => { tacheQuotidienne(); planifierQuotidien(); }, prochain - maintenant);
}

if (require.main === module) {
  serveur.listen(PORT, () => {
    console.log(`Serveur démarré : http://localhost:${PORT}  (données : ${DATA_DIR})`);
    const u = gs('readSheet_(SHEETS.USERS)');
    if (u.length === 1 && String(u[0].MotDePasse) === 'national2026') console.log('⚠ Compte NATIONAL par défaut (téléphone 61790075 / mot de passe national2026) : CHANGEZ le mot de passe dès la première connexion (Mon compte).');
    admin.creerSauvegardeSiAbsente(shim, DATA_DIR, 30);
    planifierQuotidien();
  });
}
module.exports = { serveur, appelApi, gs, shim };

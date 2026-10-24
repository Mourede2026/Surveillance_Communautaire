/**
 * Mode hors connexion de SIVEC.
 *
 *  - VOLET COMMUNAUTAIRE (RC) : une alerte ou un décès peut être notifié même sans réseau. La notification est
 *    gardée sur le téléphone (IndexedDB, file d'attente) puis envoyée automatiquement, dans l'ordre, dès que la
 *    connexion revient (événement « online », ouverture de l'application, retour au premier plan, minuteur).
 *    Chaque envoi porte un identifiant unique (clientId) : si la réponse du serveur se perd, le renvoi ne crée
 *    jamais de doublon (le serveur reconnaît l'identifiant).
 *  - TOUS LES NIVEAUX : les pages se rouvrent hors connexion avec les dernières données chargées sur l'appareil
 *    (lecture seule). Toute lecture réussie (actions list… / get…) est mémorisée ; sans réseau, la dernière copie
 *    est servie avec la date de mise à jour. Les autres actions (création, modification, suppression…)
 *    demandent une connexion.
 *
 * Ce module enveloppe Api.call : aucune autre page n'a besoin de changer. À charger juste après api.js.
 * Dans le navigateur : window.HorsLigne = { synchroniser, enAttente, rendreFile, ... }.
 */
(function (global) {
  'use strict';
  var ENVOI_DIFFERE = { submitAlerte: 'Alerte', submitDeces: 'Décès', tacheEnregistrerCas: 'Cas', tacheSaisirSuivi: 'Suivi', submitSensibilisation: 'Sensibilisation' };
  var ACTIONS_PUBLIQUES = { login: 1, logout: 1, ping: 1 };
  var CACHE_MAX = 400;
  var DB_NOM = 'sivec-hors-ligne';

  var Api_ = global.Api, Session_ = global.Session;
  var etat = { enCours: false, erreurSession: false, derniereDonnee: null, minuteur: null };

  // ---------- Stockage : IndexedDB (repli : localStorage) ----------
  var idb = null;
  function ouvrir() {
    if (idb) return idb;
    idb = new Promise(function (res, rej) {
      if (!global.indexedDB) return rej(new Error('IndexedDB indisponible'));
      var r = global.indexedDB.open(DB_NOM, 1);
      r.onupgradeneeded = function () {
        var d = r.result; d.createObjectStore('cache', { keyPath: 'k' }); d.createObjectStore('file', { keyPath: 'id' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return idb;
  }
  function tx(store, mode, fn) {
    return ouvrir().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, mode), s = t.objectStore(store), out = fn(s);
        t.oncomplete = function () { res(out && 'result' in out ? out.result : undefined); };
        t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); };
      });
    });
  }
  var LS = global.localStorage;
  function lsLire(cle) { try { return JSON.parse(LS.getItem(cle) || 'null'); } catch (e) { return null; } }
  function lsEcrire(cle, v) { try { LS.setItem(cle, JSON.stringify(v)); } catch (e) { /* plein : on ignore pour le cache */ } }

  var Stock = {
    async cacheGet(k) { try { return await tx('cache', 'readonly', function (s) { return s.get(k); }) || null; } catch (e) { return (lsLire('hl:c:' + k)) || null; } },
    async cachePut(k, data) {
      var ligne = { k: k, data: data, date: Date.now() };
      try { await tx('cache', 'readwrite', function (s) { return s.put(ligne); }); } catch (e) { lsEcrire('hl:c:' + k, ligne); }
    },
    async cacheTout() { try { return await tx('cache', 'readonly', function (s) { return s.getAll(); }) || []; } catch (e) { return []; } },
    async cacheSupprimer(k) { try { await tx('cache', 'readwrite', function (s) { return s.delete(k); }); } catch (e) { /* ignoré */ } },
    async cacheVider() { try { await tx('cache', 'readwrite', function (s) { return s.clear(); }); } catch (e) { /* ignoré */ } },
    async fileAjouter(it) {
      try { await tx('file', 'readwrite', function (s) { return s.put(it); }); }
      catch (e) { var l = lsLire('hl:file') || []; l.push(it); lsEcrire('hl:file', l); }
    },
    async fileTout() {
      try { return await tx('file', 'readonly', function (s) { return s.getAll(); }) || []; } catch (e) { return lsLire('hl:file') || []; }
    },
    async fileMaj(it) {
      try { await tx('file', 'readwrite', function (s) { return s.put(it); }); }
      catch (e) { var l = (lsLire('hl:file') || []).map(function (x) { return x.id === it.id ? it : x; }); lsEcrire('hl:file', l); }
    },
    async fileSupprimer(id) {
      try { await tx('file', 'readwrite', function (s) { return s.delete(id); }); }
      catch (e) { lsEcrire('hl:file', (lsLire('hl:file') || []).filter(function (x) { return x.id !== id; })); }
    }
  };

  // ---------- Utilitaires ----------
  function uuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  }
  function stable(o) {
    if (o === null || typeof o !== 'object') return JSON.stringify(o);
    if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
    return '{' + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(o[k]); }).join(',') + '}';
  }
  function utilisateur() { var u = (Session_.getUser && Session_.getUser()) || {}; return u.ID || ''; }
  function enLigne() { return !(global.navigator && global.navigator.onLine === false); }
  function estLecture(action) { return /^(list|get)[A-Z]/.test(action) && !ACTIONS_PUBLIQUES[action]; }
  function cleCache(action, payload) { return utilisateur() + '|' + action + '|' + stable(payload || {}); }
  function erreurSession(msg) { return /session invalide|expir|reconnectez|non authentifi/i.test(String(msg || '')); }
  function aviser(evt, detail) { try { if (global.dispatchEvent && global.CustomEvent) global.dispatchEvent(new global.CustomEvent(evt, { detail: detail || {} })); } catch (e) { /* ignoré */ } }

  // ---------- Lecture : réseau d'abord, copie locale en secours ----------
  async function lireAvecCache(appel, action, payload) {
    var k = cleCache(action, payload);
    if (enLigne()) {
      try {
        var data = await appel(action, payload);
        Stock.cachePut(k, data).then(purgeSiBesoin); // sans attendre : la réponse n'est jamais retardée
        return data;
      } catch (e) { if (!e || !e.reseau) throw e; }
    }
    var copie = await Stock.cacheGet(k);
    if (!copie) { var err = new Error('Hors connexion : ces données n\'ont pas encore été chargées sur cet appareil. Elles seront disponibles après une première ouverture avec connexion.'); err.horsLigne = true; throw err; }
    if (!etat.derniereDonnee || copie.date < etat.derniereDonnee) etat.derniereDonnee = copie.date;
    majBandeau();
    return Object.assign({}, copie.data, { _horsLigne: true, _cacheLe: copie.date });
  }
  async function purgeSiBesoin() {
    var tout = await Stock.cacheTout(); if (tout.length <= CACHE_MAX) return;
    tout.sort(function (a, b) { return a.date - b.date; });
    for (var i = 0; i < tout.length - CACHE_MAX; i++) await Stock.cacheSupprimer(tout[i].k);
  }

  // ---------- Écriture : envoi différé (RC) ----------
  async function envoyerOuMettreEnFile(appel, action, payload) {
    var p = Object.assign({}, payload);
    if (!p.clientId) p.clientId = uuid();
    if (enLigne()) {
      try { return await appel(action, p); } catch (e) { if (!e || !e.reseau) throw e; }
    }
    p.saisieHorsLigneLe = new Date().toISOString();
    await Stock.fileAjouter({ id: p.clientId, user: utilisateur(), action: action, payload: p, creeLe: Date.now(), statut: 'attente', erreur: '' });
    majBandeau(); aviser('sivec:file');
    return { ok: true, queued: true, horsLigne: true, clientId: p.clientId };
  }

  // ---------- Synchronisation ----------
  async function enAttente() {
    var u = utilisateur(); if (!u) return [];
    return (await Stock.fileTout()).filter(function (i) { return i.user === u; }).sort(function (a, b) { return a.creeLe - b.creeLe; });
  }
  async function synchroniser() {
    if (etat.enCours || !enLigne() || !Session_.getToken || !Session_.getToken() || !utilisateur()) return { envoyes: 0 };
    etat.enCours = true; var envoyes = 0, refuses = 0;
    try {
      var items = (await enAttente()).filter(function (i) { return i.statut !== 'erreur'; });
      etat.erreurSession = false;
      for (var n = 0; n < items.length; n++) {
        var it = items[n];
        try { await appelOriginal(it.action, it.payload); await Stock.fileSupprimer(it.id); envoyes++; }
        catch (e) {
          if (e && e.reseau) break;                                   // réseau perdu : on réessaiera
          if (erreurSession(e && e.message)) { etat.erreurSession = true; break; } // il faut se reconnecter : rien n'est perdu
          it.statut = 'erreur'; it.erreur = (e && e.message) || 'Refusé par le serveur.'; await Stock.fileMaj(it); refuses++;
        }
      }
      if (envoyes && typeof global.toast === 'function') global.toast(envoyes + ' notification(s) enregistrée(s) hors connexion envoyée(s) au serveur.');
      if (refuses && typeof global.toast === 'function') global.toast(refuses + ' envoi(s) refusé(s) par le serveur : voir « Envois en attente ».', true);
    } finally { etat.enCours = false; majBandeau(); aviser('sivec:file'); }
    if (envoyes) aviser('sivec:sync', { envoyes: envoyes });
    return { envoyes: envoyes };
  }

  // ---------- Enveloppe de Api.call ----------
  var appelOriginal = function () { return Promise.reject(new Error('Api indisponible')); };
  if (Api_ && typeof Api_.call === 'function') {
    appelOriginal = Api_.call.bind(Api_);
    Api_.call = async function (action, payload) {
      payload = payload || {};
      if (ENVOI_DIFFERE[action]) return envoyerOuMettreEnFile(appelOriginal, action, payload);
      if (ACTIONS_PUBLIQUES[action]) return appelOriginal(action, payload);
      if (estLecture(action)) return lireAvecCache(appelOriginal, action, payload);
      if (!enLigne()) { var err = new Error('Hors connexion : cette action nécessite une connexion internet.'); err.horsLigne = true; throw err; }
      return appelOriginal(action, payload);
    };
  }
  // À la déconnexion, les données mises en cache sont effacées de l'appareil ; les envois en attente sont conservés.
  if (Session_ && typeof Session_.clear === 'function') {
    var clearOriginal = Session_.clear.bind(Session_);
    Session_.clear = function () { Stock.cacheVider(); return clearOriginal(); };
  }

  // ---------- Interface : bandeau d'état + file d'attente ----------
  function libelleEnvoi(it) {
    var p = it.payload || {};
    if (it.action === 'submitDeces') return '🕯️ Décès — ' + (p.nom || 'sans nom') + (p.villageNom ? ' · ' + p.villageNom : '');
    if (it.action === 'submitSensibilisation') return '📣 Sensibilisation — ' + (p.theme || 'sans thème') + ' · ' + ((Number(p.adultesHommes) || 0) + (Number(p.adultesFemmes) || 0) + (Number(p.enfantsGarcons) || 0) + (Number(p.enfantsFilles) || 0)) + ' personne(s)';
    if (it.action === 'tacheEnregistrerCas') return '🗂️ Cas recensé — ' + (p.date || 'aujourd\'hui');
    if (it.action === 'tacheSaisirSuivi') return '📝 Suivi de cas — ' + (p.jour || 'aujourd\'hui');
    return '🚨 Alerte — ' + (p.typeAlerte || 'événement') + (p.villageNom ? ' · ' + p.villageNom : '');
  }
  function esc(v) { return global.escHtml ? global.escHtml(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dateFr(ms) { try { return new Date(ms).toLocaleString('fr-FR'); } catch (e) { return ''; } }

  async function majBandeau() {
    if (typeof document === 'undefined' || !document.body) return;
    var el = document.getElementById('hlBandeau');
    var liste = await enAttente(), nbAttente = liste.filter(function (i) { return i.statut !== 'erreur'; }).length, nbErreur = liste.length - nbAttente;
    var role = ((Session_.getUser && Session_.getUser()) || {}).Role, estRc = role === 'RC';
    var html = '', classe = '';
    if (!enLigne()) {
      classe = 'hl-hors';
      html = estRc ? '🔌 <b>Hors connexion</b> — vous pouvez continuer à notifier : les envois partiront dès que le réseau revient.' + (nbAttente ? ' <b>' + nbAttente + ' en attente.</b>' : '')
        : '🔌 <b>Hors connexion</b> — consultation des données déjà chargées sur cet appareil' + (etat.derniereDonnee ? ' (mises à jour le ' + dateFr(etat.derniereDonnee) + ')' : '') + '.';
    } else if (etat.erreurSession && nbAttente) {
      classe = 'hl-att';
      html = '🔑 Session expirée : <a href="index.html">reconnectez-vous</a> pour envoyer vos <b>' + nbAttente + '</b> notification(s) en attente (rien n\'est perdu).';
    } else if (nbAttente) {
      classe = 'hl-att';
      html = '⏳ <b>' + nbAttente + '</b> envoi(s) en attente de synchronisation <button type="button" id="hlSync">Envoyer maintenant</button>';
    } else if (nbErreur) {
      classe = 'hl-err';
      html = '⚠ <b>' + nbErreur + '</b> envoi(s) refusé(s) par le serveur — voir « Envois en attente ».';
    }
    if (!html) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'hlBandeau'; document.body.appendChild(el); }
    el.className = classe; el.innerHTML = html;
    var b = document.getElementById('hlSync'); if (b) b.onclick = function () { synchroniser(); };
  }

  async function rendreFile(idConteneur) {
    if (typeof document === 'undefined') return;
    var el = document.getElementById(idConteneur); if (!el) return;
    async function dessiner() {
      var liste = await enAttente();
      if (!liste.length) { el.innerHTML = '<p class="petit">Aucun envoi en attente : tout est synchronisé.</p>'; return; }
      el.innerHTML = '<ul class="hl-liste">' + liste.map(function (it) {
        return '<li class="hl-item hl-' + it.statut + '"><div><b>' + esc(libelleEnvoi(it)) + '</b><div class="petit">Enregistré le ' + esc(dateFr(it.creeLe)) + ' · ' +
          (it.statut === 'erreur' ? '⚠ refusé : ' + esc(it.erreur) : '⏳ en attente d\'envoi') + '</div></div>' +
          '<div class="hl-actions">' + (it.statut === 'erreur' ? '<button type="button" class="btn-secondary btn-mini" data-hl-retry="' + esc(it.id) + '">Réessayer</button>' : '') +
          '<button type="button" class="btn-secondary btn-mini" data-hl-del="' + esc(it.id) + '">Supprimer</button></div></li>';
      }).join('') + '</ul>' + '<button type="button" class="btn-mini" id="hlTout">Synchroniser maintenant</button>';
      var t = document.getElementById('hlTout'); if (t) t.onclick = function () { synchroniser(); };
    }
    el.onclick = async function (e) {
      var r = e.target.closest && e.target.closest('[data-hl-retry]'), d = e.target.closest && e.target.closest('[data-hl-del]');
      if (r) { var it = (await enAttente()).find(function (x) { return x.id === r.dataset.hlRetry; }); if (it) { it.statut = 'attente'; it.erreur = ''; await Stock.fileMaj(it); synchroniser(); dessiner(); } }
      if (d && global.confirm('Supprimer cet envoi ? La notification ne sera PAS transmise.')) { await Stock.fileSupprimer(d.dataset.hlDel); majBandeau(); dessiner(); }
    };
    global.addEventListener('sivec:file', dessiner); dessiner();
  }

  // ---------- Déclencheurs ----------
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('online', function () { majBandeau(); synchroniser(); });
    global.addEventListener('offline', function () { majBandeau(); });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { majBandeau(); synchroniser(); } });
      var demarrer = function () { majBandeau(); setTimeout(synchroniser, 1500); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
    }
    etat.minuteur = setInterval(function () { if (enLigne()) synchroniser(); }, 45000);
  }

  global.HorsLigne = { synchroniser: synchroniser, enAttente: enAttente, rendreFile: rendreFile, majBandeau: majBandeau, _Stock: Stock, _etat: etat, _cleCache: cleCache };
})(typeof window !== 'undefined' ? window : globalThis);

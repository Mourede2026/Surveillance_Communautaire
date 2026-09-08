/**
 * PLATEFORME DE SURVEILLANCE A BASE COMMUNAUTAIRE - BENIN
 * Frontend commun : appel de l'API (backend Google Apps Script), gestion de la session
 * (token + utilisateur connecté, stockés dans localStorage) et petites notifications "toast".
 * Ce fichier est chargé par TOUTES les pages, avant leur script spécifique.
 */

// ============================================================
// CONFIGURATION
// ============================================================

// URL du déploiement "Application Web" du backend Google Apps Script (Code.gs).
// A remplacer par l'URL obtenue après le déploiement (Extensions -> Apps Script -> Déployer ->
// Nouveau déploiement -> Type : Application Web -> Exécuter en tant que : Moi -> Accès : Tout le
// monde). L'URL ressemble à : https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec
const API_URL = 'REMPLACER_PAR_URL_DE_DEPLOIEMENT_APPS_SCRIPT';

// ============================================================
// BORNES DE JOURNÉE (même logique que le backend Code.gs)
// ============================================================
// Utilisées par forms.js, rapport.js et les pages *.html pour déterminer la semaine
// épidémiologique en cours à partir du calendrier importé (comparaison à un intervalle
// [DateDebut, DateFin]) : sans les bornes 00h00/23h59:59.999, la borne de fin (minuit) ferait
// "disparaître" le dernier jour de la semaine dès qu'on dépasse minuit ce jour-là.
function debutJournee_(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function finJournee_(date) { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; }

// ============================================================
// SESSION (token + utilisateur connecté)
// ============================================================

const Session = {
  STORAGE_KEY: 'scb_session',

  // Enregistre le token et l'utilisateur reçus après une connexion réussie.
  setSession(token, user) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ token, user }));
  },

  // Renvoie { token, user } ou null si personne n'est connecté.
  getRaw() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  getToken() {
    const s = this.getRaw();
    return s ? s.token : null;
  },

  getUser() {
    const s = this.getRaw();
    return s ? s.user : null;
  },

  clear() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  // A appeler en haut de chaque page protégée : redirige vers la connexion si personne n'est
  // connecté, ou si le rôle du compte connecté ne fait pas partie de allowedRoles (ex: la page
  // rc.html doit rester réservée aux comptes RC). Renvoie l'utilisateur connecté sinon.
  requireRole(allowedRoles) {
    const s = this.getRaw();
    if (!s || !s.token || !s.user || !allowedRoles.includes(s.user.Role)) {
      this.clear();
      window.location.href = 'index.html';
      throw new Error('Non authentifié ou rôle non autorisé.');
    }
    return s.user;
  }
};

// ============================================================
// APPEL API (backend Google Apps Script)
// ============================================================

const Api = {
  // Appelle une action du backend et renvoie directement les données utiles de la réponse
  // (ex: { users: [...] } pour l'action listUsers), en lançant une erreur si ok=false ou en cas
  // de problème réseau. Le token de la session en cours est joint automatiquement ; les actions
  // publiques (login, ping) fonctionnent aussi sans session active.
  async call(action, payload) {
    if (!API_URL || API_URL.indexOf('REMPLACER_PAR') === 0) {
      throw new Error("L'URL de l'API n'est pas configurée (voir API_URL dans assets/api.js).");
    }
    const token = Session.getToken();
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        // Content-Type "text/plain" (plutôt que "application/json") pour que la requête reste
        // une requête "simple" au sens CORS : cela évite un pré-vol OPTIONS, qu'Apps Script ne
        // sait pas gérer nativement (il n'expose que doGet/doPost), et qui ferait échouer tous
        // les appels depuis un site hébergé ailleurs (ex: GitHub Pages).
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload: payload || {}, token })
      });
    } catch (networkErr) {
      throw new Error('Connexion au serveur impossible. Vérifiez votre connexion internet.');
    }
    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new Error('Réponse du serveur invalide.');
    }
    if (!data || data.ok !== true) {
      throw new Error((data && data.error) || 'Erreur inconnue.');
    }
    return data;
  }
};

// ============================================================
// NOTIFICATIONS "TOAST"
// ============================================================

let __toastTimer = null;

// Affiche un court message temporaire en bas à droite de l'écran. isError=true l'affiche en
// rouge (erreur), sinon en vert (succès/information) — voir les classes .toast* de style.css.
function toast(message, isError) {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'toast show ' + (isError ? 'toast-error' : 'toast-ok');
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
}

/**
 * Client API vers le backend Google Apps Script.
 * IMPORTANT : remplacez APP_SCRIPT_URL par l'URL de votre déploiement
 * "Application Web" Apps Script (voir README.md).
 */
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwOeptVrskLdaYFZj1uRgEtcqPyDxkygzTT0MZ-9arDzEKG47atalYhLaRi4YHnxtRS/exec';

const Api = {
  async call(action, payload) {
    const token = Session.getToken();
    // Content-Type text/plain volontaire : évite le pre-flight CORS (non supporté par Apps Script)
    const res = await fetch(APP_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, token })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Erreur inconnue');
    return data;
  }
};

const Session = {
  KEY_TOKEN: 'sc_token',
  KEY_USER: 'sc_user',
  setSession(token, user) {
    localStorage.setItem(this.KEY_TOKEN, token);
    localStorage.setItem(this.KEY_USER, JSON.stringify(user));
  },
  getToken() { return localStorage.getItem(this.KEY_TOKEN); },
  getUser() {
    try { return JSON.parse(localStorage.getItem(this.KEY_USER)); } catch (e) { return null; }
  },
  clear() {
    localStorage.removeItem(this.KEY_TOKEN);
    localStorage.removeItem(this.KEY_USER);
  },
  requireRole(roles) {
    const u = this.getUser();
    if (!u || !this.getToken()) { window.location.href = 'index.html'; return null; }
    if (roles && !roles.includes(u.Role)) { window.location.href = 'index.html'; return null; }
    return u;
  }
};

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('fr-FR');
}

async function loadWeekPill() {
  const el = document.getElementById('weekPill');
  if (!el) return;
  try {
    const { calendrier } = await Api.call('listCalendrier', {});
    const today = new Date();
    const cur = (calendrier || []).find(r => new Date(r.DateDebut) <= today && today <= new Date(r.DateFin));
    el.textContent = cur ? `Semaine ${cur.SemaineEpi} / ${cur.Annee}` : 'Semaine non calendrier';
  } catch (e) { /* silencieux */ }
}

function toast(msg, isError) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show ' + (isError ? 'toast-error' : 'toast-ok');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

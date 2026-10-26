/**
 * Alerte sonore et notifications en direct — pour TOUS les comptes (RC, ASCQ, PF, RCSE, Département, National).
 *
 *   • 🚨 SIRÈNE (alarme) + vibration : dès qu'un relais communautaire notifie une ALERTE ou un DÉCÈS,
 *     tous ses supérieurs (ASCQ, PF, RCSE, Département, National) l'entendent.
 *   • 🔔 CARILLON discret : nouvelle activité publiée ou modifiée (la cible la reçoit), séance planifiée,
 *     sensibilisation, validation, correction… Chaque nouvelle notification affiche aussi un message.
 *   • Notification du navigateur quand l'onglet est en arrière-plan (si l'utilisateur l'a autorisée).
 *
 * Une app statique (GitHub Pages + Apps Script) ne peut pas recevoir de « push » serveur : la page interroge
 * donc listNotifications toutes les 20 secondes tant qu'elle est ouverte (et immédiatement au retour sur
 * l'onglet ou au retour du réseau). Les notifications déjà présentes à l'ouverture ne sonnent pas.
 *
 * Les navigateurs interdisent le son avant un premier geste de l'utilisateur : un bouton « Son » dans la barre
 * du haut indique l'état (activé / coupé / à activer) et permet de couper ou de réactiver l'alarme ; le choix
 * est mémorisé sur l'appareil.
 *
 * demarrerAlerteSonore([{ intervalMs }])  — à appeler une fois au chargement de la page.
 * demarrerAlerteSonoreNouvellesAlertes([intervalMs]) — ancien nom, conservé.
 */
(function () {
  'use strict';
  var CLE = 'sivec_son_alerte';
  var etat = { demarre: false, ctx: null, vus: null, bouton: null, minuteur: null };

  var URGENT = { ALERTE: '🚨', DECES: '⚰️' };
  function estUrgent(n) { return !!URGENT[n.Type]; }
  function sonActive() { try { return localStorage.getItem(CLE) !== '0'; } catch (e) { return true; } }
  function memoriserSon(v) { try { localStorage.setItem(CLE, v ? '1' : '0'); } catch (e) { /* ignoré */ } }

  // ----------------------------------------------------------------- audio
  function contexte() {
    if (!etat.ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; etat.ctx = new C(); }
    if (etat.ctx.state === 'suspended') { try { etat.ctx.resume(); } catch (e) { /* ignoré */ } }
    return etat.ctx;
  }
  function audioPret() { return !!etat.ctx && etat.ctx.state === 'running'; }

  function note(ctx, type, freq, debut, duree, volume) {
    var osc = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime + debut;
    osc.type = type; osc.frequency.value = freq; osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.setValueAtTime(volume, t + Math.max(0.03, duree - 0.06));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    osc.start(t); osc.stop(t + duree + 0.02);
  }
  /** Alarme : deux tons alternés (type sirène), environ 3,5 secondes. */
  function jouerSirene() {
    var ctx = contexte(); if (!ctx) return;
    for (var i = 0; i < 8; i++) note(ctx, 'square', i % 2 ? 760 : 980, i * 0.44, 0.42, 0.2);
    try { if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 800]); } catch (e) { /* ignoré */ }
  }
  /** Carillon : deux notes douces. */
  function jouerCarillon() {
    var ctx = contexte(); if (!ctx) return;
    note(ctx, 'sine', 660, 0, 0.28, 0.25); note(ctx, 'sine', 880, 0.22, 0.4, 0.25);
    try { if (navigator.vibrate) navigator.vibrate(150); } catch (e) { /* ignoré */ }
  }

  // ----------------------------------------------------------------- bouton « Son »
  function libelleBouton() {
    if (!sonActive()) return '🔕 Son coupé';
    return audioPret() ? '🔔 Son activé' : '🔔 Touchez pour activer le son';
  }
  function majBouton() { if (etat.bouton) { etat.bouton.textContent = libelleBouton(); etat.bouton.setAttribute('aria-pressed', sonActive() ? 'true' : 'false'); } }
  function creerBouton() {
    if (etat.bouton || !document.body) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'btnSonAlerte'; b.className = 'btn-son-alerte'; b.title = 'Alarme sonore des alertes, décès et nouvelles activités';
    b.onclick = function () {
      if (sonActive() && audioPret()) { memoriserSon(false); }                                   // coupe
      else { memoriserSon(true); contexte(); jouerCarillon(); demanderNotifNavigateur(); }        // active + test
      majBouton();
    };
    var zone = document.querySelector('.topbar-right');
    if (zone) zone.insertBefore(b, zone.firstChild);
    else { b.className += ' btn-son-flottant'; document.body.appendChild(b); }
    etat.bouton = b; majBouton();
  }
  function deverrouiller() { contexte(); majBouton(); }

  // ----------------------------------------------------------------- notification du navigateur
  function demanderNotifNavigateur() {
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { /* ignoré */ }
  }
  function notifNavigateur(titre, corps) {
    try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(titre, { body: corps, icon: 'assets/icons/icon-192.png' }); } catch (e) { /* ignoré */ }
  }

  // ----------------------------------------------------------------- sondage
  function court(t) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > 170 ? t.slice(0, 169) + '…' : t; }

  function traiter(nouvelles) {
    var urgentes = nouvelles.filter(estUrgent), autres = nouvelles.filter(function (n) { return !estUrgent(n); });
    var actif = sonActive();
    if (urgentes.length) {
      if (actif) jouerSirene();
      var nbA = urgentes.filter(function (n) { return n.Type === 'ALERTE'; }).length, nbD = urgentes.length - nbA, titre;
      if (urgentes.length === 1) titre = URGENT[urgentes[0].Type] + ' ' + court(urgentes[0].Message);
      else titre = '🚨 ' + (nbA ? nbA + ' nouvelle' + (nbA > 1 ? 's' : '') + ' alerte' + (nbA > 1 ? 's' : '') : '') + (nbA && nbD ? ' et ' : '') +
        (nbD ? nbD + ' nouveau' + (nbD > 1 ? 'x' : '') + ' décès' : '') + ' notifié' + (urgentes.length > 1 ? 's' : '') + ' par des RC.';
      if (typeof toast === 'function') toast(titre);
      notifNavigateur(urgentes.length === 1 ? (urgentes[0].Type === 'DECES' ? 'Nouveau décès communautaire' : 'Nouvelle alerte') : 'Nouvelles alertes', court(urgentes[0].Message));
    } else if (autres.length) {
      if (actif) jouerCarillon();
      var m = autres[0];
      if (typeof toast === 'function') toast('🔔 ' + court(m.Message) + (autres.length > 1 ? ' (+' + (autres.length - 1) + ' autre' + (autres.length > 2 ? 's' : '') + ')' : ''));
      notifNavigateur('SIVEC', court(m.Message));
    }
    // Rafraîchit ce que la page sait rafraîchir sans recharger.
    try { if (nouvelles.some(function (n) { return n.Type === 'ACTIVITE'; }) && typeof window.majBadgeActivites_ === 'function') window.majBadgeActivites_('navActivites'); } catch (e) { /* ignoré */ }
    try { window.dispatchEvent(new CustomEvent('sivec:notifications', { detail: nouvelles })); } catch (e) { /* ignoré */ }
  }

  async function sonder() {
    var r;
    try { r = await Api.call('listNotifications', {}); } catch (e) { return; }          // silencieux : prochain passage
    var liste = (r && r.notifications) || [];
    if (!etat.vus) { etat.vus = {}; liste.forEach(function (n) { etat.vus[n.ID] = true; }); return; }   // base : pas de son à l'ouverture
    var nouvelles = liste.filter(function (n) { return !etat.vus[n.ID]; });
    nouvelles.forEach(function (n) { etat.vus[n.ID] = true; });
    if (nouvelles.length) traiter(nouvelles.slice().reverse());
  }

  function demarrer(opts) {
    if (etat.demarre) return; etat.demarre = true;
    opts = opts || {};
    var lancer = function () {
      creerBouton();
      ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { document.addEventListener(ev, deverrouiller, { passive: true }); });
      sonder();
      etat.minuteur = setInterval(sonder, opts.intervalMs || 20000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) sonder(); });
      window.addEventListener('online', sonder);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer); else lancer();
  }

  window.demarrerAlerteSonore = demarrer;
  window.demarrerAlerteSonoreNouvellesAlertes = function (intervalMs) { demarrer({ intervalMs: intervalMs }); };
  window.__alerteSonore = { sonder: sonder, traiter: traiter, jouerSirene: jouerSirene, jouerCarillon: jouerCarillon, etat: etat, sonActive: sonActive };
})();

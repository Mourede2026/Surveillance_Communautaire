/**
 * Alerte sonore : joue un double bip et affiche un toast dès qu'un RC notifie une NOUVELLE
 * alerte (Type "ALERTE" uniquement — jamais pour un décès, sur demande explicite). Fonctionne
 * par sondage périodique de assets/api.js Api.call('listNotifications', {}) tant que la page
 * reste ouverte (pas de push serveur possible sur une app statique GitHub Pages + Apps Script).
 *
 * demarrerAlerteSonoreNouvellesAlertes([intervalMs]) : à appeler une fois au chargement de la
 * page (ex. tableau de bord ASCQ). intervalMs par défaut : 30 secondes.
 */
let __alerteSonoreDepuis = null;
let __alerteSonoreAudioCtx = null;

function __jouerBipAlerte_() {
  try {
    if (!__alerteSonoreAudioCtx) __alerteSonoreAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = __alerteSonoreAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const bip = (freq, delay) => setTimeout(() => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    }, delay);
    bip(880, 0);
    bip(1046, 250);
  } catch (e) { /* lecture audio non supportée — on n'affiche que le toast */ }
}

async function demarrerAlerteSonoreNouvellesAlertes(intervalMs) {
  __alerteSonoreDepuis = new Date().toISOString();
  setInterval(async () => {
    try {
      const { notifications } = await Api.call('listNotifications', {});
      const seuil = new Date(__alerteSonoreDepuis);
      const nouvelles = (notifications || []).filter(n => n.Type === 'ALERTE' && new Date(n.DateCreation) > seuil);
      __alerteSonoreDepuis = new Date().toISOString();
      if (nouvelles.length) {
        __jouerBipAlerte_();
        toast(`🔔 ${nouvelles.length} nouvelle${nouvelles.length > 1 ? 's' : ''} alerte${nouvelles.length > 1 ? 's' : ''} notifiée${nouvelles.length > 1 ? 's' : ''} par un RC.`);
      }
    } catch (e) { /* silencieux : le sondage réessaiera au prochain intervalle */ }
  }, intervalMs || 30000);
}

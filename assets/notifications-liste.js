/**
 * Liste les notifications du compte connecté (Type, message, date, lu/non lu), avec un bouton
 * pour marquer chacune comme lue individuellement. Utile pour vérifier concrètement ce qu'un
 * compte a reçu (ex. diagnostiquer un cas où les notifications semblent incohérentes).
 *
 * containerId : id de l'élément où injecter la liste.
 */
async function renderNotifications(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const { notifications } = await Api.call('listNotifications', {});
    if (!notifications.length) { el.innerHTML = '<div class="empty-state">Aucune notification pour le moment.</div>'; return; }
    const nonLues = notifications.filter(n => !(n.Lu === true || n.Lu === 'TRUE')).length;
    let html = (nonLues ? `<div style="margin-bottom:10px"><button class="btn-secondary btn-mini" id="toutLuBtn">✔ Tout marquer comme lu (${nonLues})</button></div>` : '') + '<table><thead><tr><th>Type</th><th>Message</th><th>Date</th><th>Statut</th><th></th></tr></thead><tbody>';
    notifications.forEach(n => {
      const lu = n.Lu === true || n.Lu === 'TRUE';
      const TYPES = { ALERTE: '🚨 Alerte', DECES: '🕯️ Décès', INVESTIGATION: '🔎 Investigation', PLANNING: '📅 Suivi groupé', DECES_DECISION: '⚰️ Décès : décision', ACTIVITE: '🔗 Activité' };
      html += `<tr><td>${TYPES[n.Type] || escHtml(n.Type)}</td><td>${escHtml(n.Message)}</td><td>${fmtDate(n.DateCreation)}</td>
        <td><span class="badge ${lu ? 'badge-done' : 'badge-new'}">${lu ? 'Lue' : 'Non lue'}</span></td>
        <td>${lu ? '' : `<button class="btn-secondary" data-mark-read="${n.ID}">Marquer comme lue</button>`}</td></tr>`;
    });
    el.innerHTML = html + '</tbody></table>';
    const tl = el.querySelector('#toutLuBtn');
    if (tl) tl.addEventListener('click', async () => { try { await Api.call('marquerToutesNotificationsLues', {}); renderNotifications(containerId); if (typeof loadDashboard === 'function') loadDashboard(); } catch (e) { toast(e.message, true); } });
    el.querySelectorAll('[data-mark-read]').forEach(b => b.addEventListener('click', async () => {
      try { await Api.call('markNotificationRead', { id: b.dataset.markRead }); renderNotifications(containerId); }
      catch (e) { toast(e.message, true); }
    }));
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement.</div>'; }
}

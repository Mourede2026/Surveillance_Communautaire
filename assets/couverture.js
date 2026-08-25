/**
 * Liste le SITE de chaque subordonné (direct et indirect) de l'utilisateur connecté :
 *  - ASCQ : le village de chacun de ses RC
 *  - PF   : l'arrondissement de chacun de ses ASCQ, et le village de chacun des RC de cet ASCQ
 *  - RCSE : tout — commune de chaque PF, arrondissement de chaque ASCQ, village de chaque RC
 *
 * Les colonnes affichées s'adaptent automatiquement au rôle du compte connecté.
 *
 * containerId : id de l'élément où injecter le composant.
 */
async function renderCouverture(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const role = (Session.getUser() || {}).Role;
    const { couverture } = await Api.call('listCouverture', {});
    el.innerHTML = couvertureTableHtml_(couverture, role);
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement de la couverture.</div>'; }
}

function couvertureTableHtml_(rows, role) {
  if (!rows || !rows.length) return '<div class="empty-state">Aucun subordonné pour le moment.</div>';

  const colonnes = {
    ASCQ: [['rc', 'Relais (RC)'], ['telephoneRc', 'Téléphone'], ['arrondissement', 'Arrondissement'], ['village', 'Village']],
    PF: [['ascq', 'ASCQ'], ['arrondissement', 'Arrondissement'], ['rc', 'Relais (RC)'], ['village', 'Village']],
    RCSE: [['commune', 'Commune'], ['pf', 'PF CCLS-TP'], ['ascq', 'ASCQ'], ['arrondissement', 'Arrondissement'], ['rc', 'Relais (RC)'], ['village', 'Village']]
  }[role] || [];
  if (!colonnes.length) return '';

  let html = `<table><thead><tr>${colonnes.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>`;
  rows.forEach(r => {
    html += `<tr>${colonnes.map(c => `<td>${r[c[0]] || '—'}</td>`).join('')}</tr>`;
  });
  return html + '</tbody></table>';
}

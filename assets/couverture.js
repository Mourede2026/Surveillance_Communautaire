/**
 * Liste le SITE de chaque subordonné (direct et indirect) de l'utilisateur connecté :
 *  - ASCQ : le village de chacun de ses RC
 *  - PF   : l'arrondissement de chacun de ses ASCQ, et le village de chacun des RC de cet ASCQ
 *  - RCSE : tout — commune de chaque PF, arrondissement de chaque ASCQ, village de chaque RC
 *
 * Les colonnes affichées s'adaptent automatiquement au rôle du compte connecté. Pour les
 * subordonnés INDIRECTS qui n'ont pas de tableau de gestion dédié à cet écran (ex. un RC ou un
 * ASCQ vus depuis un RCSE, un PF/ASCQ/RC vus depuis un DEPARTEMENT), un bouton ✏️ permet de
 * corriger directement le compte (nom, téléphone, mot de passe) — voir assets/user-admin.js.
 *
 * containerId : id de l'élément où injecter le composant.
 */
// Colonnes "éditables" (bouton ✏️) selon le rôle : uniquement celles qui n'ont pas déjà leur
// propre tableau de gestion sur l'écran (ex. un PF gère déjà ses ASCQ dans "Mes ASCQ").
const COUVERTURE_EDITABLE = { PF: ['rc'], RCSE: ['ascq', 'rc'], DEPARTEMENT: ['pf', 'ascq', 'rc'] };

async function renderCouverture(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const role = (Session.getUser() || {}).Role;
    const { couverture } = await Api.call('listCouverture', {});
    el.innerHTML = couvertureTableHtml_(couverture, role);
    el.querySelectorAll('[data-edit-col]').forEach(btn => btn.addEventListener('click', () => {
      const r = couverture[Number(btn.dataset.rowIdx)];
      const cle = btn.dataset.editCol;
      const u = {
        ID: r[cle + 'Id'], Nom: r[cle + 'NomChamp'], Prenom: r[cle + 'PrenomChamp'], Telephone: r[cle + 'Telephone'], Role: r[cle + 'Role'],
        DepartementId: r[cle + 'DepartementId'], DepartementNom: r[cle + 'DepartementNom'],
        CommuneId: r[cle + 'CommuneId'], CommuneNom: r[cle + 'CommuneNom'],
        ArrondissementId: r[cle + 'ArrondissementId'], ArrondissementNom: r[cle + 'ArrondissementNom'],
        VillageId: r[cle + 'VillageId'], VillageNom: r[cle + 'VillageNom']
      };
      openEditUserModal(u, () => renderCouverture(containerId));
    }));
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement de la couverture.</div>'; }
}

function couvertureTableHtml_(rows, role) {
  if (!rows || !rows.length) return '<div class="empty-state">Aucun subordonné pour le moment.</div>';

  const colonnes = {
    ASCQ: [['rc', 'Relais (RC)'], ['telephoneRc', 'Téléphone'], ['arrondissement', 'Arrondissement'], ['village', 'Village']],
    PF: [['ascq', 'ASCQ'], ['arrondissement', 'Arrondissement'], ['rc', 'Relais (RC)'], ['village', 'Village']],
    RCSE: [['commune', 'Commune'], ['pf', 'PF CCLS-TP'], ['ascq', 'ASCQ'], ['arrondissement', 'Arrondissement'], ['rc', 'Relais (RC)'], ['village', 'Village']],
    DEPARTEMENT: [['zone', 'Zone sanitaire'], ['commune', 'Commune'], ['pf', 'PF CCLS-TP'], ['ascq', 'ASCQ'], ['arrondissement', 'Arrondissement'], ['rc', 'Relais (RC)'], ['village', 'Village']]
  }[role] || [];
  if (!colonnes.length) return '';
  const editables = COUVERTURE_EDITABLE[role] || [];

  let html = `<table><thead><tr>${colonnes.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>`;
  rows.forEach((r, idx) => {
    html += '<tr>' + colonnes.map(([cle]) => {
      const valeur = r[cle] || '—';
      const editable = editables.includes(cle) && r[cle + 'Id'];
      const bouton = editable
        ? ` <button type="button" class="btn-inline-edit" title="Modifier ce compte" data-edit-col="${cle}" data-row-idx="${idx}">✏️</button>`
        : '';
      return `<td>${valeur}${bouton}</td>`;
    }).join('') + '</tr>';
  });
  return html + '</tbody></table>';
}

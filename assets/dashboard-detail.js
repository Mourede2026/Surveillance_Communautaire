/**
 * Détail géographique des pastilles du tableau de bord ("Alertes", "Décès", "Non
 * investiguées") : liste, par village / arrondissement / commune, les endroits qui ont EU AU
 * MOINS UN CAS (alerte ou décès), avec le décompte correspondant à chaque pastille.
 *
 * Utilisé sur les tableaux de bord ASCQ, PF CCLS-TP et RCSE (le niveau le plus pertinent dépend
 * du compte : un ASCQ verra surtout de l'intérêt à "Villages", un PF/RCSE plutôt à
 * "Arrondissements"/"Communes" — les 3 onglets restent disponibles partout par simplicité).
 *
 * containerId : id de l'élément où injecter le composant.
 */
async function renderDashboardDetail(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const { parVillage, parArrondissement, parCommune } = await Api.call('getDashboardDetail', {});
    const data = { village: parVillage, arrondissement: parArrondissement, commune: parCommune };
    el.innerHTML = `
      <div class="tabs" id="${containerId}Tabs">
        <button class="active" data-niv="village">Villages</button>
        <button data-niv="arrondissement">Arrondissements</button>
        <button data-niv="commune">Communes</button>
      </div>
      <div id="${containerId}Table"></div>
    `;
    const tableEl = document.getElementById(containerId + 'Table');
    function paint(niv) {
      tableEl.innerHTML = dashboardDetailTableHtml_(data[niv], niv);
    }
    document.getElementById(containerId + 'Tabs').querySelectorAll('[data-niv]').forEach(b => b.addEventListener('click', () => {
      document.getElementById(containerId + 'Tabs').querySelectorAll('[data-niv]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      paint(b.dataset.niv);
    }));
    paint('village');
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement du détail.</div>'; }
}

function dashboardDetailTableHtml_(rows, niveau) {
  if (!rows || !rows.length) return '<div class="empty-state">Aucun cas enregistré pour le moment à ce niveau.</div>';
  const colonneLieu = { village: 'Village', arrondissement: 'Arrondissement', commune: 'Commune' }[niveau];
  const colonnesContexte = niveau === 'village'
    ? '<th>Arrondissement</th><th>Commune</th>'
    : (niveau === 'arrondissement' ? '<th>Commune</th>' : '');
  let html = `<table><thead><tr><th>${colonneLieu}</th>${colonnesContexte}<th>Alertes</th><th>Non investiguées</th><th>Décès</th></tr></thead><tbody>`;
  rows.forEach(r => {
    const contexte = niveau === 'village' ? `<td>${r.arrondissement || ''}</td><td>${r.commune || ''}</td>`
      : (niveau === 'arrondissement' ? `<td>${r.commune || ''}</td>` : '');
    html += `<tr><td>${r.nom}</td>${contexte}<td>${r.nbAlertes}</td><td>${r.nbNonInvestiguees}</td><td>${r.nbDeces}</td></tr>`;
  });
  return html + '</tbody></table>';
}

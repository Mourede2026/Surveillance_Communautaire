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
      <div style="margin:8px 0"><button type="button" class="btn-secondary btn-mini" id="${containerId}Xl" title="Télécharger les trois tableaux au format Excel">⬇ Exporter en Excel</button></div>
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
    document.getElementById(containerId + 'Xl').onclick = () => {
      try {
        const u = (window.Session && Session.getUser && Session.getUser()) || {};
        const t = (nom, ctx, rows) => ({ nom, entete: 1, filtre: true, largeurs: [30].concat(ctx.map(() => 26), [11, 18, 11]),
          lignes: [[nom.replace(/s$/, '')].concat(ctx, ['Alertes', 'Non investiguées', 'Décès'])].concat((rows || []).map(r => [r.nom].concat(ctx.map(c => r[c.toLowerCase()] || ''), [r.nbAlertes, r.nbNonInvestiguees, r.nbDeces]))) });
        const feuilles = [
          { nom: 'Informations', sansBordure: true, largeurs: [30, 60], lignes: [
            [{ v: 'SIVEC — Détail géographique des cas', s: 't' }], [],
            [{ v: 'Contenu', s: 'b' }, 'Lieux ayant eu au moins un cas (alerte ou décès), de votre périmètre'],
            [{ v: 'Exporté le', s: 'b' }, new Date().toLocaleString('fr-FR')],
            [{ v: 'Exporté par', s: 'b' }, ((u.Prenom || '') + ' ' + (u.Nom || '')).trim() + (u.Role ? ' (' + u.Role + ')' : '')]] },
          t('Villages', ['Arrondissement', 'Commune'], parVillage), t('Arrondissements', ['Commune'], parArrondissement), t('Communes', [], parCommune)
        ];
        ExportExcel.telecharger('SIVEC_detail_geographique_' + new Date().toISOString().slice(0, 10) + '.xlsx', feuilles);
        toast('Fichier Excel prêt.');
      } catch (err) { toast('Export Excel impossible : ' + err.message, true); }
    };
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

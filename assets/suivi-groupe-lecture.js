/**
 * Synthèse en lecture seule des suivis groupés RC de tous les ASCQ sous l'utilisateur connecté
 * (PF, RCSE, DEPARTEMENT, NATIONAL — la saisie reste réservée à l'ASCQ lui-même, voir le
 * formulaire de assets/ascq.html). Reprend les mêmes données que l'historique de l'ASCQ, avec
 * une colonne ASCQ en plus puisque plusieurs ASCQ sont visibles ici.
 *
 * containerId : id de l'élément où injecter le composant.
 */
async function renderSuivisGroupesLecture(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const { suivis } = await Api.call('listSuivisGroupes', {});
    if (!suivis.length) { el.innerHTML = '<div class="empty-state">Aucun suivi groupé enregistré pour le moment.</div>'; return; }
    let html = '<table><thead><tr><th>Date</th><th>ASCQ</th><th>Arrondissement</th><th>Thèmes</th><th>RC présents</th><th>Photos</th></tr></thead><tbody>';
    suivis.forEach(s => {
      let themes = [], rcNoms = [], photos = [];
      try { themes = JSON.parse(s.Themes || '[]'); } catch (e) {}
      try { rcNoms = JSON.parse(s.RcPresentsNoms || '[]'); } catch (e) {}
      try { photos = JSON.parse(s.PhotosUrls || '[]'); } catch (e) {}
      const themesLabels = themes.map(id => { const m = (typeof BRIEFING_MODULES !== 'undefined') ? BRIEFING_MODULES.find(x => x.id === id) : null; return m ? m.title : id; });
      html += `<tr><td>${fmtDate(s.Date)}</td><td>${s.AscqNom || ''}</td><td>${s.ArrondissementNom || ''}</td>
        <td>${themesLabels.join(', ')}</td><td>${s.NbPresents} — ${rcNoms.join(', ')}</td>
        <td>${photos.map((u, i) => `<a href="${u}" target="_blank">Photo ${i + 1}</a>`).join(' · ')}</td></tr>`;
    });
    el.innerHTML = html + '</tbody></table>';
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement.</div>'; }
}

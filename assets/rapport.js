/**
 * Affiche le rapport hebdomadaire (Support 4) d'un compte (ASCQ, PF ou RCSE) avec :
 * - navigation Précédent / Suivant entre les rapports disponibles (le plus récent par défaut)
 * - un tableau de détail listant uniquement les événements AVÉRÉS (confirmés par l'ASCQ)
 *
 * Un ASCQ qui couvre plusieurs arrondissements reçoit un rapport distinct par arrondissement et
 * par semaine ; le nom de l'arrondissement est alors affiché à côté du numéro de semaine.
 *
 * containerId : id de l'élément où injecter le rapport.
 */
let __rapportState = { weeks: [], index: -1, arrLookup: {} };

async function renderRapportModule(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const [{ rapports }, { geo }] = await Promise.all([Api.call('listRapports', {}), Api.call('listGeo', {})]);
    __rapportState.arrLookup = {};
    (geo.arrondissements || []).forEach(a => __rapportState.arrLookup[a.ID] = a.Nom);
    const weeks = rapports.slice().sort((a, b) =>
      (Number(a.Annee) - Number(b.Annee)) ||
      (Number(a.SemaineEpi) - Number(b.SemaineEpi)) ||
      String(__rapportState.arrLookup[a.ArrondissementId] || '').localeCompare(String(__rapportState.arrLookup[b.ArrondissementId] || ''))
    );
    __rapportState.weeks = weeks;
    if (!weeks.length) {
      el.innerHTML = '<div class="empty-state">Aucun rapport généré pour le moment. Utilisez le bouton ci-dessus pour générer le rapport de la semaine en cours.</div>';
      return;
    }
    __rapportState.index = weeks.length - 1; // le plus récent par défaut
    await paintRapport_(containerId);
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement du rapport.</div>'; }
}

async function paintRapport_(containerId) {
  const el = document.getElementById(containerId);
  const { weeks, index, arrLookup } = __rapportState;
  const r = weeks[index];
  const arrLabel = r.Niveau === 'ASCQ' && r.ArrondissementId ? ` — ${arrLookup[r.ArrondissementId] || r.ArrondissementId}` : '';

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button class="btn-secondary" id="rapPrev" ${index <= 0 ? 'disabled' : ''}>◀ Précédent</button>
      <strong style="font-size:1.05rem">Semaine ${r.SemaineEpi} / ${r.Annee}${arrLabel}</strong>
      <button class="btn-secondary" id="rapNext" ${index >= weeks.length - 1 ? 'disabled' : ''}>Suivant ▶</button>
    </div>
    <p style="font-size:.8rem;color:var(--ink-soft);margin:0 0 14px">
      Ce rapport ne comptabilise que les événements <strong>avérés</strong> (investigation ASCQ confirmant l'événement).
    </p>
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="stat-card"><div class="n">${r.NbAlertesAverees}</div><div class="l">Événements avérés</div></div>
      <div class="stat-card"><div class="n">${r.NbPersonnesTouchees}</div><div class="l">Personnes touchées</div></div>
      <div class="stat-card"><div class="n">${r.NbPersonnesDecedees}</div><div class="l">Personnes décédées</div></div>
      <div class="stat-card"><div class="n">${r.NbAlertesVerifiees24_48h}</div><div class="l">Vérifiées 24-48h</div></div>
    </div>
    <h2 style="font-size:.95rem;margin:0 0 10px;color:var(--teal-900)">Détail des événements avérés de la semaine</h2>
    <div id="rapportDetailTable">Chargement du détail…</div>
  `;
  document.getElementById('rapPrev').onclick = () => { __rapportState.index--; paintRapport_(containerId); };
  document.getElementById('rapNext').onclick = () => { __rapportState.index++; paintRapport_(containerId); };

  const detailEl = document.getElementById('rapportDetailTable');
  try {
    // Pour un rapport de niveau ASCQ, on précise l'arrondissement afin qu'un ASCQ couvrant
    // plusieurs arrondissements ne voie que le détail de celui du rapport affiché.
    const detailPayload = { annee: r.Annee, semaine: r.SemaineEpi };
    if (r.Niveau === 'ASCQ' && r.ArrondissementId) detailPayload.arrondissementId = r.ArrondissementId;
    const { detail } = await Api.call('listRapportDetail', detailPayload);
    if (!detail.length) {
      detailEl.innerHTML = '<div class="empty-state">Aucun événement avéré cette semaine.</div>';
      return;
    }
    let html = '<table><thead><tr><th>Date</th><th>Commune</th><th>Arrondissement</th><th>Village</th><th>Événement</th><th>Nb cas</th><th>Nb décès</th></tr></thead><tbody>';
    detail.forEach(d => {
      html += `<tr><td>${fmtDate(d.date)}</td><td>${d.commune||''}</td><td>${d.arrondissement||''}</td><td>${d.village||''}</td>
        <td>${d.evenement||''}</td><td>${d.nombreCas}</td><td>${d.nombreDeces}</td></tr>`;
    });
    detailEl.innerHTML = html + '</tbody></table>';
  } catch (e) { detailEl.innerHTML = '<div class="empty-state">Erreur de chargement du détail.</div>'; }
}

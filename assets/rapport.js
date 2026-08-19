/**
 * Affiche le rapport hebdomadaire (Support 4) d'un compte (RC, ASCQ, PF ou RCSE) avec :
 * - navigation Précédent / Suivant entre les rapports disponibles (le plus récent par défaut)
 * - un tableau de synthèse par grappe/arrondissement/commune (selon le niveau du compte)
 * - un tableau de détail listant uniquement les événements AVÉRÉS (confirmés par l'ASCQ)
 *
 * Un compte qui couvre plusieurs sites (un RC avec plusieurs grappes, un ASCQ avec plusieurs
 * arrondissements) reçoit un rapport distinct par site et par semaine ; le nom du site est alors
 * affiché à côté du numéro de semaine.
 *
 * containerId : id de l'élément où injecter le rapport.
 */
let __rapportState = { weeks: [], index: -1, arrLookup: {}, grpLookup: {} };

async function renderRapportModule(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const [{ rapports }, { geo }] = await Promise.all([Api.call('listRapports', {}), Api.call('listGeo', {})]);
    __rapportState.arrLookup = {};
    __rapportState.grpLookup = {};
    (geo.arrondissements || []).forEach(a => __rapportState.arrLookup[a.ID] = a.Nom);
    (geo.grappes || []).forEach(g => __rapportState.grpLookup[g.ID] = g.Nom ? `N°${g.Numero} — ${g.Nom}` : `N°${g.Numero}`);
    const weeks = rapports.slice().sort((a, b) =>
      (Number(a.Annee) - Number(b.Annee)) ||
      (Number(a.SemaineEpi) - Number(b.SemaineEpi)) ||
      String(__rapportState.arrLookup[a.ArrondissementId] || __rapportState.grpLookup[a.GrappeId] || '').localeCompare(String(__rapportState.arrLookup[b.ArrondissementId] || __rapportState.grpLookup[b.GrappeId] || ''))
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
  const { weeks, index, arrLookup, grpLookup } = __rapportState;
  const r = weeks[index];
  let siteLabel = '';
  if (r.Niveau === 'ASCQ' && r.ArrondissementId) siteLabel = ` — ${arrLookup[r.ArrondissementId] || r.ArrondissementId}`;
  if (r.Niveau === 'RC' && r.GrappeId) siteLabel = ` — Grappe ${grpLookup[r.GrappeId] || r.GrappeId}`;

  const breakdownTitle = {
    ASCQ: 'Synthèse par grappe',
    PF: 'Synthèse par arrondissement',
    RCSE: 'Synthèse par commune'
  }[r.Niveau];

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button class="btn-secondary" id="rapPrev" ${index <= 0 ? 'disabled' : ''}>◀ Précédent</button>
      <strong style="font-size:1.05rem">Semaine ${r.SemaineEpi} / ${r.Annee}${siteLabel}</strong>
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
    ${breakdownTitle ? `
      <h2 style="font-size:.95rem;margin:0 0 10px;color:var(--teal-900)">${breakdownTitle}</h2>
      <div id="rapportBreakdownTable" style="margin-bottom:20px">Chargement…</div>
    ` : ''}
    <h2 style="font-size:.95rem;margin:0 0 10px;color:var(--teal-900)">Détail des événements avérés de la semaine</h2>
    <div id="rapportDetailTable">Chargement du détail…</div>
  `;
  document.getElementById('rapPrev').onclick = () => { __rapportState.index--; paintRapport_(containerId); };
  document.getElementById('rapNext').onclick = () => { __rapportState.index++; paintRapport_(containerId); };

  // Synthèse groupée (par grappe pour un ASCQ, par arrondissement pour un PF, par commune pour le RCSE).
  if (breakdownTitle) {
    const breakdownEl = document.getElementById('rapportBreakdownTable');
    try {
      const payload = { annee: r.Annee, semaine: r.SemaineEpi };
      if (r.Niveau === 'ASCQ' && r.ArrondissementId) payload.arrondissementId = r.ArrondissementId;
      const { breakdown } = await Api.call('listRapportBreakdown', payload);
      if (!breakdown.length) {
        breakdownEl.innerHTML = '<div class="empty-state">Aucun événement avéré cette semaine.</div>';
      } else {
        let html = '<table><thead><tr><th>Site</th><th>Cas avérés</th><th>Décès</th></tr></thead><tbody>';
        breakdown.forEach(b => { html += `<tr><td>${b.nom}</td><td>${b.cas}</td><td>${b.deces}</td></tr>`; });
        breakdownEl.innerHTML = html + '</tbody></table>';
      }
    } catch (e) { breakdownEl.innerHTML = '<div class="empty-state">Erreur de chargement de la synthèse.</div>'; }
  }

  const detailEl = document.getElementById('rapportDetailTable');
  try {
    // Pour un rapport de niveau ASCQ/RC, on précise l'arrondissement/la grappe afin qu'un compte
    // couvrant plusieurs sites ne voie que le détail de celui du rapport affiché.
    const detailPayload = { annee: r.Annee, semaine: r.SemaineEpi };
    if (r.Niveau === 'ASCQ' && r.ArrondissementId) detailPayload.arrondissementId = r.ArrondissementId;
    if (r.Niveau === 'RC' && r.GrappeId) detailPayload.grappeId = r.GrappeId;
    const { detail } = await Api.call('listRapportDetail', detailPayload);
    if (!detail.length) {
      detailEl.innerHTML = '<div class="empty-state">Aucun événement avéré cette semaine.</div>';
      return;
    }
    let html = '<table><thead><tr><th>Date</th><th>Commune</th><th>Arrondissement</th><th>Village</th><th>Grappe</th><th>Événement</th><th>Nb cas</th><th>Nb décès</th></tr></thead><tbody>';
    detail.forEach(d => {
      html += `<tr><td>${fmtDate(d.date)}</td><td>${d.commune||''}</td><td>${d.arrondissement||''}</td><td>${d.village||''}</td><td>${d.grappe||''}</td>
        <td>${d.evenement||''}</td><td>${d.nombreCas}</td><td>${d.nombreDeces}</td></tr>`;
    });
    detailEl.innerHTML = html + '</tbody></table>';
  } catch (e) { detailEl.innerHTML = '<div class="empty-state">Erreur de chargement du détail.</div>'; }
}

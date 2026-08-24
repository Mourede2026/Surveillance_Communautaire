/**
 * Affiche le rapport hebdomadaire (Support 4) d'un compte (ASCQ, PF ou RCSE) avec :
 * - navigation Précédent / Suivant entre les rapports disponibles
 * - par défaut, le rapport affiché est celui de la SEMAINE ÉPIDÉMIOLOGIQUE PRÉCÉDENTE (la
 *   semaine en cours n'étant pas terminée, elle n'est affichée que si on clique "Suivant")
 * - le détail COMPLET de chaque événement AVÉRÉ (confirmé par l'ASCQ), repris champ par champ
 *   de la fiche officielle "10_BJ_Fiche d'investigation des événements de santé par les ASCQ"
 * - un point des SITES NOTIFICATEURS (les RC/villages à l'origine des cas comptabilisés)
 * - un bas de page avec les noms de l'ASCQ, du PF CCLS-TP et du RCSE responsables
 * - un bouton d'impression / export PDF (impression navigateur, mise en page dédiée)
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
    __rapportState.index = await indexSemainePrecedente_(weeks);
    await paintRapport_(containerId);
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement du rapport.</div>'; }
}

// Détermine l'index (dans `weeks`) du rapport à afficher par défaut : celui de la semaine
// épidémiologique qui précède immédiatement la semaine en cours (le rapport de la semaine en
// cours, non terminée, ne doit pas être affiché par défaut — l'utilisateur peut toujours y
// accéder via "Suivant"). Si ce rapport n'existe pas encore (calendrier absent, tout début
// d'activité...), on retombe sur le rapport le plus récent disponible.
async function indexSemainePrecedente_(weeks) {
  const dernier = weeks.length - 1;
  try {
    const { calendrier } = await Api.call('listCalendrier', {});
    const today = new Date();
    const cur = (calendrier || []).find(r => new Date(r.DateDebut) <= today && today <= new Date(r.DateFin));
    if (!cur) return dernier;
    let anneePrec = Number(cur.Annee), semainePrec = Number(cur.SemaineEpi) - 1;
    if (semainePrec < 1) { anneePrec -= 1; semainePrec = (calendrier.filter(r => Number(r.Annee) === anneePrec).length) || 52; }
    const idx = weeks.findIndex(r => Number(r.Annee) === anneePrec && Number(r.SemaineEpi) === semainePrec);
    return idx >= 0 ? idx : dernier;
  } catch (e) { return dernier; }
}

async function paintRapport_(containerId) {
  const el = document.getElementById(containerId);
  const { weeks, index, arrLookup } = __rapportState;
  const r = weeks[index];
  const arrLabel = r.Niveau === 'ASCQ' && r.ArrondissementId ? ` — ${arrLookup[r.ArrondissementId] || r.ArrondissementId}` : '';

  el.innerHTML = `
    <div class="no-print" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button class="btn-secondary" id="rapPrev" ${index <= 0 ? 'disabled' : ''}>◀ Précédent</button>
      <strong style="font-size:1.05rem">Semaine ${r.SemaineEpi} / ${r.Annee}${arrLabel}</strong>
      <button class="btn-secondary" id="rapNext" ${index >= weeks.length - 1 ? 'disabled' : ''}>Suivant ▶</button>
    </div>
    <div class="no-print" style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn-secondary" id="rapPrint">🖨️ Imprimer / Exporter en PDF</button>
    </div>
    <div id="rapportPrintArea">
      <div class="rap-print-header" style="display:none">
        <h1 style="margin:0 0 2px;font-size:1.15rem">Support 4 — Rapport hebdomadaire de surveillance à base communautaire</h1>
        <p style="margin:0 0 14px;font-size:.85rem">Semaine ${r.SemaineEpi} / ${r.Annee}${arrLabel} — Ministère de la Santé, République du Bénin</p>
      </div>
      <p style="font-size:.8rem;color:var(--ink-soft);margin:0 0 14px">
        Ce rapport comptabilise les événements <strong>avérés</strong> (investigation ASCQ confirmant l'événement) et le détail complet de chacun.
      </p>
      <div class="grid grid-4" style="margin-bottom:18px">
        <div class="stat-card"><div class="n">${r.NbAlertesAverees}</div><div class="l">Événements avérés</div></div>
        <div class="stat-card"><div class="n">${r.NbPersonnesTouchees}</div><div class="l">Personnes touchées</div></div>
        <div class="stat-card"><div class="n">${r.NbPersonnesDecedees}</div><div class="l">Personnes décédées</div></div>
        <div class="stat-card"><div class="n">${r.NbAlertesVerifiees24_48h}</div><div class="l">Vérifiées 24-48h</div></div>
      </div>

      <h2 style="font-size:.95rem;margin:0 0 10px;color:var(--teal-900)">Détail complet des événements avérés de la semaine</h2>
      <div id="rapportDetailFull">Chargement du détail…</div>

      <h2 style="font-size:.95rem;margin:22px 0 10px;color:var(--teal-900)">Point des sites notificateurs</h2>
      <p style="font-size:.8rem;color:var(--ink-soft);margin:0 0 10px">
        Relais Communautaires (villages/grappes) à l'origine des cas comptabilisés dans la synthèse ci-dessus.
      </p>
      <div id="rapportSites">Chargement…</div>

      <div id="rapportFooter" style="margin-top:28px"></div>
    </div>
  `;
  document.getElementById('rapPrev').onclick = () => { __rapportState.index--; paintRapport_(containerId); };
  document.getElementById('rapNext').onclick = () => { __rapportState.index++; paintRapport_(containerId); };
  document.getElementById('rapPrint').onclick = () => window.print();

  const detailEl = document.getElementById('rapportDetailFull');
  const sitesEl = document.getElementById('rapportSites');
  const footerEl = document.getElementById('rapportFooter');
  try {
    // Pour un rapport de niveau ASCQ, on précise l'arrondissement afin qu'un ASCQ couvrant
    // plusieurs arrondissements ne voie que le détail de celui du rapport affiché.
    const detailPayload = { annee: r.Annee, semaine: r.SemaineEpi, niveau: r.Niveau, compteId: r.CompteId };
    if (r.Niveau === 'ASCQ' && r.ArrondissementId) detailPayload.arrondissementId = r.ArrondissementId;
    const { detail, sites, signataires } = await Api.call('listRapportDetail', detailPayload);

    detailEl.innerHTML = detail.length ? detail.map(ficheEvenementHtml_).join('') : '<div class="empty-state">Aucun événement avéré cette semaine.</div>';
    sitesEl.innerHTML = sitesTableHtml_(sites);
    footerEl.innerHTML = footerSignatairesHtml_(signataires);
  } catch (e) {
    detailEl.innerHTML = '<div class="empty-state">Erreur de chargement du détail.</div>';
    sitesEl.innerHTML = '';
  }
}

// Une "fiche" par événement avéré, reprenant les rubriques de la fiche officielle ASCQ.
function ficheEvenementHtml_(d) {
  const champ = (label, val) => `<div class="fe-field"><span class="fe-label">${label}</span><span class="fe-value">${val || '—'}</span></div>`;
  return `
    <div class="card fiche-evenement" style="margin-bottom:14px">
      <h2 style="display:flex;justify-content:space-between;align-items:baseline">
        <span>${d.maladie || 'Événement'}</span>
        <span style="font-size:.78rem;font-weight:600;color:var(--ink-soft)">${fmtDate(d.date)}</span>
      </h2>
      <div class="grid grid-2">
        ${champ('Département de notification', d.departement)}
        ${champ('Zone sanitaire de notification', d.zoneSanitaire)}
        ${champ('Commune concernée', d.commune)}
        ${champ('Arrondissement concerné', d.arrondissement)}
        ${champ('Village concerné', d.village)}
        ${champ('Nom et prénom du relais', d.relais)}
        ${champ('Tél. relais', d.telRelais)}
        ${champ('Nom et prénom de l\'ASCQ', d.ascqNom)}
        ${champ('Tél. ASCQ', d.telAscq)}
        ${champ('Coordonnées GPS', (d.gpsLat || d.gpsLon) ? `${d.gpsLat || ''}, ${d.gpsLon || ''}` : '')}
        ${champ('Événement avéré ?', d.evenementAvere)}
        ${champ('Source d\'information', d.source)}
        ${champ('Maladie / événement concerné', d.maladie)}
        ${champ('Date de survenue', fmtDate(d.dateSurvenue))}
        ${champ('Date de notification', fmtDate(d.dateNotification))}
        ${champ('Date d\'investigation', fmtDate(d.dateInvestigation))}
      </div>
      <div class="fe-longtext"><span class="fe-label">Description de l'événement (signes, symptômes, personnes touchées)</span><p>${d.description || '—'}</p></div>
      <div class="fe-longtext"><span class="fe-label">Circonstances de survenue</span><p>${d.circonstances || '—'}</p></div>
      <div class="grid grid-2" style="margin-top:10px">
        <div><h3 style="font-size:.8rem;margin:0 0 6px">Cas par catégorie (total : ${d.nombreCas || 0})</h3>${categorieTableHtml_(d.casParCategorie)}</div>
        <div><h3 style="font-size:.8rem;margin:0 0 6px">Décès par catégorie (total : ${d.nombreDeces || 0})</h3>${categorieTableHtml_(d.decesParCategorie)}</div>
      </div>
      <div class="fe-longtext" style="margin-top:10px"><span class="fe-label">Synthèse des actions menées</span><p>${d.actions || '—'}</p></div>
    </div>`;
}

function categorieTableHtml_(obj) {
  const entries = Object.entries(obj || {}).filter(([k, v]) => Number(v) > 0);
  if (!entries.length) return '<p style="font-size:.82rem;color:var(--ink-soft)">Aucune donnée renseignée.</p>';
  return `<table><tbody>${entries.map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right;font-weight:700">${v}</td></tr>`).join('')}</tbody></table>`;
}

function sitesTableHtml_(sites) {
  if (!sites || !sites.length) return '<div class="empty-state">Aucun site notificateur pour cette semaine.</div>';
  let html = '<table><thead><tr><th>Relais communautaire</th><th>Téléphone</th><th>Village</th><th>Arrondissement</th><th>Commune</th><th>Nb événements</th><th>Nb cas</th><th>Nb décès</th></tr></thead><tbody>';
  sites.forEach(s => {
    html += `<tr><td>${s.relaisNom || ''}</td><td>${s.telephoneRelais || ''}</td><td>${s.village || ''}</td><td>${s.arrondissement || ''}</td>
      <td>${s.commune || ''}</td><td>${s.nbEvenements}</td><td>${s.nbCas}</td><td>${s.nbDeces}</td></tr>`;
  });
  return html + '</tbody></table>';
}

function footerSignatairesHtml_(sig) {
  sig = sig || {};
  const ligne = (label, val) => `<div style="flex:1;min-width:180px"><div style="font-size:.75rem;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.03em;margin-bottom:26px">${label}</div><div style="border-top:1px solid var(--ink);padding-top:4px;font-size:.85rem;font-weight:600">${val || '—'}</div></div>`;
  return `
    <div style="border-top:2px solid var(--line);padding-top:16px;display:flex;gap:24px;flex-wrap:wrap">
      ${ligne('ASCQ', sig.ascq)}
      ${ligne('Point Focal CCLS-TP', sig.pf)}
      ${ligne('RCSE', sig.rcse)}
    </div>`;
}

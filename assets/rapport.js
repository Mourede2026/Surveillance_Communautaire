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
// Ordre officiel des 8 catégories âge/sexe, identique à la fiche papier ET au formulaire
// d'investigation ASCQ (assets/ascq.html, tableau CAT) — sert à toujours afficher les 8 lignes,
// dans cet ordre, même quand une catégorie est à 0 ou absente du JSON enregistré.
const CATEGORIES_AGE_SEXE = ['0-11 mois masculin', '0-11 mois féminin', '1 à 5 ans masculin', '1 à 5 ans féminin',
  '6 à 15 ans masculin', '6 à 15 ans féminin', '>15 ans masculin', '>15 ans féminin'];

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

// Une "fiche" par événement avéré, REPRODUISANT EXACTEMENT la mise en page de la fiche papier
// officielle "10_BJ_Fiche d'investigation des événements de santé par les ASCQ" : un tableau à
// deux colonnes (rubrique / valeur), une ligne par rubrique, dans le même ordre que le PDF.
function ficheEvenementHtml_(d) {
  const ligne = (label, val) => `<tr><td class="cv-label">${label}</td><td class="cv-value">${val || ''}</td></tr>`;
  const ligneLongue = (label, val) => `<tr><td class="cv-label">${label}</td><td class="cv-value cv-longtext">${(val || '').replace(/\n/g, '<br>')}</td></tr>`;
  const gps = (d.gpsLat || d.gpsLon) ? `${d.gpsLat || ''}, ${d.gpsLon || ''}` : '';

  return `
    <div class="canevas-titre">${d.maladie || 'Événement'} — ${fmtDate(d.date)}</div>
    <table class="canevas-table" style="margin-bottom:22px">
      <tbody>
        ${ligne('Département de notification', d.departement)}
        ${ligne('Zone sanitaire de notification', d.zoneSanitaire)}
        ${ligne('Commune concernée l\'événement', d.commune)}
        ${ligne('Arrondissement concernée l\'événement', d.arrondissement)}
        ${ligne('Village concernée l\'événement', d.village)}
        ${ligne('Nom et prénom du relais', d.relais)}
        ${ligne('Tél relais', d.telRelais)}
        ${ligne('Nom et prénom de l\'ASCQ', d.ascqNom)}
        ${ligne('Tél de l\'ASCQ', d.telAscq)}
        ${ligne('Coordonnées GPS', gps)}
        ${ligne('Evénement avéré ? (Oui/Non)', d.evenementAvere)}
        ${ligne('Source d\'information sur l\'événement', d.source)}
        ${ligne('Maladie/ événement concerné', d.maladie)}
        ${ligneLongue('Décrire l\'événement (signes et symptômes, date de début, les personnes touchées)', d.description)}
        ${ligneLongue('Décrire les circonstances de survenue (comment l\'événement a démarré, notion de voyage etc)', d.circonstances)}
        ${ligne('Date de survenue de l\'événement', fmtDate(d.dateSurvenue))}
        ${ligne('Date de notification de l\'événement avec l\'envoi du formulaire', fmtDate(d.dateNotification))}
        ${ligne('Date de l\'investigation de l\'événement', fmtDate(d.dateInvestigation))}
        <tr><td class="cv-label cv-section" colspan="2">Nombre total de cas de cas</td></tr>
        ${categorieLignesHtml_(d.casParCategorie)}
        <tr><td class="cv-label cv-section" colspan="2">Nombre total de décès</td></tr>
        ${categorieLignesHtml_(d.decesParCategorie)}
        ${ligneLongue('Synthèse des actions menées', d.actions)}
        <tr><td class="cv-label" style="border-bottom:none">Nom et signature des investigateurs</td><td class="cv-value" style="border-bottom:none">&nbsp;</td></tr>
      </tbody>
    </table>`;
}

// Les 8 lignes de catégorie âge/sexe, toujours dans le même ordre que le PDF, à puces (•),
// même quand une catégorie vaut 0 ou est absente des données enregistrées.
function categorieLignesHtml_(obj) {
  obj = obj || {};
  return CATEGORIES_AGE_SEXE.map(cat => `<tr><td class="cv-label cv-puce">${cat}</td><td class="cv-value">${Number(obj[cat]) || 0}</td></tr>`).join('');
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

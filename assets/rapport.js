/**
 * Affiche le rapport hebdomadaire d'un compte (ASCQ, PF ou RCSE), en reproduisant EXACTEMENT la
 * mise en page du canevas officiel "BJ_RAPPORT HEBDOMADAIRE DE LA SURVEILLANCE A BASE
 * COMMUNAUTAIRE" : en-tête (Département / Zone sanitaire / Commune / Arrondissement / Village /
 * Semaine N° du ... au ...), tableau "Synthèse des alertes", tableau "Synthèse des décès
 * communautaires", "Actions menées" et "Nom et signature du rapporteur".
 *
 * Ce rapport s'affiche TOUJOURS, avec des 0 dans les deux tableaux quand rien n'a été notifié
 * cette semaine — jamais un écran vide.
 *
 * En plus du canevas :
 * - navigation Précédent / Suivant entre les semaines disponibles
 * - par défaut, la semaine affichée est celle qui PRÉCÈDE la semaine en cours (non terminée)
 * - un point des SITES NOTIFICATEURS (les RC à l'origine des cas comptabilisés dans ce rapport)
 * - un bouton d'impression / export PDF (impression navigateur, mise en page dédiée)
 *
 * Un ASCQ qui couvre plusieurs arrondissements reçoit un rapport distinct par arrondissement et
 * par semaine : un sélecteur d'arrondissement apparaît alors au-dessus du rapport, et
 * Précédent/Suivant ne navigue qu'entre les semaines de l'arrondissement choisi.
 *
 * containerId : id de l'élément où injecter le rapport.
 */
let __rapportState = { weeks: [], filteredWeeks: [], index: -1, arrLookup: {}, arrondissements: [], selectedArr: null };

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

    // Un ASCQ qui couvre plusieurs arrondissements a un rapport distinct par arrondissement et
    // par semaine : on propose un sélecteur d'arrondissement, et Précédent/Suivant ne navigue
    // plus qu'entre les semaines de l'arrondissement choisi (au lieu d'alterner entre
    // arrondissements d'une même semaine).
    const arrIds = [...new Set(weeks.filter(w => w.Niveau === 'ASCQ' && w.ArrondissementId).map(w => w.ArrondissementId))];
    __rapportState.arrondissements = arrIds
      .map(id => ({ id, nom: __rapportState.arrLookup[id] || id }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
    __rapportState.selectedArr = __rapportState.arrondissements.length ? __rapportState.arrondissements[0].id : null;

    await selectionnerArrondissement_(containerId, __rapportState.selectedArr);
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement du rapport.</div>'; }
}

// (Re)calcule la liste filtrée de semaines pour l'arrondissement choisi (ou toutes les semaines
// si le compte n'est pas un ASCQ multi-arrondissements), puis positionne l'affichage sur la
// semaine précédente au sein de cette liste.
async function selectionnerArrondissement_(containerId, arrId) {
  __rapportState.selectedArr = arrId;
  __rapportState.filteredWeeks = arrId ? __rapportState.weeks.filter(w => w.ArrondissementId === arrId) : __rapportState.weeks;
  __rapportState.index = await indexSemainePrecedente_(__rapportState.filteredWeeks);
  await paintRapport_(containerId);
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
  const { filteredWeeks: weeks, index, arrondissements, selectedArr } = __rapportState;
  const r = weeks[index];

  const selecteurArr = arrondissements.length > 1 ? `
    <div class="no-print" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <label style="font-size:.85rem;font-weight:600;color:var(--ink-soft)">Arrondissement :</label>
      <select id="rapArrSel" style="width:auto">
        ${arrondissements.map(a => `<option value="${a.id}" ${a.id === selectedArr ? 'selected' : ''}>${a.nom}</option>`).join('')}
      </select>
    </div>` : '';

  el.innerHTML = `
    ${selecteurArr}
    <div class="no-print" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button class="btn-secondary" id="rapPrev" ${index <= 0 ? 'disabled' : ''}>◀ Précédent</button>
      <strong style="font-size:1.05rem">Semaine ${r.SemaineEpi} / ${r.Annee}</strong>
      <button class="btn-secondary" id="rapNext" ${index >= weeks.length - 1 ? 'disabled' : ''}>Suivant ▶</button>
    </div>
    <div class="no-print" style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn-secondary" id="rapPrint">🖨️ Imprimer / Exporter en PDF</button>
    </div>
    <div id="rapportPrintArea">
      <div id="rapportCanevas">Chargement…</div>

      <h2 class="no-print" style="font-size:.95rem;margin:22px 0 10px;color:var(--teal-900)">Point des sites notificateurs</h2>
      <p class="no-print" style="font-size:.8rem;color:var(--ink-soft);margin:0 0 10px">
        Relais Communautaires à l'origine des cas comptabilisés dans ce rapport.
      </p>
      <div id="rapportSites" class="no-print">Chargement…</div>
    </div>
  `;
  if (document.getElementById('rapArrSel')) {
    document.getElementById('rapArrSel').onchange = (e) => selectionnerArrondissement_(containerId, e.target.value);
  }
  document.getElementById('rapPrev').onclick = () => { __rapportState.index--; paintRapport_(containerId); };
  document.getElementById('rapNext').onclick = () => { __rapportState.index++; paintRapport_(containerId); };
  document.getElementById('rapPrint').onclick = () => window.print();

  const canevasEl = document.getElementById('rapportCanevas');
  const sitesEl = document.getElementById('rapportSites');
  try {
    // Pour un rapport de niveau ASCQ, on précise l'arrondissement afin qu'un ASCQ couvrant
    // plusieurs arrondissements ne voie que le détail de celui du rapport affiché.
    const detailPayload = { annee: r.Annee, semaine: r.SemaineEpi, niveau: r.Niveau, compteId: r.CompteId };
    if (r.Niveau === 'ASCQ' && r.ArrondissementId) detailPayload.arrondissementId = r.ArrondissementId;
    const [{ detail, sites, signataires }, { calendrier }] = await Promise.all([
      Api.call('listRapportDetail', detailPayload), Api.call('listCalendrier', {})
    ]);
    const semaineCal = (calendrier || []).find(c => Number(c.Annee) === Number(r.Annee) && Number(c.SemaineEpi) === Number(r.SemaineEpi));

    canevasEl.innerHTML = canevasHebdoHtml_(r, detail || [], signataires || {}, semaineCal);
    sitesEl.innerHTML = sitesTableHtml_(sites);
  } catch (e) {
    canevasEl.innerHTML = '<div class="empty-state">Erreur de chargement du rapport.</div>';
    sitesEl.innerHTML = '';
  }
}

// Reproduit EXACTEMENT le canevas officiel "BJ_RAPPORT HEBDOMADAIRE DE LA SURVEILLANCE A BASE
// COMMUNAUTAIRE" : en-tête géo + semaine, tableau "Synthèse des alertes", tableau "Synthèse des
// décès communautaires", "Actions menées", "Nom et signature du rapporteur". Les chiffres
// viennent directement de la ligne RapportsHebdo (r) — donc toujours présents, à 0 s'il n'y a
// rien eu cette semaine (voir ensureRapportsPassesGeneres_ côté backend).
function canevasHebdoHtml_(r, detail, sig, semaineCal) {
  const periode = semaineCal ? `du ${fmtDate(semaineCal.DateDebut)} au ${fmtDate(semaineCal.DateFin)}` : '';
  const actions = [...new Set((detail || []).map(d => d.actions).filter(Boolean))];
  const rapporteur = { ASCQ: sig.ascq, PF: sig.pf, RCSE: sig.rcse }[r.Niveau] || '';
  const ligneEntete = (label, val) => `<span class="ce-entete-champ"><strong>${label} :</strong> ${val || '—'}</span>`;
  const ligneNombre = (label, val) => `<tr><td>${label}</td><td class="ce-nombre">${val || 0}</td></tr>`;

  // Seules les rubriques géographiques pertinentes au niveau du rapport sont affichées : la
  // zone sanitaire est toujours montrée, la commune s'ajoute à partir du PF, l'arrondissement
  // seulement pour l'ASCQ (Département/Village ne s'appliquent à aucun de ces 3 niveaux ici).
  const champsGeo = { RCSE: ['zoneSanitaire'], PF: ['zoneSanitaire', 'commune'], ASCQ: ['zoneSanitaire', 'commune', 'arrondissement'] }[r.Niveau] || ['zoneSanitaire'];
  const labelsGeo = { zoneSanitaire: 'Zone sanitaire', commune: 'Commune', arrondissement: 'Arrondissement' };

  return `
    <div class="canevas-titre">Rapport hebdomadaire de la surveillance à base communautaire</div>
    <div class="canevas-entete">
      ${champsGeo.map(c => ligneEntete(labelsGeo[c], sig[c])).join('')}
      ${ligneEntete('Semaine N°', `${r.SemaineEpi} / ${r.Annee}${periode ? ' — ' + periode : ''}`)}
    </div>

    <table class="canevas-table" style="margin-top:16px">
      <thead><tr><th>Synthèse des alertes</th><th class="ce-nombre">Nombre</th></tr></thead>
      <tbody>
        ${ligneNombre('Nombre total d\'alertes détectées', r.NbAlertesDetectees)}
        ${ligneNombre('Nombre de personnes touchées', r.NbPersonnesTouchees)}
        ${ligneNombre('Nombre de personnes décédées', r.NbPersonnesDecedees)}
        ${ligneNombre('Nombre total d\'alertes vérifiées dans un délai de 24-48h', r.NbAlertesVerifiees24_48h)}
        ${ligneNombre('Nombre total d\'alertes avérées comme événement', r.NbAlertesAverees)}
      </tbody>
    </table>

    <table class="canevas-table" style="margin-top:16px">
      <thead><tr><th>Synthèse des décès communautaires</th><th class="ce-nombre">Nombre</th></tr></thead>
      <tbody>
        ${ligneNombre('Décès maternel', r.DecesMaternel)}
        ${ligneNombre('Décès néonatal (0 à 28 jours)', r.DecesNeonatal)}
        ${ligneNombre('Décès infantile (&lt;1 an ; inclure aussi les décès néonataux)', r.DecesInfantile)}
        ${ligneNombre('Décès infanto-juvénile (0-5ans)', r.DecesInfantoJuvenile)}
        ${ligneNombre('Décès ≥ 5 ans', r.Deces5ansPlus)}
      </tbody>
    </table>

    <table class="canevas-table" style="margin-top:16px">
      <thead><tr><th colspan="2">Actions menées</th></tr></thead>
      <tbody><tr><td class="ce-actions">${actions.length ? actions.map(a => `<p>${(a || '').replace(/\n/g, '<br>')}</p>`).join('') : '<p class="ce-vide">—</p>'}</td></tr></tbody>
    </table>

    <div class="canevas-signature">
      <div class="ce-sig-label">Nom et signature du rapporteur</div>
      <div class="ce-sig-ligne">${rapporteur || '—'}</div>
    </div>`;
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

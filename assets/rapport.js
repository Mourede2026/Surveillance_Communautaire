/**
 * Affiche le rapport hebdomadaire (Support 4) d'un compte (ASCQ, PF ou RCSE) sous la forme
 * d'UNE SEULE FICHE PAR SEMAINE, qui reproduit exactement la mise en page de la fiche officielle
 * "10_BJ_Fiche d'investigation des événements de santé par les ASCQ" (mêmes rubriques, même
 * ordre), mais avec les TOTAUX DE LA SEMAINE dans les rubriques chiffrées. Cette fiche s'affiche
 * TOUJOURS — avec des 0 (et des tirets pour les rubriques textuelles) même si aucune alerte ni
 * aucun décès n'a été avéré cette semaine — jamais un écran vide.
 *
 * En plus de la fiche :
 * - navigation Précédent / Suivant entre les semaines disponibles
 * - par défaut, la semaine affichée est celle qui PRÉCÈDE la semaine en cours (non terminée)
 * - un point des SITES NOTIFICATEURS (les RC à l'origine des cas comptabilisés)
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
// dans cet ordre, même quand une catégorie est à 0 ou absente des données.
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
        <h1 style="margin:0 0 2px;font-size:1.15rem">Rapport hebdomadaire de surveillance à base communautaire</h1>
        <p style="margin:0 0 14px;font-size:.85rem">Semaine ${r.SemaineEpi} / ${r.Annee}${arrLabel} — Ministère de la Santé, République du Bénin</p>
      </div>
      <div id="rapportFicheHebdo">Chargement…</div>

      <h2 style="font-size:.95rem;margin:22px 0 10px;color:var(--teal-900)">Point des sites notificateurs</h2>
      <p style="font-size:.8rem;color:var(--ink-soft);margin:0 0 10px">
        Relais Communautaires à l'origine des cas comptabilisés dans la fiche ci-dessus.
      </p>
      <div id="rapportSites">Chargement…</div>

      <div id="rapportFooter" style="margin-top:28px"></div>
    </div>
  `;
  document.getElementById('rapPrev').onclick = () => { __rapportState.index--; paintRapport_(containerId); };
  document.getElementById('rapNext').onclick = () => { __rapportState.index++; paintRapport_(containerId); };
  document.getElementById('rapPrint').onclick = () => window.print();

  const ficheEl = document.getElementById('rapportFicheHebdo');
  const sitesEl = document.getElementById('rapportSites');
  const footerEl = document.getElementById('rapportFooter');
  try {
    // Pour un rapport de niveau ASCQ, on précise l'arrondissement afin qu'un ASCQ couvrant
    // plusieurs arrondissements ne voie que le détail de celui du rapport affiché.
    const detailPayload = { annee: r.Annee, semaine: r.SemaineEpi, niveau: r.Niveau, compteId: r.CompteId };
    if (r.Niveau === 'ASCQ' && r.ArrondissementId) detailPayload.arrondissementId = r.ArrondissementId;
    const { detail, sites, signataires } = await Api.call('listRapportDetail', detailPayload);

    ficheEl.innerHTML = ficheHebdoHtml_(r, detail || [], sites || [], signataires || {});
    sitesEl.innerHTML = sitesTableHtml_(sites);
    footerEl.innerHTML = footerSignatairesHtml_(signataires);
  } catch (e) {
    ficheEl.innerHTML = '<div class="empty-state">Erreur de chargement du rapport.</div>';
    sitesEl.innerHTML = '';
  }
}

// LA fiche hebdomadaire : une seule, pour toute la semaine, avec les mêmes rubriques et le même
// ordre que la fiche papier officielle — mais les rubriques chiffrées ("Nombre total de cas" /
// "Nombre total de décès") reprennent les TOTAUX DE LA SEMAINE (somme de tous les événements
// avérés), toujours affichés avec des 0 quand il n'y a rien eu. Les rubriques textuelles
// (maladie, description...) résument les événements de la semaine, ou affichent un tiret si
// aucun événement n'a eu lieu.
function ficheHebdoHtml_(r, detail, sites, sig) {
  const ligne = (label, val) => `<tr><td class="cv-label">${label}</td><td class="cv-value">${val || '—'}</td></tr>`;
  const ligneLongue = (label, val) => `<tr><td class="cv-label">${label}</td><td class="cv-value cv-longtext">${(val || '—').toString().replace(/\n/g, '<br>')}</td></tr>`;

  const nbEvenements = detail.length;
  const casTotal = sommeCategories_(detail.map(d => d.casParCategorie));
  const decesTotal = sommeCategories_(detail.map(d => d.decesParCategorie));
  const maladies = [...new Set(detail.map(d => d.maladie).filter(Boolean))];
  const villages = [...new Set(detail.map(d => d.village).filter(Boolean))];
  const actions = [...new Set(detail.map(d => d.actions).filter(Boolean))];
  const dateMin = detail.length ? detail.reduce((m, d) => (d.dateSurvenue && (!m || new Date(d.dateSurvenue) < new Date(m))) ? d.dateSurvenue : m, null) : null;
  const dateMax = detail.length ? detail.reduce((m, d) => (d.dateInvestigation && (!m || new Date(d.dateInvestigation) > new Date(m))) ? d.dateInvestigation : m, null) : null;

  return `
    <div class="canevas-titre">Fiche hebdomadaire — Semaine ${r.SemaineEpi} / ${r.Annee}</div>
    <table class="canevas-table" style="margin-bottom:8px">
      <tbody>
        ${ligne('Département de notification', sig.departement)}
        ${ligne('Zone sanitaire de notification', sig.zoneSanitaire)}
        ${ligne('Commune concernée l\'événement', sig.commune)}
        ${ligne('Arrondissement concernée l\'événement', sig.arrondissement)}
        ${ligne('Village concernée l\'événement', villages.length ? villages.join(', ') : '—')}
        ${ligne('Nom et prénom du relais', sites.length ? `${sites.length} relais notificateur(s) — voir "Point des sites notificateurs"` : '—')}
        ${ligne('Tél relais', '—')}
        ${ligne('Nom et prénom de l\'ASCQ', sig.ascq)}
        ${ligne('Tél de l\'ASCQ', sig.ascqTel)}
        ${ligne('Coordonnées GPS', '—')}
        ${ligne('Evénement avéré ? (Oui/Non)', nbEvenements ? `Oui (${nbEvenements} événement${nbEvenements > 1 ? 's' : ''})` : 'Non')}
        ${ligne('Source d\'information sur l\'événement', '—')}
        ${ligne('Maladie/ événement concerné', maladies.length ? maladies.join(', ') : '—')}
        ${ligneLongue('Décrire l\'événement (signes et symptômes, date de début, les personnes touchées)', detail.map(d => d.description).filter(Boolean).join(' | '))}
        ${ligneLongue('Décrire les circonstances de survenue (comment l\'événement a démarré, notion de voyage etc)', detail.map(d => d.circonstances).filter(Boolean).join(' | '))}
        ${ligne('Date de survenue de l\'événement', dateMin ? fmtDate(dateMin) : '—')}
        ${ligne('Date de notification de l\'événement avec l\'envoi du formulaire', `Semaine ${r.SemaineEpi} / ${r.Annee}`)}
        ${ligne('Date de l\'investigation de l\'événement', dateMax ? fmtDate(dateMax) : '—')}
        <tr><td class="cv-label cv-section" colspan="2">Nombre total de cas de cas</td></tr>
        ${categorieLignesHtml_(casTotal)}
        <tr><td class="cv-label cv-section" colspan="2">Nombre total de décès</td></tr>
        ${categorieLignesHtml_(decesTotal)}
        ${ligneLongue('Synthèse des actions menées', actions.join(' | '))}
        <tr><td class="cv-label" style="border-bottom:none">Nom et signature des investigateurs</td><td class="cv-value" style="border-bottom:none">&nbsp;</td></tr>
      </tbody>
    </table>`;
}

// Additionne, catégorie par catégorie (les 8 du canevas), une liste d'objets casParCategorie /
// decesParCategorie renvoyés pour chaque événement de la semaine. Renvoie un objet avec les 8
// clés toujours présentes (0 par défaut) — même si `objets` est vide (aucun événement).
function sommeCategories_(objets) {
  const total = {};
  CATEGORIES_AGE_SEXE.forEach(cat => { total[cat] = 0; });
  (objets || []).forEach(o => {
    CATEGORIES_AGE_SEXE.forEach(cat => { total[cat] += Number((o || {})[cat]) || 0; });
  });
  return total;
}

// Les 8 lignes de catégorie âge/sexe, toujours dans le même ordre que le PDF, à puces (•),
// même quand une catégorie vaut 0.
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

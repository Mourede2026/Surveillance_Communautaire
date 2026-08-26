/**
 * Affiche le rapport hebdomadaire d'un compte (ASCQ, PF ou RCSE), en reproduisant EXACTEMENT la
 * mise en page du canevas officiel "BJ_RAPPORT HEBDOMADAIRE DE LA SURVEILLANCE A BASE
 * COMMUNAUTAIRE" : en-tête (Zone sanitaire / Commune / Arrondissement selon le niveau / Semaine
 * N° du ... au ...), tableau "Synthèse des alertes", tableau "Synthèse des décès
 * communautaires", "Actions menées" et "Nom et signature du rapporteur".
 *
 * Ce rapport s'affiche TOUJOURS, avec des 0 dans les deux tableaux quand rien n'a été notifié
 * cette semaine — jamais un écran vide.
 *
 * Chaque compte peut consulter le rapport à SON niveau ET à tous les niveaux EN DESSOUS de lui,
 * via des listes déroulantes en cascade :
 *  - ASCQ  : par arrondissement (s'il en couvre plusieurs)
 *  - PF    : toute la commune, ou par arrondissement de sa commune
 *  - RCSE  : toute la zone sanitaire, par commune (= par PF), ou par arrondissement d'une commune
 *
 * En plus du canevas :
 * - navigation Précédent / Suivant entre les semaines disponibles POUR LA PORTÉE choisie
 * - par défaut, la semaine affichée est celle qui PRÉCÈDE la semaine en cours (non terminée)
 * - un point des SITES NOTIFICATEURS (les RC à l'origine des cas comptabilisés dans ce rapport)
 * - un bouton d'impression / export PDF (impression navigateur, mise en page dédiée)
 *
 * containerId : id de l'élément où injecter le rapport.
 */
let __rapportState = {
  role: null, weeks: [], arrLookup: {}, perimetre: null,
  portee: null,             // 'departement' | 'zone' | 'commune' | 'arrondissement'  (ASCQ : toujours 'arrondissement')
  selectedZoneKey: null,     // DEPARTEMENT uniquement : rcseId de la zone sanitaire choisie
  selectedCommuneKey: null,  // RCSE/DEPARTEMENT : pfId de la commune choisie
  selectedArrId: null,
  filteredWeeks: [], index: -1
};

async function renderRapportModule(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const role = (Session.getUser() || {}).Role;
    const calls = [Api.call('listRapports', {}), Api.call('listGeo', {})];
    if (['PF', 'RCSE', 'DEPARTEMENT'].includes(role)) calls.push(Api.call('listPerimetreRapport', {}));
    const [{ rapports }, { geo }, perimetreRes] = await Promise.all(calls);

    __rapportState.role = role;
    __rapportState.arrLookup = {};
    (geo.arrondissements || []).forEach(a => __rapportState.arrLookup[a.ID] = a.Nom);
    __rapportState.perimetre = perimetreRes ? perimetreRes.perimetre : null;
    __rapportState.weeks = rapports.slice().sort((a, b) =>
      (Number(a.Annee) - Number(b.Annee)) || (Number(a.SemaineEpi) - Number(b.SemaineEpi))
    );

    if (!__rapportState.weeks.length) {
      el.innerHTML = '<div class="empty-state">Aucun rapport généré pour le moment. Utilisez le bouton ci-dessus pour générer le rapport de la semaine en cours.</div>';
      return;
    }

    // Portée par défaut à l'ouverture : le niveau du compte lui-même (département/zone pour
    // DEPARTEMENT — celui-ci hérite du niveau zone —, zone pour RCSE, commune pour PF,
    // arrondissement pour ASCQ — seul niveau qu'il possède).
    __rapportState.portee = { DEPARTEMENT: 'departement', RCSE: 'zone', PF: 'commune', ASCQ: 'arrondissement' }[role] || 'zone';
    if (role === 'ASCQ') {
      const arrIds = [...new Set(__rapportState.weeks.filter(w => w.Niveau === 'ASCQ').map(w => w.ArrondissementId))].sort(
        (a, b) => String(__rapportState.arrLookup[a] || '').localeCompare(String(__rapportState.arrLookup[b] || ''))
      );
      __rapportState.selectedArrId = arrIds[0] || null;
    } else if (role === 'RCSE' && __rapportState.perimetre.communes && __rapportState.perimetre.communes.length) {
      __rapportState.selectedCommuneKey = __rapportState.perimetre.communes[0].pfId;
      const arrs = __rapportState.perimetre.communes[0].arrondissements || [];
      __rapportState.selectedArrId = arrs[0] ? arrs[0].id : null;
    } else if (role === 'PF' && __rapportState.perimetre.arrondissements && __rapportState.perimetre.arrondissements.length) {
      __rapportState.selectedArrId = __rapportState.perimetre.arrondissements[0].id;
    } else if (role === 'DEPARTEMENT' && __rapportState.perimetre.zones && __rapportState.perimetre.zones.length) {
      const zone0 = __rapportState.perimetre.zones[0];
      __rapportState.selectedZoneKey = zone0.rcseId;
      const com0 = (zone0.communes || [])[0];
      __rapportState.selectedCommuneKey = com0 ? com0.pfId : null;
      const arr0 = com0 ? (com0.arrondissements || [])[0] : null;
      __rapportState.selectedArrId = arr0 ? arr0.id : null;
    }

    await appliquerPortee_(containerId);
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement du rapport.</div>'; }
}

// Renvoie les semaines (parmi celles renvoyées par listRapports) qui correspondent à la portée
// actuellement choisie (département / zone / commune / arrondissement) et à la sélection en cours.
function weeksPourPortee_() {
  const { role, weeks, portee, selectedZoneKey, selectedCommuneKey, selectedArrId } = __rapportState;
  if (role === 'NATIONAL') return weeks.filter(w => w.Niveau === 'NATIONAL');
  if (role === 'DEPARTEMENT') {
    if (portee === 'departement') return weeks.filter(w => w.Niveau === 'DEPARTEMENT');
    if (portee === 'zone') return weeks.filter(w => w.Niveau === 'RCSE' && w.CompteId === selectedZoneKey);
    if (portee === 'commune') return weeks.filter(w => w.Niveau === 'PF' && w.CompteId === selectedCommuneKey);
    if (portee === 'arrondissement') return weeks.filter(w => w.Niveau === 'ASCQ' && w.ArrondissementId === selectedArrId);
  }
  if (role === 'RCSE') {
    if (portee === 'zone') return weeks.filter(w => w.Niveau === 'RCSE');
    if (portee === 'commune') return weeks.filter(w => w.Niveau === 'PF' && w.CompteId === selectedCommuneKey);
    if (portee === 'arrondissement') return weeks.filter(w => w.Niveau === 'ASCQ' && w.ArrondissementId === selectedArrId);
  }
  if (role === 'PF') {
    if (portee === 'commune') return weeks.filter(w => w.Niveau === 'PF');
    if (portee === 'arrondissement') return weeks.filter(w => w.Niveau === 'ASCQ' && w.ArrondissementId === selectedArrId);
  }
  if (role === 'ASCQ') return weeks.filter(w => w.Niveau === 'ASCQ' && w.ArrondissementId === selectedArrId);
  return weeks;
}

// Recalcule la liste filtrée pour la portée/sélection en cours, se repositionne sur la semaine
// précédente au sein de cette liste, puis repeint.
async function appliquerPortee_(containerId) {
  __rapportState.filteredWeeks = weeksPourPortee_();
  __rapportState.index = __rapportState.filteredWeeks.length ? await indexSemainePrecedente_(__rapportState.filteredWeeks) : -1;
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

// Construit les listes déroulantes en cascade adaptées au rôle du compte connecté.
function selecteurPorteeHtml_() {
  const { role, portee, perimetre, selectedZoneKey, selectedCommuneKey, selectedArrId } = __rapportState;

  if (role === 'ASCQ') {
    const arrIds = [...new Set(__rapportState.weeks.filter(w => w.Niveau === 'ASCQ').map(w => w.ArrondissementId))];
    if (arrIds.length <= 1) return '';
    const arrondissements = arrIds.map(id => ({ id, nom: __rapportState.arrLookup[id] || id })).sort((a, b) => a.nom.localeCompare(b.nom));
    return `
      <div class="no-print rap-selecteurs">
        <label>Arrondissement :</label>
        <select id="rapArrSel">${arrondissements.map(a => `<option value="${a.id}" ${a.id === selectedArrId ? 'selected' : ''}>${a.nom}</option>`).join('')}</select>
      </div>`;
  }

  if (role === 'PF') {
    const arrs = (perimetre && perimetre.arrondissements) || [];
    if (!arrs.length) return '';
    return `
      <div class="no-print rap-selecteurs">
        <label><input type="radio" name="rapPortee" value="commune" ${portee === 'commune' ? 'checked' : ''}> Toute la commune</label>
        <label><input type="radio" name="rapPortee" value="arrondissement" ${portee === 'arrondissement' ? 'checked' : ''}> Par arrondissement</label>
        ${portee === 'arrondissement' ? `<select id="rapArrSel">${arrs.map(a => `<option value="${a.id}" ${a.id === selectedArrId ? 'selected' : ''}>${a.nom}</option>`).join('')}</select>` : ''}
      </div>`;
  }

  if (role === 'RCSE') {
    const communes = (perimetre && perimetre.communes) || [];
    if (!communes.length) return '';
    const communeCourante = communes.find(c => c.pfId === selectedCommuneKey) || communes[0];
    const arrs = communeCourante.arrondissements || [];
    return `
      <div class="no-print rap-selecteurs">
        <label><input type="radio" name="rapPortee" value="zone" ${portee === 'zone' ? 'checked' : ''}> Toute la zone sanitaire</label>
        <label><input type="radio" name="rapPortee" value="commune" ${portee === 'commune' ? 'checked' : ''}> Par commune</label>
        <label><input type="radio" name="rapPortee" value="arrondissement" ${portee === 'arrondissement' ? 'checked' : ''}> Par arrondissement</label>
        ${portee !== 'zone' ? `<select id="rapCommuneSel">${communes.map(c => `<option value="${c.pfId}" ${c.pfId === selectedCommuneKey ? 'selected' : ''}>${c.nom}</option>`).join('')}</select>` : ''}
        ${portee === 'arrondissement' ? `<select id="rapArrSel">${arrs.map(a => `<option value="${a.id}" ${a.id === selectedArrId ? 'selected' : ''}>${a.nom}</option>`).join('')}</select>` : ''}
      </div>`;
  }

  if (role === 'DEPARTEMENT') {
    const zones = (perimetre && perimetre.zones) || [];
    if (!zones.length) return '';
    const zoneCourante = zones.find(z => z.rcseId === selectedZoneKey) || zones[0];
    const communes = zoneCourante.communes || [];
    const communeCourante = communes.find(c => c.pfId === selectedCommuneKey) || communes[0] || { arrondissements: [] };
    const arrs = communeCourante.arrondissements || [];
    return `
      <div class="no-print rap-selecteurs">
        <label><input type="radio" name="rapPortee" value="departement" ${portee === 'departement' ? 'checked' : ''}> Tout le département</label>
        <label><input type="radio" name="rapPortee" value="zone" ${portee === 'zone' ? 'checked' : ''}> Par zone sanitaire</label>
        <label><input type="radio" name="rapPortee" value="commune" ${portee === 'commune' ? 'checked' : ''}> Par commune</label>
        <label><input type="radio" name="rapPortee" value="arrondissement" ${portee === 'arrondissement' ? 'checked' : ''}> Par arrondissement</label>
        ${portee !== 'departement' ? `<select id="rapZoneSel">${zones.map(z => `<option value="${z.rcseId}" ${z.rcseId === selectedZoneKey ? 'selected' : ''}>${z.nom}</option>`).join('')}</select>` : ''}
        ${(portee === 'commune' || portee === 'arrondissement') ? `<select id="rapCommuneSel">${communes.map(c => `<option value="${c.pfId}" ${c.pfId === selectedCommuneKey ? 'selected' : ''}>${c.nom}</option>`).join('')}</select>` : ''}
        ${portee === 'arrondissement' ? `<select id="rapArrSel">${arrs.map(a => `<option value="${a.id}" ${a.id === selectedArrId ? 'selected' : ''}>${a.nom}</option>`).join('')}</select>` : ''}
      </div>`;
  }

  return '';
}

function cablerSelecteurPortee_(containerId) {
  document.querySelectorAll('input[name="rapPortee"]').forEach(r => r.addEventListener('change', (e) => {
    __rapportState.portee = e.target.value;
    // En changeant de portée, on repart sur la première zone/commune/arrondissement disponible.
    if (__rapportState.role === 'RCSE' && __rapportState.perimetre.communes.length) {
      __rapportState.selectedCommuneKey = __rapportState.perimetre.communes[0].pfId;
      const arrs = __rapportState.perimetre.communes[0].arrondissements || [];
      __rapportState.selectedArrId = arrs[0] ? arrs[0].id : null;
    } else if (__rapportState.role === 'PF' && __rapportState.perimetre.arrondissements.length) {
      __rapportState.selectedArrId = __rapportState.perimetre.arrondissements[0].id;
    } else if (__rapportState.role === 'DEPARTEMENT' && __rapportState.perimetre.zones.length) {
      const zone0 = __rapportState.perimetre.zones[0];
      __rapportState.selectedZoneKey = zone0.rcseId;
      const com0 = (zone0.communes || [])[0];
      __rapportState.selectedCommuneKey = com0 ? com0.pfId : null;
      const arr0 = com0 ? (com0.arrondissements || [])[0] : null;
      __rapportState.selectedArrId = arr0 ? arr0.id : null;
    }
    appliquerPortee_(containerId);
  }));
  const zoneSel = document.getElementById('rapZoneSel');
  if (zoneSel) zoneSel.onchange = (e) => {
    __rapportState.selectedZoneKey = e.target.value;
    const zone = __rapportState.perimetre.zones.find(z => z.rcseId === e.target.value);
    const com0 = (zone && zone.communes || [])[0];
    __rapportState.selectedCommuneKey = com0 ? com0.pfId : null;
    const arr0 = com0 ? (com0.arrondissements || [])[0] : null;
    __rapportState.selectedArrId = arr0 ? arr0.id : null;
    appliquerPortee_(containerId);
  };
  const communeSel = document.getElementById('rapCommuneSel');
  if (communeSel) communeSel.onchange = (e) => {
    __rapportState.selectedCommuneKey = e.target.value;
    const communes = __rapportState.role === 'DEPARTEMENT'
      ? (__rapportState.perimetre.zones.find(z => z.rcseId === __rapportState.selectedZoneKey) || {}).communes
      : __rapportState.perimetre.communes;
    const commune = (communes || []).find(c => c.pfId === e.target.value);
    const arrs = (commune && commune.arrondissements) || [];
    __rapportState.selectedArrId = arrs[0] ? arrs[0].id : null;
    appliquerPortee_(containerId);
  };
  const arrSel = document.getElementById('rapArrSel');
  if (arrSel) arrSel.onchange = (e) => { __rapportState.selectedArrId = e.target.value; appliquerPortee_(containerId); };
}

async function paintRapport_(containerId) {
  const el = document.getElementById(containerId);
  const { filteredWeeks: weeks, index } = __rapportState;

  if (!weeks.length || index < 0) {
    el.innerHTML = `${selecteurPorteeHtml_()}<div class="empty-state">Aucun rapport disponible pour cette sélection.</div>`;
    cablerSelecteurPortee_(containerId);
    return;
  }
  const r = weeks[index];

  el.innerHTML = `
    ${selecteurPorteeHtml_()}
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
  cablerSelecteurPortee_(containerId);
  document.getElementById('rapPrev').onclick = () => { __rapportState.index--; paintRapport_(containerId); };
  document.getElementById('rapNext').onclick = () => { __rapportState.index++; paintRapport_(containerId); };
  document.getElementById('rapPrint').onclick = () => window.print();

  const canevasEl = document.getElementById('rapportCanevas');
  const sitesEl = document.getElementById('rapportSites');
  try {
    // On précise toujours niveau/compteId/arrondissementId de la ligne affichée : le backend
    // s'en sert pour calculer le détail exactement à cette portée (voir listRapportDetail_),
    // même quand elle est en dessous du niveau propre de l'utilisateur connecté.
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
  const rapporteur = { ASCQ: sig.ascq, PF: sig.pf, RCSE: sig.rcse, DEPARTEMENT: sig.departementResp }[r.Niveau] || '';
  const ligneEntete = (label, val) => `<span class="ce-entete-champ"><strong>${label} :</strong> ${val || '—'}</span>`;
  const ligneNombre = (label, val) => `<tr><td>${label}</td><td class="ce-nombre">${val || 0}</td></tr>`;

  // Seules les rubriques géographiques pertinentes au niveau DE LA LIGNE AFFICHÉE sont montrées
  // (et non du rôle de l'utilisateur connecté) : la zone sanitaire est toujours affichée, la
  // commune s'ajoute à partir du niveau PF, l'arrondissement au niveau ASCQ.
  const champsGeo = { DEPARTEMENT: ['departement'], RCSE: ['zoneSanitaire'], PF: ['zoneSanitaire', 'commune'], ASCQ: ['zoneSanitaire', 'commune', 'arrondissement'] }[r.Niveau] || ['zoneSanitaire'];
  const labelsGeo = { departement: 'Département', zoneSanitaire: 'Zone sanitaire', commune: 'Commune', arrondissement: 'Arrondissement' };

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

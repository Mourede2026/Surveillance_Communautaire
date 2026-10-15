/**
 * Espace ASCQ — « Suivi groupé RC » :
 *   • Planning   : planifier un suivi groupé (visible par PF, RCSE, Département, National) ;
 *   • Compte rendu : enregistrer un suivi réalisé (village -> RC présents, photo(s) et/ou
 *                    document(s) du rapport) ;
 *   • Historique : suivis réalisés.
 * Dépend de : api.js (Api, toast, fmtDate, escHtml), briefing-data.js (BRIEFING_MODULES),
 * suivi-groupe-lecture.js (jsonArr_, themesLabels_, piecesLiensHtml_, statutPlanningBadge_...).
 */
(function () {
  const $ = id => document.getElementById(id);
  const aujourdhui = () => new Date().toISOString().slice(0, 10);

  // ------------------------------------------------------------------
  // Données : RC de l'ASCQ et villages couverts (village d'origine + villages de leurs grappes)
  // ------------------------------------------------------------------
  let donnees = null; // { rcs: [{id, nom, villageIds}], villages: {id: nom} }

  async function chargerDonnees(force) {
    if (donnees && !force) return donnees;
    const [ru, rg, rgeo] = await Promise.all([Api.call('listUsers', {}), Api.call('listGrappesRc', {}), Api.call('listGeo', {})]);
    const grappeVillage = {}, villages = {};
    (rgeo.geo.grappes || []).forEach(g => { grappeVillage[g.ID] = g.VillageId; });
    (rgeo.geo.villages || []).forEach(v => { villages[v.ID] = v.Nom; });
    const rcs = (ru.users || []).filter(u => u.Role === 'RC').map(u => {
      const ids = [];
      if (u.VillageId) ids.push(u.VillageId);
      (rg.perimetres || []).filter(p => p.UserId === u.ID).forEach(p => { const v = grappeVillage[p.CibleId]; if (v && !ids.includes(v)) ids.push(v); });
      if (u.VillageId && !villages[u.VillageId]) villages[u.VillageId] = u.VillageNom || u.VillageId;
      return { id: u.ID, nom: (u.Prenom + ' ' + u.Nom).trim(), tel: u.Telephone || '', villageIds: ids };
    });
    donnees = { rcs, villages };
    return donnees;
  }

  // ------------------------------------------------------------------
  // Sélecteur « village -> relais communautaires à cocher »
  // La sélection est conservée quand on change de village (une séance peut réunir des RC de
  // plusieurs villages) ; le récapitulatif en dessous liste tous les RC cochés.
  // ------------------------------------------------------------------
  function creerSelecteur(containerId) {
    const el = $(containerId);
    const selection = new Map(); // rcId -> villageId d'où il a été coché
    let villageCourant = '';

    el.classList.add('rc-picker');
    el.innerHTML = `
      <div class="rc-picker-head">
        <div class="field"><label>Village de couverture</label><select class="rcp-village"></select></div>
        <button type="button" class="btn-secondary btn-mini rcp-tout">Tout cocher</button>
        <button type="button" class="btn-secondary btn-mini rcp-rien">Tout décocher</button>
      </div>
      <div class="rc-liste rcp-liste"><div class="empty-hint">Chargement…</div></div>
      <div class="rc-resume rcp-resume"></div>`;
    const selVillage = el.querySelector('.rcp-village'), liste = el.querySelector('.rcp-liste'), resume = el.querySelector('.rcp-resume');

    function rcsDuVillage() { return donnees.rcs.filter(r => r.villageIds.includes(villageCourant)); }

    function dessinerListe() {
      if (!villageCourant) { liste.innerHTML = '<div class="empty-hint">Choisissez un village pour voir ses relais communautaires.</div>'; return; }
      const rcs = rcsDuVillage();
      if (!rcs.length) { liste.innerHTML = '<div class="empty-hint">Aucun RC dans ce village.</div>'; return; }
      liste.innerHTML = rcs.map(r => `<label><input type="checkbox" value="${escHtml(r.id)}" ${selection.has(r.id) ? 'checked' : ''}> ${escHtml(r.nom)}${r.tel ? ' <span style="color:var(--ink-soft)">· ' + escHtml(r.tel) + '</span>' : ''}</label>`).join('');
    }
    function dessinerResume() {
      if (!selection.size) { resume.textContent = 'Aucun RC coché pour le moment.'; return; }
      const parVillage = {};
      selection.forEach((vid, rid) => { const rc = donnees.rcs.find(r => r.id === rid); if (rc) (parVillage[vid] = parVillage[vid] || []).push(rc.nom); });
      resume.innerHTML = `<strong>${selection.size} RC coché(s)</strong><br>` + Object.keys(parVillage).map(vid => `${escHtml(donnees.villages[vid] || vid)} : ${escHtml(parVillage[vid].join(', '))}`).join('<br>');
    }

    selVillage.addEventListener('change', () => { villageCourant = selVillage.value; dessinerListe(); });
    liste.addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      if (e.target.checked) selection.set(e.target.value, villageCourant); else selection.delete(e.target.value);
      dessinerResume();
    });
    el.querySelector('.rcp-tout').onclick = () => { rcsDuVillage().forEach(r => selection.set(r.id, villageCourant)); dessinerListe(); dessinerResume(); };
    el.querySelector('.rcp-rien').onclick = () => { rcsDuVillage().forEach(r => selection.delete(r.id)); dessinerListe(); dessinerResume(); };

    return {
      async init() {
        try {
          await chargerDonnees();
          const ids = Object.keys(donnees.villages).filter(id => donnees.rcs.some(r => r.villageIds.includes(id)));
          ids.sort((a, b) => donnees.villages[a].localeCompare(donnees.villages[b], 'fr'));
          if (!donnees.rcs.length) { selVillage.innerHTML = '<option value="">Aucun RC créé pour le moment</option>'; liste.innerHTML = ''; dessinerResume(); return; }
          selVillage.innerHTML = '<option value="">— Choisir un village —</option>' + ids.map(id => `<option value="${escHtml(id)}">${escHtml(donnees.villages[id])} (${donnees.rcs.filter(r => r.villageIds.includes(id)).length} RC)</option>`).join('');
          if (!villageCourant && ids.length === 1) { villageCourant = ids[0]; selVillage.value = villageCourant; }
          dessinerListe(); dessinerResume();
        } catch (e) { liste.innerHTML = '<div class="empty-hint">Erreur de chargement des RC : ' + escHtml(e.message) + '</div>'; }
      },
      ids: () => [...selection.keys()],
      villageIds: () => [...new Set(selection.values())],
      // Remplace la sélection (ex. pré-remplissage depuis une séance planifiée)
      set(rcIds, villageIdsPrefs) {
        selection.clear();
        (rcIds || []).forEach(id => {
          const rc = donnees.rcs.find(r => r.id === id); if (!rc) return;
          selection.set(id, (villageIdsPrefs || []).find(v => rc.villageIds.includes(v)) || rc.villageIds[0] || '');
        });
        dessinerListe(); dessinerResume();
      },
      reset() { selection.clear(); dessinerListe(); dessinerResume(); }
    };
  }

  // ------------------------------------------------------------------
  // Pièces jointes : photos (redimensionnées) et documents (PDF, Word, Excel, texte)
  // ------------------------------------------------------------------
  const DOC_MIME = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', odt: 'application/vnd.oasis.opendocument.text', txt: 'text/plain' };
  const DOC_MAX_OCTETS = 5 * 1024 * 1024;

  function lireDataUrl(file) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = () => reject(new Error('Lecture du fichier impossible.')); r.readAsDataURL(file); });
  }
  async function redimensionnerPhoto(file, maxDim) {
    const src = await lireDataUrl(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) { const k = Math.min(maxDim / width, maxDim / height); width = Math.round(width * k); height = Math.round(height * k); }
        const c = document.createElement('canvas'); c.width = width; c.height = height;
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => reject(new Error('Image illisible : ' + file.name));
      img.src = src;
    });
  }
  async function lireDocument(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mime = DOC_MIME[ext];
    if (!mime) throw new Error('Format non accepté : ' + file.name + ' (PDF, Word, Excel ou texte).');
    if (file.size > DOC_MAX_OCTETS) throw new Error(file.name + ' dépasse 5 Mo.');
    const url = await lireDataUrl(file);
    return { name: file.name, mime, dataUrl: url.replace(/^data:[^;,]*;base64,/, 'data:' + mime + ';base64,') };
  }

  // ------------------------------------------------------------------
  // Initialisation (appelée quand l'onglet « Suivi groupé RC » s'ouvre)
  // ------------------------------------------------------------------
  let initFait = false, pickerSuivi, pickerPlan, photos = [], documents = [], planningLie = null, planningsCache = [];

  function remplirThemes(containerId, name) {
    const el = $(containerId);
    if (typeof BRIEFING_MODULES !== 'undefined' && !el.dataset.rempli) {
      el.innerHTML = BRIEFING_MODULES.map(m => `<label><input type="checkbox" name="${name}" value="${escHtml(m.id)}"> ${m.icon} ${escHtml(m.title)}</label>`).join('');
      el.dataset.rempli = '1';
    }
  }

  function afficherSousOnglet(nom) {
    document.querySelectorAll('[data-suivi-sub]').forEach(b => b.classList.toggle('active', b.dataset.suiviSub === nom));
    ['planning', 'compte', 'historique'].forEach(n => { $('suiviSub-' + n).style.display = n === nom ? 'block' : 'none'; });
    if (nom === 'planning') chargerPlannings();
    if (nom === 'historique') chargerHistorique();
  }

  function apercuFichiers() {
    $('suiviFichiersApercu').innerHTML =
      photos.map(src => `<img src="${src}" alt="photo">`).join('') +
      documents.map(d => `<span class="doc-chip">📄 ${escHtml(d.name)}</span>`).join('');
  }

  function majBandeauPlanning() {
    const b = $('suiviBandeauPlanning');
    if (!planningLie) { b.style.display = 'none'; return; }
    b.style.display = 'flex';
    b.innerHTML = `<span>📅 Compte rendu de la séance planifiée du <strong>${fmtDate(planningLie.DatePrevue)}</strong> (${escHtml(jsonArr_(planningLie.VillageNoms).join(', '))}).</span>
      <button type="button" class="btn-secondary btn-mini" id="suiviDetacher">Séance non planifiée</button>`;
    $('suiviDetacher').onclick = () => { planningLie = null; majBandeauPlanning(); };
  }

  window.initSuiviGroupeAscq = async function () {
    if (!initFait) {
      initFait = true;
      remplirThemes('suiviThemes', 'themes');
      remplirThemes('planThemes', 'planThemes');
      pickerSuivi = creerSelecteur('suiviRcPicker');
      pickerPlan = creerSelecteur('planRcPicker');
      $('suiviDate').value = aujourdhui();
      $('planDate').value = aujourdhui();
      $('planDate').min = aujourdhui();
      document.querySelectorAll('[data-suivi-sub]').forEach(b => b.addEventListener('click', () => afficherSousOnglet(b.dataset.suiviSub)));

      $('suiviPhotos').addEventListener('change', async e => {
        $('suiviFichiersApercu').innerHTML = 'Traitement des photos…';
        try { photos = await Promise.all([...e.target.files].map(f => redimensionnerPhoto(f, 900))); }
        catch (err) { toast(err.message, true); photos = []; }
        apercuFichiers();
      });
      $('suiviDocs').addEventListener('change', async e => {
        try { documents = await Promise.all([...e.target.files].map(lireDocument)); }
        catch (err) { toast(err.message, true); documents = []; e.target.value = ''; }
        apercuFichiers();
      });

      $('formSuivi').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData($('formSuivi'));
        const themes = fd.getAll('themes'), rcPresentsIds = pickerSuivi.ids();
        if (!themes.length) { toast('Sélectionnez au moins un thème abordé.', true); return; }
        if (!rcPresentsIds.length) { toast('Cochez au moins un RC présent (choisissez un village, puis cochez ses RC).', true); return; }
        if (!photos.length && !documents.length) { toast('Ajoutez au moins une photo ou un document du rapport de suivi.', true); return; }
        const btn = $('formSuivi').querySelector('button[type=submit]'); btn.disabled = true;
        try {
          await Api.call('submitSuiviGroupe', {
            date: fd.get('date'), themes, rcPresentsIds, villageIds: pickerSuivi.villageIds(),
            photos, fichiers: documents, commentaires: fd.get('commentaires') || '',
            planningId: planningLie ? planningLie.ID : undefined
          });
          toast('Suivi groupé enregistré.');
          $('formSuivi').reset(); $('suiviDate').value = aujourdhui();
          photos = []; documents = []; planningLie = null; apercuFichiers(); majBandeauPlanning(); pickerSuivi.reset();
          afficherSousOnglet('historique');
        } catch (err) { toast(err.message, true); }
        btn.disabled = false;
      });

      $('formPlanning').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData($('formPlanning'));
        if (!pickerPlan.ids().length) { toast('Cochez au moins un RC à convoquer (choisissez un village, puis cochez ses RC).', true); return; }
        const btn = $('formPlanning').querySelector('button[type=submit]'); btn.disabled = true;
        try {
          await Api.call('submitPlanningSuivi', {
            datePrevue: fd.get('datePrevue'), heure: fd.get('heure') || '', lieu: fd.get('lieu') || '', objectif: fd.get('objectif') || '',
            themes: fd.getAll('planThemes'), rcConviesIds: pickerPlan.ids(), villageIds: pickerPlan.villageIds()
          });
          toast('Suivi groupé planifié. Votre hiérarchie en est informée.');
          $('formPlanning').reset(); $('planDate').value = aujourdhui(); pickerPlan.reset();
          chargerPlannings();
        } catch (err) { toast(err.message, true); }
        btn.disabled = false;
      });

      $('planningTable').addEventListener('click', async e => {
        const b = e.target.closest('button[data-plan]'); if (!b) return;
        const plan = planningsCache.find(p => p.ID === b.dataset.id); if (!plan) return;
        if (b.dataset.plan === 'rapport') {
          planningLie = plan;
          afficherSousOnglet('compte');
          await chargerDonnees();
          $('suiviDate').value = String(plan.DatePrevue) > aujourdhui() ? aujourdhui() : plan.DatePrevue;
          document.querySelectorAll('#suiviThemes input').forEach(i => { i.checked = jsonArr_(plan.Themes).includes(i.value); });
          pickerSuivi.set(jsonArr_(plan.RcConviesIds), jsonArr_(plan.VillageIds));
          majBandeauPlanning();
          $('suiviBandeauPlanning').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          try {
            await Api.call('updatePlanningSuivi', { id: plan.ID, statut: b.dataset.plan === 'annuler' ? 'Annulé' : 'Planifié' });
            toast(b.dataset.plan === 'annuler' ? 'Séance annulée.' : 'Séance réactivée.');
            chargerPlannings();
          } catch (err) { toast(err.message, true); }
        }
      });
    }
    afficherSousOnglet('planning');
    pickerSuivi.init(); pickerPlan.init();
  };

  async function chargerPlannings() {
    const el = $('planningTable');
    el.innerHTML = 'Chargement…';
    try {
      const { plannings } = await Api.call('listPlanningsSuivis', {});
      planningsCache = plannings;
      if (!plannings.length) { el.innerHTML = '<div class="empty-state">Aucun suivi groupé planifié.</div>'; return; }
      const ordre = p => (p.Statut === 'Planifié' ? 0 : 1);
      let html = '<div class="table-wrap"><table><thead><tr><th>Date prévue</th><th>Village(s)</th><th>RC convoqués</th><th>Lieu / objectif</th><th>Statut</th><th></th></tr></thead><tbody>';
      plannings.slice().sort((a, b) => ordre(a) - ordre(b) || String(a.DatePrevue).localeCompare(String(b.DatePrevue))).forEach(p => {
        let actions = '';
        if (p.Statut === 'Planifié') actions = `<button class="btn-mini" data-plan="rapport" data-id="${escHtml(p.ID)}">Faire le compte rendu</button> <button class="btn-secondary btn-mini" data-plan="annuler" data-id="${escHtml(p.ID)}">Annuler</button>`;
        else if (p.Statut === 'Annulé') actions = `<button class="btn-secondary btn-mini" data-plan="reactiver" data-id="${escHtml(p.ID)}">Réactiver</button>`;
        html += `<tr><td>${planningQuandHtml_(p)}</td><td>${escHtml(jsonArr_(p.VillageNoms).join(', '))}</td><td>${escHtml(jsonArr_(p.RcConviesNoms).join(', '))}</td>
          <td>${escHtml([p.Lieu, p.Objectif].filter(Boolean).join(' — '))}</td><td>${statutPlanningBadge_(p)}</td><td style="white-space:nowrap">${actions}</td></tr>`;
      });
      el.innerHTML = html + '</tbody></table></div>';
    } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement : ' + escHtml(e.message) + '</div>'; }
  }

  async function chargerHistorique() {
    const el = $('suiviTable');
    el.innerHTML = 'Chargement…';
    try {
      const { suivis } = await Api.call('listSuivisGroupes', {});
      if (!suivis.length) { el.innerHTML = '<div class="empty-state">Aucun suivi groupé enregistré pour le moment.</div>'; return; }
      let html = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Village(s)</th><th>Thèmes</th><th>RC présents</th><th>Rapport (photos / documents)</th></tr></thead><tbody>';
      suivis.forEach(s => {
        html += `<tr><td>${fmtDate(s.Date)}</td><td>${escHtml(jsonArr_(s.VillageNoms).join(', '))}</td><td>${escHtml(themesLabels_(jsonArr_(s.Themes)).join(', '))}</td>
          <td>${s.NbPresents} — ${escHtml(jsonArr_(s.RcPresentsNoms).join(', '))}</td><td>${piecesLiensHtml_(s)}</td></tr>`;
      });
      el.innerHTML = html + '</tbody></table></div>';
    } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement : ' + escHtml(e.message) + '</div>'; }
  }
})();

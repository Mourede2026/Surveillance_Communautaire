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
  // Sélecteur « villages -> relais communautaires à cocher »
  // On peut cocher UN SEUL village ou PLUSIEURS à la fois : les RC de chaque village coché
  // s'affichent par groupe, et la sélection des RC est conservée quand on (dé)coche des villages.
  // ------------------------------------------------------------------
  function creerSelecteur(containerId, options) {
    const autoCocher = !!(options && options.autoCocher); // planning : cocher un village convoque tous ses RC (décochables)
    const el = $(containerId);
    const rcSel = new Set();      // RC cochés
    const villagesSel = new Set(); // villages affichés (cochés dans le filtre)

    el.classList.add('rc-picker');
    el.innerHTML = `
      <div class="rcp-bloc-titre">1. Village(s) concerné(s) <span class="rcp-aide">— un seul ou plusieurs</span></div>
      <div class="rcp-actions">
        <input type="search" class="rcp-recherche" placeholder="Rechercher un village…" style="flex:1;min-width:160px">
        <button type="button" class="btn-secondary btn-mini rcp-v-tous">Tous</button>
        <button type="button" class="btn-secondary btn-mini rcp-v-aucun">Aucun</button>
      </div>
      <div class="rcp-villages"></div>
      <div class="rcp-bloc-titre" style="margin-top:12px">2. Relais communautaires à cocher</div>
      <div class="rc-liste rcp-liste"><div class="empty-hint">Chargement…</div></div>
      <div class="rc-resume rcp-resume"></div>`;
    const zoneVillages = el.querySelector('.rcp-villages'), liste = el.querySelector('.rcp-liste'), resume = el.querySelector('.rcp-resume'), recherche = el.querySelector('.rcp-recherche');
    let villageIds = [];

    const rcsDe = vid => donnees.rcs.filter(r => r.villageIds.includes(vid));

    function dessinerVillages() {
      const q = recherche.value.trim().toLowerCase();
      const visibles = villageIds.filter(id => !q || donnees.villages[id].toLowerCase().includes(q));
      zoneVillages.innerHTML = visibles.length ? visibles.map(id => `<label class="rcp-village-chip ${villagesSel.has(id) ? 'on' : ''}"><input type="checkbox" value="${escHtml(id)}" ${villagesSel.has(id) ? 'checked' : ''}> ${escHtml(donnees.villages[id])} <small>(${rcsDe(id).length} RC)</small></label>`).join('') : '<div class="empty-hint">Aucun village.</div>';
    }
    function dessinerListe() {
      if (!villagesSel.size) { liste.innerHTML = '<div class="empty-hint">Cochez un ou plusieurs villages pour voir leurs relais communautaires.</div>'; return; }
      liste.innerHTML = [...villagesSel].sort((a, b) => donnees.villages[a].localeCompare(donnees.villages[b], 'fr')).map(vid => {
        const rcs = rcsDe(vid);
        return `<div class="rcp-groupe"><div class="rcp-groupe-titre"><strong>${escHtml(donnees.villages[vid])}</strong>
          <span><button type="button" class="btn-secondary btn-mini" data-g="tout" data-v="${escHtml(vid)}">Tout cocher</button> <button type="button" class="btn-secondary btn-mini" data-g="rien" data-v="${escHtml(vid)}">Tout décocher</button></span></div>` +
          (rcs.length ? rcs.map(r => `<label><input type="checkbox" value="${escHtml(r.id)}" ${rcSel.has(r.id) ? 'checked' : ''}> ${escHtml(r.nom)}${r.tel ? ' <span style="color:var(--ink-soft)">· ' + escHtml(r.tel) + '</span>' : ''}</label>`).join('') : '<div class="empty-hint">Aucun RC dans ce village.</div>') + '</div>';
      }).join('');
    }
    function dessinerResume() {
      resume.innerHTML = rcSel.size ? `<strong>${rcSel.size} RC coché(s)</strong> dans ${villagesConcernes().length} village(s) : ` + escHtml([...rcSel].map(id => (donnees.rcs.find(r => r.id === id) || {}).nom).filter(Boolean).join(', ')) : 'Aucun RC coché pour le moment.';
    }
    // Villages cochés qui contiennent au moins un RC coché
    function villagesConcernes() { return [...villagesSel].filter(v => rcsDe(v).some(r => rcSel.has(r.id))); }
    function tout() { dessinerVillages(); dessinerListe(); dessinerResume(); }

    zoneVillages.addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      if (e.target.checked) { villagesSel.add(e.target.value); if (autoCocher) rcsDe(e.target.value).forEach(r => rcSel.add(r.id)); }
      else {
        villagesSel.delete(e.target.value);
        if (autoCocher) [...rcSel].forEach(id => { const rc = donnees.rcs.find(r => r.id === id); if (rc && !rc.villageIds.some(v => villagesSel.has(v))) rcSel.delete(id); });
      }
      e.target.closest('label').classList.toggle('on', e.target.checked);
      dessinerListe(); dessinerResume();
    });
    recherche.addEventListener('input', dessinerVillages);
    el.querySelector('.rcp-v-tous').onclick = () => { villageIds.forEach(id => { villagesSel.add(id); if (autoCocher) rcsDe(id).forEach(r => rcSel.add(r.id)); }); tout(); };
    el.querySelector('.rcp-v-aucun').onclick = () => { villagesSel.clear(); if (autoCocher) rcSel.clear(); tout(); };
    liste.addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      if (e.target.checked) rcSel.add(e.target.value); else rcSel.delete(e.target.value);
      // un RC peut figurer dans plusieurs villages : on synchronise toutes ses cases
      liste.querySelectorAll(`input[value="${CSS.escape(e.target.value)}"]`).forEach(c => { c.checked = e.target.checked; });
      dessinerResume();
    });
    liste.addEventListener('click', e => {
      const b = e.target.closest('button[data-g]'); if (!b) return;
      rcsDe(b.dataset.v).forEach(r => b.dataset.g === 'tout' ? rcSel.add(r.id) : rcSel.delete(r.id));
      dessinerListe(); dessinerResume();
    });

    return {
      async init() {
        try {
          await chargerDonnees();
          villageIds = Object.keys(donnees.villages).filter(id => rcsDe(id).length);
          villageIds.sort((a, b) => donnees.villages[a].localeCompare(donnees.villages[b], 'fr'));
          if (!donnees.rcs.length) { zoneVillages.innerHTML = '<div class="empty-hint">Aucun RC créé pour le moment.</div>'; liste.innerHTML = ''; return; }
          if (!villagesSel.size && villageIds.length === 1) { villagesSel.add(villageIds[0]); if (autoCocher) rcsDe(villageIds[0]).forEach(r => rcSel.add(r.id)); }
          tout();
        } catch (e) { liste.innerHTML = '<div class="empty-hint">Erreur de chargement des RC : ' + escHtml(e.message) + '</div>'; }
      },
      ids: () => [...rcSel],
      villageIds: () => villagesConcernes(),
      // Remplace la sélection (ex. pré-remplissage depuis une séance planifiée)
      set(rcIds, villageIdsPrefs) {
        rcSel.clear(); villagesSel.clear();
        (rcIds || []).forEach(id => { if (donnees.rcs.some(r => r.id === id)) rcSel.add(id); });
        (villageIdsPrefs || []).forEach(v => { if (villageIds.includes(v)) villagesSel.add(v); });
        rcSel.forEach(id => { const rc = donnees.rcs.find(r => r.id === id); if (!rc.villageIds.some(v => villagesSel.has(v)) && rc.villageIds[0]) villagesSel.add(rc.villageIds[0]); });
        tout();
      },
      reset() { rcSel.clear(); tout(); }
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
    const dessiner = (img, w0, h0) => {
      let width = w0, height = h0;
      if (width > maxDim || height > maxDim) { const k = Math.min(maxDim / width, maxDim / height); width = Math.round(width * k); height = Math.round(height * k); }
      const c = document.createElement('canvas'); c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      return c.toDataURL('image/jpeg', 0.75);
    };
    // 1) createImageBitmap : prend en compte l'orientation EXIF et évite de charger une énorme data URL
    if (window.createImageBitmap) {
      try { const bmp = await createImageBitmap(file); const out = dessiner(bmp, bmp.width, bmp.height); if (bmp.close) bmp.close(); return out; } catch (e) { /* repli ci-dessous */ }
    }
    // 2) repli : <img> via URL d'objet
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { try { resolve(dessiner(img, img.naturalWidth, img.naturalHeight)); } catch (e) { reject(e); } URL.revokeObjectURL(url); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Format de photo non pris en charge : ' + (file.name || 'photo') + ' (utilisez JPEG ou PNG).')); };
      img.src = url;
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
      photos.map((src, i) => `<span class="photo-vignette"><img src="${src}" alt="photo ${i + 1}"><button type="button" class="photo-retirer" data-retirer-photo="${i}" title="Retirer cette photo">×</button></span>`).join('') +
      documents.map((d, i) => `<span class="doc-chip">📄 ${escHtml(d.name)} <button type="button" class="photo-retirer-doc" data-retirer-doc="${i}" title="Retirer">×</button></span>`).join('');
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
      pickerPlan = creerSelecteur('planRcPicker', { autoCocher: true });
      $('suiviDate').value = aujourdhui(); $('suiviDate').max = aujourdhui();
      $('planDate').value = aujourdhui();
      $('planDate').min = aujourdhui();
      document.querySelectorAll('[data-suivi-sub]').forEach(b => b.addEventListener('click', () => afficherSousOnglet(b.dataset.suiviSub)));

      // Les photos S'AJOUTENT à la liste (on peut en reprendre plusieurs, une par une) ; le champ est
      // remis à zéro après chaque choix pour que reprendre la même photo déclenche bien l'événement.
      const MAX_PHOTOS = 10;
      $('suiviPhotos').addEventListener('change', async e => {
        const fichiers = [...e.target.files]; e.target.value = '';
        if (!fichiers.length) return;
        $('suiviFichiersApercu').insertAdjacentHTML('beforeend', '<span class="petit"> Traitement de la photo…</span>');
        for (const f of fichiers) {
          if (photos.length >= MAX_PHOTOS) { toast('Maximum ' + MAX_PHOTOS + ' photos par rapport.', true); break; }
          try { photos.push(await redimensionnerPhoto(f, 900)); }
          catch (err) { toast(err.message, true); }
        }
        apercuFichiers();
      });
      $('suiviDocs').addEventListener('change', async e => {
        const fichiers = [...e.target.files]; e.target.value = '';
        for (const f of fichiers) {
          try { documents.push(await lireDocument(f)); }
          catch (err) { toast(err.message, true); }
        }
        apercuFichiers();
      });
      $('suiviFichiersApercu').addEventListener('click', e => {
        const p = e.target.closest('[data-retirer-photo]'), d = e.target.closest('[data-retirer-doc]');
        if (p) { photos.splice(Number(p.dataset.retirerPhoto), 1); apercuFichiers(); }
        if (d) { documents.splice(Number(d.dataset.retirerDoc), 1); apercuFichiers(); }
      });

      $('formSuivi').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData($('formSuivi'));
        const themes = fd.getAll('themes'), rcPresentsIds = pickerSuivi.ids();
        if (!themes.length) { toast('Sélectionnez au moins un thème abordé.', true); return; }
        if (!rcPresentsIds.length) { toast('Cochez au moins un RC présent (cochez un ou plusieurs villages, puis leurs RC).', true); return; }
        if (!photos.length && !documents.length) { toast('Ajoutez au moins une photo ou un document du rapport de suivi.', true); return; }
        if (!confirm('Enregistrer ce suivi groupé ?\n\n' + rcPresentsIds.length + ' RC présent(s), ' + (photos.length + documents.length) + ' pièce(s) jointe(s).\nUne fois enregistré, le rapport est VERROUILLÉ : vous pourrez le consulter mais plus le modifier.')) return;
        const btn = $('formSuivi').querySelector('button[type=submit]'); btn.disabled = true;
        try {
          await Api.call('submitSuiviGroupe', {
            date: fd.get('date'), lieu: fd.get('lieu') || '', themes, rcPresentsIds, villageIds: pickerSuivi.villageIds(),
            photos, fichiers: documents, commentaires: fd.get('commentaires') || '',
            planningId: planningLie ? planningLie.ID : undefined
          });
          toast('Suivi groupé enregistré.');
          $('formSuivi').reset(); $('suiviDate').value = aujourdhui(); $('suiviLieu').value = '';
          photos = []; documents = []; planningLie = null; apercuFichiers(); majBandeauPlanning(); pickerSuivi.reset();
          afficherSousOnglet('historique');
        } catch (err) { toast(err.message, true); }
        btn.disabled = false;
      });

      $('formPlanning').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData($('formPlanning'));
        if (!pickerPlan.ids().length) { toast('Cochez un ou plusieurs villages : leurs relais communautaires sont convoqués automatiquement (vous pouvez en décocher).', true); return; }
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
          $('suiviLieu').value = plan.Lieu || '';
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
      let html = '<div class="table-wrap"><table><thead><tr><th>Date / heure</th><th>Village(s)</th><th>RC convoqués</th><th>Lieu</th><th>Objectif / thèmes</th><th>Statut</th><th></th></tr></thead><tbody>';
      plannings.slice().sort((a, b) => ordre(a) - ordre(b) || String(a.DatePrevue).localeCompare(String(b.DatePrevue))).forEach(p => {
        let actions = '';
        if (p.Statut === 'Planifié') actions = `<button class="btn-mini" data-plan="rapport" data-id="${escHtml(p.ID)}">Faire le compte rendu</button> <button class="btn-secondary btn-mini" data-plan="annuler" data-id="${escHtml(p.ID)}">Annuler</button>`;
        else if (p.Statut === 'Annulé') actions = `<button class="btn-secondary btn-mini" data-plan="reactiver" data-id="${escHtml(p.ID)}">Réactiver</button>`;
        const th = themesLabels_(jsonArr_(p.Themes)).join(', ');
        html += `<tr><td>${planningQuandHtml_(p)}</td><td>${escHtml(jsonArr_(p.VillageNoms).join(', '))}</td>
          <td>${jsonArr_(p.RcConviesNoms).length} — ${escHtml(jsonArr_(p.RcConviesNoms).join(', '))}</td><td>${escHtml(p.Lieu || '—')}</td>
          <td>${escHtml(p.Objectif || '')}${th ? `<div class="petit">${escHtml(th)}</div>` : (p.Objectif ? '' : '—')}</td><td>${statutPlanningBadge_(p)}</td><td style="white-space:nowrap">${actions}</td></tr>`;
      });
      el.innerHTML = html + '</tbody></table></div>';
    } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement : ' + escHtml(e.message) + '</div>'; }
  }

  async function chargerHistorique() {
    const el = $('suiviTable');
    el.innerHTML = 'Chargement…';
    try {
      const [rs, rp] = await Promise.all([Api.call('listSuivisGroupes', {}), Api.call('listPlanningsSuivis', {})]);
      montrerHistorique_(el, rp.plannings || [], rs.suivis || [], false);
    } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement : ' + escHtml(e.message) + '</div>'; }
  }
})();

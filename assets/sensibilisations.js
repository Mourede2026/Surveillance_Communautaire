/**
 * Module « Sensibilisations » : preuve des sensibilisations communautaires.
 *
 *   • Relais communautaire (saisie:true) : enregistre chaque séance avec la date, le thème, le lieu, la liste
 *     nominative des personnes sensibilisées (nom, sexe, âge) et la ou les photos de la séance. L'envoi est
 *     possible sans réseau (file d'attente de hors-ligne.js). Il consulte aussi son historique.
 *   • ASCQ, PF, RCSE, Département, National (saisie:false) : consultent les sensibilisations des RC de leur
 *     hiérarchie (filtres, totaux hommes/femmes, photos, liste des participants, export CSV).
 *
 * Dépend de api.js (Api, toast, escHtml).
 * initSensibilisations({ containerId, user, saisie })
 */
(function () {
  const esc = v => escHtml(v == null ? '' : v);
  const jsonArr = v => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const THEMES = ['Définition de cas des maladies à potentiel épidémique', 'Rage : morsures et vaccination des animaux', 'Mpox', 'Choléra et hygiène de l\'eau', 'Lavage des mains', 'Fièvre jaune', 'Méningite', 'Rougeole', 'Paludisme', 'Notification des alertes et décès au relais communautaire', 'Autre'];
  const MAX_PHOTOS = 5;

  function aujourdhui() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dFr(iso) { iso = String(iso || '').slice(0, 10); return iso.length === 10 ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—'; }

  // Les photos stockées dans Google Drive ont une URL « page de visionnage » : on utilise la miniature directe.
  function miniature(u) {
    const m = /drive\.google\.com\/file\/d\/([^/?#]+)/.exec(u || '');
    return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w800' : u;
  }

  function lireDataUrl(file) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = () => reject(new Error('Lecture du fichier impossible.')); r.readAsDataURL(file); });
  }
  async function redimensionner(file, maxDim) {
    const dessiner = (img, w0, h0) => {
      let w = w0, h = h0;
      if (w > maxDim || h > maxDim) { const k = Math.min(maxDim / w, maxDim / h); w = Math.round(w * k); h = Math.round(h * k); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.72);
    };
    if (window.createImageBitmap) {
      try { const bmp = await createImageBitmap(file); const out = dessiner(bmp, bmp.width, bmp.height); if (bmp.close) bmp.close(); return out; } catch (e) { /* repli */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { try { resolve(dessiner(img, img.naturalWidth, img.naturalHeight)); } catch (e) { reject(e); } URL.revokeObjectURL(url); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Format de photo non pris en charge (utilisez JPEG ou PNG).')); };
      img.src = url;
    });
  }

  function csv(lignes) { return '\ufeff' + lignes.map(l => l.map(x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(';')).join('\r\n'); }
  function telecharger(nom, contenu) {
    const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  let ctx = null;

  window.initSensibilisations = async function (opts) {
    ctx = opts;
    const el = document.getElementById(opts.containerId);
    if (opts.saisie) {
      el.innerHTML = `<div class="sub-tabs"><button type="button" class="active" data-sens-sub="nouvelle">➕ Nouvelle sensibilisation</button><button type="button" data-sens-sub="liste">📋 Mes sensibilisations</button></div>
        <div id="sensNouvelle"></div><div id="sensListe" style="display:none"></div>`;
      el.querySelectorAll('[data-sens-sub]').forEach(b => b.addEventListener('click', () => {
        el.querySelectorAll('[data-sens-sub]').forEach(x => x.classList.toggle('active', x === b));
        document.getElementById('sensNouvelle').style.display = b.dataset.sensSub === 'nouvelle' ? 'block' : 'none';
        document.getElementById('sensListe').style.display = b.dataset.sensSub === 'liste' ? 'block' : 'none';
        if (b.dataset.sensSub === 'liste') chargerListe('sensListe', true);
      }));
      dessinerFormulaire();
    } else {
      el.innerHTML = '<div id="sensListe"></div>';
      chargerListe('sensListe', false);
    }
  };

  // ---------------------------------------------------------------------
  // Formulaire du relais communautaire
  // ---------------------------------------------------------------------
  function dessinerFormulaire() {
    const zone = document.getElementById('sensNouvelle');
    const auj = aujourdhui();
    const photos = []; // data URLs redimensionnées
    zone.innerHTML = `<form id="formSens">
      <p class="petit" style="margin:0 0 12px">Chaque sensibilisation communautaire que vous réalisez doit être prouvée ici : indiquez qui a été sensibilisé (nom, sexe, âge) et joignez la <strong>photo de la séance</strong>. Vos supérieurs (ASCQ, point focal, coordination) la voient immédiatement.</p>
      <div class="grid grid-2">
        <div class="field"><label>Date de la sensibilisation</label><input type="date" name="date" value="${auj}" max="${auj}" required></div>
        <div class="field"><label>Thème</label><input name="theme" list="sensThemes" required maxlength="160" placeholder="Ex : Rage : morsures et vaccination des animaux"><datalist id="sensThemes">${THEMES.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="field"><label>Lieu (facultatif)</label><input name="lieu" maxlength="120" placeholder="Marché, école, place du village, domicile…"></div>
        <div class="field"><label>Commentaire (facultatif)</label><input name="commentaires" maxlength="1000" placeholder="Remarques sur la séance"></div>
      </div>
      <h4 class="sous-titre">Personnes sensibilisées</h4>
      <div id="sensCompteurs" class="petit" style="margin-bottom:6px"></div>
      <div class="table-wrap"><table class="sens-table"><thead><tr><th style="width:42px">N°</th><th>Nom et prénom</th><th style="width:120px">Sexe</th><th style="width:90px">Âge</th><th style="width:44px"></th></tr></thead><tbody id="sensLignes"></tbody></table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
        <button type="button" class="btn-secondary btn-mini" id="sensAjout">+ Ajouter une personne</button>
        <button type="button" class="btn-secondary btn-mini" id="sensColleToggle">📋 Coller une liste</button></div>
      <div id="sensColle" style="display:none;margin-bottom:10px"><div class="petit">Une personne par ligne : <code>Nom Prénom, M ou F, âge</code> (séparateurs « , » « ; » ou tabulation).</div>
        <textarea id="sensColleTexte" rows="5" placeholder="Koffi Ama, F, 28&#10;Dossou Jean, M, 41"></textarea><button type="button" class="btn-mini" id="sensColleOk" style="margin-top:6px">Ajouter ces personnes</button></div>
      <h4 class="sous-titre" style="margin-top:14px">Photo(s) de la sensibilisation (preuve)</h4>
      <input type="file" id="sensPhotoInput" accept="image/*" multiple>
      <div id="sensPhotos" class="fiche-photos" style="margin-top:8px"></div>
      <div class="petit">Au moins une photo, ${MAX_PHOTOS} au maximum. Les photos sont réduites automatiquement.</div>
      <button type="submit" class="btn-block" style="margin-top:14px">Envoyer la preuve de sensibilisation</button>
    </form>`;
    const form = zone.querySelector('#formSens'), corps = zone.querySelector('#sensLignes');

    function ligne(nom, sexe, age) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="sens-n"></td><td><input class="sens-nom" maxlength="80" value="${esc(nom || '')}" placeholder="Nom et prénom"></td>
        <td><select class="sens-sexe"><option value="">—</option><option value="M" ${sexe === 'M' ? 'selected' : ''}>Masculin</option><option value="F" ${sexe === 'F' ? 'selected' : ''}>Féminin</option></select></td>
        <td><input class="sens-age" type="number" min="0" max="120" inputmode="numeric" value="${age == null ? '' : esc(age)}"></td>
        <td><button type="button" class="btn-danger btn-mini" data-del title="Retirer">✕</button></td>`;
      corps.appendChild(tr); numeroter(); return tr;
    }
    function numeroter() {
      corps.querySelectorAll('tr').forEach((tr, i) => { tr.querySelector('.sens-n').textContent = i + 1; });
      majCompteurs();
    }
    function lirePersonnes() {
      return Array.from(corps.querySelectorAll('tr')).map(tr => ({ nom: tr.querySelector('.sens-nom').value.trim(), sexe: tr.querySelector('.sens-sexe').value, age: tr.querySelector('.sens-age').value })).filter(x => x.nom || x.sexe || x.age !== '');
    }
    function majCompteurs() {
      const l = lirePersonnes().filter(x => x.nom);
      zone.querySelector('#sensCompteurs').innerHTML = `<strong>${l.length}</strong> personne(s) · ${l.filter(x => x.sexe === 'M').length} homme(s) · ${l.filter(x => x.sexe === 'F').length} femme(s)`;
    }
    ligne();
    corps.addEventListener('input', majCompteurs); corps.addEventListener('change', majCompteurs);
    corps.addEventListener('click', e => { if (e.target.closest('[data-del]')) { e.target.closest('tr').remove(); if (!corps.children.length) ligne(); numeroter(); } });
    zone.querySelector('#sensAjout').onclick = () => { const tr = ligne(); tr.querySelector('.sens-nom').focus(); };
    zone.querySelector('#sensColleToggle').onclick = () => { const z = zone.querySelector('#sensColle'); z.style.display = z.style.display === 'none' ? 'block' : 'none'; };
    zone.querySelector('#sensColleOk').onclick = () => {
      const txt = zone.querySelector('#sensColleTexte').value; let n = 0;
      // retire la première ligne vide du tableau si elle est encore vide
      const vides = Array.from(corps.querySelectorAll('tr')).filter(tr => !tr.querySelector('.sens-nom').value && !tr.querySelector('.sens-sexe').value && tr.querySelector('.sens-age').value === '');
      vides.forEach(tr => tr.remove());
      txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
        const p = l.split(/[;,\t]/).map(x => x.trim());
        const nom = p[0] || ''; if (!nom) return;
        const s = (p[1] || '').toLowerCase();
        const sexe = /^(m|h|g|masculin|homme|garçon|garcon)$/.test(s) ? 'M' : (/^(f|feminin|féminin|femme|fille)$/.test(s) ? 'F' : '');
        const age = /^\d+$/.test(p[2] || '') ? Number(p[2]) : '';
        ligne(nom, sexe, age); n++;
      });
      if (!corps.children.length) ligne();
      numeroter(); zone.querySelector('#sensColleTexte').value = '';
      toast(n ? n + ' personne(s) ajoutée(s). Vérifiez le sexe et l\'âge de chacune.' : 'Aucune ligne reconnue.', !n);
    };

    function dessinerPhotos() {
      zone.querySelector('#sensPhotos').innerHTML = photos.map((u, i) => `<div style="position:relative"><img src="${u}" alt="Photo ${i + 1}"><button type="button" class="btn-danger btn-mini" data-ph="${i}" style="position:absolute;top:4px;right:4px">✕</button></div>`).join('');
    }
    zone.querySelector('#sensPhotos').addEventListener('click', e => { const b = e.target.closest('[data-ph]'); if (b) { photos.splice(Number(b.dataset.ph), 1); dessinerPhotos(); } });
    zone.querySelector('#sensPhotoInput').addEventListener('change', async e => {
      const fichiers = Array.from(e.target.files || []); e.target.value = '';
      for (const f of fichiers) {
        if (photos.length >= MAX_PHOTOS) { toast('Maximum ' + MAX_PHOTOS + ' photos.', true); break; }
        try { photos.push(await redimensionner(f, 1280)); } catch (err) { toast(err.message, true); }
      }
      dessinerPhotos();
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const personnes = lirePersonnes().filter(x => x.nom);
      if (!personnes.length) { toast('Ajoutez au moins une personne sensibilisée.', true); return; }
      const sansSexe = personnes.find(x => !x.sexe); if (sansSexe) { toast('Précisez le sexe de « ' + sansSexe.nom + ' ».', true); return; }
      const sansAge = personnes.find(x => x.age === '' || isNaN(Number(x.age))); if (sansAge) { toast('Précisez l\'âge de « ' + sansAge.nom + ' ».', true); return; }
      if (!photos.length) { toast('Ajoutez au moins une photo de la sensibilisation.', true); return; }
      const fd = new FormData(form), btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        const r = await Api.call('submitSensibilisation', {
          date: fd.get('date'), theme: fd.get('theme'), lieu: fd.get('lieu'), commentaires: fd.get('commentaires'),
          participants: personnes.map(x => ({ nom: x.nom, sexe: x.sexe, age: Number(x.age) })), photos: photos.slice()
        });
        toast(r.queued ? 'Pas de réseau : la preuve est gardée sur ce téléphone et sera envoyée automatiquement.' : 'Preuve de sensibilisation enregistrée. Merci !');
        dessinerFormulaire();
      } catch (err) { toast(err.message, true); btn.disabled = false; }
    });
  }

  // ---------------------------------------------------------------------
  // Liste (historique du RC, ou lecture par les niveaux supérieurs)
  // ---------------------------------------------------------------------
  async function chargerListe(zoneId, estRc) {
    const el = document.getElementById(zoneId);
    el.innerHTML = 'Chargement…';
    let r;
    try { r = await Api.call('listSensibilisations', {}); } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement : ' + esc(e.message) + '</div>'; return; }
    const rows = r.sensibilisations;
    if (!rows.length) { el.innerHTML = '<div class="empty-state">' + (estRc ? 'Vous n\'avez encore enregistré aucune sensibilisation.' : 'Aucune sensibilisation enregistrée pour le moment par les relais communautaires de votre périmètre.') + '</div>'; return; }
    el.innerHTML = `<div class="grid grid-4" id="sensStats" style="margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <input id="sensRech" placeholder="${estRc ? 'Rechercher (thème, lieu)' : 'Rechercher (RC, village, thème)'}" style="flex:1;min-width:180px">
        <label class="petit">Du <input type="date" id="sensDu"></label><label class="petit">au <input type="date" id="sensAu"></label>
        <button type="button" class="btn-secondary btn-mini" id="sensExport">⬇ Participants (CSV)</button></div>
      <div class="table-wrap"><table><thead><tr><th>Date</th>${estRc ? '' : '<th>Relais communautaire</th><th>Village</th>'}<th>Thème</th><th>Personnes</th><th>Preuves</th><th></th></tr></thead><tbody id="sensCorps"></tbody></table></div>`;
    const corps = el.querySelector('#sensCorps');
    function filtrer() {
      const t = el.querySelector('#sensRech').value.trim().toLowerCase(), du = el.querySelector('#sensDu').value, au = el.querySelector('#sensAu').value;
      return rows.filter(s => (!du || s.Date >= du) && (!au || s.Date <= au) && (!t || (s.Theme + ' ' + s.Lieu + ' ' + s.RcNom + ' ' + s.VillageNom).toLowerCase().includes(t)));
    }
    function montrer() {
      const v = filtrer();
      const tot = v.reduce((a, s) => a + Number(s.NbParticipants || 0), 0), h = v.reduce((a, s) => a + Number(s.NbHommes || 0), 0), f = v.reduce((a, s) => a + Number(s.NbFemmes || 0), 0);
      el.querySelector('#sensStats').innerHTML = [[v.length, 'Séances'], [tot, 'Personnes sensibilisées'], [h, 'Hommes'], [f, 'Femmes']].map(x => `<div class="stat-card"><div class="n">${x[0]}</div><div class="l">${x[1]}</div></div>`).join('');
      corps.innerHTML = v.length ? v.map(s => {
        const ph = jsonArr(s.PhotosUrls);
        return `<tr><td>${dFr(s.Date)}${s.HorsLigne ? '<div class="petit">hors connexion</div>' : ''}</td>${estRc ? '' : `<td>${esc(s.RcNom)}</td><td>${esc(s.VillageNom)}</td>`}<td><strong>${esc(s.Theme)}</strong>${s.Lieu ? '<div class="petit">' + esc(s.Lieu) + '</div>' : ''}</td>
          <td>${esc(s.NbParticipants)}<div class="petit">${esc(s.NbHommes)} H · ${esc(s.NbFemmes)} F</div></td>
          <td>${ph.length ? `<a href="${esc(ph[0])}" target="_blank" rel="noopener"><img class="sens-mini" src="${esc(miniature(ph[0]))}" alt="Photo" loading="lazy"></a>${ph.length > 1 ? '<div class="petit">+' + (ph.length - 1) + ' photo(s)</div>' : ''}` : '—'}</td>
          <td><button type="button" class="btn-secondary btn-mini" data-sens="${esc(s.ID)}">Détail</button></td></tr>`;
      }).join('') : `<tr><td colspan="${estRc ? 5 : 7}" class="petit">Aucune sensibilisation ne correspond.</td></tr>`;
    }
    ['#sensRech', '#sensDu', '#sensAu'].forEach(sel => el.querySelector(sel).addEventListener('input', montrer));
    corps.addEventListener('click', e => { const b = e.target.closest('[data-sens]'); if (b) detail(rows.find(x => x.ID === b.dataset.sens), estRc); });
    el.querySelector('#sensExport').onclick = () => {
      const l = [['Date', 'Relais communautaire', 'Village', 'Thème', 'Lieu', 'Nom et prénom', 'Sexe', 'Âge']];
      filtrer().forEach(s => jsonArr(s.Participants).forEach(p => l.push([s.Date, s.RcNom, s.VillageNom, s.Theme, s.Lieu, p.nom, p.sexe === 'F' ? 'Féminin' : 'Masculin', p.age])));
      telecharger('sensibilisations_participants.csv', csv(l));
    };
    montrer();
  }

  function detail(s, estRc) {
    const ph = jsonArr(s.PhotosUrls), pers = jsonArr(s.Participants);
    const ov = document.createElement('div'); ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal-box" style="width:760px;max-height:92vh;overflow:auto">
      <h3 style="margin-top:0">📣 ${esc(s.Theme)}</h3>
      <div class="petit" style="margin-bottom:10px">${dFr(s.Date)}${s.Lieu ? ' · ' + esc(s.Lieu) : ''}${estRc ? '' : ' · ' + esc(s.RcNom) + (s.VillageNom ? ' (' + esc(s.VillageNom) + ')' : '')} · ${esc(s.NbParticipants)} personne(s) : ${esc(s.NbHommes)} homme(s), ${esc(s.NbFemmes)} femme(s)</div>
      ${s.Commentaires ? `<p style="margin:0 0 10px">${esc(s.Commentaires)}</p>` : ''}
      <div class="fiche-photos">${ph.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(miniature(u))}" alt="Photo ${i + 1}"></a>`).join('') || '<span class="petit">Aucune photo.</span>'}</div>
      <h4 class="sous-titre">Personnes sensibilisées</h4>
      <div class="table-wrap" style="max-height:300px;overflow:auto"><table><thead><tr><th>N°</th><th>Nom et prénom</th><th>Sexe</th><th>Âge</th></tr></thead><tbody>${pers.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.nom)}</td><td>${p.sexe === 'F' ? 'Féminin' : 'Masculin'}</td><td>${esc(p.age)}</td></tr>`).join('')}</tbody></table></div>
      <div style="margin-top:14px;text-align:right"><button type="button" class="btn-secondary" id="sensFerme">Fermer</button></div></div>`;
    document.body.appendChild(ov);
    const fermer = () => ov.remove();
    ov.querySelector('#sensFerme').onclick = fermer;
    ov.addEventListener('click', e => { if (e.target === ov) fermer(); });
  }
})();

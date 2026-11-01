/**
 * Module « Collecte avec questionnaire » : activité de type « Collecte de données » dont le demandeur a rédigé un
 * questionnaire simple DANS la plateforme (questions ouvertes, fermées, à choix multiples, oui/non, nombre, date).
 *   • Destinataire : remplit le questionnaire autant de fois que nécessaire — y compris HORS CONNEXION (la saisie est
 *     gardée sur l'appareil puis envoyée automatiquement au retour du réseau) ; consulte et peut retirer ses réponses.
 *   • Demandeur : consulte toutes les réponses de sa hiérarchie, les exporte (CSV) et peut en supprimer.
 * Dépend de api.js, hors-ligne.js et taches.js (formulaires générés).
 *
 *   Collectes.estQuestionnaire(activite) ; Collectes.remplir(activite, onChange) ;
 *   Collectes.mesReponses(activite, onChange) ; Collectes.rendreDonnees(conteneur, { activiteId, onChange })
 */
(function () {
  const esc = v => escHtml(v == null ? '' : v);
  const TYPE = 'Collecte de données';
  const LIB_ROLE = { RC: 'RC', ASCQ: 'ASCQ', PF_CNLS_TP: 'PF', RCSE: 'RCSE', DEPARTEMENT: 'Dép.', NATIONAL: 'National' };

  function champsDe(a) { try { const q = JSON.parse(a.Questionnaire || '{}'); return Array.isArray(q.champs) ? q.champs : []; } catch (e) { return []; } }
  function estQuestionnaire(a) { return !!a && a.Type === TYPE && champsDe(a).length > 0; }

  function modal(html, largeur) {
    const ov = document.createElement('div'); ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal-box" style="width:${largeur || 640}px;max-height:92vh;overflow:auto">${html}</div>`;
    document.body.appendChild(ov);
    const fermer = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) fermer(); });
    return { ov, fermer, box: ov.firstElementChild };
  }
  function dFr(v) { return v ? fmtDate(v) : ''; }
  const nbAttente = async activiteId => {
    try { return (await window.HorsLigne.enAttente()).filter(i => i.action === 'submitCollecte' && i.payload && i.payload.activiteId === activiteId && i.statut !== 'erreur').length; }
    catch (e) { return 0; }
  };

  // ---------------- remplir le questionnaire ----------------
  function remplir(a, onChange) {
    const champs = champsDe(a);
    const m = modal(`<h3 style="margin-top:0">📝 ${esc(a.Titre)}</h3>
      <p class="petit" style="margin:0 0 10px">${a.Description ? esc(a.Description).replace(/\n/g, '<br>') + '<br>' : ''}Vous pouvez remplir ce questionnaire autant de fois que nécessaire. <strong>Sans connexion</strong>, la réponse reste sur cet appareil et part automatiquement dès que le réseau revient.</p>
      <form id="qcForm"><div class="field"><label>Lieu / structure concernée (facultatif)</label><input name="__lieu" maxlength="120" placeholder="Ex : CS de Djidja, village de…"></div>
        ${window.Taches.formulaireHtml(champs, 'q_')}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="submit" class="btn-block">Enregistrer cette réponse</button><button type="button" class="btn-secondary btn-block" id="qcFerme">Fermer</button></div></form>`);
    m.box.querySelector('#qcFerme').onclick = () => { m.fermer(); if (typeof onChange === 'function') onChange(); };
    m.box.querySelector('#qcForm').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.target, rep = window.Taches.lireReponses(form, champs, 'q_');
      const manque = champs.find(c => c.obligatoire && (rep[c.id] === '' || rep[c.id] == null || (Array.isArray(rep[c.id]) && !rep[c.id].length)));
      if (manque) { toast('Réponse obligatoire : ' + manque.label, true); return; }
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        const r = await Api.call('submitCollecte', { activiteId: a.ID, reponses: rep, lieu: form.querySelector('[name=__lieu]').value });
        toast(r.queued ? 'Pas de réseau : la réponse est gardée sur cet appareil et sera envoyée automatiquement.' : 'Réponse enregistrée. Vous pouvez en saisir une autre.');
        form.reset();
      } catch (err) { toast(err.message, true); }
      btn.disabled = false;
    });
  }

  // ---------------- tableau des réponses (demandeur : toutes ; destinataire : les siennes) ----------------
  async function rendreReponses(el, activiteId, opts) {
    opts = opts || {};
    el.innerHTML = 'Chargement…';
    let r;
    try { r = await Api.call('listCollectes', { activiteId }); } catch (e) { el.innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>'; return; }
    const champs = r.activite.questionnaire.champs, rows = r.reponses, dem = r.enTantQueDemandeur;
    const attente = await nbAttente(activiteId);
    const notePending = attente ? `<div class="petit" style="margin-bottom:8px">⏳ <strong>${attente}</strong> réponse(s) saisie(s) sans connexion, en attente d'envoi (elles apparaîtront ici après la synchronisation).</div>` : '';
    if (!rows.length) { el.innerHTML = notePending + '<div class="empty-state">Aucune réponse pour le moment.</div>'; return; }
    const personnes = new Set(rows.map(x => x.UserId)).size;
    const selection = new Set();
    el.innerHTML = `${notePending}<div class="petit" style="margin-bottom:8px"><strong>${rows.length}</strong> réponse(s)${dem ? ' de <strong>' + personnes + '</strong> compte(s)' : ''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
        <input id="qcRech" placeholder="Rechercher…" style="flex:1;min-width:160px">
        <button type="button" class="btn-danger btn-mini" id="qcSuppr" disabled>🗑 Supprimer la sélection (0)</button>
        <button type="button" class="btn-secondary btn-mini" id="qcCsv">⬇ Exporter (CSV)</button></div>
      <div class="table-wrap" style="max-height:420px;overflow:auto"><table><thead><tr><th><input type="checkbox" id="qcTout" style="width:auto"></th><th>Date</th>${dem ? '<th>Compte</th><th>Niveau</th>' : ''}<th>Lieu</th>${champs.map(c => '<th>' + esc(c.label) + '</th>').join('')}<th></th></tr></thead><tbody id="qcCorps"></tbody></table></div>`;
    const texteLigne = x => (dem ? x.UserNom + ' ' + x.Lieu : x.Lieu) + ' ' + champs.map(c => window.Taches.valeurTexte(c, x.Reponses[c.id])).join(' ');
    const liste = () => { const t = el.querySelector('#qcRech').value.trim().toLowerCase(); return rows.filter(x => !t || texteLigne(x).toLowerCase().includes(t)); };
    function maj() {
      const b = el.querySelector('#qcSuppr'); b.disabled = !selection.size; b.textContent = '🗑 Supprimer la sélection (' + selection.size + ')';
      const v = liste(); el.querySelector('#qcTout').checked = v.length > 0 && v.every(x => selection.has(x.ID));
    }
    function montrer() {
      el.querySelector('#qcCorps').innerHTML = liste().map(x => `<tr><td><input type="checkbox" class="qc-sel" data-id="${esc(x.ID)}" ${selection.has(x.ID) ? 'checked' : ''} style="width:auto"></td>
        <td>${esc(dFr(x.DateSaisie))}${x.HorsLigne ? '<div class="petit">📴 hors connexion</div>' : ''}</td>${dem ? `<td>${esc(x.UserNom)}</td><td>${esc(LIB_ROLE[x.Role] || '')}</td>` : ''}<td>${esc(x.Lieu)}</td>
        ${champs.map(c => `<td>${esc(window.Taches.valeurTexte(c, x.Reponses[c.id]))}</td>`).join('')}
        <td><button type="button" class="btn-danger btn-mini" data-del="${esc(x.ID)}">🗑</button></td></tr>`).join('');
      maj();
    }
    async function supprimer(ids) {
      if (!ids.length || !confirm('Supprimer définitivement ' + ids.length + ' réponse(s) ?' + (dem ? ' Les comptes concernés seront prévenus.' : ''))) return;
      try { await Api.call('supprimerCollectes', { activiteId, ids }); toast('Supprimé.'); if (typeof opts.onChange === 'function') opts.onChange(); await rendreReponses(el, activiteId, opts); }
      catch (err) { toast(err.message, true); }
    }
    el.querySelector('#qcRech').addEventListener('input', montrer);
    el.querySelector('#qcCorps').addEventListener('change', e => { const c = e.target.closest('.qc-sel'); if (!c) return; c.checked ? selection.add(c.dataset.id) : selection.delete(c.dataset.id); maj(); });
    el.querySelector('#qcCorps').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) supprimer([d.dataset.del]); });
    el.querySelector('#qcTout').addEventListener('change', e => { liste().forEach(x => e.target.checked ? selection.add(x.ID) : selection.delete(x.ID)); montrer(); });
    el.querySelector('#qcSuppr').onclick = () => supprimer([...selection]);
    el.querySelector('#qcCsv').onclick = () => {
      const l = [['Date', 'Compte', 'Niveau', 'Lieu'].concat(champs.map(c => c.label))];
      liste().forEach(x => l.push([x.DateSaisie, x.UserNom, LIB_ROLE[x.Role] || '', x.Lieu].concat(champs.map(c => window.Taches.valeurTexte(c, x.Reponses[c.id])))));
      window.Taches.telecharger('collecte_' + window.Taches.nomFichier(r.activite.titre) + '.csv', window.Taches.csv(l));
    };
    montrer();
  }

  function mesReponses(a, onChange) {
    const m = modal(`<h3 style="margin-top:0">📋 Mes réponses — ${esc(a.Titre)}</h3><div id="qcZone"></div><div style="margin-top:12px;text-align:right"><button type="button" class="btn-secondary" id="qcFermer">Fermer</button></div>`, 900);
    m.box.querySelector('#qcFermer').onclick = () => { m.fermer(); if (typeof onChange === 'function') onChange(); };
    rendreReponses(m.box.querySelector('#qcZone'), a.ID, { onChange });
  }

  window.Collectes = { estQuestionnaire, remplir, mesReponses, rendreDonnees: rendreReponses, champsDe };
})();

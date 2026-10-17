/**
 * Module « Activités » : liens de collecte de données (Google Forms, KoboCollect...), formations,
 * tests, documents… publiés par un niveau SUPÉRIEUR pour les niveaux INFÉRIEURS de sa hiérarchie.
 *   • Tout compte reçoit les activités que ses supérieurs lui ont adressées (lien, consignes,
 *     commentaires, date limite) et indique « Ouvert » / « Fait ».
 *   • Les comptes ASCQ, PF, RCSE, DEPARTEMENT, NATIONAL peuvent en créer pour les niveaux en dessous
 *     d'eux, suivre l'avancement compte par compte, commenter, modifier, archiver, supprimer.
 *   • Le RC ne peut pas en créer ; un niveau bas ne peut jamais en demander à un niveau haut.
 * Dépend de api.js (Api, toast, fmtDate, escHtml).
 *
 * initActivites({ containerId, user, recevoir, gerer }) ; majBadgeActivites_(navId, libelle)
 */
(function () {
  const ICONES = { 'Collecte de données': '📝', 'Formation': '🎓', 'Test / Quiz': '✅', 'Information / Document': '📄', 'Autre': '🔗' };
  const TYPES = Object.keys(ICONES);
  const RANG = { RC: 0, ASCQ: 1, PF_CNLS_TP: 2, RCSE: 3, DEPARTEMENT: 4, NATIONAL: 5 };
  const LIB_ROLE = { RC: 'Relais communautaires (RC)', ASCQ: 'ASCQ', PF_CNLS_TP: 'Points focaux (PF CNLS-TP)', RCSE: 'RCSE (zones sanitaires)', DEPARTEMENT: 'Départements' };
  const LIB_ROLE_COURT = { RC: 'RC', ASCQ: 'ASCQ', PF_CNLS_TP: 'PF', RCSE: 'RCSE', DEPARTEMENT: 'Dép.', NATIONAL: 'National' };
  const aujourdhui = () => new Date().toISOString().slice(0, 10);
  const jsonArr = v => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const lienSur = u => /^https?:\/\//i.test(u || '') ? u : '#';

  let ctx = null, donnees = null;

  async function charger() { donnees = await Api.call('listActivites', {}); return donnees; }

  // ---------------- badge dans le menu ----------------
  window.majBadgeActivites_ = async function (navId, libelle) {
    try {
      const d = await Api.call('listActivites', {});
      const aFaire = d.recues.filter(a => a.MonStatut !== 'Fait').length;
      const el = document.getElementById(navId);
      if (el) el.textContent = (libelle || '🔗 Activités') + (aFaire ? ' (' + aFaire + ')' : '');
    } catch (e) { /* facultatif */ }
  };

  // ---------------- point d'entrée ----------------
  window.initActivites = async function (opts) {
    ctx = opts;
    const el = document.getElementById(opts.containerId);
    el.innerHTML = 'Chargement…';
    try { await charger(); } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement : ' + escHtml(e.message) + '</div>'; return; }
    const peutGerer = opts.gerer && donnees.peutCreer;
    const aFaire = donnees.recues.filter(a => a.MonStatut !== 'Fait').length;
    el.innerHTML = `${(opts.recevoir && peutGerer) ? `<div class="sub-tabs">
        <button type="button" data-act-sub="recues" class="active">📥 Reçues${aFaire ? ' (' + aFaire + ' à faire)' : ''}</button>
        <button type="button" data-act-sub="gerer">📤 Demander une activité</button></div>` : ''}
      <div id="actRecues" ${(!opts.recevoir) ? 'style="display:none"' : ''}></div>
      <div id="actGerer" style="display:${(!opts.recevoir && peutGerer) ? 'block' : 'none'}"></div>`;
    if (opts.recevoir) dessinerRecues();
    if (peutGerer) dessinerGestion();
    el.querySelectorAll('[data-act-sub]').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('[data-act-sub]').forEach(x => x.classList.toggle('active', x === b));
      document.getElementById('actRecues').style.display = b.dataset.actSub === 'recues' ? 'block' : 'none';
      document.getElementById('actGerer').style.display = b.dataset.actSub === 'gerer' ? 'block' : 'none';
    }));
  };

  async function rafraichir() { await window.initActivites(ctx); }

  // ---------------- activités reçues ----------------
  function badgeRecu(a) {
    if (a.MonStatut === 'Fait') return '<span class="badge badge-done">✔ Fait</span>';
    const retard = a.DateLimite && String(a.DateLimite) < aujourdhui();
    if (retard) return '<span class="badge badge-late">En retard</span>';
    return a.MonStatut === 'Ouvert' ? '<span class="badge badge-new">Ouvert — à terminer</span>' : '<span class="badge badge-new">À faire</span>';
  }
  function commentairesHtml(a) {
    const c = jsonArr(a.Commentaires);
    return c.length ? `<div class="act-coms"><strong>💬 Commentaires de ${escHtml(a.CreeParNom)}</strong>` + c.map(x => `<div class="act-com"><span class="petit">${fmtDate(x.date)}</span><br>${escHtml(x.texte).replace(/\n/g, '<br>')}</div>`).join('') + '</div>' : '';
  }

  function dessinerRecues() {
    const el = document.getElementById('actRecues');
    const liste = donnees.recues;
    if (!liste.length) { el.innerHTML = '<div class="empty-state">Aucune activité demandée pour le moment.</div>'; return; }
    el.innerHTML = `<div class="admin-barre"><select id="actFiltre"><option value="">Toutes</option><option value="afaire">À faire</option><option value="fait">Faites</option></select></div><div id="actRecuesListe"></div>`;
    const zone = document.getElementById('actRecuesListe');
    function montrer() {
      const f = document.getElementById('actFiltre').value;
      const vis = liste.filter(a => !f || (f === 'fait' ? a.MonStatut === 'Fait' : a.MonStatut !== 'Fait'));
      zone.innerHTML = vis.length ? vis.map(a => `<div class="card act-card">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
          <strong>${ICONES[a.Type] || '🔗'} ${escHtml(a.Titre)}</strong>${badgeRecu(a)}</div>
        <div class="petit" style="margin:4px 0 8px">${escHtml(a.Type)} · demandé par ${escHtml(a.CreeParNom)} (${LIB_ROLE_COURT[a.CreeParRole] || ''}) le ${fmtDate(a.DateCreation)}${a.DateLimite ? ' · <strong>à faire avant le ' + fmtDate(a.DateLimite) + '</strong>' : ''}</div>
        ${a.Description ? `<p style="margin:0 0 10px">${escHtml(a.Description).replace(/\n/g, '<br>')}</p>` : ''}
        ${commentairesHtml(a)}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          ${a.Lien ? `<a class="btn-lien" href="${escHtml(lienSur(a.Lien))}" target="_blank" rel="noopener noreferrer" data-ouvrir="${escHtml(a.ID)}">Ouvrir le lien ↗</a>` : ''}
          ${a.MonStatut === 'Fait' ? `<button class="btn-secondary" data-statut="Ouvert" data-id="${escHtml(a.ID)}">Annuler « fait »</button>` : `<button data-statut="Fait" data-id="${escHtml(a.ID)}">✔ J'ai terminé</button>`}
        </div></div>`).join('') : '<div class="empty-state">Rien dans cette catégorie.</div>';
    }
    document.getElementById('actFiltre').addEventListener('change', montrer);
    zone.addEventListener('click', async e => {
      const o = e.target.closest('[data-ouvrir]');
      if (o) { Api.call('marquerActivite', { id: o.dataset.ouvrir, statut: 'Ouvert' }).catch(() => {}); return; } // le lien s'ouvre normalement
      const b = e.target.closest('[data-statut]'); if (!b) return;
      b.disabled = true;
      try { await Api.call('marquerActivite', { id: b.dataset.id, statut: b.dataset.statut, force: true }); toast(b.dataset.statut === 'Fait' ? 'Activité marquée comme faite.' : 'Remise à faire.'); rafraichir(); if (typeof ctx.onChange === 'function') ctx.onChange(); }
      catch (err) { toast(err.message, true); b.disabled = false; }
    });
    montrer();
  }

  // ---------------- gestion (niveau supérieur) ----------------
  function rolesCibles() {
    const rang = RANG[ctx.user.Role];
    return Object.keys(LIB_ROLE).filter(r => RANG[r] < rang).sort((a, b) => RANG[b] - RANG[a]);
  }

  function dessinerGestion() {
    const el = document.getElementById('actGerer');
    const roles = rolesCibles();
    el.innerHTML = `<div class="card"><h2>Demander une activité aux niveaux inférieurs</h2>
      <p class="petit" style="margin:0 0 12px">Publiez le lien d'un formulaire (Google Forms, KoboCollect…), d'une formation ou d'un test. Il s'affichera, jusqu'à l'échéance incluse, dans l'espace des comptes du ou des niveaux choisis <strong>de votre hiérarchie</strong>, avec vos consignes. Vous suivrez qui l'a ouvert et qui l'a terminé.</p>
      <form id="formActivite">
        <div class="grid grid-2">
          <div class="field"><label>Type</label><select name="type">${TYPES.map(t => `<option>${ICONES[t]} ${escHtml(t)}</option>`).join('')}</select></div>
          <div class="field"><label>Titre</label><input name="titre" required placeholder="Ex : Collecte de données sur les mpox"></div>
          <div class="field"><label>Lien (https://…)</label><input name="lien" type="url" placeholder="https://forms.gle/… ou lien de formation / test"></div>
          <div class="field"><label>Échéance (obligatoire)</label><input name="dateLimite" type="date" required min="${aujourdhui()}"></div>
        </div>
        <div class="field"><label>Consignes / commentaire (optionnel)</label><textarea name="description" placeholder="Explications, public concerné, comment remplir…"></textarea></div>
        <fieldset><legend>Niveaux destinataires</legend><div class="checks">${roles.map(r => `<label><input type="checkbox" name="cibles" value="${r}"> ${escHtml(LIB_ROLE[r])}</label>`).join('')}</div></fieldset>
        <button type="submit" class="btn-block">Publier l'activité</button>
      </form></div>
      <div class="card"><h2>Mes activités demandées</h2><div id="actCreees"></div></div>`;
    document.getElementById('formActivite').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target), cibles = fd.getAll('cibles');
      if (!cibles.length) { toast('Cochez au moins un niveau destinataire.', true); return; }
      const type = TYPES.find(t => fd.get('type').includes(t)) || 'Autre';
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        const r = await Api.call('createActivite', { type, titre: fd.get('titre'), lien: fd.get('lien'), dateLimite: fd.get('dateLimite'), description: fd.get('description'), cibleRoles: cibles });
        toast(`Activité publiée pour ${r.nbCibles} compte(s). Ils sont notifiés.`);
        e.target.reset(); await rafraichir();
        const sub = document.querySelector('[data-act-sub=gerer]'); if (sub) sub.click();
      } catch (err) { toast(err.message, true); }
      btn.disabled = false;
    });
    const zone = document.getElementById('actCreees');
    const liste = donnees.creees;
    if (!liste.length) { zone.innerHTML = '<div class="empty-state">Vous n\'avez encore demandé aucune activité.</div>'; return; }
    zone.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Activité</th><th>Destinataires</th><th>Échéance</th><th>Avancement</th><th></th></tr></thead><tbody>' + liste.map(a => {
      const pct = a.NbCibles ? Math.round(100 * a.NbFaits / a.NbCibles) : 0;
      return `<tr><td>${ICONES[a.Type] || '🔗'} <strong>${escHtml(a.Titre)}</strong>${a.Statut === 'Archivée' ? ' <span class="badge badge-cancel">Archivée</span>' : ''}${a.Echue ? ' <span class="badge badge-late">Échue (masquée aux destinataires)</span>' : ''}<div class="petit">${escHtml(a.Type)} · ${fmtDate(a.DateCreation)}</div></td>
        <td>${escHtml(jsonArr(a.CibleRoles).map(r => LIB_ROLE_COURT[r] || r).join(', '))} <span class="petit">(${a.NbCibles})</span></td><td>${a.DateLimite ? fmtDate(a.DateLimite) : '—'}</td>
        <td><div class="barre"><span style="width:${pct}%"></span></div><span class="petit">${a.NbFaits}/${a.NbCibles} faits · ${a.NbOuverts} en cours</span></td>
        <td><button class="btn-secondary btn-mini" data-detail="${escHtml(a.ID)}">Détails</button></td></tr>`;
    }).join('') + '</tbody></table></div>';
    zone.addEventListener('click', e => { const b = e.target.closest('[data-detail]'); if (b) ouvrirDetail(b.dataset.detail); });
  }

  async function ouvrirDetail(id) {
    let d;
    try { d = await Api.call('getActiviteDetail', { id }); } catch (e) { toast(e.message, true); return; }
    const a = d.activite;
    const ov = document.createElement('div'); ov.className = 'modal-overlay';
    const stat = { 'Fait': '<span class="badge badge-done">✔ Fait</span>', 'Ouvert': '<span class="badge badge-new">En cours</span>', 'Non ouvert': '<span class="badge badge-late">Non ouvert</span>' };
    const faits = d.cibles.filter(c => c.statut === 'Fait').length;
    ov.innerHTML = `<div class="modal-box" style="width:760px;max-height:92vh;overflow:auto">
      <h3 style="margin-top:0">${ICONES[a.Type] || '🔗'} ${escHtml(a.Titre)} ${a.Statut === 'Archivée' ? '<span class="badge badge-cancel">Archivée</span>' : ''}</h3>
      <form id="formModifAct">
        <div class="grid grid-2">
          <div class="field"><label>Titre</label><input name="titre" value="${escHtml(a.Titre)}" required></div>
          <div class="field"><label>Type</label><select name="type">${TYPES.map(t => `<option ${t === a.Type ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}</select></div>
          <div class="field"><label>Lien</label><input name="lien" type="url" value="${escHtml(a.Lien)}"></div>
          <div class="field"><label>Échéance</label><input name="dateLimite" type="date" required value="${escHtml(a.DateLimite || '')}"></div>
        </div>
        <div class="field"><label>Consignes</label><textarea name="description">${escHtml(a.Description)}</textarea></div>
        <button type="submit" class="btn-secondary btn-mini">Enregistrer les modifications</button>
        ${a.Lien ? ` <a href="${escHtml(lienSur(a.Lien))}" target="_blank" rel="noopener noreferrer" class="petit">Ouvrir le lien ↗</a>` : ''}
      </form>
      <h4 class="sous-titre" style="margin-top:16px">💬 Commentaires (visibles par les destinataires)</h4>
      <div>${jsonArr(a.Commentaires).map(x => `<div class="act-com"><span class="petit">${fmtDate(x.date)} · ${escHtml(x.auteur)}</span><br>${escHtml(x.texte).replace(/\n/g, '<br>')}</div>`).join('') || '<div class="petit">Aucun commentaire.</div>'}</div>
      <div style="display:flex;gap:8px;margin-top:8px"><textarea id="actNouvCom" rows="2" placeholder="Ajouter un commentaire ou une précision…" style="flex:1"></textarea><button id="actEnvoyerCom" class="btn-mini">Publier</button></div>
      <h4 class="sous-titre" style="margin-top:16px">Avancement : ${faits}/${d.cibles.length} ont terminé</h4>
      <div class="table-wrap" style="max-height:260px;overflow:auto"><table><thead><tr><th>Compte</th><th>Niveau</th><th>Lieu</th><th>Statut</th></tr></thead><tbody>${d.cibles.map(c => `<tr><td>${escHtml(c.nom)}<div class="petit">${escHtml(c.telephone)}</div></td><td>${LIB_ROLE_COURT[c.role] || ''}</td><td>${escHtml(c.lieu)}</td><td>${stat[c.statut] || ''}${c.date ? `<div class="petit">${fmtDate(c.date)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn-secondary" id="actArchiver">${a.Statut === 'Archivée' ? 'Réactiver' : 'Archiver (masquer aux destinataires)'}</button>
        <button class="btn-danger" id="actSupprimer">Supprimer</button><button class="btn-secondary" id="actFermer" style="margin-left:auto">Fermer</button></div></div>`;
    document.body.appendChild(ov);
    const fermer = () => ov.remove();
    ov.querySelector('#actFermer').onclick = fermer;
    ov.addEventListener('click', e => { if (e.target === ov) fermer(); });
    const appel = async (action, payload, msg) => { try { await Api.call(action, Object.assign({ id }, payload)); toast(msg); fermer(); await rafraichir(); } catch (err) { toast(err.message, true); } };
    ov.querySelector('#formModifAct').addEventListener('submit', e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); appel('updateActivite', f, 'Modifications enregistrées.'); });
    ov.querySelector('#actEnvoyerCom').onclick = () => { const t = ov.querySelector('#actNouvCom').value.trim(); if (!t) return; appel('commenterActivite', { texte: t }, 'Commentaire publié (les destinataires sont notifiés).'); };
    ov.querySelector('#actArchiver').onclick = () => appel('updateActivite', { statut: a.Statut === 'Archivée' ? 'Active' : 'Archivée' }, a.Statut === 'Archivée' ? 'Activité réactivée.' : 'Activité archivée.');
    ov.querySelector('#actSupprimer').onclick = () => { if (confirm('Supprimer définitivement cette activité et son suivi ? Les destinataires ne la verront plus.')) appel('deleteActivite', {}, 'Activité supprimée.'); };
  }
})();

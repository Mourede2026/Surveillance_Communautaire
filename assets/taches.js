/**
 * Module « Tâches » (activité de type « Tâche (recensement et suivi) »).
 *
 *   • Niveau supérieur : rédige DANS la plateforme le questionnaire d'enregistrement du cas (informations
 *     clés) et le questionnaire de suivi quotidien, fixe la durée du suivi, puis consulte les données
 *     collectées (tableau, détail par cas, export CSV).
 *   • Relais communautaire : recense un cas (formulaire généré), puis saisit le suivi de ce cas chaque jour
 *     jusqu'à la fin de la période, ou clôture le suivi avec une issue.
 *
 * Dépend de api.js (Api, toast, escHtml). Utilisé par activites.js.
 *   Taches.construire(conteneur, questionnaireInitial?) -> { lire() }
 *   Taches.ouvrirRc(activite, onChange)
 *   Taches.rendreDonnees(conteneur, { activiteId })
 */
(function () {
  const TYPES_CHAMP = [['texte', 'Texte court'], ['texte_long', 'Texte long'], ['nombre', 'Nombre'], ['date', 'Date'], ['choix', 'Choix unique'], ['choix_multiple', 'Choix multiples'], ['oui_non', 'Oui / Non']];
  const ISSUES = ['Guéri', 'Décédé', 'Référé / transféré', 'Perdu de vue', 'Autre'];
  const esc = v => escHtml(v == null ? '' : v);

  function aujourdhui() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ajouterJours(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function joursEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
  function dFr(iso) { iso = String(iso || '').slice(0, 10); return iso.length === 10 ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—'; }
  function parseQ(a) { try { const q = JSON.parse(a.Questionnaire || '{}'); return { champsCas: q.champsCas || [], champsSuivi: q.champsSuivi || [], dureeJours: q.dureeJours || 7, suivisParJour: q.suivisParJour || 1 }; } catch (e) { return { champsCas: [], champsSuivi: [], dureeJours: 7, suivisParJour: 1 }; } }

  // =====================================================================
  // 1. Constructeur de questionnaire (niveau supérieur)
  // =====================================================================
  function defaut() {
    return {
      dureeJours: 7, suivisParJour: 1,
      champsCas: [
        { label: 'Nom et prénom du patient', type: 'texte', opts: '', obligatoire: true },
        { label: 'Sexe', type: 'choix', opts: 'Masculin\nFéminin', obligatoire: true },
        { label: 'Âge (en années)', type: 'nombre', opts: '', obligatoire: true },
        { label: 'Téléphone du patient ou d\'un proche', type: 'texte', opts: '', obligatoire: false },
        { label: 'Date de début des signes', type: 'date', opts: '', obligatoire: false }
      ],
      champsSuivi: [
        { label: 'État du patient aujourd\'hui', type: 'choix', opts: 'Amélioré\nStationnaire\nAggravé\nGuéri', obligatoire: true },
        { label: 'Signes présents', type: 'texte_long', opts: '', obligatoire: false },
        { label: 'Le patient a-t-il consulté un centre de santé ?', type: 'oui_non', opts: '', obligatoire: false },
        { label: 'Observations', type: 'texte_long', opts: '', obligatoire: false }
      ]
    };
  }

  function construire(conteneur, init) {
    const etat = init ? JSON.parse(JSON.stringify(init)) : defaut();
    // Édition d'un questionnaire publié : les questions existantes gardent leur id (donc leurs réponses) et leur type.
    ['champsCas', 'champsSuivi'].forEach(k => etat[k].forEach(c => { if (c.opts === undefined) c.opts = (c.options || []).join('\n'); }));
    const BLOCS = [
      { cle: 'champsCas', titre: '1. Informations clés du cas à recenser', aide: 'Questions posées au relais communautaire quand il enregistre un nouveau cas (identité, âge, sexe, signes…).' },
      { cle: 'champsSuivi', titre: '2. Questionnaire de suivi quotidien', aide: 'Questions que le relais remplira chaque jour pour chaque cas recensé, pendant toute la durée du suivi.' }
    ];

    function ligneHtml(cle, i, c) {
      const aOptions = c.type === 'choix' || c.type === 'choix_multiple';
      return `<div class="q-row" data-l="${cle}" data-i="${i}">
        <div class="q-ligne1">
          <input class="q-label" placeholder="Intitulé de la question" value="${esc(c.label)}" maxlength="140">
          <select class="q-type">${TYPES_CHAMP.map(t => `<option value="${t[0]}" ${t[0] === c.type ? 'selected' : ''}>${t[1]}</option>`).join('')}</select>
        </div>
        <div class="q-ligne2">
          <label class="q-req"><input type="checkbox" class="q-oblig" ${c.obligatoire ? 'checked' : ''}> Obligatoire</label>
          <span class="q-btns"><button type="button" class="btn-secondary btn-mini" data-act="up" title="Monter">↑</button><button type="button" class="btn-secondary btn-mini" data-act="down" title="Descendre">↓</button><button type="button" class="btn-danger btn-mini" data-act="del" title="Supprimer">✕</button></span>
        </div>
        ${aOptions ? `<textarea class="q-opts" rows="3" placeholder="Un choix par ligne (au moins 2)">${esc(c.opts)}</textarea>` : ''}
      </div>`;
    }

    function dessiner() {
      conteneur.innerHTML = BLOCS.map(b => `<div class="q-bloc"><h4 class="sous-titre">${b.titre}</h4><p class="petit" style="margin:0 0 8px">${b.aide}</p>
          <div>${etat[b.cle].map((c, i) => ligneHtml(b.cle, i, c)).join('') || '<div class="petit">Aucune question.</div>'}</div>
          <button type="button" class="btn-secondary btn-mini" data-add="${b.cle}">+ Ajouter une question</button></div>`).join('') +
        `<div class="grid grid-2"><div class="field"><label>Durée du suivi de chaque cas (jours)</label><input type="number" min="1" max="90" class="q-duree" value="${esc(etat.dureeJours)}"><div class="petit">Un cas recensé sera suivi chaque jour pendant cette durée.</div></div>
          <div class="field"><label>Suivis attendus par jour</label><select class="q-spj">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${Number(etat.suivisParJour || 1) === n ? 'selected' : ''}>${n}${n === 1 ? ' (une fois par jour)' : n === 3 ? ' (matin, midi et soir)' : ''}</option>`).join('')}</select><div class="petit">Le relais pourra saisir plusieurs suivis le même jour (matin, midi, soir ou autre heure), chacun avec les mêmes variables clés.</div></div></div>`;
    }

    conteneur.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) { etat[add.dataset.add].push({ label: '', type: 'texte', opts: '', obligatoire: false }); dessiner(); const l = conteneur.querySelectorAll(`[data-l="${add.dataset.add}"] .q-label`); if (l.length) l[l.length - 1].focus(); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const row = b.closest('.q-row'), cle = row.dataset.l, i = Number(row.dataset.i), liste = etat[cle];
      if (b.dataset.act === 'del') liste.splice(i, 1);
      else if (b.dataset.act === 'up' && i > 0) [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]];
      else if (b.dataset.act === 'down' && i < liste.length - 1) [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]];
      dessiner();
    });
    conteneur.addEventListener('input', e => {
      const row = e.target.closest('.q-row');
      if (e.target.matches('.q-duree')) { etat.dureeJours = e.target.value; return; }
      if (!row) return;
      const c = etat[row.dataset.l][Number(row.dataset.i)];
      if (e.target.matches('.q-label')) c.label = e.target.value;
      else if (e.target.matches('.q-opts')) c.opts = e.target.value;
    });
    conteneur.addEventListener('change', e => {
      if (e.target.matches('.q-spj')) { etat.suivisParJour = Number(e.target.value); return; }
      const row = e.target.closest('.q-row'); if (!row) return;
      const c = etat[row.dataset.l][Number(row.dataset.i)];
      if (e.target.matches('.q-oblig')) c.obligatoire = e.target.checked;
      else if (e.target.matches('.q-type')) { c.type = e.target.value; dessiner(); }
    });
    dessiner();

    return {
      ids() { return { champsCas: etat.champsCas.filter(c => c.id).map(c => c.id), champsSuivi: etat.champsSuivi.filter(c => c.id).map(c => c.id) }; },
      lire() {
        const net = liste => liste.filter(c => c.label.trim()).map(c => ({
          id: c.id || undefined, label: c.label.trim(), type: c.type, obligatoire: !!c.obligatoire,
          options: (c.type === 'choix' || c.type === 'choix_multiple') ? String(c.opts || '').split('\n').map(x => x.trim()).filter(Boolean) : []
        }));
        const q = { champsCas: net(etat.champsCas), champsSuivi: net(etat.champsSuivi), dureeJours: Number(etat.dureeJours), suivisParJour: Number(etat.suivisParJour) || 1 };
        if (!q.champsCas.length) throw new Error('Ajoutez au moins une question dans « Informations clés du cas à recenser ».');
        if (!q.champsSuivi.length) throw new Error('Ajoutez au moins une question dans le « Questionnaire de suivi quotidien ».');
        [['Informations du cas', q.champsCas], ['Questionnaire de suivi', q.champsSuivi]].forEach(([n, l]) => l.forEach(c => {
          if ((c.type === 'choix' || c.type === 'choix_multiple') && c.options.length < 2) throw new Error(`Dans « ${n} », la question « ${c.label} » doit proposer au moins 2 choix (un par ligne).`);
        }));
        if (!(q.dureeJours >= 1 && q.dureeJours <= 90)) throw new Error('La durée du suivi doit être comprise entre 1 et 90 jours.');
        return q;
      }
    };
  }

  // =====================================================================
  // 2. Génération et lecture des formulaires (côté RC)
  // =====================================================================
  function champHtml(c, pref) {
    const id = pref + c.id, req = c.obligatoire ? ' required' : '';
    const label = `<label for="${id}">${esc(c.label)}${c.obligatoire ? ' <span class="req">*</span>' : ''}</label>`;
    let ctrl = '';
    if (c.type === 'texte_long') ctrl = `<textarea id="${id}" name="${id}" rows="3" maxlength="2000"${req}></textarea>`;
    else if (c.type === 'nombre') ctrl = `<input id="${id}" name="${id}" type="number" step="any" inputmode="decimal"${req}>`;
    else if (c.type === 'date') ctrl = `<input id="${id}" name="${id}" type="date" max="${aujourdhui()}"${req}>`;
    else if (c.type === 'choix') ctrl = `<select id="${id}" name="${id}"${req}><option value="">— Choisir —</option>${(c.options || []).map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
    else if (c.type === 'oui_non') ctrl = `<select id="${id}" name="${id}"${req}><option value="">— Choisir —</option><option>Oui</option><option>Non</option></select>`;
    else if (c.type === 'choix_multiple') return `<div class="field"><label>${esc(c.label)}${c.obligatoire ? ' <span class="req">*</span>' : ''}</label><div class="checks q-checks">${(c.options || []).map(o => `<label><input type="checkbox" name="${id}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div></div>`;
    else ctrl = `<input id="${id}" name="${id}" type="text" maxlength="500"${req}>`;
    return `<div class="field">${label}${ctrl}</div>`;
  }
  function formulaireHtml(champs, pref) { return champs.map(c => champHtml(c, pref)).join(''); }

  function lireReponses(form, champs, pref) {
    const out = {};
    champs.forEach(c => {
      const name = pref + c.id;
      if (c.type === 'choix_multiple') out[c.id] = Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(x => x.value);
      else { const el = form.querySelector(`[name="${name}"]`); out[c.id] = el ? el.value : ''; }
    });
    return out;
  }
  function remplir(form, champs, pref, rep) {
    champs.forEach(c => {
      const v = (rep || {})[c.id], name = pref + c.id;
      if (c.type === 'choix_multiple') form.querySelectorAll(`input[name="${name}"]`).forEach(x => { x.checked = Array.isArray(v) && v.includes(x.value); });
      else { const el = form.querySelector(`[name="${name}"]`); if (el) el.value = v == null ? '' : v; }
    });
  }
  function valeurTexte(c, v) {
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (v === '' || v == null) return '—';
    return c.type === 'date' ? dFr(v) : String(v);
  }
  function resume(champs, rep, n) {
    return champs.map(c => ({ c, v: (rep || {})[c.id] })).filter(x => x.v !== '' && x.v != null && !(Array.isArray(x.v) && !x.v.length))
      .slice(0, n).map(x => valeurTexte(x.c, x.v)).join(' · ') || '—';
  }

  function badgeEtat(c) {
    if (c.Etat === 'Clôturé') return `<span class="badge badge-done">Clôturé${c.Issue ? ' · ' + esc(c.Issue) : ''}</span>`;
    if (c.Etat === 'Suivi terminé') return '<span class="badge badge-cancel">Suivi terminé</span>';
    return c.JoursManquants && c.JoursManquants.length ? `<span class="badge badge-late">En suivi · ${c.JoursManquants.length} jour(s) à saisir</span>` : '<span class="badge badge-new">En suivi · à jour</span>';
  }

  function ouvrirModal(html, largeur) {
    const ov = document.createElement('div'); ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal-box tache-box" style="width:${largeur || 820}px;max-height:92vh;overflow:auto">${html}</div>`;
    document.body.appendChild(ov);
    const fermer = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) fermer(); });
    return { ov, fermer, box: ov.firstElementChild };
  }

  // =====================================================================
  // 3. Espace du relais communautaire : recenser et suivre
  // =====================================================================
  async function ouvrirRc(a, onChange) {
    const q = parseQ(a), auj = aujourdhui();
    const { box, fermer } = ouvrirModal(`
      <h3 style="margin-top:0">🗂️ ${esc(a.Titre)}</h3>
      <div class="petit" style="margin-bottom:8px">Demandé par ${esc(a.CreeParNom)} · ${a.DateLimite ? (String(a.DateLimite) < auj ? '<strong>recensement clos depuis le ' + dFr(a.DateLimite) + '</strong>' : 'recensement des cas jusqu\'au <strong>' + dFr(a.DateLimite) + '</strong>') : ''} · chaque cas est suivi pendant <strong>${q.dureeJours} jour(s)</strong></div>
      ${a.Description ? `<p style="margin:0 0 10px">${esc(a.Description).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="sub-tabs"><button type="button" class="active" data-tt="nouveau">➕ Recenser un cas</button><button type="button" data-tt="cas" id="ttCas">📋 Mes cas</button></div>
      <div id="tNouveau"></div><div id="tCas" style="display:none">Chargement…</div>
      <div style="margin-top:14px;text-align:right"><button type="button" class="btn-secondary" id="tFermer">Fermer</button></div>`);
    box.querySelector('#tFermer').onclick = () => { fermer(); if (typeof onChange === 'function') onChange(); };
    const zNouveau = box.querySelector('#tNouveau'), zCas = box.querySelector('#tCas');
    let cas = [];

    box.querySelectorAll('[data-tt]').forEach(b => b.addEventListener('click', () => {
      box.querySelectorAll('[data-tt]').forEach(x => x.classList.toggle('active', x === b));
      zNouveau.style.display = b.dataset.tt === 'nouveau' ? 'block' : 'none';
      zCas.style.display = b.dataset.tt === 'cas' ? 'block' : 'none';
    }));
    const montrerOnglet = t => box.querySelector(`[data-tt="${t}"]`).click();

    function dessinerNouveau() {
      if (a.DateLimite && String(a.DateLimite) < auj) { zNouveau.innerHTML = '<div class="empty-state">Le recensement de nouveaux cas est clos. Vous pouvez continuer le suivi des cas déjà recensés.</div>'; return; }
      zNouveau.innerHTML = `<form id="formCas"><div class="field"><label>Date du recensement</label><input type="date" name="__date" value="${auj}" max="${auj}" required></div>
        ${formulaireHtml(q.champsCas, 'cas_')}<button type="submit" class="btn-block">Enregistrer le cas</button></form>`;
      zNouveau.querySelector('#formCas').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target, btn = form.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          const r = await Api.call('tacheEnregistrerCas', { activiteId: a.ID, date: form.querySelector('[name=__date]').value, reponses: lireReponses(form, q.champsCas, 'cas_') });
          toast(r.queued ? 'Pas de réseau : le cas est gardé sur ce téléphone et sera envoyé automatiquement.' : `Cas enregistré. Son suivi se fait pendant ${q.dureeJours} jour(s).`);
          dessinerNouveau();
          if (!r.queued) { await charger(); montrerOnglet('cas'); }
        } catch (err) { toast(err.message, true); btn.disabled = false; }
      });
    }

    async function charger() {
      try { const r = await Api.call('listTacheCas', { activiteId: a.ID }); cas = r.cas; }
      catch (e) { zCas.innerHTML = '<div class="empty-state">Erreur de chargement : ' + esc(e.message) + '</div>'; return; }
      const dus = cas.filter(c => c.Etat === 'En suivi' && c.JoursManquants.length).length;
      box.querySelector('#ttCas').textContent = `📋 Mes cas (${cas.length})` + (dus ? ' · ' + dus + ' à suivre' : '');
      dessinerCas();
    }

    function dessinerCas() {
      if (!cas.length) { zCas.innerHTML = '<div class="empty-state">Vous n\'avez encore recensé aucun cas pour cette tâche.</div>'; return; }
      zCas.innerHTML = cas.map(c => {
        const pct = c.NbAttendus ? Math.round(100 * c.NbFaits / c.NbAttendus) : 100;
        return `<div class="card tache-cas" data-cas="${esc(c.ID)}">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><strong>${esc(resume(q.champsCas, c.Reponses, 3))}</strong>${badgeEtat(c)}</div>
          <div class="petit" style="margin:4px 0">Recensé le ${dFr(c.DateEnregistrement)} · suivi jusqu'au ${dFr(c.DateFinSuivi)} · ${c.NbFaits}/${c.NbTotalAttendus || c.DureeJours} suivi(s) saisis (${c.Suivis.length} au total)${c.HorsLigne ? ' · saisi hors connexion' : ''}</div>
          <div class="barre"><span style="width:${pct}%"></span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            ${c.Etat === 'En suivi' ? `<button type="button" class="btn-mini" data-suivre="${esc(c.ID)}">📝 Saisir le suivi</button>` : ''}
            <button type="button" class="btn-secondary btn-mini" data-histo="${esc(c.ID)}">Voir le dossier</button>
          </div><div class="tache-zone" style="margin-top:10px"></div></div>`;
      }).join('');
    }

    zCas.addEventListener('click', e => {
      const b = e.target.closest('[data-suivre],[data-histo]'); if (!b) return;
      const carte = b.closest('.tache-cas'), zone = carte.querySelector('.tache-zone');
      const c = cas.find(x => x.ID === carte.dataset.cas);
      if (b.dataset.histo) { zone.innerHTML = zone.dataset.mode === 'histo' ? '' : dossierHtml(c, q); zone.dataset.mode = zone.dataset.mode === 'histo' ? '' : 'histo'; return; }
      if (zone.dataset.mode === 'suivi') { zone.innerHTML = ''; zone.dataset.mode = ''; return; }
      zone.dataset.mode = 'suivi'; formSuivi(zone, c);
    });

    function momentParDefaut() { const h = new Date().getHours(); return h < 11 ? 'Matin' : (h < 15 ? 'Midi' : 'Soir'); }
    function formSuivi(zone, c) {
      const fin = c.DateFinSuivi < auj ? c.DateFinSuivi : auj, spj = c.SuivisParJour || 1;
      const jours = []; for (let d = c.DateEnregistrement; d <= fin; d = ajouterJours(d, 1)) jours.push(d);
      const nb = d => c.ParJour[d] || 0;
      const defautJour = jours.includes(auj) && nb(auj) < spj ? auj : (jours.find(d => d > c.DateEnregistrement && nb(d) < spj) || jours[jours.length - 1]);
      zone.innerHTML = `<form class="tache-form-suivi">
        <div class="petit" style="margin-bottom:6px">Vous pouvez saisir <strong>plusieurs suivis le même jour</strong> (matin, midi, soir, autre heure). Chaque suivi est ajouté ; il ne peut plus être modifié ni supprimé par vous.${spj > 1 ? ' Attendus : <strong>' + spj + ' par jour</strong>.' : ''}</div>
        <div class="grid grid-2"><div class="field"><label>Jour du suivi</label><select name="__jour">${jours.map(d => `<option value="${d}" ${d === defautJour ? 'selected' : ''}>Jour ${joursEntre(c.DateEnregistrement, d)} — ${dFr(d)} (${nb(d)}${spj > 1 ? '/' + spj : ''} saisi${nb(d) > 1 ? 's' : ''})</option>`).join('')}</select></div>
        <div class="field"><label>Moment du suivi</label><select name="__moment">${['Matin', 'Midi', 'Soir', 'Autre'].map(m => `<option ${m === momentParDefaut() ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div>
        <div class="field" data-heure style="display:none"><label>Heure précise</label><input type="time" name="__heure"></div>
        ${formulaireHtml(q.champsSuivi, 'suv_')}
        <label class="q-req" style="display:flex;gap:6px;align-items:center;margin:6px 0"><input type="checkbox" name="__clot"> Clôturer le suivi de ce cas</label>
        <div class="field" data-issue style="display:none"><label>Issue du cas</label><select name="__issue"><option value="">— Choisir —</option>${ISSUES.map(i => `<option>${esc(i)}</option>`).join('')}</select></div>
        <button type="submit" class="btn-block">Enregistrer ce suivi</button></form>`;
      const form = zone.querySelector('form');
      form.querySelector('[name=__moment]').addEventListener('change', ev => { form.querySelector('[data-heure]').style.display = ev.target.value === 'Autre' ? 'block' : 'none'; });
      form.querySelector('[name=__clot]').addEventListener('change', ev => { form.querySelector('[data-issue]').style.display = ev.target.checked ? 'block' : 'none'; });
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const clot = form.querySelector('[name=__clot]').checked, issue = form.querySelector('[name=__issue]').value;
        if (clot && !issue) { toast('Choisissez l\'issue du cas pour clôturer son suivi.', true); return; }
        if (clot && !confirm('Clôturer le suivi de ce cas ? Vous ne pourrez plus saisir de suivi pour lui.')) return;
        const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          const r = await Api.call('tacheSaisirSuivi', { casId: c.ID, jour: form.querySelector('[name=__jour]').value, moment: form.querySelector('[name=__moment]').value, heure: form.querySelector('[name=__heure]').value, reponses: lireReponses(form, q.champsSuivi, 'suv_'), cloturer: clot, issue });
          toast(r.queued ? 'Pas de réseau : le suivi est gardé sur ce téléphone et sera envoyé automatiquement.' : 'Suivi enregistré. Vous pouvez en ajouter un autre (autre moment de la journée).');
          if (!r.queued) await charger();
        } catch (err) { toast(err.message, true); btn.disabled = false; }
      });
    }

    dessinerNouveau();
    await charger();
    if (cas.some(c => c.Etat === 'En suivi')) montrerOnglet('cas');
  }

  function momentLibelle(s) { return s.Moment ? (s.Moment === 'Autre' && s.Heure ? s.Heure : s.Moment) : (s.Heure || ''); }
function dossierHtml(c, q, peutSupprimer) {
    const lignes = (champs, rep) => champs.map(ch => `<tr><th style="width:42%">${esc(ch.label)}</th><td>${esc(valeurTexte(ch, (rep || {})[ch.id]))}</td></tr>`).join('');
    return `<div class="tache-dossier"><h4 class="sous-titre">Informations du cas</h4><table><tbody>${lignes(q.champsCas, c.Reponses)}</tbody></table>
      <h4 class="sous-titre" style="margin-top:12px">Suivi jour par jour</h4>
      ${c.Suivis.length ? c.Suivis.map(s => `<div class="act-com"><strong>Jour ${joursEntre(c.DateEnregistrement, s.Jour)} — ${dFr(s.Jour)}${momentLibelle(s) ? ' · ' + esc(momentLibelle(s)) : ''}</strong>${peutSupprimer ? ` <button type="button" class="btn-danger btn-mini" data-suppr-suivi="${esc(s.ID)}" title="Supprimer ce suivi">🗑</button>` : ''}<table><tbody>${lignes(q.champsSuivi, s.Reponses)}</tbody></table></div>`).join('') : '<div class="petit">Aucun suivi saisi pour le moment.</div>'}
      ${c.JoursManquants.length ? `<div class="petit" style="color:#8F2A18">Jours à compléter${(c.SuivisParJour || 1) > 1 ? ' (moins de ' + c.SuivisParJour + ' suivis)' : ''} : ${c.JoursManquants.map(dFr).join(', ')}</div>` : ''}
      ${c.Etat === 'Clôturé' ? `<div class="petit">Clôturé le ${dFr(c.DateCloture)} — issue : ${esc(c.Issue)}</div>` : ''}</div>`;
  }

  // =====================================================================
  // 4. Données collectées (niveau supérieur)
  // =====================================================================
  function csv(lignes) { return '\ufeff' + lignes.map(l => l.map(x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(';')).join('\r\n'); }
  function telecharger(nom, contenu) {
    const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const nomFichier = t => String(t || 'taches').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').slice(0, 40);

  async function rendreDonnees(el, opts) {
    el.innerHTML = 'Chargement…';
    let r;
    try { r = await Api.call('listTacheCas', { activiteId: opts.activiteId }); } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement : ' + esc(e.message) + '</div>'; return; }
    const act = r.activites[opts.activiteId];
    if (!act) { el.innerHTML = '<div class="empty-state">Tâche introuvable.</div>'; return; }
    const q = act.questionnaire, cas = r.cas;
    if (!cas.length) { el.innerHTML = '<div class="empty-state">Aucun cas recensé pour le moment. Les données apparaîtront ici dès que les relais communautaires enregistreront des cas.</div>'; return; }
    const nbSuivis = cas.reduce((t, c) => t + c.Suivis.length, 0), manquants = cas.reduce((t, c) => t + (c.Etat === 'En suivi' ? c.JoursManquants.length : 0), 0);
    const stat = (n, l) => `<div class="stat-card"><div class="n">${n}</div><div class="l">${l}</div></div>`;
    el.innerHTML = `<div class="grid grid-4" style="margin-bottom:12px">${stat(cas.length, 'Cas recensés')}${stat(cas.filter(c => c.Etat === 'En suivi').length, 'En cours de suivi')}${stat(nbSuivis, 'Suivis saisis')}${stat(manquants, 'Suivis en retard')}</div>
      <div class="admin-barre" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <input id="tdRech" placeholder="Rechercher (RC, village, patient…)" style="flex:1;min-width:180px">
        <select id="tdEtat"><option value="">Tous les états</option><option>En suivi</option><option>Suivi terminé</option><option>Clôturé</option></select>
        <select id="tdParRc" title="Sélectionner d'un coup tous les cas d'un relais communautaire"><option value="">Sélection rapide par relais…</option>${[...new Set(cas.map(c => c.RcNom))].sort().map(n => `<option>${esc(n)}</option>`).join('')}</select>
        <button type="button" class="btn-danger btn-mini" id="tdSuppr" disabled>🗑 Supprimer la sélection (0)</button>
        <button type="button" class="btn-secondary btn-mini" id="tdExpCas">⬇ Cas (CSV)</button>
        <button type="button" class="btn-secondary btn-mini" id="tdExpSuivis">⬇ Suivis journaliers (CSV)</button></div>
      <div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="tdToutes" title="Sélectionner tous les cas affichés" style="width:auto"></th><th>Recensé le</th><th>Cas</th><th>Relais communautaire</th><th>Village</th><th>État</th><th>Suivi</th><th></th></tr></thead><tbody id="tdCorps"></tbody></table></div>`;
    const corps = el.querySelector('#tdCorps');
    function liste() {
      const t = el.querySelector('#tdRech').value.trim().toLowerCase(), e = el.querySelector('#tdEtat').value;
      return cas.filter(c => (!e || c.Etat === e) && (!t || (c.RcNom + ' ' + c.VillageNom + ' ' + resume(q.champsCas, c.Reponses, 99)).toLowerCase().includes(t)));
    }
    function montrer() {
      const v = liste();
      corps.innerHTML = v.length ? v.map(c => `<tr><td><input type="checkbox" class="td-sel" data-sel="${esc(c.ID)}" ${selection.has(c.ID) ? 'checked' : ''} style="width:auto"></td><td>${dFr(c.DateEnregistrement)}</td><td><strong>${esc(resume(q.champsCas, c.Reponses, 3))}</strong></td><td>${esc(c.RcNom)}</td><td>${esc(c.VillageNom)}</td><td>${badgeEtat(c)}</td>
        <td>${c.NbFaits}/${c.DureeJours}</td><td><button type="button" class="btn-secondary btn-mini" data-dossier="${esc(c.ID)}">Dossier</button> <button type="button" class="btn-danger btn-mini" data-suppr="${esc(c.ID)}" title="Supprimer ce cas et son suivi">🗑</button></td></tr>`).join('') : '<tr><td colspan="8" class="petit">Aucun cas ne correspond.</td></tr>';
      majSelection();
    }
    // Suppression ligne par ligne (le demandeur garde la main : cocher les cas à supprimer, ou 🗑 sur une ligne).
    const selection = new Set();
    function majSelection() {
      const b = el.querySelector('#tdSuppr'); b.disabled = !selection.size; b.textContent = '🗑 Supprimer la sélection (' + selection.size + ')';
      const v = liste(); const t = el.querySelector('#tdToutes'); t.checked = v.length > 0 && v.every(c => selection.has(c.ID));
    }
    async function supprimer(ids) {
      if (!ids.length) return;
      if (!confirm('Supprimer définitivement ' + ids.length + ' cas, avec tout leur suivi ? Les relais communautaires concernés seront prévenus. Cette action est irréversible.')) return;
      try { const r = await Api.call('tacheSupprimerCas', { activiteId: opts.activiteId, casIds: ids }); toast(r.supprimes + ' cas supprimé(s).'); if (typeof opts.onChange === 'function') opts.onChange(); await rendreDonnees(el, opts); }
      catch (err) { toast(err.message, true); }
    }
    el.querySelector('#tdRech').addEventListener('input', montrer);
    el.querySelector('#tdEtat').addEventListener('change', montrer);
    corps.addEventListener('change', e => { const c = e.target.closest('.td-sel'); if (!c) return; c.checked ? selection.add(c.dataset.sel) : selection.delete(c.dataset.sel); majSelection(); });
    el.querySelector('#tdToutes').addEventListener('change', e => { liste().forEach(c => e.target.checked ? selection.add(c.ID) : selection.delete(c.ID)); montrer(); });
    el.querySelector('#tdParRc').addEventListener('change', e => { const n = e.target.value; if (!n) return; cas.filter(c => c.RcNom === n).forEach(c => selection.add(c.ID)); e.target.value = ''; montrer(); });
    el.querySelector('#tdSuppr').addEventListener('click', () => supprimer([...selection]));
    corps.addEventListener('click', e => {
      const sp = e.target.closest('[data-suppr]'); if (sp) { supprimer([sp.dataset.suppr]); return; }
      const b = e.target.closest('[data-dossier]'); if (!b) return;
      const c = cas.find(x => x.ID === b.dataset.dossier);
      const m = ouvrirModal(`<h3 style="margin-top:0">Dossier du cas — ${esc(resume(q.champsCas, c.Reponses, 2))}</h3>
        <div class="petit" style="margin-bottom:8px">${esc(c.RcNom)} · ${esc(c.VillageNom)} · recensé le ${dFr(c.DateEnregistrement)} · ${badgeEtat(c)}</div>${dossierHtml(c, q, true)}
        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn-danger" id="tdSupprCas">🗑 Supprimer ce cas</button><button type="button" class="btn-secondary" id="tdFerme">Fermer</button></div>`, 760);
      m.box.querySelector('#tdFerme').onclick = m.fermer;
      m.box.addEventListener('click', async ev => {
        const b = ev.target.closest('[data-suppr-suivi]'); if (!b) return;
        if (!confirm('Supprimer définitivement ce suivi ? Le relais communautaire sera prévenu.')) return;
        try { await Api.call('tacheSupprimerSuivis', { activiteId: opts.activiteId, ids: [b.dataset.supprSuivi] }); toast('Suivi supprimé.'); m.fermer(); if (typeof opts.onChange === 'function') opts.onChange(); await rendreDonnees(el, opts); }
        catch (err) { toast(err.message, true); }
      });
      m.box.querySelector('#tdSupprCas').onclick = () => { m.fermer(); supprimer([c.ID]); };
    });
    el.querySelector('#tdExpCas').onclick = () => {
      const l = [['Tâche', 'Relais communautaire', 'Village', 'Date de recensement', 'Fin du suivi', 'État', 'Issue', 'Suivis saisis', 'Suivis attendus'].concat(q.champsCas.map(c => c.label))];
      liste().forEach(c => l.push([act.titre, c.RcNom, c.VillageNom, c.DateEnregistrement, c.DateFinSuivi, c.Etat, c.Issue, c.NbFaits, c.DureeJours].concat(q.champsCas.map(ch => valeurTexte(ch, c.Reponses[ch.id]).replace(/^—$/, '')))));
      telecharger('cas_' + nomFichier(act.titre) + '.csv', csv(l));
    };
    el.querySelector('#tdExpSuivis').onclick = () => {
      const l = [['Tâche', 'Cas', 'Relais communautaire', 'Village', 'Date de recensement', 'Jour', 'Date du suivi', 'Moment', 'Heure'].concat(q.champsSuivi.map(c => c.label))];
      liste().forEach(c => c.Suivis.forEach(s => l.push([act.titre, resume(q.champsCas, c.Reponses, 2), c.RcNom, c.VillageNom, c.DateEnregistrement, 'J' + joursEntre(c.DateEnregistrement, s.Jour), s.Jour, s.Moment || '', s.Heure || ''].concat(q.champsSuivi.map(ch => valeurTexte(ch, s.Reponses[ch.id]).replace(/^—$/, ''))))));
      telecharger('suivis_' + nomFichier(act.titre) + '.csv', csv(l));
    };
    montrer();
  }

  window.Taches = { construire, ouvrirRc, rendreDonnees, parseQuestionnaire: parseQ };
})();

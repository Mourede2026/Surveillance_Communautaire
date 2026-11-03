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
  // Questionnaire intégré d'une collecte de données : liste complète (la tâche de suivi garde la liste ci-dessus).
  const TYPES_COLLECTE = [['texte', 'Texte court'], ['texte_long', 'Texte long'], ['entier', 'Nombre entier'], ['decimal', 'Nombre décimal'], ['nombre', 'Nombre (entier ou décimal)'], ['date', 'Date'], ['heure', 'Heure'], ['choix', 'Choix unique'], ['choix_multiple', 'Choix multiples'], ['oui_non', 'Oui / Non (booléen)'], ['gps', 'Position GPS'], ['signature', 'Signature'], ['photo', 'Photo (appareil photo)'], ['calcul', 'Calcul automatique']];
  const ISSUES = ['Guéri', 'Décédé', 'Référé / transféré', 'Perdu de vue', 'Autre'];
  const esc = v => escHtml(v == null ? '' : v);

  function aujourdhui() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ajouterJours(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function joursEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
  function dFr(iso) { iso = String(iso || '').slice(0, 10); return iso.length === 10 ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—'; }
  function parseQ(a) { try { const q = JSON.parse(a.Questionnaire || '{}'); return { champsCas: q.champsCas || [], champsSuivi: q.champsSuivi || [], dureeJours: q.dureeJours || 7, suivisParJour: q.suivisParJour || 1, libellesSeances: q.libellesSeances || [], gpsSuivi: q.gpsSuivi || 'facultatif' }; } catch (e) { return { champsCas: [], champsSuivi: [], dureeJours: 7, suivisParJour: 1, libellesSeances: [], gpsSuivi: 'facultatif' }; } }
  // Nom d'un suivi de la journée (ex. « Matin ») ; « Séance k » si le demandeur n'en a pas donné.
  function libSeance(q, k) { return ((q && q.libellesSeances) || [])[k - 1] || ('Séance ' + k); }

  // =====================================================================
  // 1. Constructeur de questionnaire (niveau supérieur)
  // =====================================================================
  function defaut() {
    return {
      dureeJours: 7,
      suivisParJour: 1,
      gpsSuivi: 'facultatif',
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

  // Questionnaire simple d'une « Collecte de données » : une seule liste de questions (pas de suivi quotidien).
  function defautSimple() {
    return { champs: [
      { label: 'Nom de la structure ou de la localité', type: 'texte', opts: '', obligatoire: true },
      { label: 'Avez-vous observé des cas suspects ?', type: 'oui_non', opts: '', obligatoire: true },
      { label: 'Nombre de cas observés', type: 'nombre', opts: '', obligatoire: false },
      { label: 'Signes observés', type: 'choix_multiple', opts: 'Fièvre\nÉruption cutanée\nToux\nDiarrhée', obligatoire: false },
      { label: 'Observations', type: 'texte_long', opts: '', obligatoire: false }
    ] };
  }

  function construire(conteneur, init, options) {
    const simple = !!(options && options.simple);
    const etat = init ? JSON.parse(JSON.stringify(init)) : (simple ? defautSimple() : defaut());
    // Édition d'un questionnaire publié : les questions existantes gardent leur id (donc leurs réponses) et leur type.
    (simple ? ['champs'] : ['champsCas', 'champsSuivi']).forEach(k => (etat[k] = etat[k] || []).forEach(c => { if (c.opts === undefined) c.opts = (c.options || []).join('\n'); }));
    // Les calculs désignent les autres questions par leur rang : on convertit {c3} (identifiant stocké) en {Q2} (rang affiché).
    if (simple) (etat.champs = etat.champs || []).forEach((c, _i, liste) => { if (c.type === 'calcul' && c.formule && !c.opts) c.opts = String(c.formule).replace(/\{(c\d+)\}/g, (m, id) => { const j = liste.findIndex(x => x.id === id); return j >= 0 ? '{Q' + (j + 1) + '}' : m; }); });
    // Conditions d'affichage et choix en cascade : chaque question a une clé stable (son id, ou une clé provisoire) afin que les liens
    // résistent aux déplacements ; ils sont convertis en rangs (« Q2 ») à l'enregistrement.
    let compteurCle = 0; const cle = c => c._k || (c._k = 'n' + (++compteurCle)); const cleDe = cle;
    if (simple) etat.champs.forEach(c => {
      if (c.id) c._k = c.id;
      if (c.condition) { c.cond = JSON.parse(JSON.stringify(c.condition)); delete c.condition; }
      if (c.cascade) { c.cascChamp = c.cascade.champ; c.opts = (c.cascade.liens || []).map(l => l[0] + ' | ' + l[1]).join('\n'); delete c.cascade; }
    });
    const SRC_COND = t => ['calcul', 'gps', 'signature', 'photo'].indexOf(t) === -1;
    const NUM = ['nombre', 'entier', 'decimal'];
    const OP_TXT = { '=': 'est égal à', '!=': 'est différent de', '>': 'est supérieur à', '>=': 'est supérieur ou égal à', '<': 'est inférieur à', '<=': 'est inférieur ou égal à', contient: 'contient', ne_contient_pas: 'ne contient pas', renseigne: 'est renseignée', vide: 'est vide' };
    const opsPour = t => (t === 'choix' || t === 'oui_non' ? ['=', '!='] : t === 'choix_multiple' ? ['contient', 'ne_contient_pas'] : NUM.indexOf(t) !== -1 ? ['=', '!=', '>', '>=', '<', '<='] : t === 'date' || t === 'heure' ? ['=', '!=', '>', '>=', '<', '<='] : ['=', '!=', 'contient']).concat(['renseigne', 'vide']).map(o => [o, OP_TXT[o]]);
    const optsDe = src => String(src.opts || '').split('\n').map(x => x.trim()).filter(Boolean).map(l => src.cascChamp ? l.split('|')[0].trim() : l).filter((o, k, a) => a.indexOf(o) === k);
    const BLOCS = simple ? [
      { cle: 'champs', titre: 'Questions du questionnaire', aide: 'Texte, nombre entier ou décimal, date, heure, choix unique ou multiple, Oui/Non, position GPS, signature, ou calcul automatique à partir d\'autres questions (ex. IMC). Le questionnaire pourra être rempli autant de fois que nécessaire, même sans connexion.' }
    ] : [
      { cle: 'champsCas', titre: '1. Informations clés du cas à recenser', aide: 'Questions posées au relais communautaire quand il enregistre un nouveau cas (identité, âge, sexe, signes…).' },
      { cle: 'champsSuivi', titre: '2. Questionnaire de suivi quotidien', aide: 'Questions que le relais remplira chaque jour pour chaque cas recensé, pendant toute la durée du suivi.' }
    ];

    function regleHtml(liste, i, c, r, j) {
      const srcs = liste.slice(0, i).filter(x => x.label.trim() && SRC_COND(x.type)), src = srcs.find(x => cle(x) === r.champ);
      const vide = r.op === 'renseigne' || r.op === 'vide';
      let val = '';
      if (src && !vide) {
        if (src.type === 'choix' || src.type === 'choix_multiple') val = `<select class="q-r-val" data-j="${j}"><option value="">— valeur —</option>${optsDe(src).map(o => `<option ${o === r.valeur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
        else if (src.type === 'oui_non') val = `<select class="q-r-val" data-j="${j}"><option value="">— valeur —</option><option ${r.valeur === 'Oui' ? 'selected' : ''}>Oui</option><option ${r.valeur === 'Non' ? 'selected' : ''}>Non</option></select>`;
        else val = `<input class="q-r-val" data-j="${j}" type="${NUM.indexOf(src.type) !== -1 ? 'number' : src.type === 'date' ? 'date' : src.type === 'heure' ? 'time' : 'text'}" step="any" maxlength="80" value="${esc(r.valeur)}" placeholder="valeur" style="max-width:150px">`;
      }
      return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0;align-items:center"><select class="q-r-champ" data-j="${j}"><option value="">— Question —</option>${srcs.map(x => `<option value="${esc(cle(x))}" ${cle(x) === r.champ ? 'selected' : ''}>Q${liste.indexOf(x) + 1} — ${esc(x.label.trim().slice(0, 40))}</option>`).join('')}</select>${src ? `<select class="q-r-op" data-j="${j}">${opsPour(src.type).map(o => `<option value="${o[0]}" ${o[0] === r.op ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>` : ''}${val}<button type="button" class="btn-danger btn-mini" data-act="r-del" data-j="${j}" title="Retirer cette condition">✕</button></div>`;
    }
    function ligneHtml(cle_, i, c) {
      const h = ligneHtmlBase(cle_, i, c);
      if (!simple) return h;
      const liste = etat.champs, aCond = !!(c.cond && c.cond.regles && c.cond.regles.length) || c._condOuv, aCasc = c.type === 'choix' && (c.cascChamp || c._cascOuv);
      let panneaux = '';
      if (aCond) {
        const regles = (c.cond && c.cond.regles) || [];
        panneaux += `<div style="margin-top:6px;padding:8px;border-left:3px solid var(--teal-700,#0d6b61);background:var(--tint-2,#eef6f5);border-radius:6px"><div class="petit"><strong>🔀 Afficher cette question seulement si…</strong></div>
          ${regles.map((r, j) => regleHtml(liste, i, c, r, j)).join('') || '<div class="petit">Aucune condition : la question est toujours affichée.</div>'}
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px"><button type="button" class="btn-secondary btn-mini" data-act="cond-add">+ Ajouter une condition</button>
          ${regles.length > 1 ? `<select class="q-cond-lien"><option value="et" ${(c.cond.op || 'et') === 'et' ? 'selected' : ''}>toutes les conditions doivent être vraies (ET)</option><option value="ou" ${c.cond.op === 'ou' ? 'selected' : ''}>au moins une condition vraie (OU)</option></select>` : ''}
          <button type="button" class="btn-secondary btn-mini" data-act="cond-off">Retirer</button></div></div>`;
      }
      if (aCasc) {
        const parents = liste.slice(0, i).filter(x => x.label.trim() && x.type === 'choix'), par = parents.find(x => cle(x) === c.cascChamp);
        panneaux += `<div style="margin-top:6px;padding:8px;border-left:3px solid #b9770e;background:#fdf6e8;border-radius:6px"><div class="petit"><strong>🔗 Choix en cascade</strong> — les choix proposés dépendent de la réponse à une question précédente (ex. Département → Commune).</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px"><select class="q-casc-champ"><option value="">— Liste simple (pas de cascade) —</option>${parents.map(x => `<option value="${esc(cle(x))}" ${cle(x) === c.cascChamp ? 'selected' : ''}>Filtrer selon Q${liste.indexOf(x) + 1} — ${esc(x.label.trim().slice(0, 40))}</option>`).join('')}</select></div>
          ${par ? `<div class="petit" style="margin-top:4px">Écrivez un choix par ligne : <code>Choix | Valeur du parent</code> (ex. <code>${esc((optsDe(par)[0] ? 'Abomey' : 'Choix'))} | ${esc(optsDe(par)[0] || 'valeur')}</code>). Valeurs du parent : <strong>${esc(optsDe(par).join(', ') || 'à saisir dans la question parente')}</strong></div>` : '<div class="petit" style="margin-top:4px">Choisissez la question parente (un « Choix unique » placé avant celle-ci).</div>'}</div>`;
      }
      let r = h.replace('data-act="up"', `data-act="ins" title="Insérer une question avant celle-ci">⤒＋</button><button type="button" class="btn-secondary btn-mini" data-act="cond" title="Condition d\'affichage" ${aCond ? 'style="outline:2px solid var(--teal-700,#0d6b61)"' : ''}>🔀</button>${c.type === 'choix' ? `<button type="button" class="btn-secondary btn-mini" data-act="casc" title="Choix en cascade" ${aCasc ? 'style="outline:2px solid #b9770e"' : ''}>🔗</button>` : ''}<button type="button" class="btn-secondary btn-mini" data-act="up"`);
      if (c.cascChamp && c.type === 'choix') r = r.replace('Un choix par ligne (au moins 2)', 'Un choix par ligne : Choix | Valeur du parent');
      return r.replace(/<\/div>\s*$/, panneaux + '</div>');
    }
    function ligneHtmlBase(cle, i, c) {
      const aOptions = c.type === 'choix' || c.type === 'choix_multiple';
      return `<div class="q-row" data-l="${cle}" data-i="${i}">
        <div class="q-ligne1">
          ${simple ? `<span class="petit" style="font-weight:700;min-width:28px;align-self:center">Q${i + 1}</span>` : ''}<input class="q-label" placeholder="Intitulé de la question" value="${esc(c.label)}" maxlength="140">
          <select class="q-type">${(simple ? TYPES_COLLECTE.filter(t => t[0] !== 'nombre' || c.type === 'nombre') : TYPES_CHAMP).map(t => `<option value="${t[0]}" ${t[0] === c.type ? 'selected' : ''}>${t[1]}</option>`).join('')}</select>
        </div>
        <div class="q-ligne2">
          <label class="q-req"><input type="checkbox" class="q-oblig" ${c.obligatoire ? 'checked' : ''}> Obligatoire</label>
          <span class="q-btns"><button type="button" class="btn-secondary btn-mini" data-act="up" title="Monter">↑</button><button type="button" class="btn-secondary btn-mini" data-act="down" title="Descendre">↓</button><button type="button" class="btn-danger btn-mini" data-act="del" title="Supprimer">✕</button></span>
        </div>
        ${aOptions ? `<textarea class="q-opts" rows="3" placeholder="Un choix par ligne (au moins 2)">${esc(c.opts)}</textarea>` : ''}
        ${c.type === 'calcul' ? `<input class="q-formule" maxlength="300" placeholder="Formule, ex. {Q2} / ({Q3} * {Q3}) * 10000" value="${esc(c.opts)}"><div class="petit">Désignez les autres questions par leur numéro : {Q1}, {Q2}… Opérations + − * / ^ et parenthèses ; fonctions ARRONDI(x;2), MIN, MAX, SOMME, MOYENNE, ABS, RACINE, SI(condition;si_vrai;si_faux). Le résultat est calculé automatiquement (une question numérique ou un calcul placé avant).</div>` : ''}
      </div>`;
    }

    // Réglages du rythme du suivi : durée, nombre de suivis par jour (avec leur nom), position GPS.
    function seancesHtml() {
      const n = Math.floor(Number(etat.suivisParJour));
      if (!(n >= 2 && n <= 10)) return '<div class="petit">Un seul suivi par jour.</div>';
      const libs = etat.libellesSeances || [];
      return `<div class="petit" style="margin:6px 0 4px">Donnez un nom à chaque suivi de la journée (matin, midi, soir, ou la période de votre choix) :</div><div style="display:flex;gap:8px;flex-wrap:wrap">${Array.from({ length: n }, (_, k) => `<input type="text" class="q-seance-lib" data-k="${k}" maxlength="40" placeholder="Séance ${k + 1}" value="${esc(libs[k] || '')}" style="max-width:170px">`).join('')}</div>`;
    }
    function reglagesHtml() {
      return `<div class="q-bloc" style="margin-top:12px"><h4 class="sous-titre">3. Rythme du suivi</h4>
        <div style="display:flex;gap:12px;flex-wrap:wrap"><div class="field" style="max-width:260px"><label>Durée du suivi de chaque cas (jours)</label><input type="number" min="1" max="90" class="q-duree" value="${esc(etat.dureeJours)}"><div class="petit">Un cas recensé sera suivi pendant cette durée.</div></div>
          <div class="field" style="max-width:260px"><label>Nombre de suivis par jour</label><input type="number" min="1" max="10" class="q-spj" value="${esc(etat.suivisParJour)}"><div class="petit">1 = un seul suivi par jour ; 2 ou plus = plusieurs séances le même jour.</div></div>
          <div class="field" style="max-width:260px"><label>Position GPS à chaque suivi</label><select class="q-gps"><option value="facultatif" ${etat.gpsSuivi === 'facultatif' ? 'selected' : ''}>Facultative</option><option value="obligatoire" ${etat.gpsSuivi === 'obligatoire' ? 'selected' : ''}>Obligatoire</option><option value="non" ${etat.gpsSuivi === 'non' ? 'selected' : ''}>Désactivée</option></select><div class="petit">Le relais prend ses coordonnées GPS à chaque suivi.</div></div></div>
        <div class="petit" style="margin-top:4px">Modèles rapides : <button type="button" class="btn-secondary btn-mini" data-preset="matin,soir">Matin / Soir</button> <button type="button" class="btn-secondary btn-mini" data-preset="matin,midi,soir">Matin / Midi / Soir</button></div>
        <div class="q-seances">${seancesHtml()}</div></div>`;
    }

    function dessiner() {
      conteneur.innerHTML = BLOCS.map(b => `<div class="q-bloc"><h4 class="sous-titre">${b.titre}</h4><p class="petit" style="margin:0 0 8px">${b.aide}</p>
          <div>${etat[b.cle].map((c, i) => ligneHtml(b.cle, i, c)).join('') || '<div class="petit">Aucune question.</div>'}</div>
          <button type="button" class="btn-secondary btn-mini" data-add="${b.cle}">+ Ajouter une question</button>${simple ? ' <button type="button" class="btn-secondary btn-mini" data-add-debut>⤒ Ajouter au début</button> <button type="button" class="btn-secondary btn-mini" data-apercu>👁 Tester le questionnaire</button>' : ''}</div>`).join('') +
        (simple ? '' : reglagesHtml());
    }

    conteneur.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) { etat[add.dataset.add].push({ label: '', type: 'texte', opts: '', obligatoire: false }); dessiner(); const l = conteneur.querySelectorAll(`[data-l="${add.dataset.add}"] .q-label`); if (l.length) l[l.length - 1].focus(); return; }
      if (e.target.closest('[data-add-debut]')) { etat.champs.unshift({ label: '', type: 'texte', opts: '', obligatoire: false }); dessiner(); const l0 = conteneur.querySelector('.q-label'); if (l0) l0.focus(); return; }
      if (e.target.closest('[data-apercu]')) { apercu(); return; }
      const pre = e.target.closest('[data-preset]');
      if (pre) { const l = pre.dataset.preset.split(',').map(x => x.charAt(0).toUpperCase() + x.slice(1)); etat.suivisParJour = l.length; etat.libellesSeances = l; const si = conteneur.querySelector('.q-spj'); if (si) si.value = l.length; const z = conteneur.querySelector('.q-seances'); if (z) z.innerHTML = seancesHtml(); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const row = b.closest('.q-row'), cle = row.dataset.l, i = Number(row.dataset.i), liste = etat[cle];
      if (simple && ['ins', 'cond', 'casc', 'cond-add', 'cond-off', 'r-del'].indexOf(b.dataset.act) !== -1) {
        const q = liste[i];
        if (b.dataset.act === 'ins') liste.splice(i, 0, { label: '', type: 'texte', opts: '', obligatoire: false });
        else if (b.dataset.act === 'cond') { if (q.cond && q.cond.regles && q.cond.regles.length) { q._condOuv = !q._condOuv; } else { q._condOuv = !q._condOuv; q.cond = null; } }
        else if (b.dataset.act === 'casc') { q._cascOuv = !q._cascOuv; if (!q._cascOuv && q.cascChamp && !confirm('Retirer le lien de cascade de cette question ?')) q._cascOuv = true; else if (!q._cascOuv) q.cascChamp = ''; }
        else if (b.dataset.act === 'cond-add') { q.cond = q.cond || { op: 'et', regles: [] }; q.cond.regles.push({ champ: '', op: '=', valeur: '' }); q._condOuv = true; }
        else if (b.dataset.act === 'cond-off') { q.cond = null; q._condOuv = false; }
        else if (b.dataset.act === 'r-del') { q.cond.regles.splice(Number(b.dataset.j), 1); if (!q.cond.regles.length) { q.cond = null; } }
        dessiner(); return;
      }
      if (b.dataset.act === 'del') {
        const k = simple ? cleDe(liste[i]) : null;
        liste.splice(i, 1);
        if (simple && k) { // les liens (conditions, cascades) qui pointaient vers la question supprimée sont retirés
          let touche = false;
          liste.forEach(q => { if (q.cond && q.cond.regles) { const av = q.cond.regles.length; q.cond.regles = q.cond.regles.filter(r => r.champ !== k); if (q.cond.regles.length !== av) touche = true; if (!q.cond.regles.length) q.cond = null; } if (q.cascChamp === k) { q.cascChamp = ''; touche = true; } });
          if (touche) toast('Les conditions / cascades qui dépendaient de cette question ont été retirées.');
        }
      }
      else if (b.dataset.act === 'up' && i > 0) [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]];
      else if (b.dataset.act === 'down' && i < liste.length - 1) [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]];
      dessiner();
    });
    conteneur.addEventListener('input', e => {
      const row = e.target.closest('.q-row');
      if (e.target.matches('.q-duree')) { etat.dureeJours = e.target.value; return; }
      if (e.target.matches('.q-spj')) { etat.suivisParJour = e.target.value; const z = conteneur.querySelector('.q-seances'); if (z) z.innerHTML = seancesHtml(); return; }
      if (e.target.matches('.q-seance-lib')) { etat.libellesSeances = etat.libellesSeances || []; etat.libellesSeances[Number(e.target.dataset.k)] = e.target.value; return; }
      if (e.target.matches('.q-gps')) { etat.gpsSuivi = e.target.value; return; }
      if (!row) return;
      const c = etat[row.dataset.l][Number(row.dataset.i)];
      if (e.target.matches('.q-r-val')) { c.cond.regles[Number(e.target.dataset.j)].valeur = e.target.value; return; }
      if (e.target.matches('.q-label')) c.label = e.target.value;
      else if (e.target.matches('.q-opts') || e.target.matches('.q-formule')) c.opts = e.target.value;
    });
    conteneur.addEventListener('change', e => {
      const row = e.target.closest('.q-row'); if (!row) return;
      const c = etat[row.dataset.l][Number(row.dataset.i)];
      if (e.target.matches('.q-r-champ')) { const r = c.cond.regles[Number(e.target.dataset.j)]; r.champ = e.target.value; const src = etat.champs.find(x => cleDe(x) === r.champ); r.op = src ? opsPour(src.type)[0][0] : '='; r.valeur = ''; dessiner(); return; }
      if (e.target.matches('.q-r-op')) { const r = c.cond.regles[Number(e.target.dataset.j)]; r.op = e.target.value; if (r.op === 'renseigne' || r.op === 'vide') r.valeur = ''; dessiner(); return; }
      if (e.target.matches('.q-r-val')) { c.cond.regles[Number(e.target.dataset.j)].valeur = e.target.value; return; }
      if (e.target.matches('.q-cond-lien')) { c.cond.op = e.target.value; return; }
      if (e.target.matches('.q-casc-champ')) { c.cascChamp = e.target.value; dessiner(); return; }
      if (e.target.matches('.q-oblig')) c.obligatoire = e.target.checked;
      else if (e.target.matches('.q-type')) { const avant = c.type; c.type = e.target.value; if (c.type !== 'choix') c.cascChamp = ''; if ((avant === 'calcul') !== (c.type === 'calcul')) c.opts = ''; dessiner(); }
    });
    dessiner();

    function apercu() {
      let q; try { q = api.lire(); } catch (err) { toast(err.message, true); return; }
      const champs = q.champs.map((c, i) => Object.assign({}, c, { id: 'c' + (i + 1) })), idDe = r => 'c' + String(r).replace(/^Q/i, '');
      champs.forEach(c => {
        if (c.condition) c.condition = { op: c.condition.op, regles: c.condition.regles.map(r => Object.assign({}, r, { champ: idDe(r.champ) })) };
        if (c.cascade) c.cascade = { champ: idDe(c.cascade.champ), liens: c.cascade.liens };
        if (c.formule) c.formule = c.formule.replace(/\{Q(\d+)\}/gi, (m, n) => '{c' + n + '}');
      });
      const m = ouvrirModal(`<h3 style="margin-top:0">👁 Test du questionnaire</h3><p class="petit">Aperçu tel que le verront les destinataires : essayez les conditions et les cascades. Rien n'est enregistré.</p><form id="apForm">${formulaireHtml(champs, 'ap_')}<div style="margin-top:10px;text-align:right"><button type="button" class="btn-secondary" id="apFerme">Fermer</button></div></form>`, 680);
      brancher(m.box.querySelector('#apForm'), champs, 'ap_');
      m.box.querySelector('#apFerme').onclick = m.fermer;
    }

    const api = {
      ids() { if (simple) return { champs: etat.champs.filter(c => c.id).map(c => c.id) }; return { champsCas: etat.champsCas.filter(c => c.id).map(c => c.id), champsSuivi: etat.champsSuivi.filter(c => c.id).map(c => c.id) }; },
      lire() {
        const net = liste => {
          const garde = liste.map((c, i) => ({ c, i })).filter(x => x.c.label.trim());
          const pos = {}; garde.forEach((x, k) => { pos[x.i + 1] = k + 1; });
          return garde.map(({ c }) => ({
            id: c.id || undefined, label: c.label.trim(), type: c.type, obligatoire: c.type === 'calcul' ? false : !!c.obligatoire,
            options: (c.type === 'choix' || c.type === 'choix_multiple') ? String(c.opts || '').split('\n').map(x => x.trim()).filter(Boolean) : [],
            formule: c.type === 'calcul' ? String(c.opts || '').trim().replace(/\{\s*Q(\d+)\s*\}/gi, (m, n) => { if (!pos[n]) throw new Error('Calcul « ' + c.label.trim() + ' » : la question Q' + n + ' n\'existe pas ou n\'a pas d\'intitulé.'); return '{Q' + pos[n] + '}'; }) : undefined
          }));
        };
        const netSimple = liste => {
          const garde = liste.map((c, i) => ({ c, i })).filter(x => x.c.label.trim());
          const pos = {}; garde.forEach((x, k) => { pos[x.i + 1] = k + 1; });
          const posCle = {}; garde.forEach((x, k) => { posCle[cleDe(x.c)] = k + 1; });
          const lignes = c => String(c.opts || '').split('\n').map(x => x.trim()).filter(Boolean);
          return garde.map(({ c }, k) => {
            const rang = k + 1, lab = c.label.trim();
            let options = [], cascade, condition;
            if (c.type === 'choix' && c.cascChamp) {
              const p = posCle[c.cascChamp];
              if (!p || p >= rang) throw new Error(`Choix en cascade de « ${lab} » : la question parente doit exister et être placée avant.`);
              const liens = lignes(c).map(l => { const j = l.indexOf('|'); if (j < 1 || !l.slice(j + 1).trim()) throw new Error(`Choix en cascade de « ${lab} » : la ligne « ${l} » doit s'écrire « Choix | Valeur du parent ».`); return [l.slice(0, j).trim(), l.slice(j + 1).trim()]; });
              cascade = { champ: 'Q' + p, liens };
              options = liens.map(l => l[0]).filter((o, i, a) => a.indexOf(o) === i);
            } else if (c.type === 'choix' || c.type === 'choix_multiple') options = lignes(c);
            if (c.cond && c.cond.regles && c.cond.regles.length) {
              condition = { op: c.cond.op || 'et', regles: c.cond.regles.map(rg => {
                const p = posCle[rg.champ];
                if (!p) throw new Error(`Condition de « ${lab} » : choisissez la question à tester (ou retirez la condition).`);
                if (p >= rang) throw new Error(`Condition de « ${lab} » : elle doit porter sur une question placée AVANT elle.`);
                return { champ: 'Q' + p, op: rg.op, valeur: rg.valeur || '' };
              }) };
            }
            return { id: c.id || undefined, label: lab, type: c.type, obligatoire: c.type === 'calcul' ? false : !!c.obligatoire, options, condition, cascade,
              formule: c.type === 'calcul' ? String(c.opts || '').trim().replace(/\{\s*Q(\d+)\s*\}/gi, (m, n) => { if (!pos[n]) throw new Error('Calcul « ' + lab + ' » : la question Q' + n + ' n\'existe pas ou n\'a pas d\'intitulé.'); return '{Q' + pos[n] + '}'; }) : undefined };
          });
        };
        if (simple) {
          const champs = netSimple(etat.champs);
          if (!champs.length) throw new Error('Ajoutez au moins une question au questionnaire.');
          champs.forEach(c => { if ((c.type === 'choix' || c.type === 'choix_multiple') && c.options.length < 2 && !c.cascade) throw new Error(`La question « ${c.label} » doit proposer au moins 2 choix (un par ligne).`); });
          champs.forEach(c => { if (c.type === 'calcul' && !c.formule) throw new Error('Le calcul « ' + c.label + ' » n\'a pas de formule.'); });
          return { champs };
        }
        const q = { champsCas: net(etat.champsCas), champsSuivi: net(etat.champsSuivi), dureeJours: Number(etat.dureeJours), suivisParJour: Number(etat.suivisParJour || 1), libellesSeances: (etat.libellesSeances || []).slice(0, Number(etat.suivisParJour) || 1).map(x => String(x || '').trim()), gpsSuivi: etat.gpsSuivi || 'facultatif' };
        if (!q.champsCas.length) throw new Error('Ajoutez au moins une question dans « Informations clés du cas à recenser ».');
        if (!q.champsSuivi.length) throw new Error('Ajoutez au moins une question dans le « Questionnaire de suivi quotidien ».');
        [['Informations du cas', q.champsCas], ['Questionnaire de suivi', q.champsSuivi]].forEach(([n, l]) => l.forEach(c => {
          if ((c.type === 'choix' || c.type === 'choix_multiple') && c.options.length < 2) throw new Error(`Dans « ${n} », la question « ${c.label} » doit proposer au moins 2 choix (un par ligne).`);
        }));
        if (!(q.dureeJours >= 1 && q.dureeJours <= 90)) throw new Error('La durée du suivi doit être comprise entre 1 et 90 jours.');
        if (!(Number.isInteger(q.suivisParJour) && q.suivisParJour >= 1 && q.suivisParJour <= 10)) throw new Error('Le nombre de suivis par jour doit être un entier compris entre 1 et 10.');
        return q;
      }
    };
    return api;
  }

  // =====================================================================
  // 2. Génération et lecture des formulaires (côté RC)
  // =====================================================================
  function champHtml(c, pref) {
    const id = pref + c.id, req = c.obligatoire ? ' required' : '';
    const label = `<label for="${id}">${esc(c.label)}${c.obligatoire ? ' <span class="req">*</span>' : ''}</label>`;
    let ctrl = '';
    if (c.type === 'texte_long') ctrl = `<textarea id="${id}" name="${id}" rows="3" maxlength="2000"${req}></textarea>`;
    else if (c.type === 'nombre' || c.type === 'decimal') ctrl = `<input id="${id}" name="${id}" type="number" step="any" inputmode="decimal"${req}>`;
    else if (c.type === 'entier') ctrl = `<input id="${id}" name="${id}" type="number" step="1" inputmode="numeric"${req}>`;
    else if (c.type === 'heure') ctrl = `<input id="${id}" name="${id}" type="time"${req}>`;
    else if (c.type === 'calcul') ctrl = `<input id="${id}" name="${id}" type="text" readonly tabindex="-1" data-calcul placeholder="Calculé automatiquement" style="background:var(--tint-2)">`;
    else if (c.type === 'gps') return `<div class="field"><label>${esc(c.label)}${c.obligatoire ? ' <span class="req">*</span>' : ''}</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="hidden" name="${id}" data-gps><button type="button" class="btn-secondary btn-mini" data-gps-btn>📍 Prendre ma position</button><span class="petit" data-gps-etat>Aucune position prise.</span></div></div>`;
    else if (c.type === 'signature') return `<div class="field"><label>${esc(c.label)}${c.obligatoire ? ' <span class="req">*</span>' : ''}</label><div data-sign><canvas width="320" height="120" style="border:1px solid #bbb;border-radius:8px;background:#fff;touch-action:none;max-width:100%;display:block"></canvas><input type="hidden" name="${id}"><button type="button" class="btn-secondary btn-mini" data-sign-clear style="margin-top:4px">Effacer</button> <span class="petit">Signez avec le doigt ou la souris.</span></div></div>`;
    else if (c.type === 'photo') return `<div class="field"><label>${esc(c.label)}${c.obligatoire ? ' <span class="req">*</span>' : ''}</label><div data-photo><input type="hidden" name="${id}"><img data-photo-img alt="photo" style="display:none;max-width:100%;max-height:240px;border-radius:8px;border:1px solid #ccc;margin-bottom:6px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="btn-secondary btn-mini" data-photo-cam>📷 Prendre une photo</button><button type="button" class="btn-secondary btn-mini" data-photo-gal>🖼️ Choisir une image</button><button type="button" class="btn-secondary btn-mini" data-photo-clear style="display:none">✕ Retirer</button><span class="petit" data-photo-etat>Aucune photo.</span></div><input type="file" accept="image/*" capture="environment" data-photo-file-cam hidden><input type="file" accept="image/*" data-photo-file-gal hidden></div></div>`;
    else if (c.type === 'date') ctrl = `<input id="${id}" name="${id}" type="date" max="${aujourdhui()}"${req}>`;
    else if (c.type === 'choix') ctrl = `<select id="${id}" name="${id}"${req}><option value="">— Choisir —</option>${(c.cascade ? [] : (c.options || [])).map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
    else if (c.type === 'oui_non') ctrl = `<select id="${id}" name="${id}"${req}><option value="">— Choisir —</option><option>Oui</option><option>Non</option></select>`;
    else if (c.type === 'choix_multiple') return `<div class="field"><label>${esc(c.label)}${c.obligatoire ? ' <span class="req">*</span>' : ''}</label><div class="checks q-checks">${(c.options || []).map(o => `<label><input type="checkbox" name="${id}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div></div>`;
    else ctrl = `<input id="${id}" name="${id}" type="text" maxlength="500"${req}>`;
    return `<div class="field">${label}${ctrl}</div>`;
  }
  function formulaireHtml(champs, pref) { return champs.map(c => champHtml(c, pref).replace('<div class="field"', `<div class="field" data-qid="${esc(c.id)}"`)).join(''); }

  function lireReponses(form, champs, pref) {
    const out = {};
    champs.forEach(c => {
      const name = pref + c.id, w = form.querySelector(`[data-qid="${c.id}"]`);
      if (w && w.dataset.masque === '1') { out[c.id] = c.type === 'choix_multiple' ? [] : ''; return; }   // question masquée par sa condition d'affichage
      if (c.type === 'choix_multiple') out[c.id] = Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(x => x.value);
      else if (c.type === 'gps') { const el = form.querySelector(`[name="${name}"]`); let g = ''; try { g = el && el.value ? JSON.parse(el.value) : ''; } catch (e) { g = ''; } out[c.id] = g; }
      else { const el = form.querySelector(`[name="${name}"]`); out[c.id] = el ? el.value : ''; }
    });
    return out;
  }
  function remplir(form, champs, pref, rep) {
    champs.forEach(c => {
      const v = (rep || {})[c.id], name = pref + c.id;
      if (c.type === 'choix_multiple') form.querySelectorAll(`input[name="${name}"]`).forEach(x => { x.checked = Array.isArray(v) && v.includes(x.value); });
      else if (c.type === 'gps') { const el = form.querySelector(`[name="${name}"]`); if (el) { el.value = v && typeof v === 'object' ? JSON.stringify(v) : ''; majGpsEtat(el); } }
      else if (c.type === 'signature') { const el = form.querySelector(`[name="${name}"]`); if (el) { el.value = typeof v === 'string' ? v : ''; dessinerSignature(el.closest('[data-sign]'), el.value); } }
      else if (c.type === 'photo') { const el = form.querySelector(`[name="${name}"]`); if (el) { el.value = typeof v === 'string' ? v : ''; const z = el.closest('[data-photo]'); if (z && z._afficher) z._afficher(); } }
      else { const el = form.querySelector(`[name="${name}"]`); if (el) el.value = v == null ? '' : v; }
    });
  }

  // ---- Position GPS, signature et calculs automatiques d'un formulaire (à appeler après l'insertion du formulaire) ----
  function majGpsEtat(hid) {
    const span = hid.closest('div').querySelector('[data-gps-etat]'); if (!span) return;
    let g = null; try { g = hid.value ? JSON.parse(hid.value) : null; } catch (e) { g = null; }
    span.textContent = g ? '✔ ' + Number(g.lat).toFixed(6) + ', ' + Number(g.lon).toFixed(6) + (g.precision !== '' && g.precision != null ? ' (±' + g.precision + ' m)' : '') : 'Aucune position prise.';
  }
  function dessinerSignature(zone, dataUrl) {
    if (!zone) return; const cv = zone.querySelector('canvas'), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (dataUrl) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = dataUrl; }
  }
  function brancher(form, champs, pref) {
    const calculs = champs.filter(c => c.type === 'calcul' && c.formule), analyses = {};
    calculs.forEach(c => { try { analyses[c.id] = window.Formules.analyser(c.formule); } catch (e) { /* formule illisible : champ laissé vide */ } });
    const numDe = id => {
      const ch = champs.find(x => x.id === id), el = ch && form.querySelector(`[name="${pref + id}"]`); if (!el) return NaN;
      const v = el.value; if (ch.type === 'oui_non') return v === 'Oui' ? 1 : (v === 'Non' ? 0 : NaN);
      if (v === '') return NaN; const n = Number(v); return isFinite(n) ? n : NaN;
    };
    const recalculer = () => calculs.forEach(c => {
      const el = form.querySelector(`[name="${pref + c.id}"]`); if (!el || !analyses[c.id]) return;
      const r = window.Formules.calculer(analyses[c.id], (k, nom) => k === 'ref' ? numDe(nom) : NaN);
      el.value = isFinite(r) ? String(Math.round(r * 1e6) / 1e6) : '';
    });
    if (calculs.length) { form.addEventListener('input', recalculer); form.addEventListener('change', recalculer); recalculer(); }
    form.addEventListener('click', e => {
      const b = e.target.closest('[data-gps-btn]'); if (!b) return;
      const hid = b.closest('div').querySelector('[data-gps]'), span = b.closest('div').querySelector('[data-gps-etat]');
      if (!navigator.geolocation) { toast('La géolocalisation n\'est pas disponible sur cet appareil.', true); return; }
      b.disabled = true; span.textContent = 'Recherche de la position…';
      navigator.geolocation.getCurrentPosition(p => {
        hid.value = JSON.stringify({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lon: Math.round(p.coords.longitude * 1e6) / 1e6, precision: Math.round(p.coords.accuracy) }); b.disabled = false; majGpsEtat(hid);
      }, () => { b.disabled = false; majGpsEtat(hid); toast('Position introuvable : autorisez la localisation et réessayez.', true); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
    form.querySelectorAll('[data-sign]').forEach(zone => {
      const cv = zone.querySelector('canvas'), hid = zone.querySelector('input[type=hidden]'), ctx = cv.getContext('2d');
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
      let trace = false;
      const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
      cv.addEventListener('pointerdown', e => { e.preventDefault(); trace = true; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignoré */ } const p = pt(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke(); });
      cv.addEventListener('pointermove', e => { if (!trace) return; const p = pt(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
      const fin = () => { if (!trace) return; trace = false; hid.value = cv.toDataURL('image/png'); };
      cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
      zone.querySelector('[data-sign-clear]').onclick = () => { hid.value = ''; ctx.clearRect(0, 0, cv.width, cv.height); };
    });
    // ---- Photos : prise de vue directe (ou choix d'une image), réduite sur l'appareil avant envoi ----
    form.querySelectorAll('[data-photo]').forEach(z => {
      const hid = z.querySelector('input[type=hidden]'), img = z.querySelector('[data-photo-img]'), etat = z.querySelector('[data-photo-etat]'), eff = z.querySelector('[data-photo-clear]');
      const afficher = () => {
        if (hid.value) { img.src = hid.value; img.style.display = 'block'; eff.style.display = ''; etat.textContent = '✔ Photo prête (' + Math.round(hid.value.length * 0.75 / 1024) + ' Ko)'; }
        else { img.removeAttribute('src'); img.style.display = 'none'; eff.style.display = 'none'; etat.textContent = 'Aucune photo.'; }
      };
      z._afficher = afficher;
      const charger = async f => { if (!f) return; etat.textContent = 'Traitement de la photo…'; try { hid.value = await compresserImage(f); } catch (err) { toast('Photo illisible : ' + err.message, true); } afficher(); };
      z.querySelector('[data-photo-cam]').onclick = () => z.querySelector('[data-photo-file-cam]').click();
      z.querySelector('[data-photo-gal]').onclick = () => z.querySelector('[data-photo-file-gal]').click();
      z.querySelectorAll('input[type=file]').forEach(fi => { fi.onchange = () => { const f = fi.files && fi.files[0]; fi.value = ''; charger(f); }; });
      eff.onclick = () => { hid.value = ''; afficher(); };
    });
    // ---- Conditions d'affichage et choix en cascade (comme KoboToolbox) ----
    const dynamiques = champs.some(c => c.condition || c.cascade);
    const valeurForm = c => {
      const name = pref + c.id;
      if (c.type === 'choix_multiple') return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(x => x.value);
      const el = form.querySelector(`[name="${name}"]`); return el ? el.value : '';
    };
    function majDynamique() {
      if (!dynamiques) return;
      const vals = {};
      champs.forEach(c => {
        const w = form.querySelector(`[data-qid="${c.id}"]`); if (!w) return;
        const visible = !c.condition || window.Conditions.evaluer(c.condition, id => vals[id]);
        if (c.cascade && visible) {
          const sel = w.querySelector('select'), pv = vals[c.cascade.champ] || '', parent = champs.find(x => x.id === c.cascade.champ);
          if (sel && sel.dataset.sig !== pv) {
            const courant = sel.value, opts = pv ? c.cascade.liens.filter(l => l[1] === pv).map(l => l[0]).filter((o, k, a) => a.indexOf(o) === k) : [];
            sel.innerHTML = `<option value="">${opts.length ? '— Choisir —' : (pv ? 'Aucun choix pour cette valeur' : 'Choisir d\'abord « ' + esc(parent ? parent.label : 'la question précédente') + ' »')}</option>` + opts.map(o => `<option>${esc(o)}</option>`).join('');
            if (opts.indexOf(courant) !== -1) sel.value = courant;
            sel.dataset.sig = pv;
          }
        }
        const etaitMasquee = w.dataset.masque === '1';
        if (etaitMasquee === visible) { w.dataset.masque = visible ? '' : '1'; w.style.display = visible ? '' : 'none'; w.querySelectorAll('input,select,textarea,button').forEach(x => { x.disabled = !visible; }); }
        vals[c.id] = visible ? valeurForm(c) : (c.type === 'choix_multiple' ? [] : '');
      });
    }
    if (dynamiques) { form.addEventListener('input', majDynamique); form.addEventListener('change', majDynamique); }
    form.addEventListener('reset', () => setTimeout(() => {
      form.querySelectorAll('[data-gps]').forEach(h => { h.value = ''; majGpsEtat(h); });
      form.querySelectorAll('[data-sign]').forEach(z => { z.querySelector('input[type=hidden]').value = ''; dessinerSignature(z, ''); });
      form.querySelectorAll('[data-photo]').forEach(z => { z.querySelector('input[type=hidden]').value = ''; if (z._afficher) z._afficher(); });
      recalculer(); majDynamique();
    }, 0));
    majDynamique();
    form._majDynamique = majDynamique;
  }
  // Réduit une photo (≈ 1024 px, JPEG) pour qu'elle reste légère (envoi mobile, stockage Drive).
  function compresserImage(fichier) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fichier), img = new Image();
      img.onload = () => {
        try {
          let cote = 1024, q = 0.72, out = '';
          for (let essai = 0; essai < 5; essai++) {
            const k = Math.min(1, cote / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            out = cv.toDataURL('image/jpeg', q);
            if (out.length <= 280000) break;
            cote = Math.round(cote * 0.75); q = Math.max(0.5, q - 0.06);
          }
          URL.revokeObjectURL(url);
          if (out.length > 340000) reject(new Error('image trop volumineuse')); else resolve(out);
        } catch (err) { URL.revokeObjectURL(url); reject(err); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('format non reconnu')); };
      img.src = url;
    });
  }
  // Adresse d'une miniature : Google Drive fournit un aperçu à partir de l'identifiant du fichier.
  function miniaturePhoto(u) { const m = /\/d\/([\w-]+)/.exec(String(u || '')); return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w400' : u; }
  function celluleHtml(c, v) {
    if (c.type === 'photo' && typeof v === 'string' && /^(https?:\/\/|\/)/.test(v)) return `<a href="${esc(v)}" target="_blank" rel="noopener" title="Ouvrir la photo"><img src="${esc(miniaturePhoto(v))}" alt="photo" loading="lazy" style="height:46px;max-width:90px;object-fit:cover;border-radius:4px;border:1px solid #ddd"></a>`;
    if (c.type === 'gps' && v && v.lat !== undefined) return `<a href="https://www.openstreetmap.org/?mlat=${esc(v.lat)}&mlon=${esc(v.lon)}#map=18/${esc(v.lat)}/${esc(v.lon)}" target="_blank" rel="noopener">📍 ${esc(v.lat)}, ${esc(v.lon)}</a>`;
    if (c.type === 'signature' && typeof v === 'string' && v.indexOf('data:image/png;base64,') === 0) return `<img src="${esc(v)}" alt="signature" style="height:34px;background:#fff;border:1px solid #ddd;border-radius:4px">`;
    return esc(valeurTexte(c, v));
  }
  function valeurTexte(c, v) {
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (v === '' || v == null) return '—';
    if (c.type === 'gps') return v && v.lat !== undefined ? v.lat + ', ' + v.lon : '—';
    if (c.type === 'signature') return '✍ signé';
    return c.type === 'date' ? dFr(v) : String(v);
  }
  function resume(champs, rep, n) {
    return champs.map(c => ({ c, v: (rep || {})[c.id] })).filter(x => x.v !== '' && x.v != null && !(Array.isArray(x.v) && !x.v.length))
      .slice(0, n).map(x => valeurTexte(x.c, x.v)).join(' · ') || '—';
  }

  function badgeEtat(c) {
    if (c.Etat === 'Clôturé') return `<span class="badge badge-done">Clôturé${c.Issue ? ' · ' + esc(c.Issue) : ''}</span>`;
    if (c.Etat === 'Suivi terminé') return '<span class="badge badge-cancel">Suivi terminé</span>';
    return c.JoursManquants && c.JoursManquants.length ? `<span class="badge badge-late">En suivi · ${c.SeancesManquantes && c.SeancesManquantes.length > c.JoursManquants.length ? c.SeancesManquantes.length + ' suivi(s)' : c.JoursManquants.length + ' jour(s)'} à saisir</span>` : '<span class="badge badge-new">En suivi · à jour</span>';
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
      <div class="petit" style="margin-bottom:8px">Demandé par ${esc(a.CreeParNom)} · ${a.DateLimite ? (String(a.DateLimite) < auj ? '<strong>recensement clos depuis le ' + dFr(a.DateLimite) + '</strong>' : 'recensement des cas jusqu\'au <strong>' + dFr(a.DateLimite) + '</strong>') : ''} · chaque cas est suivi pendant <strong>${q.dureeJours} jour(s)</strong>${q.suivisParJour > 1 ? ', <strong>' + q.suivisParJour + ' fois par jour</strong> (' + Array.from({ length: q.suivisParJour }, (_, k) => esc(libSeance(q, k + 1))).join(', ') + ')' : ''}</div>
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
          <div class="petit" style="margin:4px 0">Recensé le ${dFr(c.DateEnregistrement)} · suivi jusqu'au ${dFr(c.DateFinSuivi)} · ${c.NbFaits}/${c.NbTotal || c.DureeJours} suivi(s) saisi(s)${c.SuivisParJour > 1 ? ' (' + c.SuivisParJour + ' par jour)' : ''}${c.HorsLigne ? ' · saisi hors connexion' : ''}</div>
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

    function formSuivi(zone, c) {
      const fin = c.DateFinSuivi < auj ? c.DateFinSuivi : auj;
      const spj = c.SuivisParJour || q.suivisParJour || 1;
      const jours = []; for (let d = c.DateEnregistrement; d <= fin; d = ajouterJours(d, 1)) jours.push(d);
      const cle = (j, s) => j + '|' + s;
      const faits = new Set(c.Suivis.map(s => cle(s.Jour, s.Seance || 1)));
      const jourComplet = d => { for (let k = 1; k <= spj; k++) if (!faits.has(cle(d, k))) return false; return true; };
      const defautJour = jours.includes(auj) && !jourComplet(auj) ? auj : (jours.find(d => d > c.DateEnregistrement && !jourComplet(d)) || jours[jours.length - 1]);
      zone.innerHTML = `<form class="tache-form-suivi"><div class="field"><label>Jour du suivi</label><select name="__jour">${jours.map(d => { const nb = Array.from({ length: spj }, (_, k) => faits.has(cle(d, k + 1))).filter(Boolean).length; return `<option value="${d}" ${d === defautJour ? 'selected' : ''}>Jour ${joursEntre(c.DateEnregistrement, d)} — ${dFr(d)}${spj > 1 ? (nb ? ' ✔ ' + nb + '/' + spj + ' suivi(s) saisi(s)' : '') : (faits.has(cle(d, 1)) ? ' ✔ déjà saisi (sera remplacé)' : '')}</option>`; }).join('')}</select></div>
        ${spj > 1 ? `<div class="field"><label>Moment du suivi</label><select name="__seance"></select></div>` : ''}
        ${formulaireHtml(q.champsSuivi, 'suv_')}
        ${q.gpsSuivi !== 'non' ? `<div class="field" data-gps><label>📍 Position GPS de ce suivi${q.gpsSuivi === 'obligatoire' ? ' (obligatoire)' : ''}</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="btn-secondary btn-mini" data-gps-btn>📍 Prendre ma position</button><span class="petit" data-gps-etat>Aucune position prise.</span></div></div>` : ''}
        <label class="q-req" style="display:flex;gap:6px;align-items:center;margin:6px 0"><input type="checkbox" name="__clot"> Clôturer le suivi de ce cas</label>
        <div class="field" data-issue style="display:none"><label>Issue du cas</label><select name="__issue"><option value="">— Choisir —</option>${ISSUES.map(i => `<option>${esc(i)}</option>`).join('')}</select></div>
        <button type="submit" class="btn-block">Enregistrer le suivi</button></form>`;
      const form = zone.querySelector('form');
      const selSeance = form.querySelector('[name=__seance]');
      const seanceCourante = () => selSeance ? Number(selSeance.value) : 1;
      // Liste des séances du jour choisi : la première non saisie est présélectionnée.
      const remplirSeances = () => {
        if (!selSeance) return;
        const j = form.querySelector('[name=__jour]').value;
        const premiere = Array.from({ length: spj }, (_, k) => k + 1).find(k => !faits.has(cle(j, k))) || 1;
        selSeance.innerHTML = Array.from({ length: spj }, (_, k) => k + 1).map(k => `<option value="${k}" ${k === premiere ? 'selected' : ''}>${esc(libSeance(q, k))}${faits.has(cle(j, k)) ? ' ✔ déjà saisi (sera remplacé)' : ''}</option>`).join('');
      };
      // Position GPS : propre à chaque séance (réinitialisée quand on change de jour ou de séance).
      let gps = null;
      const majGps = () => { const el = form.querySelector('[data-gps-etat]'); if (el) el.textContent = gps ? '✔ ' + gps.lat.toFixed(6) + ', ' + gps.lon.toFixed(6) + (gps.precision !== '' && gps.precision != null ? ' (±' + gps.precision + ' m)' : '') + (gps.deja ? ' · déjà enregistrée (reprendre pour la remplacer)' : '') : 'Aucune position prise.'; };
      const btnGps = form.querySelector('[data-gps-btn]');
      if (btnGps) btnGps.onclick = () => {
        if (!navigator.geolocation) { toast('La géolocalisation n\'est pas disponible sur cet appareil.', true); return; }
        btnGps.disabled = true; form.querySelector('[data-gps-etat]').textContent = 'Recherche de la position…';
        navigator.geolocation.getCurrentPosition(p => {
          gps = { lat: p.coords.latitude, lon: p.coords.longitude, precision: Math.round(p.coords.accuracy) }; btnGps.disabled = false; majGps();
        }, () => { btnGps.disabled = false; majGps(); toast('Position introuvable : autorisez la localisation et réessayez.', true); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      };
      const rafraichirForm = () => {
        const s = c.Suivis.find(x => x.Jour === form.querySelector('[name=__jour]').value && (x.Seance || 1) === seanceCourante());
        remplir(form, q.champsSuivi, 'suv_', s ? s.Reponses : {});
        gps = s && s.Latitude !== '' && s.Latitude != null ? { lat: s.Latitude, lon: s.Longitude, precision: s.Precision, deja: true } : null; majGps();
      };
      remplirSeances(); rafraichirForm();
      form.querySelector('[name=__jour]').addEventListener('change', () => { remplirSeances(); rafraichirForm(); });
      if (selSeance) selSeance.addEventListener('change', rafraichirForm);
      form.querySelector('[name=__clot]').addEventListener('change', ev => { form.querySelector('[data-issue]').style.display = ev.target.checked ? 'block' : 'none'; });
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        if (q.gpsSuivi === 'obligatoire' && !gps) { toast('Prenez la position GPS avant d\'enregistrer ce suivi.', true); return; }
        const clot = form.querySelector('[name=__clot]').checked, issue = form.querySelector('[name=__issue]').value;
        if (clot && !issue) { toast('Choisissez l\'issue du cas pour clôturer son suivi.', true); return; }
        if (clot && !confirm('Clôturer le suivi de ce cas ? Vous ne pourrez plus saisir de suivi pour lui.')) return;
        const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          const r = await Api.call('tacheSaisirSuivi', { casId: c.ID, jour: form.querySelector('[name=__jour]').value, seance: seanceCourante(), gps: gps ? { lat: gps.lat, lon: gps.lon, precision: gps.precision } : undefined, reponses: lireReponses(form, q.champsSuivi, 'suv_'), cloturer: clot, issue });
          toast(r.queued ? 'Pas de réseau : le suivi est gardé sur ce téléphone et sera envoyé automatiquement.' : 'Suivi enregistré.');
          if (!r.queued) await charger();
        } catch (err) { toast(err.message, true); btn.disabled = false; }
      });
    }

    dessinerNouveau();
    await charger();
    if (cas.some(c => c.Etat === 'En suivi')) montrerOnglet('cas');
  }

  function dossierHtml(c, q, supprimable) {
    const lignes = (champs, rep) => champs.map(ch => `<tr><th style="width:42%">${esc(ch.label)}</th><td>${esc(valeurTexte(ch, (rep || {})[ch.id]))}</td></tr>`).join('');
    return `<div class="tache-dossier"><h4 class="sous-titre">Informations du cas</h4><table><tbody>${lignes(q.champsCas, c.Reponses)}</tbody></table>
      <h4 class="sous-titre" style="margin-top:12px">Suivi jour par jour${(c.SuivisParJour || 1) > 1 ? ' (' + c.SuivisParJour + ' par jour : ' + Array.from({ length: c.SuivisParJour }, (_, k) => libSeance(q, k + 1)).join(', ') + ')' : ''}</h4>
      ${c.Suivis.length ? c.Suivis.map(s => `<div class="act-com"><strong>Jour ${joursEntre(c.DateEnregistrement, s.Jour)} — ${dFr(s.Jour)}${(c.SuivisParJour || 1) > 1 ? ' · ' + libSeance(q, s.Seance || 1) : ''}</strong>${supprimable && s.ID ? ` <button type="button" class="btn-danger btn-mini" data-suppr-suivi="${esc(s.ID)}" style="margin-left:6px">🗑 Supprimer ce suivi</button>` : ''}${s.Latitude !== '' && s.Latitude != null ? `<div class="petit" style="margin:4px 0">📍 <a href="https://www.openstreetmap.org/?mlat=${s.Latitude}&mlon=${s.Longitude}#map=18/${s.Latitude}/${s.Longitude}" target="_blank" rel="noopener">${s.Latitude}, ${s.Longitude}</a>${s.Precision !== '' && s.Precision != null ? ' (±' + s.Precision + ' m)' : ''}</div>` : ''}<table><tbody>${lignes(q.champsSuivi, s.Reponses)}</tbody></table></div>`).join('') : '<div class="petit">Aucun suivi saisi pour le moment.</div>'}
      ${c.JoursManquants.length ? `<div class="petit" style="color:#8F2A18">${(c.SuivisParJour || 1) > 1 && c.SeancesManquantes ? 'Suivis manquants : ' + c.SeancesManquantes.map(m => dFr(m.Jour) + ' (' + libSeance(q, m.Seance) + ')').join(', ') : 'Jours sans suivi : ' + c.JoursManquants.map(dFr).join(', ')}</div>` : ''}
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
        <td>${c.NbFaits}/${c.NbTotal || c.DureeJours}</td><td><button type="button" class="btn-secondary btn-mini" data-dossier="${esc(c.ID)}">Dossier</button> <button type="button" class="btn-danger btn-mini" data-suppr="${esc(c.ID)}" title="Supprimer ce cas et son suivi">🗑</button></td></tr>`).join('') : '<tr><td colspan="8" class="petit">Aucun cas ne correspond.</td></tr>';
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
      m.box.querySelector('#tdSupprCas').onclick = () => { m.fermer(); supprimer([c.ID]); };
      // Le demandeur peut aussi retirer un seul jour de suivi (erreur de saisie) sans supprimer le cas.
      m.box.addEventListener('click', async ev => {
        const sb = ev.target.closest('[data-suppr-suivi]'); if (!sb) return;
        if (!confirm('Supprimer ce suivi journalier ? Le relais communautaire sera prévenu et pourra le ressaisir.')) return;
        try { const r = await Api.call('tacheSupprimerSuivis', { activiteId: opts.activiteId, suiviIds: [sb.dataset.supprSuivi] }); toast(r.supprimes + ' suivi supprimé.'); m.fermer(); if (typeof opts.onChange === 'function') opts.onChange(); await rendreDonnees(el, opts); }
        catch (err) { toast(err.message, true); }
      });
    });
    el.querySelector('#tdExpCas').onclick = () => {
      const l = [['Tâche', 'Relais communautaire', 'Village', 'Date de recensement', 'Fin du suivi', 'État', 'Issue', 'Suivis saisis', 'Suivis attendus'].concat(q.champsCas.map(c => c.label))];
      liste().forEach(c => l.push([act.titre, c.RcNom, c.VillageNom, c.DateEnregistrement, c.DateFinSuivi, c.Etat, c.Issue, c.NbFaits, c.NbTotal || c.DureeJours].concat(q.champsCas.map(ch => valeurTexte(ch, c.Reponses[ch.id]).replace(/^—$/, '')))));
      telecharger('cas_' + nomFichier(act.titre) + '.csv', csv(l));
    };
    el.querySelector('#tdExpSuivis').onclick = () => {
      const l = [['Tâche', 'Cas', 'Relais communautaire', 'Village', 'Date de recensement', 'Jour', 'Date du suivi', 'Séance', 'Latitude', 'Longitude', 'Précision GPS (m)'].concat(q.champsSuivi.map(c => c.label))];
      liste().forEach(c => c.Suivis.forEach(s => l.push([act.titre, resume(q.champsCas, c.Reponses, 2), c.RcNom, c.VillageNom, c.DateEnregistrement, 'J' + joursEntre(c.DateEnregistrement, s.Jour), s.Jour, libSeance(q, s.Seance || 1), s.Latitude, s.Longitude, s.Precision].concat(q.champsSuivi.map(ch => valeurTexte(ch, s.Reponses[ch.id]).replace(/^—$/, ''))))));
      telecharger('suivis_' + nomFichier(act.titre) + '.csv', csv(l));
    };
    montrer();
  }

  window.Taches = { brancher, celluleHtml, TYPES_COLLECTE, construire, ouvrirRc, rendreDonnees, parseQuestionnaire: parseQ, libSeance, formulaireHtml, lireReponses, valeurTexte, resume, ouvrirModal, csv, telecharger, nomFichier };
})();

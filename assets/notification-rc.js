/**
 * Notification du relais communautaire : l'ASCQ voit TOUTES les données collectées, peut les CORRIGER avant de
 * valider (investigation d'une alerte, confirmation d'un décès) et peut SUPPRIMER la notification.
 *
 *  NotifRc.donneesHtml(refType, ligne)                          — toutes les données, en lecture
 *  NotifRc.rendreCarte(el, refType, ligne, { onChange, onSupprime }) — carte complète + boutons « Modifier » / « Supprimer »
 *  NotifRc.modifier(refType, ligne, onChange)                   — fenêtre de correction
 *  NotifRc.supprimer(refType, ligne, onSupprime)                — fenêtre de suppression (motif obligatoire)
 *
 * refType : 'ALERTE' | 'DECES'. Actions serveur : modifierNotificationRc, supprimerNotificationRc.
 * Une notification déjà validée (alerte investiguée, décès confirmé) n'est plus modifiable. Chaque correction et
 * chaque suppression est tracée côté serveur (feuille JournalModifications) et le RC en est informé.
 */
(function () {
  'use strict';
  var TYPES_ALERTE = ['1. Rougeole', '2. Choléra', '3. Méningite', '4. PFA', '5. FHV Lassa', '6. FHV Ebola', '7. Fièvre jaune', '8. Dengue', '9. Anthrax', '10. Shigellose',
    '11. Grippes aviaires', '12. Rage', '13. COVID-19', '14. Mpox', '15. Morsure de chien', '16. Morsure de serpent', '17. Morsure d\'autre animaux', '18. Animaux malades',
    '19. Animaux morts', '20. Autre événement inhabituel'];
  var SIGNES = ['Fièvre', 'Bouton sur le corps', 'Diarrhée aqueuse', 'Vomissement', 'Selles avec du sang', 'Maux de tête', 'Saignements inexpliqués', 'Raideur nuque', 'Altération conscience',
    'Bombement fontanelle', 'Peur de la lumière', 'Peur de l\'eau ou des bruits de l\'eau', 'Convulsions', 'Yeux jaune', 'Fatigue intense', 'Nausée', 'Maux de gorge', 'Toux', 'Douleurs abdominales',
    'Manque d\'appétit', 'Paralysie ou difficultés à marcher', 'Courbatures ou fatigues', 'Douleurs musculaires ou articulaires', 'Présence de sang dans les urines', 'Irritabilité ou agressivité',
    'Gonflement des ganglions', 'Crachats teintés de sang', 'Lésions cutanées', 'Difficultés respiratoires'];
  var TYPES_DECES = { 1: 'Décès maternel', 2: 'Décès de bébé (0-28 jours)', 3: 'Décès d\'enfant de 1 mois à 1 an', 4: 'Décès d\'enfant de 1 à 5 ans', 5: 'Décès de personne de plus de 5 ans' };
  var LIEUX = { 1: 'Domicile', 2: 'Accoucheuse', 3: 'Lieu de culte', 4: 'Au cours du transport', 5: 'À l\'étranger', 6: 'Autre' };
  var CIRC = { 1: 'Grossesse / avortement / accouchement / suites de couches', 2: 'Maladie', 3: 'Accident de route', 4: 'Accident domestique', 5: 'Mort subite', 6: 'Violence', 7: 'Autre' };

  function v(x) { return x === null || x === undefined ? '' : String(x); }
  function d10(x) { return v(x).slice(0, 10); }
  function lib(m, k) { return m[String(k)] || v(k); }
  function validee(refType, l) { return refType === 'DECES' ? l.Statut === 'Confirmé' : l.Statut === 'Investigué'; }
  function champ(titre, valeur) { var t = v(valeur); return '<div class="nrc-champ"><span>' + escHtml(titre) + '</span><b>' + (t ? escHtml(t) : '—') + '</b></div>'; }

  function ageTexte(l) {
    var p = [];
    if (v(l.AgeAnnees) !== '') p.push(l.AgeAnnees + ' an(s)');
    if (v(l.AgeMois) !== '') p.push(l.AgeMois + ' mois');
    if (v(l.AgeJours) !== '') p.push(l.AgeJours + ' jour(s)');
    return p.join(' ') || v(l.Age);
  }

  function donneesHtml(refType, l) {
    var badges = '';
    if (v(l.HorsLigne) === 'Oui') badges += '<span class="nrc-badge nrc-hl">📴 Saisie hors connexion</span>';
    if (v(l.ModifieParAscq) === 'Oui') badges += '<span class="nrc-badge nrc-mod">✏️ Corrigée par l\'ASCQ le ' + escHtml(fmtDate(l.DateModification)) + '</span>';
    var lieu = champ('Village', l.VillageNom) + champ('Grappe', l.NGrappe) + champ('Département', l.Departement) + champ('Semaine épidémiologique', v(l.SemaineEpi) ? 'S' + l.SemaineEpi + ' / ' + v(l.Annee) : '');
    var notif = champ('Notifié par (RC)', l.NotificateurNom) + champ('Saisi le', fmtDate(l.DateSaisie)) + champ('Centre de santé', l.CentreSante) + champ('Date de notification', fmtDate(l.DateNotification));
    if (refType === 'DECES') {
      return '<div class="nrc-badges">' + badges + '</div>' +
        '<h4 class="nrc-titre">Identification du défunt</h4><div class="nrc-grille">' + champ('Nom et prénoms', l.Nom) + champ('Sexe', l.Sexe) + champ('Date de naissance', fmtDate(l.DateNaissance)) + champ('Âge au décès', ageTexte(l)) +
        champ('Parent / proche', l.NomParent) + champ('Téléphone du proche', l.TelephoneParent) + champ('Adresse / repère', l.Adresse) + '</div>' +
        '<h4 class="nrc-titre">Circonstances du décès</h4><div class="nrc-grille">' + champ('Type de décès', lib(TYPES_DECES, l.TypeDeces)) + champ('Date du décès', fmtDate(l.DateDeces)) + champ('Lieu du décès', lib(LIEUX, l.LieuDeces)) +
        champ('Circonstances', lib(CIRC, l.Circonstances)) + champ('Cause probable', l.CauseProbable) + '</div>' +
        '<h4 class="nrc-titre">Localisation et notification</h4><div class="nrc-grille">' + lieu + notif + '</div>';
    }
    var signes = v(l.Signes).split('|').filter(Boolean).map(function (s) { return '<span class="nrc-chip">' + escHtml(s) + '</span>'; }).join('') || '<span class="petit">Aucun signe coché.</span>';
    return '<div class="nrc-badges">' + badges + '</div>' +
      '<h4 class="nrc-titre">Identification du cas</h4><div class="nrc-grille">' + champ('Nom et prénoms', l.Nom) + champ('Sexe', l.Sexe) + champ('Date de naissance', fmtDate(l.DateNaissance)) + champ('Âge', v(l.Age)) +
      champ('Téléphone du cas (ou parent)', l.Telephone) + champ('Adresse / repère', l.Adresse) + '</div>' +
      '<h4 class="nrc-titre">Alerte</h4><div class="nrc-grille">' + champ('Type d\'alerte', l.TypeAlerte) + champ('Précision (« Autre »)', l.AutrePreciser) + champ('Début de la maladie', fmtDate(l.DateDebutMaladie)) + champ('Événement en cours', l.EnCours) + '</div>' +
      '<h4 class="nrc-titre">Signes et symptômes</h4><div class="nrc-chips">' + signes + '</div>' +
      '<h4 class="nrc-titre">Ampleur de l\'événement</h4><div class="nrc-grille">' + champ('Personnes touchées', l.PersonnesTouchees) + champ('Personnes décédées', l.PersonnesMortes) + champ('Animaux malades', l.AnimauxMalades) + champ('Animaux morts', l.AnimauxMorts) + '</div>' +
      '<h4 class="nrc-titre">Localisation et notification</h4><div class="nrc-grille">' + lieu + notif + '</div>';
  }

  // ---------- fenêtres ----------
  function fenetre(contenu) {
    var ov = document.createElement('div'); ov.className = 'modal-overlay nrc-overlay'; ov.style.display = 'flex';
    ov.innerHTML = '<div class="modal-box nrc-box">' + contenu + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    return ov;
  }
  function input(nom, label, val, type, extra) { return '<div class="field"><label>' + escHtml(label) + '</label><input name="' + nom + '" type="' + (type || 'text') + '" value="' + escHtml(val) + '" ' + (extra || '') + '></div>'; }
  function select(nom, label, options, val) {
    return '<div class="field"><label>' + escHtml(label) + '</label><select name="' + nom + '">' + options.map(function (o) { return '<option value="' + escHtml(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function optionsMap(m) { return Object.keys(m).map(function (k) { return [k, m[k]]; }); }

  function formulaire(refType, l) {
    if (refType === 'DECES') {
      return '<fieldset><legend>Identification du défunt</legend>' + input('Nom', 'Nom et prénoms', l.Nom, 'text', 'required') +
        '<div class="grid grid-2">' + select('Sexe', 'Sexe', [['M', 'M'], ['F', 'F']], l.Sexe) + input('DateNaissance', 'Date de naissance', d10(l.DateNaissance), 'date') + '</div>' +
        '<div class="grid grid-2">' + input('AgeAnnees', 'Âge au décès (années)', l.AgeAnnees, 'number', 'min="0"') + input('AgeMois', 'Âge au décès (mois)', l.AgeMois, 'number', 'min="0"') + '</div>' +
        '<div class="grid grid-2">' + input('NomParent', 'Parent ou proche', l.NomParent) + input('TelephoneParent', 'Téléphone du proche', l.TelephoneParent) + '</div>' + input('Adresse', 'Adresse / repère', l.Adresse) + '</fieldset>' +
        '<fieldset><legend>Circonstances du décès</legend>' + select('TypeDeces', 'Type de décès', optionsMap(TYPES_DECES), l.TypeDeces) +
        '<div class="grid grid-2">' + input('DateDeces', 'Date du décès', d10(l.DateDeces), 'date') + input('DateNotification', 'Date de notification', d10(l.DateNotification), 'date') + '</div>' +
        '<div class="grid grid-2">' + select('LieuDeces', 'Lieu du décès', optionsMap(LIEUX), l.LieuDeces) + select('Circonstances', 'Circonstances', optionsMap(CIRC), l.Circonstances) + '</div>' +
        input('CauseProbable', 'Cause probable', l.CauseProbable) + input('CentreSante', 'Centre de santé rattaché', l.CentreSante) + '</fieldset>';
    }
    var cochés = v(l.Signes).split('|');
    var types = TYPES_ALERTE.indexOf(l.TypeAlerte) === -1 && l.TypeAlerte ? [l.TypeAlerte].concat(TYPES_ALERTE) : TYPES_ALERTE;
    return '<fieldset><legend>Identification du cas</legend>' + input('Nom', 'Nom et prénoms du cas', l.Nom, 'text', 'required') +
      '<div class="grid grid-2">' + select('Sexe', 'Sexe', [['M', 'M'], ['F', 'F']], l.Sexe) + input('Telephone', 'Téléphone du cas (ou parent)', l.Telephone) + '</div>' +
      '<div class="grid grid-2">' + input('DateNaissance', 'Date de naissance', d10(l.DateNaissance), 'date') + input('Age', 'Âge (si date inconnue)', l.Age) + '</div>' + input('Adresse', 'Adresse / repère', l.Adresse) + '</fieldset>' +
      '<fieldset><legend>Alerte</legend>' + select('TypeAlerte', 'Type d\'alerte', types.map(function (t) { return [t, t]; }), l.TypeAlerte) + input('AutrePreciser', 'Si « Autre », préciser', l.AutrePreciser) +
      '<div class="grid grid-2">' + input('DateDebutMaladie', 'Date de début de la maladie', d10(l.DateDebutMaladie), 'date') + input('DateNotification', 'Date de notification', d10(l.DateNotification), 'date') + '</div></fieldset>' +
      '<fieldset><legend>Signes et symptômes</legend><div class="checks">' + SIGNES.map(function (s) { return '<label><input type="checkbox" name="Signes" value="' + escHtml(s) + '"' + (cochés.indexOf(s) !== -1 ? ' checked' : '') + '>' + escHtml(s) + '</label>'; }).join('') + '</div></fieldset>' +
      '<fieldset><legend>Ampleur de l\'événement</legend><div class="grid grid-4">' + input('PersonnesTouchees', 'Personnes touchées', l.PersonnesTouchees, 'number', 'min="0"') + input('PersonnesMortes', 'Personnes décédées', l.PersonnesMortes, 'number', 'min="0"') +
      input('AnimauxMalades', 'Animaux malades', l.AnimauxMalades, 'number', 'min="0"') + input('AnimauxMorts', 'Animaux morts', l.AnimauxMorts, 'number', 'min="0"') + '</div>' +
      select('EnCours', 'L\'événement est-il en cours ?', [['Oui', 'Oui'], ['Non', 'Non']], l.EnCours || 'Oui') + input('CentreSante', 'Centre de santé rattaché', l.CentreSante) + '</fieldset>';
  }

  function modifier(refType, l, onChange) {
    var ov = fenetre('<h2 style="margin-top:0">✏️ Corriger la notification du RC</h2><p class="petit">Les données ci-dessous ont été saisies par <b>' + escHtml(l.NotificateurNom || 'le RC') +
      '</b>. Corrigez-les avant de valider. Le RC en sera informé et chaque changement est conservé (avant / après).</p><form id="nrcForm">' + formulaire(refType, l) +
      '<div class="field"><label>Motif de la correction (facultatif)</label><input name="__motif" placeholder="Ex. correction après visite du village"></div>' +
      '<div class="nrc-actions"><button type="submit">Enregistrer les corrections</button><button type="button" class="btn-secondary" id="nrcAnnuler">Annuler</button></div></form>');
    ov.querySelector('#nrcAnnuler').onclick = function () { ov.remove(); };
    ov.querySelector('#nrcForm').onsubmit = async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target), champs = {};
      fd.forEach(function (val, k) { if (k !== 'Signes' && k !== '__motif') champs[k] = val; });
      if (refType !== 'DECES') champs.Signes = fd.getAll('Signes');
      var bouton = e.target.querySelector('button[type=submit]'); bouton.disabled = true;
      try {
        var r = await Api.call('modifierNotificationRc', { refType: refType, refId: l.ID, champs: champs, motif: fd.get('__motif') || '' });
        ov.remove();
        if (r.aucunChangement) { toast('Aucun changement à enregistrer.'); return; }
        Object.assign(l, r.ligne); toast('Corrections enregistrées (' + r.champsModifies.length + ' champ(s)). Le RC en est informé.');
        if (onChange) onChange(l);
      } catch (err) { toast(err.message, true); bouton.disabled = false; }
    };
  }

  function supprimer(refType, l, onSupprime) {
    var quoi = refType === 'DECES' ? 'décès' : 'alerte';
    var ov = fenetre('<h2 style="margin-top:0;color:#B00020">🗑️ Supprimer cette notification ?</h2><p>Notification de ' + quoi + ' de <b>' + escHtml(l.Nom || 'sans nom') + '</b> faite par <b>' + escHtml(l.NotificateurNom || 'le RC') + '</b>.</p>' +
      (validee(refType, l) ? '<p class="nrc-alerte">⚠ Cette notification est déjà <b>validée</b> : sa fiche d\'investigation et les notifications envoyées aux niveaux supérieurs seront aussi retirées.</p>' : '') +
      '<p class="petit">La suppression est définitive. Une copie de sauvegarde est gardée dans le journal des modifications, et le RC en est informé avec le motif.</p>' +
      '<div class="field"><label>Motif de la suppression (obligatoire)</label><input id="nrcMotif" placeholder="Ex. doublon, information erronée, cas hors de ma zone"></div>' +
      '<div class="nrc-actions"><button type="button" id="nrcOk" style="background:#B00020">Supprimer définitivement</button><button type="button" class="btn-secondary" id="nrcNon">Annuler</button></div>');
    ov.querySelector('#nrcNon').onclick = function () { ov.remove(); };
    ov.querySelector('#nrcOk').onclick = async function () {
      var motif = ov.querySelector('#nrcMotif').value.trim();
      if (motif.length < 3) { toast('Le motif de la suppression est obligatoire.', true); return; }
      this.disabled = true;
      try { await Api.call('supprimerNotificationRc', { refType: refType, refId: l.ID, motif: motif }); ov.remove(); toast('Notification supprimée.'); if (onSupprime) onSupprime(l); }
      catch (err) { toast(err.message, true); this.disabled = false; }
    };
  }

  function rendreCarte(el, refType, l, rappels) {
    rappels = rappels || {};
    var titre = refType === 'DECES' ? 'Décès notifié par le RC' : 'Cas notifié par le RC';
    var peutModifier = !validee(refType, l);
    el.innerHTML = '<div class="card nrc-carte"><div class="nrc-tete"><h2 style="margin:0">' + titre + '</h2><div class="nrc-boutons">' +
      (peutModifier ? '<button type="button" class="btn-secondary btn-mini" data-nrc="modifier">✏️ Modifier les données</button>' : '<span class="petit">🔒 Validée : non modifiable</span>') +
      '<button type="button" class="btn-secondary btn-mini nrc-suppr" data-nrc="supprimer">🗑️ Supprimer</button></div></div>' +
      '<p class="petit" style="margin:4px 0 8px">Toutes les données collectées par le RC. ' + (peutModifier ? 'Vous pouvez les corriger avant de valider.' : '') + '</p>' + donneesHtml(refType, l) + '</div>';
    el.querySelector('[data-nrc=modifier]') && (el.querySelector('[data-nrc=modifier]').onclick = function () { modifier(refType, l, function (r) { rendreCarte(el, refType, r, rappels); if (rappels.onChange) rappels.onChange(r); }); });
    el.querySelector('[data-nrc=supprimer]').onclick = function () { supprimer(refType, l, function (r) { el.innerHTML = ''; if (rappels.onSupprime) rappels.onSupprime(r); }); };
  }

  window.NotifRc = { donneesHtml: donneesHtml, rendreCarte: rendreCarte, modifier: modifier, supprimer: supprimer, formulaire: formulaire, validee: validee };
})();

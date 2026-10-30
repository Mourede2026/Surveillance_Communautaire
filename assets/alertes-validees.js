/**
 * Alertes infection VALIDÉES par l'ASCQ — synthèse affichée dans le tableau de bord de tous les
 * niveaux au-dessus du relais communautaire (ASCQ, PF, RCSE, Département, National).
 *
 * Quand l'ASCQ investigue et valide un événement (ou confirme un décès), chaque niveau supérieur voit :
 * l'affection ou l'événement, l'arrondissement, le village, la commune, le nombre de cas touchés et de
 * cas décédés (et, si l'événement concerne des animaux, le nombre d'animaux touchés et décédés), le
 * résumé, la personne qui a fait la notification et l'ASCQ qui l'a validée.
 *
 * En tête du bloc : « Point de la semaine » — un paragraphe (et des puces) qui résume, pour une semaine
 * épidémiologique choisie (par défaut la semaine en cours), les événements validés du périmètre :
 * « 3 cas de rougeole dans l'arrondissement de X, un décès maternel dans l'arrondissement de Y… », SANS
 * nom d'auteur (ni notificateur ni ASCQ). Texte copiable pour un bulletin ou un message.
 *
 * renderAlertesValidees(idConteneur) — action serveur : listAlertesValidees (limitée au périmètre).
 */
(function () {
  'use strict';
  var PAGE = 15;
  var etat = { liste: [], filtre: '', type: '', vues: PAGE, cont: null, cal: [], idx: -1, idxCourant: -1, debut: null };

  // ---------------------------------------------------------------- Point de la semaine
  var TYPES_DECES = {
    '1': ['décès maternel', 'décès maternels'],
    '2': ['décès de bébé (0-28 jours)', 'décès de bébés (0-28 jours)'],
    '3': ['décès d\'enfant de 1 mois à 1 an', 'décès d\'enfants de 1 mois à 1 an'],
    '4': ['décès d\'enfant de 1 à 5 ans', 'décès d\'enfants de 1 à 5 ans'],
    '5': ['décès >= 5 ans', 'décès >= 5 ans']
  };
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ajouteJours(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; }
  function lundi(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function de(nom) { nom = String(nom || '').trim(); return (/^[AEIOUYÉÈÊ]/i.test(nom) ? 'd\'' : 'de ') + nom; }
  function minuscule(t) { t = String(t || '').trim(); return (t.length > 1 && t[1] === t[1].toUpperCase() && t[1] !== t[1].toLowerCase()) ? t : t.charAt(0).toLowerCase() + t.slice(1); }
  function liste_(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]; }
  function pluriel(n, sing, plur) { return n + ' ' + (n > 1 ? plur : sing); }
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function jourTxt(d) { return d.getDate() === 1 ? '1er' : String(d.getDate()); }
  function dateLongue(d, avecAnnee) { return jourTxt(d) + ' ' + MOIS[d.getMonth()] + (avecAnnee ? ' ' + d.getFullYear() : ''); }

  function plage() {
    if (etat.cal.length && etat.idx >= 0) {
      var w = etat.cal[etat.idx];
      return { label: 'S' + w.SemaineEpi + ' / ' + w.Annee, debut: debutJournee_(w.DateDebut), fin: finJournee_(w.DateFin), courante: etat.idx === etat.idxCourant };
    }
    var d = etat.debut || lundi(new Date());
    return { label: 'du lundi ' + dateLongue(d), debut: d, fin: ajouteJours(d, 6), courante: iso(d) === iso(lundi(new Date())) };
  }
  function periodeTexte(p) {
    var d = p.debut, f = p.fin, memeMois = d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear();
    return memeMois ? 'du ' + jourTxt(d) + ' au ' + dateLongue(f, true) : 'du ' + dateLongue(d, d.getFullYear() !== f.getFullYear()) + ' au ' + dateLongue(f, true);
  }
  // Événements validés de la semaine, regroupés par affection (ou type de décès) puis par arrondissement,
  // avec le nombre de cas. Les alertes passent avant les décès. Jamais de nom d'auteur.
  function evenementsSemaine(p) {
    var du = iso(p.debut), au = iso(p.fin);
    var liste = etat.liste.filter(function (a) { var d = String(a.dateValidation || a.date || '').slice(0, 10); return d >= du && d <= au; });
    var humains = {}, animaux = {}, deces = {};
    function ajoute(map, cle, n, a, base) {
      var g = map[cle] || (map[cle] = Object.assign({ cle: cle, total: 0, morts: 0, arrs: {} }, base));
      var arr = a.arrondissement || a.commune || 'arrondissement non précisé';
      g.total += n; g.arrs[arr] = (g.arrs[arr] || 0) + n; return g;
    }
    liste.forEach(function (a) {
      if (a.kind === 'DECES') ajoute(deces, a.typeDeces || 'x', Math.max(1, Number(a.casDeces) || 0), a, {});
      else if (estAnimal(a) && !(a.casTouches > 0)) { var g = ajoute(animaux, minuscule(a.affection), Number(a.animauxTouches) || 0, a, { aff: a.affection }); g.morts += Number(a.animauxMorts) || 0; }
      else ajoute(humains, minuscule(a.affection), Math.max(1, Number(a.casTouches) || 0), a, { aff: a.affection });
    });
    function detail(g) {
      return Object.keys(g.arrs).sort(function (x, y) { return g.arrs[y] - g.arrs[x] || x.localeCompare(y, 'fr'); })
        .map(function (k) { return k + ' (' + g.arrs[k] + ')'; }).join(', ');
    }
    function tri(map) { return Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) { return y.total - x.total || String(x.cle).localeCompare(String(y.cle), 'fr'); }); }
    var items = [];
    tri(humains).forEach(function (g) { items.push((g.total > 1 ? g.total + ' cas suspects ' : '1 cas suspect ') + de(minuscule(g.aff)) + ' : ' + detail(g)); });
    tri(animaux).forEach(function (g) { items.push(pluriel(g.total, 'animal touché', 'animaux touchés') + ' (' + minuscule(g.aff) + ')' + (g.morts ? ', dont ' + pluriel(g.morts, 'mort', 'morts') : '') + ' : ' + detail(g)); });
    tri(deces).sort(function (x, y) { return String(x.cle).localeCompare(String(y.cle)); }).forEach(function (g) {
      var t = TYPES_DECES[g.cle] || ['décès communautaire', 'décès communautaires'];
      items.push(g.total + ' ' + (g.total > 1 ? t[1] : t[0]) + ' : ' + detail(g));
    });
    var tot = { nb: liste.length, cas: 0, deces: 0, animT: 0, animM: 0 };
    liste.forEach(function (a) {
      if (estAnimal(a) && !(a.casTouches > 0) && a.kind !== 'DECES') { tot.animT += a.animauxTouches || 0; tot.animM += a.animauxMorts || 0; return; }
      tot.cas += a.casTouches || 0; tot.deces += a.casDeces || 0; tot.animT += a.animauxTouches || 0; tot.animM += a.animauxMorts || 0;
    });
    return { items: items, tot: tot };
  }

  function enTete(p, ev) {
    var en = 'Point de la semaine ' + p.label + ' (' + periodeTexte(p) + ') : ';
    if (!ev.tot.nb) return en + 'aucun événement de santé validé par les ASCQ cette semaine dans votre périmètre.';
    return en + pluriel(ev.tot.nb, 'événement de santé validé', 'événements de santé validés') + ' par les ASCQ dans votre périmètre :';
  }
  function bilan(ev) {
    var t = ev.tot, b = [];
    if (!t.nb) return '';
    if (t.cas) b.push(pluriel(t.cas, 'personne touchée', 'personnes touchées') + (t.deces ? ' dont ' + pluriel(t.deces, 'décès', 'décès') : ''));
    else if (t.deces) b.push(pluriel(t.deces, 'décès', 'décès'));
    if (t.animT) b.push(pluriel(t.animT, 'animal touché', 'animaux touchés') + (t.animM ? ' dont ' + pluriel(t.animM, 'mort', 'morts') : ''));
    return b.length ? 'Bilan : ' + liste_(b) + '.' : '';
  }
  function texteSemaine(p, ev) { return [enTete(p, ev)].concat(ev.items.map(function (i) { return '- ' + i; })).concat(bilan(ev) ? [bilan(ev)] : []).join('\n'); }

  function syntheseHtml() {
    var p = plage(), ev = evenementsSemaine(p);
    etat.texteSemaine = texteSemaine(p, ev);
    var peutPrec = etat.cal.length ? etat.idx > 0 : true, peutSuiv = !p.courante;
    return '<section class="av-synthese"><div class="av-synthese-tete"><h3>🗓️ Point de la semaine</h3><div class="av-sem-nav">' +
      '<button type="button" class="btn-secondary btn-mini" id="avSemPrec"' + (peutPrec ? '' : ' disabled') + '>‹ Semaine précédente</button>' +
      '<span class="av-sem-label">' + escHtml(p.label) + (p.courante ? ' (en cours)' : '') + '</span>' +
      '<button type="button" class="btn-secondary btn-mini" id="avSemSuiv"' + (peutSuiv ? '' : ' disabled') + '>Semaine suivante ›</button></div></div>' +
      '<p class="av-synthese-texte">' + escHtml(enTete(p, ev)) + '</p>' +
      (ev.items.length ? '<ul class="av-synthese-puces">' + ev.items.map(function (i) { return '<li>' + escHtml(i) + '</li>'; }).join('') + '</ul>' : '') +
      (bilan(ev) ? '<p class="av-synthese-bilan">' + escHtml(bilan(ev)) + '</p>' : '') +
      '<div class="av-synthese-pied"><span class="petit">Événements validés par les ASCQ, regroupés par affection puis par arrondissement (nombre de cas entre parenthèses) ; alertes avant décès ; sans mention des auteurs.</span>' +
      '<button type="button" class="btn-secondary btn-mini" id="avCopier">📋 Copier le texte</button></div></section>';
  }
  function lierSynthese() {
    var prec = document.getElementById('avSemPrec'), suiv = document.getElementById('avSemSuiv'), cop = document.getElementById('avCopier');
    function aller(sens) {
      if (etat.cal.length) etat.idx = Math.max(0, Math.min(etat.idxCourant >= 0 ? etat.idxCourant : etat.cal.length - 1, etat.idx + sens));
      else etat.debut = ajouteJours(etat.debut || lundi(new Date()), 7 * sens);
      dessiner();
    }
    if (prec) prec.onclick = function () { aller(-1); };
    if (suiv) suiv.onclick = function () { aller(1); };
    if (cop) cop.onclick = function () {
      var t = etat.texteSemaine || '';
      var ok = function () { toast('Texte copié.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { toast('Copie impossible.', true); });
      else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Copie impossible.', true); } ta.remove(); }
    };
  }

  function estAnimal(a) { return (a.animauxTouches || 0) > 0 || (a.animauxMorts || 0) > 0; }
  function typeDe(a) { return a.kind === 'DECES' ? 'deces' : (estAnimal(a) ? 'animal' : 'humain'); }

  function filtrees() {
    var q = etat.filtre.trim().toLowerCase();
    return etat.liste.filter(function (a) {
      if (etat.type && typeDe(a) !== etat.type) return false;
      if (!q) return true;
      return [a.affection, a.commune, a.arrondissement, a.village, a.notificateur, a.ascq, a.resume].join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function chiffre(libelle, valeur, classe) {
    return '<div class="av-chiffre ' + classe + '"><strong>' + escHtml(valeur) + '</strong><span>' + escHtml(libelle) + '</span></div>';
  }

  function carte(a) {
    var animal = estAnimal(a), t = typeDe(a);
    var badge = a.kind === 'DECES' ? '⚰️ Décès communautaire validé' : (animal ? '🐾 Alerte infection validée (animaux)' : '🚨 Alerte infection validée');
    var chiffres = chiffre('Cas touchés', a.casTouches || 0, 'av-touches') + chiffre('Cas décédés', a.casDeces || 0, 'av-deces');
    if (animal) chiffres += chiffre('Animaux touchés', a.animauxTouches || 0, 'av-animal') + chiffre('Animaux décédés', a.animauxMorts || 0, 'av-animal-mort');
    return '<article class="av-carte av-' + t + '">' +
      '<div class="av-tete"><span class="av-badge">' + badge + '</span><span class="av-date">Validée le ' + escHtml(fmtDate(a.dateValidation || a.date)) + '</span></div>' +
      '<h3 class="av-affection">' + escHtml(a.affection) + '</h3>' +
      '<div class="av-lieu">📍 <span><b>Village</b> ' + escHtml(a.village || '—') + '</span><span><b>Arrondissement</b> ' + escHtml(a.arrondissement || '—') + '</span><span><b>Commune</b> ' + escHtml(a.commune || '—') + '</span></div>' +
      '<div class="av-chiffres">' + chiffres + '</div>' +
      (a.resume ? '<p class="av-resume"><b>Résumé :</b> ' + escHtml(a.resume) + '</p>' : '') +
      '<div class="av-pied"><span>Notifiée par <b>' + escHtml(a.notificateur || '—') + '</b>' + (a.notificateurTel ? ' · ' + escHtml(a.notificateurTel) : '') + (a.dateNotification ? ' (le ' + escHtml(fmtDate(a.dateNotification)) + ')' : '') + '</span>' +
      '<span>Validée par <b>' + escHtml(a.ascq || '—') + '</b> (ASCQ)</span></div></article>';
  }

  function dessiner() {
    var el = etat.cont; if (!el) return;
    var liste = filtrees(), nbAnimal = etat.liste.filter(function (a) { return typeDe(a) === 'animal'; }).length;
    el.innerHTML = syntheseHtml() +
      '<div class="av-barre">' +
        '<input type="search" id="avRecherche" placeholder="Rechercher (affection, village, notificateur…)" value="' + escHtml(etat.filtre) + '">' +
        '<select id="avType"><option value="">Tous les types</option><option value="humain"' + (etat.type === 'humain' ? ' selected' : '') + '>Alertes (personnes)</option>' +
        '<option value="animal"' + (etat.type === 'animal' ? ' selected' : '') + '>Alertes animales</option><option value="deces"' + (etat.type === 'deces' ? ' selected' : '') + '>Décès communautaires</option></select>' +
        '<button type="button" class="btn-secondary btn-mini" id="avExcel">⬇ Exporter en Excel</button>' +
      '</div>' +
      '<div class="petit av-compte">' + liste.length + ' alerte(s) validée(s)' + (etat.liste.length !== liste.length ? ' (sur ' + etat.liste.length + ')' : '') + (nbAnimal ? ' · dont ' + nbAnimal + ' concernant des animaux' : '') + '</div>' +
      (liste.length ? liste.slice(0, etat.vues).map(carte).join('') : '<p class="petit">Aucune alerte validée par un ASCQ pour le moment.</p>') +
      (liste.length > etat.vues ? '<div style="text-align:center;margin-top:10px"><button type="button" class="btn-secondary" id="avPlus">Voir plus (' + (liste.length - etat.vues) + ')</button></div>' : '');
    var rech = document.getElementById('avRecherche');
    rech.oninput = function () { etat.filtre = rech.value; etat.vues = PAGE; var pos = rech.selectionStart; dessiner(); var r2 = document.getElementById('avRecherche'); r2.focus(); try { r2.setSelectionRange(pos, pos); } catch (e) { /* ignoré */ } };
    document.getElementById('avType').onchange = function (e) { etat.type = e.target.value; etat.vues = PAGE; dessiner(); };
    var plus = document.getElementById('avPlus'); if (plus) plus.onclick = function () { etat.vues += PAGE; dessiner(); };
    document.getElementById('avExcel').onclick = exporter;
    lierSynthese();
    if (etat.paramValidation !== undefined && typeof window.blocParametreValidation === 'function') window.blocParametreValidation(el, etat.paramValidation);
  }

  function feuille(liste) {
    var u = (window.Session && Session.getUser && Session.getUser()) || {};
    var entete = ['Date de validation', 'Type', 'Affection / événement', 'Commune', 'Arrondissement', 'Village', 'Cas touchés', 'Cas décédés', 'Animaux touchés', 'Animaux décédés', 'Notifiée par', 'Téléphone du notificateur', 'Date de notification', 'Validée par (ASCQ)', 'Résumé'];
    var lignes = [entete].concat(liste.map(function (a) {
      return [fmtDate(a.dateValidation || a.date), a.kind === 'DECES' ? 'Décès communautaire' : (estAnimal(a) ? 'Alerte (animaux)' : 'Alerte'), a.affection, a.commune, a.arrondissement, a.village,
        a.casTouches || 0, a.casDeces || 0, a.animauxTouches || 0, a.animauxMorts || 0, a.notificateur, a.notificateurTel, fmtDate(a.dateNotification), a.ascq, a.resume];
    }));
    return [
      { nom: 'Informations', sansBordure: true, largeurs: [30, 60], lignes: [
        [{ v: 'SIVEC — Alertes infection validées par les ASCQ', s: 't' }], [],
        [{ v: 'Filtre de recherche', s: 'b' }, etat.filtre || 'Aucun'],
        [{ v: 'Type', s: 'b' }, { '': 'Tous', humain: 'Alertes (personnes)', animal: 'Alertes animales', deces: 'Décès communautaires' }[etat.type]],
        [{ v: 'Nombre d’alertes', s: 'b' }, liste.length],
        [{ v: 'Exporté le', s: 'b' }, new Date().toLocaleString('fr-FR')],
        [{ v: 'Exporté par', s: 'b' }, ((u.Prenom || '') + ' ' + (u.Nom || '')).trim() + (u.Role ? ' (' + u.Role + ')' : '')]] },
      { nom: 'Alertes validées', entete: 1, filtre: true, largeurs: [14, 20, 30, 16, 18, 18, 10, 10, 11, 11, 24, 16, 14, 24, 60], lignes: lignes }
    ];
  }

  function exporter() {
    try {
      ExportExcel.telecharger('SIVEC_alertes_validees_' + new Date().toISOString().slice(0, 10) + '.xlsx', feuille(filtrees()));
      toast('Fichier Excel prêt.');
    } catch (err) { toast('Export Excel impossible : ' + err.message, true); }
  }

  window.renderAlertesValidees = async function (idConteneur) {
    var el = document.getElementById(idConteneur); if (!el) return;
    etat.cont = el; el.innerHTML = '<p class="petit">Chargement des alertes validées…</p>';
    try {
      var r = await Api.call('listAlertesValidees', {}); etat.liste = r.alertes || []; etat.vues = PAGE;
      // Semaines épidémiologiques (calendrier importé par le National) : semaine en cours par défaut.
      try {
        var c = await Api.call('listCalendrier', {}), auj = new Date();
        etat.cal = (c.calendrier || []).slice().sort(function (a, b) { return debutJournee_(a.DateDebut) - debutJournee_(b.DateDebut); });
        etat.idxCourant = etat.cal.findIndex(function (w) { return debutJournee_(w.DateDebut) <= auj && auj <= finJournee_(w.DateFin); });
        if (etat.idxCourant < 0) etat.cal = [];
        etat.idx = etat.idxCourant;
      } catch (e) { etat.cal = []; etat.idx = -1; }
      etat.debut = lundi(new Date());
      try { if (typeof Session !== 'undefined' && Session.getUser() && Session.getUser().Role === 'NATIONAL') etat.paramValidation = (await Api.call('getParametres', {})).parametres.validationAscq; } catch (e) { /* ignoré */ }
      dessiner();
    }
    catch (err) { el.innerHTML = '<p class="petit" style="color:#b00020">' + escHtml(err.message) + '</p>'; }
  };
  window.__alertesValidees = { synthese: function () { var p = plage(), ev = evenementsSemaine(p); return { texte: texteSemaine(p, ev), items: ev.items }; }, carte: carte, feuille: feuille, filtrees: filtrees, etat: etat, estAnimal: estAnimal };
})();

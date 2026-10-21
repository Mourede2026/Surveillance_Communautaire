/**
 * Alertes infection VALIDÉES par l'ASCQ — synthèse affichée dans le tableau de bord de tous les
 * niveaux au-dessus du relais communautaire (ASCQ, PF, RCSE, Département, National).
 *
 * Quand l'ASCQ investigue et valide un événement (ou confirme un décès), chaque niveau supérieur voit :
 * l'affection ou l'événement, l'arrondissement, le village, la commune, le nombre de cas touchés et de
 * cas décédés (et, si l'événement concerne des animaux, le nombre d'animaux touchés et décédés), le
 * résumé, la personne qui a fait la notification et l'ASCQ qui l'a validée.
 *
 * renderAlertesValidees(idConteneur) — action serveur : listAlertesValidees (limitée au périmètre).
 */
(function () {
  'use strict';
  var PAGE = 15;
  var etat = { liste: [], filtre: '', type: '', vues: PAGE, cont: null };

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
    el.innerHTML =
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
    try { var r = await Api.call('listAlertesValidees', {}); etat.liste = r.alertes || []; etat.vues = PAGE; dessiner(); }
    catch (err) { el.innerHTML = '<p class="petit" style="color:#b00020">' + escHtml(err.message) + '</p>'; }
  };
  window.__alertesValidees = { carte: carte, feuille: feuille, filtrees: filtrees, etat: etat, estAnimal: estAnimal };
})();

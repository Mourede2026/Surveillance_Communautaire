/**
 * Rapport de séance d'un suivi groupé.
 *
 * Affiché EN MÊME TEMPS que la liste de présence (voir liste-presence.js) : en-tête, thèmes développés,
 * résumé structuré de chaque thème choisi, participation, observations et preuves jointes.
 *
 * Le résumé de chaque thème est extrait automatiquement du module de briefing correspondant
 * (BRIEFING_MODULES, assets/briefing-data.js) : signes, définition du cas alerte, transmission,
 * prévention, conduite à tenir du RC, rôle du RC. Les données du rapport viennent de getListePresence
 * (champ « rapport »).
 *
 * window.RapportSeance = { documentHtml(d), feuilleExcel(d), resumeTheme(id) }
 */
(function () {
  'use strict';

  var cache = {};

  function modules() { return (typeof BRIEFING_MODULES !== 'undefined') ? BRIEFING_MODULES : []; }
  function propre(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
  function sansPictogramme(t) { return propre(t).replace(/^[^\p{L}\p{N}]+/u, '').trim(); }
  function coupe(t, n) { t = propre(t); return t.length > n ? t.slice(0, n - 1).trim() + '…' : t; }

  /** Résumé structuré d'un thème : { id, icone, titre, sections: [{ titre, points: [], texte }] } */
  function resumeTheme(id) {
    if (cache[id]) return cache[id];
    var m = modules().find(function (x) { return x.id === id; });
    if (!m) return (cache[id] = { id: id, icone: '', titre: id, sections: [] });
    var doc = new DOMParser().parseFromString('<div>' + m.body + '</div>', 'text/html');
    var sections = [];
    doc.querySelectorAll('.block').forEach(function (b) {
      var titreEl = b.querySelector('.block-title');
      var titre = sansPictogramme(titreEl ? titreEl.textContent : '');
      var points = [];
      b.querySelectorAll('.tag').forEach(function (t) { points.push(sansPictogramme(t.textContent)); });
      b.querySelectorAll('.step-list li').forEach(function (li) {
        var sp = li.querySelectorAll('span'); points.push(sansPictogramme((sp.length ? sp[sp.length - 1] : li).textContent));
      });
      var contenu = b.querySelector('.block-content');
      var texte = '';
      if (contenu) {
        var copie = contenu.cloneNode(true);
        copie.querySelectorAll('.tag-list').forEach(function (n) { n.remove(); });
        texte = coupe(copie.textContent, 320);
      }
      points = points.filter(Boolean).slice(0, 8);
      if (titre && (points.length || texte)) sections.push({ titre: titre, points: points, texte: texte });
    });
    return (cache[id] = { id: id, icone: m.icon || '', titre: m.title, sections: sections });
  }

  function listeNoms(a) { return (a || []).length ? a.join(', ') : '—'; }

  function themesHtml(r) {
    var themes = (r.themes || []).map(resumeTheme);
    if (!themes.length) return '<p>—</p>';
    return '<ol class="rs-themes">' + themes.map(function (t) { return '<li>' + escHtml(t.titre) + '</li>'; }).join('') + '</ol>' +
      '<h4 class="rs-h">2. Résumé de chaque thème développé</h4>' +
      themes.map(function (t, i) {
        return '<div class="rs-theme"><div class="rs-theme-titre">' + escHtml(t.icone) + ' 2.' + (i + 1) + ' ' + escHtml(t.titre) + '</div>' +
          (t.sections.length ? t.sections.map(function (s) {
            return '<div class="rs-sec"><div class="rs-sec-titre">' + escHtml(s.titre) + '</div>' +
              (s.texte ? '<p class="rs-p">' + escHtml(s.texte) + '</p>' : '') +
              (s.points.length ? '<ul class="rs-ul">' + s.points.map(function (p) { return '<li>' + escHtml(p) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
          }).join('') : '<p class="rs-p">Résumé détaillé indisponible pour ce thème.</p>') + '</div>';
      }).join('');
  }

  function documentHtml(d) {
    var r = d.rapport; if (!r) return '';
    var h = d.header || {};
    var photos = (r.photos || []).map(function (u, i) { return '<a href="' + escHtml(u) + '" target="_blank" rel="noopener"><img class="rs-photo" alt="Photo ' + (i + 1) + '" src="' + escHtml(u) + '"></a>'; }).join('');
    var docs = (r.documents || []).map(function (x) { return '<div><a href="' + escHtml(x.url) + '" target="_blank" rel="noopener">📄 ' + escHtml(x.nom) + '</a></div>'; }).join('');
    return '<div class="rs-doc">' +
      '<div class="lp-haut"><div class="lp-rep">RÉPUBLIQUE DU BÉNIN<br>MINISTÈRE DE LA SANTÉ</div><div class="lp-marque"><img class="lp-logo" alt="" src="assets/icons/icon-192.png"><b>SIVEC</b></div></div>' +
      '<h2 class="lp-titre">RAPPORT DE SÉANCE</h2><div class="lp-sous">Suivi groupé des relais communautaires</div>' +
      '<table class="lp-meta"><tr><td><b>Département :</b> ' + escHtml(h.departement || '—') + '</td><td><b>Zone sanitaire :</b> ' + escHtml(h.zoneSanitaire || '—') + '</td></tr>' +
      '<tr><td><b>Commune :</b> ' + escHtml(h.commune || '—') + '</td><td><b>Arrondissement :</b> ' + escHtml(h.arrondissement || '—') + '</td></tr>' +
      '<tr><td><b>Date de la séance :</b> ' + escHtml(fmtDate(h.date) || '—') + '</td><td><b>Lieu :</b> ' + escHtml(h.lieu || '—') + '</td></tr>' +
      '<tr><td><b>Animée par :</b> ' + escHtml(r.ascq || h.ascq || '—') + '</td><td><b>Village(s) :</b> ' + escHtml(listeNoms(r.villages)) + '</td></tr>' +
      (r.objectif ? '<tr><td colspan="2"><b>Objectif de la séance :</b> ' + escHtml(r.objectif) + '</td></tr>' : '') + '</table>' +
      '<h4 class="rs-h">1. Thèmes développés</h4>' + themesHtml(r) +
      '<h4 class="rs-h">3. Participation</h4>' +
      '<table class="lp-table rs-part"><tbody>' +
      '<tr><th>Participants (liste de présence)</th><td>' + escHtml(r.nbParticipants) + '</td></tr>' +
      '<tr><th>Relais communautaires présents</th><td>' + escHtml(r.nbRcPresents) + '</td></tr>' +
      ((r.rcAbsents || []).length ? '<tr><th>Relais communautaires absents</th><td>' + escHtml(listeNoms(r.rcAbsents)) + '</td></tr>' : '') +
      '<tr><th>Autres acteurs et superviseurs présents</th><td>' + escHtml(r.nbAutres) + '</td></tr></tbody></table>' +
      '<h4 class="rs-h">4. Observations</h4><p class="rs-p">' + (r.commentaires ? escHtml(r.commentaires).replace(/\n/g, '<br>') : '—') + '</p>' +
      ((photos || docs) ? '<h4 class="rs-h">5. Pièces jointes</h4><div class="rs-photos">' + photos + '</div>' + docs : '') +
      '<div class="lp-pied">Rapport déposé' + (r.dateDepot ? ' le ' + escHtml(fmtDate(r.dateDepot)) : '') + ' par ' + escHtml(r.ascq || '—') + '. Il est verrouillé : il ne peut plus être modifié. La liste de présence suit ce rapport.</div></div>';
  }

  /** Feuille Excel « Rapport de séance » : en-tête, thèmes, résumé de chaque thème, participation. */
  function feuilleExcel(d) {
    var r = d.rapport; if (!r) return null;
    var h = d.header || {};
    var l = [[{ v: 'RAPPORT DE SÉANCE — Suivi groupé des relais communautaires', s: 't' }], [],
      [{ v: 'Département', s: 'b' }, h.departement || ''], [{ v: 'Zone sanitaire', s: 'b' }, h.zoneSanitaire || ''],
      [{ v: 'Commune', s: 'b' }, h.commune || ''], [{ v: 'Arrondissement', s: 'b' }, h.arrondissement || ''],
      [{ v: 'Date de la séance', s: 'b' }, fmtDate(h.date) || ''], [{ v: 'Lieu', s: 'b' }, h.lieu || ''],
      [{ v: 'Animée par', s: 'b' }, r.ascq || ''], [{ v: 'Village(s)', s: 'b' }, (r.villages || []).join(', ')]];
    if (r.objectif) l.push([{ v: 'Objectif', s: 'b' }, r.objectif]);
    l.push([], [{ v: 'THÈMES DÉVELOPPÉS ET RÉSUMÉ', s: 'h' }, { v: '', s: 'h' }]);
    (r.themes || []).map(resumeTheme).forEach(function (t, i) {
      l.push([{ v: (i + 1) + '. ' + t.titre, s: 'b' }, '']);
      t.sections.forEach(function (s) {
        if (s.texte) l.push([s.titre, s.texte]);
        s.points.forEach(function (p, k) { l.push([(!s.texte && k === 0) ? s.titre : '', '• ' + p]); });
      });
    });
    l.push([], [{ v: 'PARTICIPATION', s: 'h' }, { v: '', s: 'h' }],
      ['Participants (liste de présence)', r.nbParticipants], ['Relais communautaires présents', r.nbRcPresents],
      ['Relais communautaires absents', (r.rcAbsents || []).join(', ')], ['Autres acteurs et superviseurs', r.nbAutres],
      [], [{ v: 'OBSERVATIONS', s: 'h' }, { v: '', s: 'h' }], ['', r.commentaires || '']);
    return { nom: 'Rapport de séance', largeurs: [44, 110], lignes: l, images: [], hauteurs: {} };
  }

  window.RapportSeance = { documentHtml: documentHtml, feuilleExcel: feuilleExcel, resumeTheme: resumeTheme };
})();

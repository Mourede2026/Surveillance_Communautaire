/**
 * Calendrier épidémiologique de l'année — version PDF à télécharger.
 *
 * Le calendrier est défini une fois par an par l'administrateur national (onglet « Calendrier épidémiologique »).
 * Tous les autres utilisateurs (RC, ASCQ, PF, RCSE — responsables de la coordination de la surveillance —,
 * Département) peuvent en télécharger la version PDF depuis leur tableau de bord. Le PDF est fabriqué dans le
 * navigateur (assets/pdf-mini.js) : il fonctionne aussi hors connexion (dernier calendrier chargé).
 *
 * renderCalendrierPdf(idConteneur) — action serveur : listCalendrier.
 */
(function () {
  'use strict';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function jour(v) { return String(v || '').slice(0, 10); }
  function fr(v) { var j = jour(v); return j ? j.slice(8, 10) + '/' + j.slice(5, 7) + '/' + j.slice(0, 4) : ''; }
  function longue(v) { var j = jour(v); return j ? parseInt(j.slice(8, 10), 10) + ' ' + MOIS[parseInt(j.slice(5, 7), 10) - 1] + ' ' + j.slice(0, 4) : ''; }
  function aujourdhui() { var d = new Date(), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

  /** Logo (icône de l'application) en RGB 8 bits sur fond blanc, pour l'incruster dans le PDF. */
  function logoRgb(src, taille) {
    return new Promise(function (res) {
      try {
        var img = new Image();
        img.onload = function () {
          var cv = document.createElement('canvas'); cv.width = cv.height = taille; var c = cv.getContext('2d');
          c.fillStyle = '#fff'; c.fillRect(0, 0, taille, taille); c.drawImage(img, 0, 0, taille, taille);
          var d = c.getImageData(0, 0, taille, taille).data, rgb = new Uint8Array(taille * taille * 3);
          for (var i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
          res({ rgb: rgb, l: taille, h: taille });
        };
        img.onerror = function () { res(null); }; img.src = src;
      } catch (e) { res(null); }
    });
  }

  /** Construit le PDF (une page A4) : deux colonnes de semaines. Fonction pure, testable hors navigateur. */
  function construirePdf(annee, semaines, qui, logo, jourCourant) {
    var doc = new PdfMini({ titre: 'Calendrier epidemiologique ' + annee }), p = doc.page(), L = p.l, M = 40;
    var teal = '#0B3D3A', gris = '#55655F';
    p.texte(M, 52, 'RÉPUBLIQUE DU BÉNIN', { taille: 9, gras: true }); p.texte(M, 65, 'MINISTÈRE DE LA SANTÉ', { taille: 9, gras: true });
    if (logo) p.image(logo, L - M - 44, 36, 44, 44);
    p.texte(L - M - 52, 62, 'SIVEC', { taille: 15, gras: true, couleur: teal, align: 'right' });
    p.texte(L / 2, 112, 'CALENDRIER ÉPIDÉMIOLOGIQUE ' + annee, { taille: 19, gras: true, couleur: teal, align: 'center' });
    var premiere = semaines[0], derniere = semaines[semaines.length - 1];
    p.texte(L / 2, 132, 'Semaines épidémiologiques du lundi au dimanche — du ' + longue(premiere.DateDebut) + ' au ' + longue(derniere.DateFin), { taille: 10, couleur: gris, align: 'center' });
    var colonnes = [60, 96, 96], largT = colonnes[0] + colonnes[1] + colonnes[2], ecart = L - 2 * M - 2 * largT, hLigne = 19, y0 = 156;
    var moitie = Math.ceil(semaines.length / 2), blocs = [semaines.slice(0, moitie), semaines.slice(moitie)];
    var courante = null;
    blocs.forEach(function (bloc, b) {
      var x0 = M + b * (largT + ecart), x = x0;
      p.rect(x0, y0, largT, hLigne + 2, { fond: teal });
      ['Semaine', 'Date de début', 'Date de fin'].forEach(function (t, i) { p.texte(x + colonnes[i] / 2, y0 + 14, t, { taille: 9, gras: true, couleur: '#FFFFFF', align: 'center' }); x += colonnes[i]; });
      bloc.forEach(function (s, i) {
        var y = y0 + hLigne + 2 + i * hLigne, actuelle = jourCourant >= jour(s.DateDebut) && jourCourant <= jour(s.DateFin);
        if (actuelle) courante = s;
        p.rect(x0, y, largT, hLigne, { fond: actuelle ? '#FBE3B0' : (i % 2 ? '#F2F6F5' : '#FFFFFF'), trait: '#C9D4D1', epaisseur: 0.4 });
        var cx = x0;
        [ 'S' + s.SemaineEpi, fr(s.DateDebut), fr(s.DateFin) ].forEach(function (t, k) { p.texte(cx + colonnes[k] / 2, y + 13, t, { taille: 10, gras: k === 0, align: 'center' }); cx += colonnes[k]; });
      });
    });
    var yFin = y0 + hLigne + 2 + moitie * hLigne + 20;
    if (courante) { p.rect(M, yFin - 9, 10, 10, { fond: '#FBE3B0', trait: '#C9871F' }); p.texte(M + 16, yFin, 'Semaine en cours : S' + courante.SemaineEpi + ' (du ' + fr(courante.DateDebut) + ' au ' + fr(courante.DateFin) + ')', { taille: 9 }); yFin += 18; }
    p.texte(M, yFin, 'La semaine épidémiologique est celle de la date de survenue ; elle sert de référence pour les notifications,', { taille: 8.5, couleur: gris });
    p.texte(M, yFin + 12, 'les rapports hebdomadaires et les tendances.', { taille: 8.5, couleur: gris });
    p.ligne(M, 800, L - M, 800, { couleur: '#C9D4D1', epaisseur: 0.6 });
    p.texte(M, 814, 'Calendrier défini par l’administration nationale · téléchargé le ' + fr(jourCourant) + (qui ? ' par ' + qui : '') + ' · SIVEC', { taille: 8, couleur: gris });
    return doc;
  }

  window.renderCalendrierPdf = async function (idConteneur) {
    var el = document.getElementById(idConteneur); if (!el) return;
    el.innerHTML = '<p class="petit">Chargement du calendrier…</p>';
    var cal;
    try { cal = (await Api.call('listCalendrier', {})).calendrier || []; }
    catch (err) { el.innerHTML = '<p class="petit" style="color:#b00020">' + escHtml(err.message) + '</p>'; return; }
    var parAnnee = {}; cal.forEach(function (s) { (parAnnee[s.Annee] = parAnnee[s.Annee] || []).push(s); });
    var annees = Object.keys(parAnnee).sort(), anneeCourante = String(new Date().getFullYear());
    if (!annees.length) { el.innerHTML = '<p class="petit">Le calendrier épidémiologique de l’année n’a pas encore été défini par l’administrateur national.</p>'; return; }
    var choisie = annees.indexOf(anneeCourante) !== -1 ? anneeCourante : annees[annees.length - 1];
    function dessiner() {
      var sem = parAnnee[choisie].slice().sort(function (a, b) { return Number(a.SemaineEpi) - Number(b.SemaineEpi); });
      el.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between">' +
        '<div><b>Calendrier épidémiologique ' + escHtml(choisie) + '</b><div class="petit">' + sem.length + ' semaines · du ' + escHtml(longue(sem[0].DateDebut)) + ' au ' + escHtml(longue(sem[sem.length - 1].DateFin)) + '</div></div>' +
        '<div style="display:flex;gap:8px;align-items:center">' + (annees.length > 1 ? '<select id="calAnnee">' + annees.map(function (a) { return '<option' + (a === choisie ? ' selected' : '') + '>' + escHtml(a) + '</option>'; }).join('') + '</select>' : '') +
        '<button type="button" id="calPdf">⬇ Télécharger le PDF</button></div></div>';
      var s = document.getElementById('calAnnee'); if (s) s.onchange = function () { choisie = s.value; dessiner(); };
      document.getElementById('calPdf').onclick = async function () {
        var b = this; b.disabled = true;
        try {
          var u = (window.Session && Session.getUser && Session.getUser()) || {}, logo = await logoRgb('assets/icons/icon-192.png', 96);
          var qui = ((u.Prenom || '') + ' ' + (u.Nom || '')).trim();
          construirePdf(choisie, sem, qui, logo, aujourdhui()).telecharger('SIVEC_calendrier_epidemiologique_' + choisie + '.pdf');
          toast('Calendrier PDF prêt.');
        } catch (err) { toast('PDF impossible : ' + err.message, true); } finally { b.disabled = false; }
      };
    }
    dessiner();
  };
  window.__calendrierPdf = { construirePdf: construirePdf, longue: longue };
})();

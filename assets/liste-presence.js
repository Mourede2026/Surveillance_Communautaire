/**
 * Liste de présence d'un suivi groupé.
 *
 * En-tête : département, zone sanitaire, commune, arrondissement, date du suivi.
 * Colonnes : N° d'ordre · Nom et prénom · Qualification · Provenance (arrondissement ou village) ·
 *            Contact téléphonique · Signature.
 * Une ligne par participant : l'ASCQ, les RC présents et les autres participants (superviseurs). La signature
 * de chacun est celle qu'il a enregistrée dans « Mon compte » ; sans signature enregistrée, la case reste
 * vide pour signer à la main après impression.
 *
 * ouvrirListePresence(suiviId) — fenêtre avec le document, impression / PDF et export Excel.
 * Action serveur : getListePresence.
 */
(function () {
  'use strict';

  var COLONNES = ['N° d’ordre', 'Nom et prénom', 'Qualification', 'Provenance (Arrondissement ou Village)', 'Contact téléphonique', 'Signature'];

  function documentHtml(d, sansId) {
    var h = d.header || {}, lignes = (d.participants || []).map(function (p) {
      return '<tr><td class="lp-c">' + p.ordre + '</td><td>' + escHtml(p.nom) + '</td><td>' + escHtml(p.qualification) + '</td><td>' + escHtml(p.provenance || '—') + '</td><td class="lp-c">' + escHtml(p.telephone || '—') + '</td>' +
        '<td class="lp-sigcell">' + (p.signature ? '<img class="lp-sig" alt="Signature de ' + escHtml(p.nom) + '" src="' + p.signature + '">' : '') + '</td></tr>';
    }).join('');
    var rapport = (window.RapportSeance && d.rapport) ? window.RapportSeance.documentHtml(d) + '<div class="lp-saut"></div>' : '';
    return '<div ' + (sansId ? '' : 'id="lpPrintArea" ') + 'class="lp-doc">' + rapport +
      '<div class="lp-haut"><div class="lp-rep">RÉPUBLIQUE DU BÉNIN<br>MINISTÈRE DE LA SANTÉ</div><div class="lp-marque"><img class="lp-logo" alt="" src="assets/icons/icon-192.png"><b>SIVEC</b></div></div>' +
      '<h2 class="lp-titre">LISTE DE PRÉSENCE</h2><div class="lp-sous">Suivi groupé des relais communautaires</div>' +
      '<table class="lp-meta"><tr><td><b>Département :</b> ' + escHtml(h.departement || '—') + '</td><td><b>Zone sanitaire :</b> ' + escHtml(h.zoneSanitaire || '—') + '</td></tr>' +
      '<tr><td><b>Commune :</b> ' + escHtml(h.commune || '—') + '</td><td><b>Arrondissement :</b> ' + escHtml(h.arrondissement || '—') + '</td></tr>' +
      '<tr><td colspan="2"><b>Date du suivi :</b> ' + escHtml(fmtDate(h.date) || '—') + (h.lieu ? ' &nbsp;·&nbsp; <b>Lieu :</b> ' + escHtml(h.lieu) : '') + '</td></tr></table>' +
      '<table class="lp-table"><thead><tr>' + COLONNES.map(function (c) { return '<th>' + escHtml(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + lignes + '</tbody></table>' +
      '<div class="lp-pied">Les signatures proviennent des comptes SIVEC des participants (« Mon compte »). Une case vide se signe à la main après impression.</div></div>';
  }

  function octets(dataUrl) {
    var b = atob(String(dataUrl).split(',')[1] || ''), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }

  /** Feuille Excel : informations d'en-tête, tableau et signatures en images. */
  function feuillesExcel(d) {
    var rap = window.RapportSeance ? window.RapportSeance.feuilleExcel(d) : null;
    return (rap ? [rap] : []).concat([feuilleExcel(d)]);
  }
  function feuilleExcel(d) {
    var h = d.header || {}, lignes = [
      [{ v: 'LISTE DE PRÉSENCE — Suivi groupé des relais communautaires', s: 't' }], [],
      [{ v: 'Département', s: 'b' }, h.departement || ''], [{ v: 'Zone sanitaire', s: 'b' }, h.zoneSanitaire || ''],
      [{ v: 'Commune', s: 'b' }, h.commune || ''], [{ v: 'Arrondissement', s: 'b' }, h.arrondissement || ''],
      [{ v: 'Date du suivi', s: 'b' }, fmtDate(h.date) || ''], [{ v: 'Lieu', s: 'b' }, h.lieu || ''], []
    ];
    var debut = lignes.length, images = [], hauteurs = {};
    lignes.push(COLONNES.map(function (c) { return { v: c, s: 'h' }; }));
    (d.participants || []).forEach(function (p, i) {
      lignes.push([p.ordre, p.nom, p.qualification, p.provenance || '', p.telephone || '', '']);
      hauteurs[debut + 1 + i] = 42;
      if (p.signature) { try { images.push({ png: octets(p.signature), col: 5, ligne: debut + 1 + i, larg: 120, haut: 50 }); } catch (e) { /* signature illisible : case laissée vide */ } }
    });
    return { nom: 'Liste de présence', largeurs: [18, 30, 40, 34, 20, 24], lignes: lignes, images: images, hauteurs: hauteurs };
  }

  function fermer() { var o = document.getElementById('lpOverlay'); if (o) o.remove(); }

  async function ouvrir(suiviId) {
    fermer();
    var ov = document.createElement('div'); ov.id = 'lpOverlay'; ov.className = 'modal-overlay lp-overlay'; ov.style.display = 'flex';
    ov.innerHTML = '<div class="modal-box lp-box"><p class="petit">Chargement du rapport et de la liste de présence…</p></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) fermer(); });
    try {
      var d = await Api.call('getListePresence', { suiviId: suiviId });
      ov.firstChild.innerHTML =
        '<div class="lp-actions no-print"><button type="button" id="lpImprimer">🖨️ Imprimer / PDF</button>' +
        '<button type="button" class="btn-secondary" id="lpExcel">⬇ Excel (rapport + liste)</button><button type="button" class="btn-secondary" id="lpFermer">Fermer</button></div>' +
        documentHtml(d);
      document.getElementById('lpFermer').onclick = fermer;
      document.getElementById('lpImprimer').onclick = function () { window.print(); };
      document.getElementById('lpExcel').onclick = function () {
        try { ExportExcel.telecharger('SIVEC_rapport_et_presence_' + String((d.header || {}).date || '').slice(0, 10) + '.xlsx', feuillesExcel(d)); toast('Fichier Excel prêt.'); }
        catch (err) { toast('Export Excel impossible : ' + err.message, true); }
      };
    } catch (err) { ov.firstChild.innerHTML = '<p style="color:#b00020">' + escHtml(err.message) + '</p><button type="button" class="btn-secondary" id="lpFermer">Fermer</button>'; document.getElementById('lpFermer').onclick = fermer; }
  }

  window.ouvrirListePresence = ouvrir;
  window.__listePresence = { documentHtml: documentHtml, feuilleExcel: feuilleExcel, COLONNES: COLONNES };
})();

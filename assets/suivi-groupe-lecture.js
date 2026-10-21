/**
 * Suivis groupés des RC — éléments partagés + synthèse en LECTURE SEULE pour les niveaux
 * hiérarchiques (PF, RCSE, DEPARTEMENT, NATIONAL). La saisie et la planification restent
 * réservées à l'ASCQ (voir assets/suivi-groupe-ascq.js).
 *
 * renderSuivisGroupesLecture(containerId) affiche :
 *   1. le planning des suivis groupés prévus par les ASCQ du périmètre ;
 *   2. les suivis réalisés (villages, thèmes, RC présents, photos et documents du rapport).
 */

function jsonArr_(v) { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }

function themesLabels_(ids) {
  return ids.map(id => { const m = (typeof BRIEFING_MODULES !== 'undefined') ? BRIEFING_MODULES.find(x => x.id === id) : null; return m ? m.title : id; });
}

// Liens vers les photos et documents joints au rapport d'un suivi groupé.
function piecesLiensHtml_(s) {
  const photos = jsonArr_(s.PhotosUrls).map((u, i) => `<a href="${escHtml(u)}" target="_blank" rel="noopener">📷 Photo ${i + 1}</a>`);
  const docs = jsonArr_(s.DocumentsUrls).map(d => `<a href="${escHtml(d.url)}" target="_blank" rel="noopener">📄 ${escHtml(d.nom || 'Document')}</a>`);
  return photos.concat(docs).join('<br>') || '—';
}

// Statut d'une séance planifiée ("En retard" si la date est passée sans compte rendu).
function statutPlanningBadge_(p) {
  const today = new Date().toISOString().slice(0, 10);
  if (p.Statut === 'Réalisé') return '<span class="badge badge-done">Réalisé</span>';
  if (p.Statut === 'Annulé') return '<span class="badge badge-cancel">Annulé</span>';
  if (String(p.DatePrevue) < today) return '<span class="badge badge-late">En retard</span>';
  return '<span class="badge badge-new">Planifié</span>';
}

function planningQuandHtml_(p) { return fmtDate(p.DatePrevue) + (p.Heure ? ' à ' + escHtml(p.Heure) : ''); }

// Historique unifié : chaque séance planifiée avec sa mention (Réalisé / Non réalisé / À venir),
// plus les suivis réalisés sans planification préalable (mention « Réalisé »).
//   Réalisé      : un compte rendu a été enregistré
//   Non réalisé  : annulée, ou date dépassée sans compte rendu
//   À venir      : planifiée, date non dépassée
function historiqueSuivis_(plannings, suivis) {
  const today = new Date().toISOString().slice(0, 10);
  const lignes = [];
  const suiviParId = {};
  suivis.forEach(s => { suiviParId[s.ID] = s; });
  const utilises = new Set();
  plannings.forEach(p => {
    const suivi = p.SuiviId ? suiviParId[p.SuiviId] : null;
    if (suivi) utilises.add(suivi.ID);
    let statut = 'À venir';
    if (p.Statut === 'Réalisé' || suivi) statut = 'Réalisé';
    else if (p.Statut === 'Annulé' || String(p.DatePrevue) < today) statut = 'Non réalisé';
    lignes.push({
      date: suivi ? suivi.Date : p.DatePrevue, prevu: p.DatePrevue, heure: p.Heure, ascq: p.AscqNom, planifie: true, statut,
      motif: p.Statut === 'Annulé' ? 'Annulé' : (statut === 'Non réalisé' ? 'Date dépassée sans compte rendu' : ''),
      villages: jsonArr_(p.VillageNoms), lieu: p.Lieu, objectif: p.Objectif,
      themes: jsonArr_((suivi && suivi.Themes) || p.Themes), convoques: jsonArr_(p.RcConviesNoms),
      presents: suivi ? jsonArr_(suivi.RcPresentsNoms) : [], suivi, plan: p
    });
  });
  suivis.forEach(sv => {
    if (utilises.has(sv.ID)) return;
    lignes.push({ date: sv.Date, prevu: '', heure: '', ascq: sv.AscqNom, planifie: false, statut: 'Réalisé', motif: 'Non planifié',
      villages: jsonArr_(sv.VillageNoms), lieu: '', objectif: '', themes: jsonArr_(sv.Themes), convoques: [], presents: jsonArr_(sv.RcPresentsNoms), suivi: sv, plan: null });
  });
  return lignes.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function statutHistoriqueBadge_(l) {
  if (l.statut === 'Réalisé') return '<span class="badge badge-done">✔ Réalisé</span>';
  if (l.statut === 'Non réalisé') return '<span class="badge badge-late">✖ Non réalisé</span>' + (l.motif ? `<div class="petit">${escHtml(l.motif)}</div>` : '');
  return '<span class="badge badge-new">À venir</span>';
}

// Indicateurs de réalisation : taux = réalisés planifiés / (réalisés planifiés + non réalisés).
function kpiSuivisHtml_(lignes) {
  const plan = lignes.filter(l => l.planifie);
  const realises = plan.filter(l => l.statut === 'Réalisé').length;
  const nonReal = plan.filter(l => l.statut === 'Non réalisé').length;
  const avenir = plan.filter(l => l.statut === 'À venir').length;
  const horsPlan = lignes.filter(l => !l.planifie).length;
  const echus = realises + nonReal;
  const taux = echus ? Math.round(100 * realises / echus) + ' %' : '—';
  return `<div class="grid grid-4" style="margin-bottom:14px">
    <div class="stat-card"><div class="n">${plan.length}</div><div class="l">Séances planifiées</div></div>
    <div class="stat-card"><div class="n">${realises}</div><div class="l">Réalisées (avec preuve)</div></div>
    <div class="stat-card"><div class="n">${nonReal}</div><div class="l">Non réalisées · ${avenir} à venir</div></div>
    <div class="stat-card"><div class="n">${taux}</div><div class="l">Taux de réalisation${horsPlan ? ' · ' + horsPlan + ' hors planning' : ''}</div></div></div>`;
}

function ligneTableHtml_(l, i, avecAscq) {
  const rc = l.statut === 'Réalisé' ? `${l.presents.length} présent(s)` + (l.suivi && jsonArr_(l.suivi.RcAbsentsNoms).length ? ` · ${jsonArr_(l.suivi.RcAbsentsNoms).length} absent(s)` : '') : (l.convoques.length ? `${l.convoques.length} convoqué(s)` : '—');
  const quand = l.planifie && l.prevu && String(l.prevu) !== String(l.date) ? `${fmtDate(l.date)}<div class="petit">prévu le ${fmtDate(l.prevu)}</div>` : fmtDate(l.date) + (l.heure ? ` <span class="petit">${escHtml(l.heure)}</span>` : '');
  const nbPieces = l.suivi ? jsonArr_(l.suivi.PhotosUrls).length + jsonArr_(l.suivi.DocumentsUrls).length : 0;
  return `<tr><td>${quand}</td>${avecAscq ? `<td>${escHtml(l.ascq)}</td>` : ''}<td>${escHtml(l.villages.join(', '))}</td>
    <td>${escHtml(themesLabels_(l.themes).join(', '))}</td><td>${rc}</td><td>${statutHistoriqueBadge_(l)}</td>
    <td>${nbPieces ? '📎 ' + nbPieces : '—'}</td><td><button class="btn-secondary btn-mini" data-fiche="${i}">Voir la fiche</button>${l.statut === 'Réalisé' && l.suivi ? ` <button class="btn-secondary btn-mini" data-presence="${l.suivi.ID}">👥 Présence</button>` : ''}</td></tr>`;
}

// Fiche détaillée (et imprimable / PDF) d'une séance : preuves, présence, commentaires.
function ouvrirFicheSuivi_(l) {
  const sv = l.suivi, pl = l.plan;
  const absents = sv ? jsonArr_(sv.RcAbsentsNoms) : [];
  const photos = sv ? jsonArr_(sv.PhotosUrls) : [], docs = sv ? jsonArr_(sv.DocumentsUrls) : [];
  const ligne = (k, v) => v ? `<tr><th style="width:34%;text-transform:none">${k}</th><td>${v}</td></tr>` : '';
  let presence = '';
  if (l.statut === 'Réalisé') {
    // Liste de présence signée : ASCQ, RC présents et autres participants, avec qualification, provenance,
    // contact et signature (chargée depuis le serveur, voir assets/liste-presence.js).
    presence = (sv ? `<div id="ficheListePresence" class="lp-inline"><p class="petit">Chargement de la liste de présence…</p></div>` : '') +
      (absents.length ? `<p class="petit"><b>Absents :</b> ${escHtml(absents.join(', '))}</p>` : '');
  } else if (l.convoques.length) {
    presence = `<h4 class="sous-titre" style="margin-top:16px">RC convoqués</h4><p>${escHtml(l.convoques.join(', '))}</p>`;
  }
  const preuves = (photos.length || docs.length) ? `<h4 class="sous-titre" style="margin-top:16px">Preuves jointes</h4>
    <div class="fiche-photos">${photos.map((u, i) => `<a href="${escHtml(u)}" target="_blank" rel="noopener"><img src="${escHtml(u)}" alt="Photo ${i + 1}"></a>`).join('')}</div>
    <div>${docs.map(d => `<div><a href="${escHtml(d.url)}" target="_blank" rel="noopener">📄 ${escHtml(d.nom || 'Document')}</a></div>`).join('')}</div>` :
    (l.statut === 'Réalisé' ? '' : '<p class="petit" style="margin-top:14px">Aucune preuve : la séance n\'a pas (encore) fait l\'objet d\'un compte rendu.</p>');
  const verrou = sv ? `<div class="verrou">🔒 Rapport verrouillé — déposé le ${fmtDate(sv.DateCreation)} par ${escHtml(sv.AscqNom)}. Il ne peut plus être modifié.</div>` : '';
  const ov = document.createElement('div');
  ov.className = 'modal-overlay fiche-overlay';
  ov.innerHTML = `<div class="modal-box fiche-box"><div id="fichePrintArea">
    <h3 style="margin:0 0 4px">Fiche de suivi groupé des relais communautaires</h3>
    <div style="margin-bottom:10px">${statutHistoriqueBadge_(l)}</div>${verrou}
    <table><tbody>
      ${ligne('ASCQ', escHtml(l.ascq))}${ligne('Arrondissement', escHtml((sv && sv.ArrondissementNom) || (pl && pl.ArrondissementNom) || ''))}
      ${ligne('Date de la séance', fmtDate(l.date))}${l.planifie ? ligne('Date prévue', planningQuandHtml_(pl)) : ligne('Planification', 'Séance non planifiée à l\'avance')}
      ${ligne('Lieu', escHtml((sv && sv.Lieu) || l.lieu))}${ligne('Village(s)', escHtml(l.villages.join(', ')))}
      ${ligne('Thèmes abordés', escHtml(themesLabels_(l.themes).join(', ')))}${ligne('Objectif', escHtml(l.objectif))}
      ${ligne('Commentaires', escHtml(sv ? sv.Commentaires : ''))}${l.motif && l.statut === 'Non réalisé' ? ligne('Motif', escHtml(l.motif)) : ''}
    </tbody></table>${presence}${preuves}</div>
    <div class="no-print" style="display:flex;gap:8px;margin-top:14px"><button class="btn-block" id="ficheImprimer">🖨️ Imprimer / PDF</button>${sv && l.statut === 'Réalisé' ? '<button class="btn-secondary btn-block" id="ficheListe">👥 Liste de présence (Excel)</button>' : ''}<button class="btn-secondary btn-block" id="ficheFermer">Fermer</button></div></div>`;
  document.body.appendChild(ov);
  if (sv && l.statut === 'Réalisé' && window.__listePresence) {
    const zoneLp = ov.querySelector('#ficheListePresence');
    Api.call('getListePresence', { suiviId: sv.ID }).then(d => { if (zoneLp) zoneLp.innerHTML = window.__listePresence.documentHtml(d, true); })
      .catch(err => { if (zoneLp) zoneLp.innerHTML = `<p class="petit" style="color:#b00020">${escHtml(err.message)}</p>`; });
    const bl = ov.querySelector('#ficheListe'); if (bl) bl.onclick = () => ouvrirListePresence(sv.ID);
  }
  ov.querySelector('#ficheFermer').onclick = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('#ficheImprimer').onclick = () => window.print();
}

// Affiche indicateurs + filtres + tableau d'historique dans l'élément el.
function montrerHistorique_(el, plannings, suivis, avecAscq) {
  const toutes = historiqueSuivis_(plannings, suivis);
  const ascqs = [...new Set(toutes.map(l => l.ascq).filter(Boolean))].sort();
  el.innerHTML = kpiSuivisHtml_(toutes) + `<div class="admin-barre">
    <select data-f="statut"><option value="">Tous les statuts</option><option>Réalisé</option><option>Non réalisé</option><option>À venir</option></select>
    ${avecAscq ? `<select data-f="ascq"><option value="">Tous les ASCQ</option>${ascqs.map(a => `<option>${escHtml(a)}</option>`).join('')}</select>` : ''}
    <label class="petit">Du <input type="date" data-f="du" style="width:auto"></label><label class="petit">au <input type="date" data-f="au" style="width:auto"></label>
    <input type="search" data-f="q" placeholder="Village, thème, RC…"></div><div data-zone="table"></div>`;
  const zone = el.querySelector('[data-zone=table]');
  let visibles = [];
  function dessiner() {
    const f = {}; el.querySelectorAll('[data-f]').forEach(i => { f[i.dataset.f] = i.value; });
    const q = (f.q || '').toLowerCase();
    visibles = toutes.filter(l => (!f.statut || l.statut === f.statut) && (!f.ascq || l.ascq === f.ascq) && (!f.du || String(l.date) >= f.du) && (!f.au || String(l.date) <= f.au) &&
      (!q || (l.villages.join(' ') + ' ' + themesLabels_(l.themes).join(' ') + ' ' + l.presents.join(' ') + ' ' + l.convoques.join(' ')).toLowerCase().includes(q)));
    if (!visibles.length) { zone.innerHTML = '<div class="empty-state">Aucun suivi groupé pour ces critères.</div>'; return; }
    zone.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Date</th>' + (avecAscq ? '<th>ASCQ</th>' : '') +
      '<th>Village(s)</th><th>Thèmes</th><th>RC</th><th>Statut</th><th>Preuves</th><th></th></tr></thead><tbody>' + visibles.map((l, i) => ligneTableHtml_(l, i, avecAscq)).join('') + '</tbody></table></div>';
  }
  el.querySelectorAll('[data-f]').forEach(i => i.addEventListener(i.tagName === 'INPUT' && i.type === 'search' ? 'input' : 'change', dessiner));
  zone.addEventListener('click', e => {
    const b = e.target.closest('[data-fiche]'); if (b) ouvrirFicheSuivi_(visibles[Number(b.dataset.fiche)]);
    const p = e.target.closest('[data-presence]'); if (p && window.ouvrirListePresence) ouvrirListePresence(p.dataset.presence);
  });
  dessiner();
}

async function renderSuivisGroupesLecture(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const [rs, rp] = await Promise.all([Api.call('listSuivisGroupes', {}), Api.call('listPlanningsSuivis', {})]);
    const suivis = rs.suivis || [], plannings = rp.plannings || [];

    let html = '<h3 class="sous-titre">📅 Planning des suivis groupés à venir</h3>';
    const avenir = plannings.filter(p => p.Statut === 'Planifié' && String(p.DatePrevue) >= new Date().toISOString().slice(0, 10));
    if (!avenir.length) html += '<div class="empty-state">Aucun suivi groupé à venir.</div>';
    else {
      html += '<div class="table-wrap"><table><thead><tr><th>Date prévue</th><th>ASCQ</th><th>Village(s)</th><th>RC convoqués</th><th>Lieu / objectif</th></tr></thead><tbody>';
      avenir.slice().sort((a, b) => String(a.DatePrevue).localeCompare(String(b.DatePrevue))).forEach(p => {
        html += `<tr><td>${planningQuandHtml_(p)}</td><td>${escHtml(p.AscqNom)}</td><td>${escHtml(jsonArr_(p.VillageNoms).join(', '))}</td>
          <td>${jsonArr_(p.RcConviesNoms).length} — ${escHtml(jsonArr_(p.RcConviesNoms).join(', '))}</td><td>${escHtml([p.Lieu, p.Objectif].filter(Boolean).join(' — '))}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    html += '<h3 class="sous-titre" style="margin-top:22px">👥 Suivis réalisés et non réalisés — preuves</h3><div data-zone="histo"></div>';
    el.innerHTML = html;
    montrerHistorique_(el.querySelector('[data-zone=histo]'), plannings, suivis, true);
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement : ' + escHtml(e.message) + '</div>'; }
}

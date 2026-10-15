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

async function renderSuivisGroupesLecture(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = 'Chargement…';
  try {
    const [rs, rp] = await Promise.all([Api.call('listSuivisGroupes', {}), Api.call('listPlanningsSuivis', {})]);
    const suivis = rs.suivis || [], plannings = rp.plannings || [];

    let html = '<h3 class="sous-titre">📅 Planning des suivis groupés</h3>';
    if (!plannings.length) html += '<div class="empty-state">Aucun suivi groupé planifié pour le moment.</div>';
    else {
      html += '<div class="table-wrap"><table><thead><tr><th>Date prévue</th><th>ASCQ</th><th>Village(s)</th><th>RC convoqués</th><th>Lieu / objectif</th><th>Statut</th></tr></thead><tbody>';
      // à venir d'abord (les plus proches en premier), puis le reste
      const ordre = p => (p.Statut === 'Planifié' ? 0 : 1);
      plannings.slice().sort((a, b) => ordre(a) - ordre(b) || String(a.DatePrevue).localeCompare(String(b.DatePrevue))).forEach(p => {
        html += `<tr><td>${planningQuandHtml_(p)}</td><td>${escHtml(p.AscqNom)}</td><td>${escHtml(jsonArr_(p.VillageNoms).join(', '))}</td>
          <td>${jsonArr_(p.RcConviesIds).length}</td><td>${escHtml([p.Lieu, p.Objectif].filter(Boolean).join(' — '))}</td><td>${statutPlanningBadge_(p)}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    html += '<h3 class="sous-titre" style="margin-top:22px">👥 Suivis groupés réalisés</h3>';
    if (!suivis.length) html += '<div class="empty-state">Aucun suivi groupé enregistré pour le moment.</div>';
    else {
      html += '<div class="table-wrap"><table><thead><tr><th>Date</th><th>ASCQ</th><th>Village(s)</th><th>Thèmes</th><th>RC présents</th><th>Rapport (photos / documents)</th></tr></thead><tbody>';
      suivis.forEach(s => {
        html += `<tr><td>${fmtDate(s.Date)}</td><td>${escHtml(s.AscqNom)}</td><td>${escHtml(jsonArr_(s.VillageNoms).join(', ') || s.ArrondissementNom || '')}</td>
          <td>${escHtml(themesLabels_(jsonArr_(s.Themes)).join(', '))}</td><td>${s.NbPresents} — ${escHtml(jsonArr_(s.RcPresentsNoms).join(', '))}</td>
          <td>${piecesLiensHtml_(s)}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    el.innerHTML = html;
  } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement : ' + escHtml(e.message) + '</div>'; }
}

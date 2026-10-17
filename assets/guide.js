/**
 * Visionneuse du guide d'utilisation (contenu : assets/guide-data.js, un guide par niveau).
 * ouvrirGuide(sectionId?) — plein écran, sommaire, recherche, précédent/suivant, progression
 * (sections lues mémorisées sur l'appareil), impression. Chargé à la demande par profil-menu.js.
 */
(function () {
  const lire = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const texte = html => { const d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').toLowerCase(); };

  window.ouvrirGuide = function (sectionId) {
    const u = (typeof Session !== 'undefined' && Session.getUser()) || {};
    const guide = (window.GUIDES || {})[u.Role];
    if (!guide) { if (window.toast) toast('Guide indisponible pour ce compte.', true); return; }
    const cleLu = 'scb_guide_lu_' + u.Role;
    let lus = lire(cleLu), courant = Math.max(0, guide.sections.findIndex(s => s.id === sectionId)), filtre = '';
    const idx = guide.sections.map(s => texte(s.titre + ' ' + s.html));

    const ov = document.createElement('div'); ov.className = 'guide-overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="guide-boite">
      <header class="guide-tete"><div class="guide-titre"><strong>📖 ${escHtml(guide.titre)}</strong><span class="petit" id="guideProgres"></span></div>
        <div class="guide-actions"><button type="button" id="guideImp" class="btn-secondary btn-mini" title="Imprimer ce guide">🖨️</button><button type="button" id="guideFermer" class="guide-x" title="Fermer">×</button></div></header>
      <div class="guide-corps">
        <nav class="guide-toc"><input type="search" id="guideRech" placeholder="🔎 Rechercher dans le guide…"><div id="guideListe"></div></nav>
        <article class="guide-contenu"><div id="guideTexte"></div>
          <div class="guide-nav"><button type="button" class="btn-secondary" id="guidePrec">← Précédent</button><button type="button" id="guideSuiv">Suivant →</button></div></article>
      </div></div>`;
    document.body.appendChild(ov); document.body.classList.add('guide-ouvert');
    const $ = id => ov.querySelector('#' + id);

    function dessinerListe() {
      const q = filtre.trim().toLowerCase();
      $('guideListe').innerHTML = guide.sections.map((s, i) => (!q || idx[i].includes(q)) ?
        `<button type="button" class="guide-item ${i === courant ? 'actif' : ''}" data-i="${i}"><span class="guide-num">${lus.includes(s.id) ? '✓' : i + 1}</span> ${escHtml(s.titre)}</button>` : '').join('')
        || '<div class="petit" style="padding:8px">Aucun résultat.</div>';
      $('guideProgres').textContent = ' ' + lus.filter(id => guide.sections.some(s => s.id === id)).length + ' / ' + guide.sections.length + ' sections lues';
    }
    function afficher(i) {
      courant = Math.min(Math.max(i, 0), guide.sections.length - 1);
      const s = guide.sections[courant];
      $('guideTexte').innerHTML = `<h2>${courant + 1}. ${escHtml(s.titre)}</h2>` + (courant === 0 && guide.intro ? `<p class="guide-intro">${escHtml(guide.intro)}</p>` : '') + s.html;
      if (!lus.includes(s.id)) { lus.push(s.id); ecrire(cleLu, lus); }
      $('guidePrec').disabled = courant === 0;
      $('guideSuiv').textContent = courant === guide.sections.length - 1 ? 'Terminer ✓' : 'Suivant →';
      dessinerListe(); ov.querySelector('.guide-contenu').scrollTop = 0;
      const act = ov.querySelector('.guide-item.actif'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
    }
    const fermer = () => { ov.remove(); document.body.classList.remove('guide-ouvert'); document.removeEventListener('keydown', cle); };
    const cle = ev => { if (ev.key === 'Escape') fermer(); else if (ev.key === 'ArrowRight' && ev.target.tagName !== 'INPUT') afficher(courant + 1); else if (ev.key === 'ArrowLeft' && ev.target.tagName !== 'INPUT') afficher(courant - 1); };
    document.addEventListener('keydown', cle);
    $('guideFermer').onclick = fermer;
    $('guidePrec').onclick = () => afficher(courant - 1);
    $('guideSuiv').onclick = () => { if (courant === guide.sections.length - 1) fermer(); else afficher(courant + 1); };
    $('guideListe').addEventListener('click', ev => { const b = ev.target.closest('[data-i]'); if (b) afficher(Number(b.dataset.i)); });
    $('guideRech').addEventListener('input', ev => { filtre = ev.target.value; dessinerListe(); });
    $('guideImp').onclick = () => {
      const w = window.open('', '_blank'); if (!w) { window.print(); return; }
      w.document.write('<!doctype html><meta charset="utf-8"><title>' + escHtml(guide.titre) + '</title><style>body{font:14px/1.5 sans-serif;max-width:800px;margin:20px auto;padding:0 16px}h1{color:#0E5E59}h2{border-bottom:2px solid #0E5E59;padding-bottom:4px;margin-top:28px}.g-note{border-left:4px solid #E8A33D;background:#FFF6E5;padding:8px 10px;margin:10px 0}</style><h1>' + escHtml(guide.titre) + '</h1><p>' + escHtml(guide.intro) + '</p>' +
        guide.sections.map((s, i) => '<h2>' + (i + 1) + '. ' + escHtml(s.titre) + '</h2>' + s.html).join('') + '<script>window.print()<\/script>');
      w.document.close();
    };
    afficher(courant);
  };
})();

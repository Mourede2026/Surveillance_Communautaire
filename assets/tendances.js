/**
 * Tendances par semaine épidémiologique (tableau de bord de chaque espace).
 * Un graphique par événement notifié (maladies / décès) sur les semaines 1..N d'une année :
 * histogramme à barres collées (par défaut) ou courbe. Sans notification, la série reste à zéro.
 * Les données sont celles du périmètre de l'utilisateur (calculé côté serveur : action getTendances).
 * Graphiques en SVG pur (aucune librairie) : fonctionne hors ligne dans l'application installée.
 * Dépend de api.js. renderTendances(containerId)
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const etat = { annee: null, mode: 'histo' };

  function pasAxe(max) { const c = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]; const m = Math.max(max, 4); for (const p of c) if (m / p <= 5) return p; return 1000; }

  function svgGraphe(valeurs, couleur, mode, titre) {
    const W = 560, H = 210, g = 36, d = 8, b = 24, n = valeurs.length;
    const max = Math.max.apply(null, valeurs.concat([0]));
    const pas = pasAxe(max), top = Math.max(pas * Math.ceil(Math.max(max, 1) / pas), pas);
    const pw = W - g - d, ph = H - d - b, y = v => d + ph - (v / top) * ph, bw = pw / n;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${titre}" class="tend-svg" preserveAspectRatio="xMidYMid meet">`;
    for (let v = 0; v <= top; v += pas) s += `<line x1="${g}" x2="${W - d}" y1="${y(v)}" y2="${y(v)}" class="tend-grille"/><text x="${g - 5}" y="${y(v) + 4}" text-anchor="end" class="tend-txt">${v}</text>`;
    for (let i = 0; i < n; i++) if (i === 0 || (i + 1) % 4 === 0) s += `<text x="${g + (i + .5) * bw}" y="${H - 8}" text-anchor="middle" class="tend-txt">S${i + 1}</text>`;
    if (mode === 'histo') {
      valeurs.forEach((v, i) => { if (v > 0) s += `<rect x="${g + i * bw}" y="${y(v)}" width="${bw}" height="${y(0) - y(v)}" fill="${couleur}" stroke="var(--card)" stroke-width=".6"><title>Semaine ${i + 1} : ${v}</title></rect>`; });
    } else {
      const pts = valeurs.map((v, i) => `${(g + (i + .5) * bw).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      s += `<polyline points="${pts}" fill="none" stroke="${couleur}" stroke-width="2.2" stroke-linejoin="round"/>`;
      valeurs.forEach((v, i) => { if (v > 0) s += `<circle cx="${g + (i + .5) * bw}" cy="${y(v)}" r="3" fill="${couleur}"><title>Semaine ${i + 1} : ${v}</title></circle>`; });
    }
    s += `<line x1="${g}" x2="${W - d}" y1="${y(0)}" y2="${y(0)}" stroke="${couleur}" stroke-width="2" opacity="${max ? .45 : 1}"/></svg>`;
    return s;
  }

  function carte(titre, valeurs, couleur, mode) {
    const total = valeurs.reduce((a, b) => a + b, 0);
    return `<div class="tend-card"><div class="tend-tete"><strong>${escHtml(titre)}</strong><span class="petit">${total} notification(s)</span></div>${svgGraphe(valeurs, couleur, mode, escHtml(titre))}</div>`;
  }

  window.renderTendances = async function (containerId) {
    const el = document.getElementById(containerId); if (!el) return;
    el.innerHTML = '<div class="petit">Chargement des tendances…</div>';
    try {
      const r = await Api.call('getTendances', etat.annee ? { annee: etat.annee } : {});
      etat.annee = r.annee;
      const ordre = o => Object.keys(o).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
      const cartes = [carte('Toutes les alertes', r.alertes.total, 'var(--teal-500)', etat.mode)]
        .concat(ordre(r.alertes.parType).map(t => carte(t, r.alertes.parType[t], 'var(--teal-700)', etat.mode)))
        .concat([carte('Tous les décès', r.deces.total, 'var(--red-600)', etat.mode)])
        .concat(ordre(r.deces.parType).map(t => carte(t, r.deces.parType[t], 'var(--red-600)', etat.mode)));
      el.innerHTML = `<div class="tend-barre"><label>Année <select id="${containerId}An">${r.annees.map(a => `<option ${a === r.annee ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <div class="sub-tabs" style="margin:0"><button type="button" data-m="histo" class="${etat.mode === 'histo' ? 'active' : ''}">▮ Histogramme</button><button type="button" data-m="courbe" class="${etat.mode === 'courbe' ? 'active' : ''}">📈 Courbe</button></div>
        <span class="petit">Semaines épidémiologiques 1 à ${r.nbSemaines} · à zéro s'il n'y a aucune notification</span></div>
        <div class="tend-grid">${cartes.join('')}</div>`;
      document.getElementById(containerId + 'An').onchange = e => { etat.annee = Number(e.target.value); renderTendances(containerId); };
      el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { etat.mode = b.dataset.m; renderTendances(containerId); });
    } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement des tendances : ' + escHtml(e.message) + '</div>'; }
  };
})();

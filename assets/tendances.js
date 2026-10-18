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
  const etat = { annee: null, mode: 'histo', dep: '', com: '', arr: '', vil: '' };

  // ---------- Export Excel (données filtrées + graphiques en images) ----------
  function libelleFiltre(liste, id) { const x = (liste || []).find(y => y.id === id); return x ? x.nom : 'Tous'; }
  const ordreTypes = o => Object.keys(o).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));

  /** Feuilles « Filtres » et « Synthèse » (fonction pure : testable hors navigateur). */
  function feuillesTendances(r, e, utilisateur, maintenant) {
    const o = r.options || {}, n = r.nbSemaines || (r.alertes.total || []).length;
    const sem = []; for (let i = 1; i <= n; i++) sem.push('S' + i);
    const filtres = [
      [{ v: 'SIVEC — Tendances par semaine épidémiologique', s: 't' }], [],
      [{ v: 'Année', s: 'b' }, r.annee],
      [{ v: 'Département', s: 'b' }, libelleFiltre(o.departements, e.dep)],
      [{ v: 'Commune', s: 'b' }, libelleFiltre(o.communes, e.com)],
      [{ v: 'Arrondissement', s: 'b' }, libelleFiltre(o.arrondissements, e.arr)],
      [{ v: 'Village', s: 'b' }, libelleFiltre(o.villages, e.vil)],
      [{ v: 'Période', s: 'b' }, 'Semaines épidémiologiques 1 à ' + n],
      [{ v: 'Affichage des graphiques', s: 'b' }, e.mode === 'histo' ? 'Histogramme' : 'Courbe'],
      [], [{ v: 'Exporté le', s: 'b' }, maintenant],
      [{ v: 'Exporté par', s: 'b' }, utilisateur]
    ];
    const lignes = [['Catégorie', 'Événement', 'Total'].concat(sem)];
    const somme = v => v.reduce((a, b) => a + b, 0);
    const ajoute = (cat, nom, v) => lignes.push([cat, nom, somme(v)].concat(v));
    ajoute('Alertes', 'Toutes les alertes', r.alertes.total);
    ordreTypes(r.alertes.parType).forEach(k => ajoute('Alertes', k, r.alertes.parType[k]));
    ajoute('Décès', 'Tous les décès', r.deces.total);
    ordreTypes(r.deces.parType).forEach(k => ajoute('Décès', k, r.deces.parType[k]));
    return [
      { nom: 'Filtres', sansBordure: true, largeurs: [30, 46], lignes: filtres },
      { nom: 'Synthèse', entete: 1, filtre: true, largeurs: [12, 38, 9].concat(sem.map(() => 6)), lignes }
    ];
  }

  async function exporterExcel(el, r, e) {
    try {
      const u = (window.Session && Session.getUser && Session.getUser()) || {};
      const feuilles = feuillesTendances(r, e, ((u.Prenom || '') + ' ' + (u.Nom || '')).trim() + (u.Role ? ' (' + u.Role + ')' : ''), new Date().toLocaleString('fr-FR'));
      // Graphiques : une image par carte, en grille de 2 colonnes
      const cartes = Array.from(el.querySelectorAll('.tend-card')), images = [], lignes = [[{ v: 'Graphiques (année ' + r.annee + ')', s: 't' }]];
      const L = 560, H = 210, PAS = 13;
      for (let i = 0; i < cartes.length; i++) {
        const svg = cartes[i].querySelector('svg'), titre = (cartes[i].querySelector('strong') || {}).textContent || '';
        const p = Math.floor(i / 2), col = (i % 2) * 10, lig = 1 + p * PAS;
        while (lignes.length <= lig) lignes.push([]);
        while (lignes[lig].length <= col) lignes[lig].push(null);
        lignes[lig][col] = { v: titre, s: 'b' };
        try { images.push({ png: await ExportExcel.svgVersPng(svg), col: col, ligne: lig + 1, larg: L, haut: H }); } catch (err) { /* le tableau reste exporté */ }
      }
      feuilles.push({ nom: 'Graphiques', lignes, images });
      const jour = new Date().toISOString().slice(0, 10);
      ExportExcel.telecharger('SIVEC_tendances_' + r.annee + '_' + jour + '.xlsx', feuilles);
      toast('Fichier Excel prêt.');
    } catch (err) { toast('Export Excel impossible : ' + err.message, true); }
  }
  window.__tendancesExport = { feuillesTendances };

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
      const filtre = { departementId: etat.dep, communeId: etat.com, arrondissementId: etat.arr, villageId: etat.vil };
      const r = await Api.call('getTendances', Object.assign(etat.annee ? { annee: etat.annee } : {}, { filtre }));
      etat.annee = r.annee;
      // Filtres en cascade : n'apparaissent que les niveaux qui offrent un vrai choix (plus d'une valeur)
      const o = r.options, sel = (id, lib, liste, val) => liste.length > 1 || val
        ? `<label>${lib} <select id="${containerId}${id}"><option value="">Tous</option>${liste.map(x => `<option value="${escHtml(x.id)}" ${x.id === val ? 'selected' : ''}>${escHtml(x.nom)}</option>`).join('')}</select></label>` : '';
      const comsV = o.communes.filter(c => !etat.dep || c.parent === etat.dep);
      const arrsV = o.arrondissements.filter(a => (!etat.com || a.parent === etat.com) && (!etat.dep || comsV.some(c => c.id === a.parent)));
      const vilsV = o.villages.filter(v => (!etat.arr || v.parent === etat.arr) && arrsV.some(a => a.id === v.parent));
      const filtresHtml = sel('Dep', 'Département', o.departements, etat.dep) + sel('Com', 'Commune', comsV, etat.com) + sel('Arr', 'Arrondissement', arrsV, etat.arr) + sel('Vil', 'Village', vilsV, etat.vil);
      const ordre = o => Object.keys(o).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
      const cartes = [carte('Toutes les alertes', r.alertes.total, 'var(--teal-500)', etat.mode)]
        .concat(ordre(r.alertes.parType).map(t => carte(t, r.alertes.parType[t], 'var(--teal-700)', etat.mode)))
        .concat([carte('Tous les décès', r.deces.total, 'var(--red-600)', etat.mode)])
        .concat(ordre(r.deces.parType).map(t => carte(t, r.deces.parType[t], 'var(--red-600)', etat.mode)));
      el.innerHTML = `<div class="tend-barre">${filtresHtml}<label>Année <select id="${containerId}An">${r.annees.map(a => `<option ${a === r.annee ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <div class="sub-tabs" style="margin:0"><button type="button" data-m="histo" class="${etat.mode === 'histo' ? 'active' : ''}">▮ Histogramme</button><button type="button" data-m="courbe" class="${etat.mode === 'courbe' ? 'active' : ''}">📈 Courbe</button></div>
        <button type="button" class="btn-secondary btn-mini" id="${containerId}Xl" title="Télécharger les données et graphiques filtrés au format Excel">⬇ Exporter en Excel</button>
        <span class="petit">Semaines épidémiologiques 1 à ${r.nbSemaines} · à zéro s'il n'y a aucune notification</span></div>
        <div class="tend-grid">${cartes.join('')}</div>`;
      const lien = (id, cle, enfants) => { const x = document.getElementById(containerId + id); if (x) x.onchange = e => { etat[cle] = e.target.value; enfants.forEach(k => { etat[k] = ''; }); renderTendances(containerId); }; };
      lien('Dep', 'dep', ['com', 'arr', 'vil']); lien('Com', 'com', ['arr', 'vil']); lien('Arr', 'arr', ['vil']); lien('Vil', 'vil', []);
      document.getElementById(containerId + 'An').onchange = e => { etat.annee = Number(e.target.value); renderTendances(containerId); };
      document.getElementById(containerId + 'Xl').onclick = () => exporterExcel(el, r, Object.assign({}, etat));
      el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { etat.mode = b.dataset.m; renderTendances(containerId); });
    } catch (e) { el.innerHTML = '<div class="empty-state">Erreur de chargement des tendances : ' + escHtml(e.message) + '</div>'; }
  };
})();

/**
 * Rend le module de briefing (mémo de surveillance à base communautaire) sous forme
 * d'accordéon : chaque maladie/événement apparaît d'abord comme un simple titre, et son
 * contenu complet (symptômes, définition de cas, transmission, prévention, CAT, rôle) ne
 * s'affiche qu'au clic. Commun aux espaces RC, ASCQ et PF CCLS-TP — tout le monde voit
 * exactement les mêmes modules, quel que soit son niveau.
 *
 * Dépend de assets/briefing-data.js (BRIEFING_MODULES) et assets/briefing.css.
 * containerId : id de l'élément où injecter le briefing.
 */
function renderBriefingModule(containerId) {
  const el = document.getElementById(containerId);
  if (!el || typeof BRIEFING_MODULES === 'undefined') return;

  el.innerHTML = `
    <div class="briefing-intro">
      👋 Ce mémo t'aide à reconnaître les maladies et événements sous surveillance, à savoir comment ils se
      transmettent, comment les prévenir et <strong>quoi faire face à un cas suspect</strong>.
      <br><br>
      💡 <strong>Règle d'or :</strong> dès qu'un signe alerte apparaît → <strong>notifie immédiatement ton ASCQ</strong>, sans attendre.
    </div>
    <input type="text" class="briefing-search" id="briefingSearch" placeholder="🔎 Rechercher une maladie ou un événement…">
    ${typeof openBriefingVideo === 'function' ? `
    <div class="bv-series-row">
      <button class="bv-series-btn" id="bvWatchSeries">▶️ Regarder toute la série vidéo (${BRIEFING_MODULES.length} maladies)</button>
    </div>` : ''}
    <div class="briefing-list" id="briefingList"></div>
  `;

  const list = document.getElementById('briefingList');
  list.innerHTML = BRIEFING_MODULES.map(m => `
    <div class="briefing-module ${m.theme}" id="briefing-${m.id}" data-title="${m.title.toLowerCase()}">
      <div class="disease-header" data-toggle="${m.id}">
        <span class="d-icon">${m.icon}</span>
        <h2>${m.title}</h2>
        <span class="d-num">${m.num}</span>
        ${typeof openBriefingVideo === 'function' ? `<button class="bv-play-trigger" data-play="${m.id}" title="Regarder en vidéo" aria-label="Regarder en vidéo">🎬</button>` : ''}
        <span class="d-chevron">▾</span>
      </div>
      <div class="disease-body">${m.body}</div>
    </div>
  `).join('');

  list.querySelectorAll('[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const mod = document.getElementById('briefing-' + header.dataset.toggle);
      mod.classList.toggle('open');
    });
  });

  list.querySelectorAll('[data-play]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof openBriefingVideo === 'function') openBriefingVideo(btn.dataset.play);
  }));

  const watchSeriesBtn = document.getElementById('bvWatchSeries');
  if (watchSeriesBtn) watchSeriesBtn.addEventListener('click', () => openBriefingVideo(BRIEFING_MODULES[0].id));

  document.getElementById('briefingSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    list.querySelectorAll('.briefing-module').forEach(mod => {
      mod.hidden = q.length > 0 && !mod.dataset.title.includes(q);
    });
  });
}

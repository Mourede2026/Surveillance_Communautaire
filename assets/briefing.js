/**
 * Rend le module de briefing (mémo de surveillance à base communautaire) sous forme
 * d'accordéon : chaque maladie/événement apparaît d'abord comme un simple titre, et son
 * contenu complet (symptômes, définition de cas, transmission, prévention, CAT, rôle) ne
 * s'affiche qu'au clic. Commun aux espaces RC, ASCQ et PF CCLS-TP — tout le monde voit
 * exactement les mêmes modules, quel que soit son niveau.
 *
 * Quand un script vidéo de formation existe pour la maladie (assets/briefing-videos-data.js,
 * BRIEFING_VIDEO_BODIES), il est ajouté sous le mémo, avec un bouton de lecture vocale (voir
 * assets/briefing-videos.js) : exemple de cas, signes par partie du corps, définition du cas
 * alerte, transmission, prévention, CAT du RC et message de clôture — pour former les RC ou
 * produire de courtes vidéos de sensibilisation.
 *
 * Dépend de assets/briefing-data.js (BRIEFING_MODULES) et assets/briefing.css ; optionnellement
 * de assets/briefing-videos-data.js + assets/briefing-videos.js pour les scripts vidéo.
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
    <div class="briefing-list" id="briefingList"></div>
  `;

  const list = document.getElementById('briefingList');
  list.innerHTML = BRIEFING_MODULES.map(m => {
    const videoBody = (typeof BRIEFING_VIDEO_BODIES !== 'undefined') ? BRIEFING_VIDEO_BODIES[m.id] : null;
    const videoBlock = videoBody ? `
      <div class="briefing-video">
        <div class="briefing-video-title">🎬 Script vidéo de formation (à lire face caméra ou à écouter)</div>
        ${videoBody}
        <div id="tts-status-${m.id}" class="tts-status"></div>
      </div>` : '';
    return `
    <div class="briefing-module ${m.theme}" id="briefing-${m.id}" data-title="${m.title.toLowerCase()}">
      <div class="disease-header" data-toggle="${m.id}">
        <span class="d-icon">${m.icon}</span>
        <h2>${m.title}</h2>
        <span class="d-num">${m.num}</span>
        <span class="d-chevron">▾</span>
      </div>
      <div class="disease-body">${m.body}${videoBlock}</div>
    </div>
  `; }).join('');

  list.querySelectorAll('[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const mod = document.getElementById('briefing-' + header.dataset.toggle);
      mod.classList.toggle('open');
    });
  });

  document.getElementById('briefingSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    list.querySelectorAll('.briefing-module').forEach(mod => {
      mod.hidden = q.length > 0 && !mod.dataset.title.includes(q);
    });
  });
}

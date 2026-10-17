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
    <div id="briefingChoice"></div>
    <div class="briefing-intro">
      👋 Ce mémo t'aide à reconnaître les maladies et événements sous surveillance, à savoir comment ils se
      transmettent, comment les prévenir et <strong>quoi faire face à un cas suspect</strong>.
      <br><br>
      💡 <strong>Règle d'or :</strong> dès qu'un signe alerte apparaît → <strong>notifie immédiatement ton ASCQ</strong>, sans attendre.
    </div>
    <div class="bv-series-row"><button class="bv-series-btn" id="bvSeriesBtn" type="button">🎬 Regarder la vidéo du briefing (toutes les maladies)</button></div>
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
        <button class="bv-play-trigger" type="button" data-play="${m.id}" title="Regarder la vidéo de cette maladie" aria-label="Regarder la vidéo : ${m.title}">▶</button>
        <span class="d-chevron">▾</span>
      </div>
      <div class="disease-body"><button class="bv-body-play" type="button" data-play="${m.id}">🎬 Voir cette maladie en vidéo</button>${m.body}${videoBlock}</div>
    </div>
  `; }).join('');

  list.querySelectorAll('[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const mod = document.getElementById('briefing-' + header.dataset.toggle);
      mod.classList.toggle('open');
    });
  });

  const seriesBtn = document.getElementById('bvSeriesBtn');
  if (seriesBtn) seriesBtn.addEventListener('click', () => { if (typeof openBriefingVideo === 'function') openBriefingVideo(); });
  list.querySelectorAll('[data-play]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof openBriefingVideo === 'function') openBriefingVideo(btn.dataset.play);
  }));

  document.getElementById('briefingSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    list.querySelectorAll('.briefing-module').forEach(mod => {
      mod.hidden = q.length > 0 && !mod.dataset.title.includes(q);
    });
  });
}


/**
 * Appelée à chaque ouverture de l'onglet « Briefing maladies » (rc.html, ascq.html, pf.html).
 * Ne lance JAMAIS la vidéo d'office : la personne choisit entre « Regarder la vidéo » et
 * « Lire le texte ». Elle peut cocher « Se souvenir de mon choix » ; dans ce cas son mode
 * (vidéo ou texte) est appliqué directement aux ouvertures suivantes, avec un lien « Changer »
 * pour revenir au choix. Cliquer sur une maladie ouvre toujours son texte ; la vidéo d'une
 * maladie se lance uniquement via le bouton ▶ / « Voir en vidéo ».
 */
function maybeAutoOpenBriefingVideo() {
  const box = document.getElementById('briefingChoice');
  if (!box) return;
  let mode = '';
  try { mode = localStorage.getItem('bvMode') || ''; } catch (e) { /* stockage indisponible */ }
  const canVideo = typeof openBriefingVideo === 'function';

  if (mode === 'video' && canVideo) {
    box.innerHTML = '<div class="bv-choice-mini">🎬 Mode mémorisé : vidéo · <button type="button" class="bv-choice-link" id="bvChoiceReset">Changer</button></div>';
    document.getElementById('bvChoiceReset').addEventListener('click', () => { try { localStorage.removeItem('bvMode'); } catch (e) {} maybeAutoOpenBriefingVideo(); });
    openBriefingVideo();
    return;
  }
  if (mode === 'text' || !canVideo) {
    box.innerHTML = canVideo ? '<div class="bv-choice-mini">📖 Mode mémorisé : texte · <button type="button" class="bv-choice-link" id="bvChoiceReset">Changer</button></div>' : '';
    const r = document.getElementById('bvChoiceReset');
    if (r) r.addEventListener('click', () => { try { localStorage.removeItem('bvMode'); } catch (e) {} maybeAutoOpenBriefingVideo(); });
    return;
  }

  box.innerHTML = `
    <div class="bv-choice">
      <div class="bv-choice-title">Comment voulez-vous suivre le briefing ?</div>
      <div class="bv-choice-actions">
        <button type="button" class="bv-choice-btn bv-choice-video" id="bvChoiceVideo">🎬<span>Regarder la vidéo</span><small>Scènes animées, voix et sous-titres</small></button>
        <button type="button" class="bv-choice-btn bv-choice-text" id="bvChoiceText">📖<span>Lire le texte</span><small>Les fiches maladie par maladie</small></button>
      </div>
      <label class="bv-choice-remember"><input type="checkbox" id="bvChoiceRemember"> Se souvenir de mon choix</label>
    </div>`;
  const remember = () => document.getElementById('bvChoiceRemember').checked;
  const save = (m) => { if (remember()) { try { localStorage.setItem('bvMode', m); } catch (e) {} } };
  document.getElementById('bvChoiceVideo').addEventListener('click', () => { save('video'); openBriefingVideo(); });
  document.getElementById('bvChoiceText').addEventListener('click', () => {
    save('text');
    const l = document.getElementById('briefingList');
    if (l) l.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

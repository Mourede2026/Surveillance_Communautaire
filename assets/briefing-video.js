/**
 * "Vidéo" du briefing maladies : transforme chaque module de BRIEFING_MODULES (assets/briefing-
 * data.js) en une petite série de diapositives animées, lues automatiquement avec narration
 * vocale (Web Speech API, voix française) ET sous-titres à l'écran — jouable comme une vidéo,
 * sans qu'aucun fichier vidéo ne soit généré ni téléchargé.
 *
 * Fonctionnement :
 *  1. parseModuleToSlides(module) relit le HTML de `module.body` (toujours structuré en 6 blocs
 *     identiques : symptômes, alerte, transmission, prévention, CAT, rôle — voir briefing-data.js)
 *     et en extrait une suite de diapositives { title, lines[], narration }.
 *  2. Le lecteur (overlay plein écran) enchaîne les diapositives d'un module, puis passe
 *     automatiquement au module suivant ("lecture auto"), comme une playlist vidéo.
 *  3. Chaque diapositive est à la fois parlée (SpeechSynthesis, lang fr-FR) et sous-titrée ; si
 *     la synthèse vocale n'est pas disponible (ou coupée par l'utilisateur), un minuteur estime
 *     la durée de lecture et avance seul.
 *
 * Dépend de : assets/briefing-data.js (BRIEFING_MODULES) et assets/briefing-video.css.
 * Point d'entrée public : openBriefingVideo(startModuleId).
 */

/* ---------------------------------------------------------------------------------------------
 * 1. Extraction des diapositives depuis le HTML d'un module
 * ------------------------------------------------------------------------------------------- */

// Enlève les émojis (et sélecteurs de variante / ZWJ) d'un texte, pour une narration vocale
// propre (les émojis restent affichés à l'écran, seule la voix les ignore).
function bvStripEmoji_(text) {
  return String(text || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bvEscapeHtml_(text) {
  const d = document.createElement('div');
  d.textContent = String(text || '');
  return d.innerHTML;
}

// Lit les enfants directs d'un conteneur (.block-content) et regroupe le texte en "lignes" :
// - une puce par .tag-list > .tag
// - le texte qui précède un .tag-list devient une ligne "sous-titre" (ex: "Chez les bébés :")
// - un <em> devient une ligne "note" (aparté)
// - sinon, tout le texte restant est regroupé en un seul paragraphe
function bvExtractLines_(contentEl) {
  const lines = [];
  const hasTagList = !!contentEl.querySelector(':scope > .tag-list');
  let buffer = [];
  const flush = (type) => {
    const t = buffer.join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1') // enlève l'espace avant la ponctuation (fusion de nœuds autour d'un <strong>/<em> inline)
      .replace(/[\s:]+$/, '')
      .trim();
    buffer = [];
    if (t) lines.push({ type, text: t });
  };
  Array.from(contentEl.childNodes).forEach((node) => {
    if (node.nodeType === 1 && node.classList && node.classList.contains('tag-list')) {
      flush('subhead');
      Array.from(node.querySelectorAll('.tag')).forEach((tag) => {
        lines.push({ type: 'item', text: tag.textContent.trim() });
      });
    } else if (node.nodeType === 1 && node.tagName === 'EM') {
      flush(hasTagList ? 'subhead' : 'text');
      lines.push({ type: 'note', text: node.textContent.trim() });
    } else if (node.nodeType === 1 && node.tagName === 'BR') {
      flush(hasTagList ? 'subhead' : 'text');
    } else {
      const t = node.textContent;
      if (t && t.trim()) buffer.push(t.trim());
    }
  });
  flush(hasTagList ? 'subhead' : 'text');
  return lines;
}

const BV_BLOCK_ORDER_ = ['block-symptoms', 'block-alert', 'block-transmission', 'block-prevention', 'block-cat', 'block-role'];

function parseModuleToSlides(m) {
  const wrap = document.createElement('div');
  wrap.innerHTML = m.body;
  const blocks = Array.from(wrap.querySelectorAll(':scope > .block'));
  const slides = [];

  slides.push({
    kind: 'intro', icon: m.icon, title: m.title, sub: m.num,
    lines: [{ type: 'note', text: 'Mémo de surveillance à base communautaire' }],
    narration: `${bvStripEmoji_(m.title)}. ${m.num}.`
  });

  blocks
    .slice()
    .sort((a, b) => BV_BLOCK_ORDER_.indexOf(Array.from(a.classList).find((c) => BV_BLOCK_ORDER_.includes(c)))
      - BV_BLOCK_ORDER_.indexOf(Array.from(b.classList).find((c) => BV_BLOCK_ORDER_.includes(c))))
    .forEach((block) => {
      const titleEl = block.querySelector(':scope > .block-title');
      const title = titleEl ? titleEl.textContent.trim() : '';
      let lines = [];

      if (block.classList.contains('block-cat')) {
        block.querySelectorAll(':scope > .step-list > li').forEach((li, i) => {
          const numEl = li.querySelector('.step-num');
          const num = numEl ? numEl.textContent.trim() : String(i + 1);
          const clone = li.cloneNode(true);
          const numClone = clone.querySelector('.step-num');
          if (numClone) numClone.remove();
          lines.push({ type: 'step', num, text: clone.textContent.trim() });
        });
        const hi = block.querySelector(':scope > .highlight-box');
        if (hi) lines.push({ type: 'warning', text: hi.textContent.trim() });
      } else {
        const contentEl = block.querySelector(':scope > .block-content') || block;
        lines = bvExtractLines_(contentEl);
      }

      const narrationParts = [bvStripEmoji_(title)];
      lines.forEach((l) => {
        const t = bvStripEmoji_(l.text);
        if (!t) return;
        if (l.type === 'step') narrationParts.push(`Étape ${l.num}. ${t}`);
        else if (l.type === 'warning') narrationParts.push(`Attention. ${t}`);
        else narrationParts.push(t);
      });

      slides.push({
        kind: 'block', icon: m.icon, title, lines,
        narration: narrationParts.filter(Boolean).join('. ').replace(/\.\.+/g, '.').trim()
      });
    });

  slides.push({
    kind: 'outro', icon: '📞', title: "Règle d'or",
    lines: [{ type: 'warning', text: "Dès qu'un signe alerte apparaît → notifie immédiatement ton ASCQ, sans attendre." }],
    narration: "Règle d'or : dès qu'un signe alerte apparaît, notifie immédiatement ton A-S-C-Q, sans attendre."
  });

  return slides;
}

let __bvAllSlides = null;
function bvGetAllSlides_() {
  if (!__bvAllSlides) __bvAllSlides = BRIEFING_MODULES.map(parseModuleToSlides);
  return __bvAllSlides;
}

function bvEstimateDurationMs_(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const ms = (words / 150) * 60000; // ~150 mots/minute (débit posé, adapté à un mémo de terrain)
  return Math.max(3500, Math.min(30000, Math.round(ms) + 900));
}

function bvPickFrenchVoice_() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('fr')) || null;
}

/* ---------------------------------------------------------------------------------------------
 * 2. Lecteur (overlay plein écran)
 * ------------------------------------------------------------------------------------------- */

const BV = {
  overlay: null, el: {}, moduleIndex: 0, slideIndex: 0,
  playing: false, muted: false, autoNext: true,
  timerId: null, rafId: null, slideStartTs: 0, slideDurationMs: 0
};

function bvCurrentModuleSlides_() { return bvGetAllSlides_()[BV.moduleIndex]; }
function bvCurrentSlide_() { return bvCurrentModuleSlides_()[BV.slideIndex]; }

function bvClearTimers_() {
  if (BV.timerId) { clearTimeout(BV.timerId); BV.timerId = null; }
  if (BV.rafId) { cancelAnimationFrame(BV.rafId); BV.rafId = null; }
}
function bvStopSpeaking_() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }

function bvProgressLoop_() {
  const elapsed = performance.now() - BV.slideStartTs;
  const pct = Math.min(1, BV.slideDurationMs ? elapsed / BV.slideDurationMs : 1);
  if (BV.el.progressFill) BV.el.progressFill.style.width = (pct * 100) + '%';
  if (pct < 1 && BV.playing) BV.rafId = requestAnimationFrame(bvProgressLoop_);
}

function bvPlayCurrentSlide_() {
  const slide = bvCurrentSlide_();
  bvStopSpeaking_();
  bvClearTimers_();
  BV.slideStartTs = performance.now();

  if (!BV.muted && 'speechSynthesis' in window && slide.narration) {
    const estMs = bvEstimateDurationMs_(slide.narration) * 1.15;
    BV.slideDurationMs = estMs;
    const u = new SpeechSynthesisUtterance(slide.narration);
    u.lang = 'fr-FR';
    const voice = bvPickFrenchVoice_();
    if (voice) u.voice = voice;
    u.rate = 0.98;
    u.onend = () => { if (BV.playing) bvGoNext_(true); };
    u.onerror = () => { if (BV.playing) bvGoNext_(true); };
    window.speechSynthesis.speak(u);
    bvProgressLoop_();
    // Filet de sécurité si l'événement "fin de lecture" ne se déclenche jamais (bug navigateur).
    BV.timerId = setTimeout(() => { if (BV.playing) bvGoNext_(true); }, estMs + 8000);
  } else {
    const estMs = bvEstimateDurationMs_(slide.narration || slide.title);
    BV.slideDurationMs = estMs;
    bvProgressLoop_();
    BV.timerId = setTimeout(() => { if (BV.playing) bvGoNext_(true); }, estMs);
  }
}

function bvPlay_() {
  BV.playing = true;
  if (BV.el.playPause) BV.el.playPause.textContent = '⏸';
  if (BV.el.endscreen) BV.el.endscreen.hidden = true;
  bvPlayCurrentSlide_();
}
function bvPause_() {
  BV.playing = false;
  if (BV.el.playPause) BV.el.playPause.textContent = '▶';
  bvClearTimers_();
  bvStopSpeaking_();
}

function bvRenderSlide_() {
  const slides = bvCurrentModuleSlides_();
  const slide = slides[BV.slideIndex];
  const m = BRIEFING_MODULES[BV.moduleIndex];

  BV.el.stage.className = 'bv-stage ' + m.theme;
  BV.el.bigIcon.textContent = slide.icon || m.icon;
  BV.el.slideTitle.textContent = slide.title;
  BV.el.moduleLabel.textContent = `${m.icon} ${m.title} · ${m.num}`;

  BV.el.lines.innerHTML = slide.lines.map((l, i) => {
    const cls = 'bv-line bv-line-' + l.type;
    const num = l.type === 'step' ? `<span class="bv-step-num">${bvEscapeHtml_(l.num)}</span>` : '';
    return `<li class="${cls}" style="animation-delay:${(i * 0.12).toFixed(2)}s">${num}<span>${bvEscapeHtml_(l.text)}</span></li>`;
  }).join('');

  BV.el.caption.textContent = slide.narration || slide.title;

  Array.from(BV.el.dots.children).forEach((d, i) => d.classList.toggle('active', i === BV.slideIndex));
  BV.el.prevModuleBtn.disabled = BV.moduleIndex === 0 && BV.slideIndex === 0;
  BV.el.nextModuleBtn.disabled = false;

  bvUpdatePlaylistActive_();
}

function bvRebuildDots_() {
  const slides = bvCurrentModuleSlides_();
  BV.el.dots.innerHTML = slides.map(() => '<span class="bv-dot"></span>').join('');
}

function bvGoNext_(auto) {
  bvClearTimers_(); bvStopSpeaking_();
  const slides = bvCurrentModuleSlides_();
  if (BV.slideIndex < slides.length - 1) {
    BV.slideIndex++;
    bvRenderSlide_();
    if (BV.playing) bvPlayCurrentSlide_();
    return;
  }
  const isLastModule = BV.moduleIndex >= BRIEFING_MODULES.length - 1;
  if (auto && !BV.autoNext) { bvPause_(); return; }
  if (isLastModule) { bvPause_(); bvShowEndOfSeries_(); return; }
  BV.moduleIndex++; BV.slideIndex = 0;
  bvRebuildDots_(); bvRenderSlide_();
  if (BV.playing) bvPlayCurrentSlide_();
}

function bvGoPrev_() {
  bvClearTimers_(); bvStopSpeaking_();
  if (BV.slideIndex > 0) {
    BV.slideIndex--;
  } else if (BV.moduleIndex > 0) {
    BV.moduleIndex--;
    BV.slideIndex = bvCurrentModuleSlides_().length - 1;
    bvRebuildDots_();
  }
  bvRenderSlide_();
  if (BV.playing) bvPlayCurrentSlide_();
}

function bvJumpToModule_(idx) {
  bvClearTimers_(); bvStopSpeaking_();
  BV.moduleIndex = Math.max(0, Math.min(BRIEFING_MODULES.length - 1, idx));
  BV.slideIndex = 0;
  bvRebuildDots_(); bvRenderSlide_();
  bvTogglePlaylist_(false);
  if (BV.playing) bvPlayCurrentSlide_(); else bvPlay_();
}

function bvToggleMute_() {
  BV.muted = !BV.muted;
  BV.el.muteBtn.textContent = BV.muted ? '🔇' : '🔊';
  if (BV.playing) bvPlayCurrentSlide_();
}

function bvShowEndOfSeries_() {
  if (BV.el.endscreen) BV.el.endscreen.hidden = false;
}

function bvBuildPlaylist_() {
  BV.el.playlist.innerHTML = BRIEFING_MODULES.map((m, i) => `
    <button class="bv-playlist-item" data-idx="${i}">
      <span class="bv-pl-icon">${m.icon}</span>
      <span class="bv-pl-title">${bvEscapeHtml_(m.title)}</span>
      <span class="bv-pl-num">${bvEscapeHtml_(m.num)}</span>
    </button>`).join('');
  BV.el.playlist.querySelectorAll('[data-idx]').forEach((btn) => {
    btn.addEventListener('click', () => bvJumpToModule_(Number(btn.dataset.idx)));
  });
}
function bvUpdatePlaylistActive_() {
  if (!BV.el.playlist) return;
  Array.from(BV.el.playlist.children).forEach((btn, i) => btn.classList.toggle('active', i === BV.moduleIndex));
}
function bvTogglePlaylist_(force) {
  const show = typeof force === 'boolean' ? force : !BV.overlay.classList.contains('bv-playlist-open');
  BV.overlay.classList.toggle('bv-playlist-open', show);
}

function bvClose_() {
  bvPause_();
  BV.overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function bvOnKeydown_(e) {
  if (!BV.overlay || !BV.overlay.classList.contains('open')) return;
  if (e.key === 'Escape') bvClose_();
  else if (e.key === 'ArrowRight') bvGoNext_(false);
  else if (e.key === 'ArrowLeft') bvGoPrev_();
  else if (e.key === ' ') { e.preventDefault(); BV.playing ? bvPause_() : bvPlay_(); }
}

function bvEnsureOverlay_() {
  if (BV.overlay) return;
  const div = document.createElement('div');
  div.id = 'briefingVideoOverlay';
  div.className = 'bv-overlay';
  div.innerHTML = `
    <div class="bv-topbar">
      <button class="bv-icon-btn" id="bvClose" title="Fermer" aria-label="Fermer">✕</button>
      <div class="bv-module-label" id="bvModuleLabel"></div>
      <button class="bv-icon-btn" id="bvPlaylistToggle" title="Liste des maladies" aria-label="Liste des maladies">☰</button>
    </div>
    <div class="bv-stage" id="bvStage">
      <div class="bv-bigicon" id="bvBigIcon"></div>
      <div class="bv-slide">
        <h2 class="bv-slide-title" id="bvSlideTitle"></h2>
        <ul class="bv-lines" id="bvLines"></ul>
      </div>
    </div>
    <div class="bv-caption" id="bvCaption"></div>
    <div class="bv-dots" id="bvDots"></div>
    <div class="bv-progress"><div class="bv-progress-fill" id="bvProgressFill"></div></div>
    <div class="bv-controls">
      <button class="bv-icon-btn" id="bvPrevModule" title="Maladie précédente" aria-label="Maladie précédente">⏮</button>
      <button class="bv-icon-btn" id="bvPrev" title="Précédent" aria-label="Diapositive précédente">◀</button>
      <button class="bv-play-btn" id="bvPlayPause" title="Lecture / Pause" aria-label="Lecture / Pause">⏸</button>
      <button class="bv-icon-btn" id="bvNext" title="Suivant" aria-label="Diapositive suivante">▶</button>
      <button class="bv-icon-btn" id="bvNextModule" title="Maladie suivante" aria-label="Maladie suivante">⏭</button>
      <button class="bv-icon-btn" id="bvMute" title="Son" aria-label="Couper / activer le son">🔊</button>
      <label class="bv-autonext"><input type="checkbox" id="bvAutoNext" checked> Lecture auto</label>
    </div>
    <div class="bv-playlist-panel">
      <div class="bv-playlist-header">Toutes les maladies</div>
      <div class="bv-playlist" id="bvPlaylist"></div>
    </div>
    <div class="bv-endscreen" id="bvEndscreen" hidden>
      <div class="bv-endscreen-title">✅ Série terminée !</div>
      <div class="bv-endscreen-actions">
        <button class="bv-icon-btn bv-endscreen-btn" id="bvReplay">🔁 Revoir depuis le début</button>
        <button class="bv-icon-btn bv-endscreen-btn" id="bvCloseEnd">Fermer</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  BV.overlay = div;
  BV.el = {
    stage: div.querySelector('#bvStage'),
    bigIcon: div.querySelector('#bvBigIcon'),
    slideTitle: div.querySelector('#bvSlideTitle'),
    lines: div.querySelector('#bvLines'),
    caption: div.querySelector('#bvCaption'),
    dots: div.querySelector('#bvDots'),
    progressFill: div.querySelector('#bvProgressFill'),
    moduleLabel: div.querySelector('#bvModuleLabel'),
    playPause: div.querySelector('#bvPlayPause'),
    muteBtn: div.querySelector('#bvMute'),
    prevModuleBtn: div.querySelector('#bvPrevModule'),
    nextModuleBtn: div.querySelector('#bvNextModule'),
    playlist: div.querySelector('#bvPlaylist'),
    endscreen: div.querySelector('#bvEndscreen')
  };

  div.querySelector('#bvClose').addEventListener('click', bvClose_);
  div.querySelector('#bvPlaylistToggle').addEventListener('click', () => bvTogglePlaylist_());
  div.querySelector('#bvPrev').addEventListener('click', bvGoPrev_);
  div.querySelector('#bvNext').addEventListener('click', () => bvGoNext_(false));
  div.querySelector('#bvPlayPause').addEventListener('click', () => (BV.playing ? bvPause_() : bvPlay_()));
  div.querySelector('#bvMute').addEventListener('click', bvToggleMute_);
  div.querySelector('#bvPrevModule').addEventListener('click', () => bvJumpToModule_(BV.moduleIndex - 1 < 0 ? 0 : BV.moduleIndex - 1));
  div.querySelector('#bvNextModule').addEventListener('click', () => bvJumpToModule_(BV.moduleIndex + 1));
  div.querySelector('#bvAutoNext').addEventListener('change', (e) => { BV.autoNext = e.target.checked; });
  div.querySelector('#bvReplay').addEventListener('click', () => bvJumpToModule_(0));
  div.querySelector('#bvCloseEnd').addEventListener('click', bvClose_);
  div.addEventListener('click', (e) => { if (e.target === div) bvClose_(); });

  document.addEventListener('keydown', bvOnKeydown_);

  bvBuildPlaylist_();
}

/**
 * Point d'entrée public : ouvre le lecteur vidéo du briefing et lance la lecture à partir du
 * module `startId` (id de BRIEFING_MODULES, ex: "rougeole"). Si absent, démarre au 1er module.
 */
function openBriefingVideo(startId) {
  if (typeof BRIEFING_MODULES === 'undefined' || !BRIEFING_MODULES.length) return;
  bvEnsureOverlay_();
  const idx = BRIEFING_MODULES.findIndex((m) => m.id === startId);
  BV.moduleIndex = idx >= 0 ? idx : 0;
  BV.slideIndex = 0;
  bvRebuildDots_();
  BV.overlay.classList.add('open');
  BV.overlay.classList.remove('bv-playlist-open');
  document.body.style.overflow = 'hidden';
  bvRenderSlide_();
  bvPlay_();
}

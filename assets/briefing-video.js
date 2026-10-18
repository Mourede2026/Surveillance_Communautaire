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
        blk: Array.from(block.classList).find((c) => BV_BLOCK_ORDER_.includes(c)) || '',
        narration: narrationParts.filter(Boolean).join('. ').replace(/\.\.+/g, '.').trim()
      });
    });

  slides.push({
    kind: 'outro', icon: '📞', title: "Règle d'or",
    lines: [{ type: 'warning', text: "Dès qu'un signe alerte apparaît → notifie immédiatement ton ASCQ, sans attendre." }],
    narration: "Règle d'or : dès qu'un signe alerte apparaît, notifie immédiatement ton ASCQ, sans attendre."
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

/* ---------------------------------------------------------------------------------------------
 * Voix et prononciation
 *  - bvPrepareSpeech(texte) : transforme les sigles en lettres épelées pour la synthèse vocale
 *    (ASCQ → « a èsse cé ku », RC → « èr cé »…). Seule la voix est modifiée : les sous-titres
 *    gardent le texte d'origine.
 *  - bvPickFrenchVoice_() : choisit la voix française la plus proche d'une voix d'homme naturelle
 *    (voix « Natural/Online/Neural » d'abord ; noms masculins connus favorisés ; voix
 *    féminines connues pénalisées). La personne peut imposer sa voix via le menu « Voix »
 *    du lecteur (choix mémorisé).
 * ------------------------------------------------------------------------------------------- */
const BV_LETTER_NAMES_ = {
  A: 'a', B: 'bé', C: 'cé', D: 'dé', E: 'eu', F: 'èf', G: 'gé', H: 'ache', I: 'i', J: 'ji', K: 'ka', L: 'èl', M: 'èm',
  N: 'èn', O: 'o', P: 'pé', Q: 'ku', R: 'èr', S: 'èsse', T: 'té', U: 'u', V: 'vé', W: 'double vé', X: 'iks', Y: 'i grec', Z: 'zède'
};
// Sigles à épeler lettre par lettre (les mots entièrement en majuscules comme « NE PAS TOUCHER » restent lus normalement).
const BV_SIGLES_ = ['CNLS-TP', 'CCLS-TP', 'ASCQ', 'RCSE', 'MIILD', 'COVID-19', 'RR1', 'RR2', 'PFA', 'MVE', 'VPO', 'CPN', 'SRO', 'CAT', 'RC', 'PF', 'CS'];
const BV_SIGLE_RE_ = new RegExp('(?<![A-Za-zÀ-ÿ0-9])(' + BV_SIGLES_.join('|') + ')(?![A-Za-zÀ-ÿ0-9])', 'g');

function bvSpellSigle_(sigle) {
  if (sigle === 'COVID-19') return 'covid dix-neuf';
  return sigle.replace(/-/g, '').split('').map((ch) => {
    if (ch === '1') return 'un';
    if (ch === '2') return 'deux';
    return BV_LETTER_NAMES_[ch] || ch;
  }).join(' ');
}
function bvPrepareSpeech(text) {
  return String(text || '').replace(BV_SIGLE_RE_, (m) => bvSpellSigle_(m));
}

const BV_MALE_RE_ = /\b(henri|r[ée]my|r[ée]mi|paul|thomas|claude|antoine|mathieu|guillaume|bernard|julien|nicolas|pierre|olivier|lo[iï]c|hugo|lucas|maxime|fabrice|male|homme|masculin)\b/i;
const BV_FEMALE_RE_ = /\b(am[ée]lie|aur[ée]lie|c[ée]line|denise|[ée]lo[iï]se|hortense|julie|marie|audrey|l[ée]a|sylvie|virginie|vivienne|female|femme|f[ée]minin|google fran[cç]ais)\b/i;
function bvVoiceScore_(v) {
  const n = (v.name || '') + ' ' + (v.voiceURI || '');
  let sc = 0;
  if (BV_MALE_RE_.test(n)) sc += 6;
  if (BV_FEMALE_RE_.test(n)) sc -= 5;
  if (/natural|online|neural|premium|enhanced|wavenet|multilingual/i.test(n)) sc += 3;
  if ((v.lang || '').toLowerCase().replace('_', '-') === 'fr-fr') sc += 1;
  return sc;
}
function bvFrenchVoices_() {
  if (!('speechSynthesis' in window)) return [];
  return (window.speechSynthesis.getVoices() || []).filter((v) => v.lang && v.lang.toLowerCase().startsWith('fr'));
}
function bvPickFrenchVoice_() {
  const list = bvFrenchVoices_();
  if (!list.length) return null;
  let saved = '';
  try { saved = localStorage.getItem('bvVoice') || ''; } catch (e) { /* stockage indisponible */ }
  if (saved) { const hit = list.find((v) => v.voiceURI === saved || v.name === saved); if (hit) return hit; }
  return list.slice().sort((a, b) => bvVoiceScore_(b) - bvVoiceScore_(a))[0];
}
// Voix sans indice masculin : on baisse un peu la hauteur pour se rapprocher d'une voix d'homme
// (certaines voix en ligne ignorent ce réglage).
function bvVoicePitch_(voice) {
  if (!voice) return 0.85;
  return BV_MALE_RE_.test((voice.name || '') + ' ' + (voice.voiceURI || '')) ? 0.95 : 0.8;
}
function bvFillVoiceList_() {
  const sel = BV && BV.el && BV.el.voiceSel;
  if (!sel) return;
  const list = bvFrenchVoices_();
  let saved = '';
  try { saved = localStorage.getItem('bvVoice') || ''; } catch (e) { /* stockage indisponible */ }
  sel.innerHTML = '<option value="">Automatique (voix d\'homme si disponible)</option>' +
    list.map((v) => `<option value="${bvEscapeHtml_(v.voiceURI || v.name)}">${bvEscapeHtml_(v.name)} (${bvEscapeHtml_(v.lang)})</option>`).join('');
  sel.value = list.some((v) => (v.voiceURI || v.name) === saved) ? saved : '';
}

/* ---------------------------------------------------------------------------------------------
 * 2. Lecteur (overlay plein écran)
 * ------------------------------------------------------------------------------------------- */

const BV = {
  overlay: null, el: {}, moduleIndex: 0, slideIndex: 0,
  playing: false, muted: false, autoNext: true,
  timerId: null, rafId: null, slideStartTs: 0, slideDurationMs: 0,
  token: 0,          // identifie la lecture en cours : les événements d'une lecture annulée sont ignorés
  frozenMs: 0,       // temps écoulé dans la diapositive quand la lecture est en pause
  durs: [],          // durées estimées (ms) des diapositives du module courant
  seeking: false, speechBroken: false
};

function bvCurrentModuleSlides_() { return bvGetAllSlides_()[BV.moduleIndex]; }
function bvCurrentSlide_() { return bvCurrentModuleSlides_()[BV.slideIndex]; }

function bvClearTimers_() {
  if (BV.timerId) { clearTimeout(BV.timerId); BV.timerId = null; }
  if (BV.rafId) { cancelAnimationFrame(BV.rafId); BV.rafId = null; }
}
function bvStopSpeaking_() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }

// Durée estimée d'une diapositive, et découpage de sa narration en phrases (on peut ainsi
// reprendre la lecture à une phrase donnée quand la personne avance ou recule dans la vidéo).
function bvSlideDurMs_(slide) { return Math.round(bvEstimateDurationMs_(slide.narration || slide.title) * 1.1); }
function bvChunksOf_(slide) {
  if (slide._chunks) return slide._chunks;
  const raw = (String(slide.narration || slide.title || '').match(/[^.!?]+[.!?]*/g) || []).map((x) => x.trim()).filter(Boolean);
  const chunks = [];
  raw.forEach((t) => {
    if (chunks.length && chunks[chunks.length - 1].length < 45) chunks[chunks.length - 1] += ' ' + t;
    else chunks.push(t);
  });
  if (!chunks.length) chunks.push(String(slide.title || ''));
  const total = chunks.reduce((n, c) => n + c.length, 0) || 1;
  let acc = 0;
  slide._cum = chunks.map((c) => { const f = acc / total; acc += c.length; return f; }); // part de la durée écoulée au début de chaque phrase
  slide._chunks = chunks;
  return chunks;
}

function bvFmt_(ms) {
  const t = Math.max(0, Math.round(ms / 1000));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
function bvElapsedMs_() { return BV.playing ? performance.now() - BV.slideStartTs : BV.frozenMs; }
function bvBeforeMs_() { return BV.durs.slice(0, BV.slideIndex).reduce((n, d) => n + d, 0); }
function bvTotalMs_() { return BV.durs.reduce((n, d) => n + d, 0) || 1; }

// Met à jour la barre de position (tout le module) et les temps affichés.
function bvUpdateTimeline_() {
  if (!BV.el.seek) return;
  const dur = BV.durs[BV.slideIndex] || 1;
  const pos = bvBeforeMs_() + Math.max(0, Math.min(bvElapsedMs_(), dur));
  if (!BV.seeking) BV.el.seek.value = String(Math.round(pos / bvTotalMs_() * 1000));
  BV.el.timeCur.textContent = bvFmt_(pos);
  BV.el.timeTot.textContent = bvFmt_(bvTotalMs_());
}
function bvProgressLoop_() {
  bvUpdateTimeline_();
  if (BV.playing) BV.rafId = requestAnimationFrame(bvProgressLoop_);
}

// Lit la phrase i de la diapositive, puis enchaîne. Un événement venant d'une lecture annulée
// (jeton différent, ou erreur « canceled/interrupted ») est ignoré : c'est ce qui faisait défiler
// toutes les diapositives d'un coup lors d'un changement de diapositive.
function bvSpeakChunk_(token, slide, i, dur) {
  if (token !== BV.token || !BV.playing) return;
  const chunks = bvChunksOf_(slide);
  if (i >= chunks.length) { bvGoNext_(true); return; }
  BV.slideStartTs = performance.now() - slide._cum[i] * dur; // recale la progression sur la voix
  const u = new SpeechSynthesisUtterance(bvPrepareSpeech(chunks[i]));
  u.lang = 'fr-FR';
  const voice = bvPickFrenchVoice_();
  if (voice) { u.voice = voice; u.lang = voice.lang || 'fr-FR'; }
  u.rate = 0.94;
  u.pitch = bvVoicePitch_(voice);
  u.onend = () => bvSpeakChunk_(token, slide, i + 1, dur);
  u.onerror = (ev) => {
    if (token !== BV.token) return;
    if (ev && (ev.error === 'canceled' || ev.error === 'interrupted')) return;
    // Vraie panne de la synthèse vocale : on termine cette diapositive au minuteur, sans voix.
    BV.speechBroken = true;
    bvStopSpeaking_();
    const reste = Math.max(800, dur - (performance.now() - BV.slideStartTs));
    if (BV.timerId) clearTimeout(BV.timerId);
    BV.timerId = setTimeout(() => { if (BV.playing && token === BV.token) bvGoNext_(true); }, reste);
  };
  window.speechSynthesis.speak(u);
}

// Lance (ou relance) la diapositive courante, éventuellement à `startRatio` (0 à 1) de sa durée.
function bvPlayCurrentSlide_(startRatio) {
  const slide = bvCurrentSlide_();
  bvStopSpeaking_();
  bvClearTimers_();
  const token = ++BV.token;
  const dur = BV.durs[BV.slideIndex] || bvSlideDurMs_(slide);
  BV.slideDurationMs = dur;
  const ratio = Math.max(0, Math.min(0.98, startRatio || 0));
  const useSpeech = !BV.muted && !BV.speechBroken && 'speechSynthesis' in window && !!slide.narration;
  let startChunk = 0;
  if (useSpeech) {
    bvChunksOf_(slide);
    slide._cum.forEach((f, i) => { if (f <= ratio) startChunk = i; });
  }
  const offset = useSpeech ? slide._cum[startChunk] * dur : ratio * dur;
  BV.slideStartTs = performance.now() - offset;
  bvProgressLoop_();
  if (useSpeech) {
    bvSpeakChunk_(token, slide, startChunk, dur);
    // Filet de sécurité si la voix ne se termine jamais (bug de certains navigateurs).
    BV.timerId = setTimeout(() => { if (BV.playing && token === BV.token) bvGoNext_(true); }, dur - offset + 8000);
  } else {
    BV.timerId = setTimeout(() => { if (BV.playing && token === BV.token) bvGoNext_(true); }, Math.max(400, dur - offset));
  }
}
// Reprend à l'endroit exact où on en est (après un changement de voix ou de son).
function bvRestartHere_() {
  const dur = BV.durs[BV.slideIndex] || 1;
  bvPlayCurrentSlide_(bvElapsedMs_() / dur);
}

function bvPlay_() {
  const dur = BV.durs[BV.slideIndex] || 1;
  const ratio = BV.frozenMs / dur;
  BV.playing = true;
  if (BV.el.playPause) BV.el.playPause.textContent = '⏸';
  if (BV.el.endscreen) BV.el.endscreen.hidden = true;
  bvPlayCurrentSlide_(ratio);
}
function bvPause_() {
  if (BV.playing) BV.frozenMs = performance.now() - BV.slideStartTs;
  BV.playing = false;
  BV.token++; // invalide les événements encore en attente
  if (BV.el.playPause) BV.el.playPause.textContent = '▶';
  bvClearTimers_();
  bvStopSpeaking_();
  bvUpdateTimeline_();
}

// Se place à `ms` depuis le début du module (change de diapositive si besoin) ; reste en pause
// si la lecture était en pause.
function bvSeekToMs_(ms) {
  const total = bvTotalMs_();
  ms = Math.max(0, Math.min(total - 1, ms));
  let idx = 0, acc = 0;
  while (idx < BV.durs.length - 1 && acc + BV.durs[idx] <= ms) { acc += BV.durs[idx]; idx++; }
  const ratio = (ms - acc) / (BV.durs[idx] || 1);
  const changed = idx !== BV.slideIndex;
  BV.slideIndex = idx;
  if (changed) bvRenderSlide_();
  if (BV.el.endscreen) BV.el.endscreen.hidden = true;
  if (BV.playing) bvPlayCurrentSlide_(ratio);
  else { BV.frozenMs = ratio * (BV.durs[idx] || 1); bvUpdateTimeline_(); }
}
// Avance (+) ou recule (−) de `deltaMs` ; au-delà de la fin du module, passe à la maladie suivante.
function bvSeekBy_(deltaMs) {
  const pos = bvBeforeMs_() + bvElapsedMs_() + deltaMs;
  if (pos >= bvTotalMs_()) {
    if (BV.moduleIndex < BRIEFING_MODULES.length - 1) { bvJumpToModule_(BV.moduleIndex + 1); return; }
    bvSeekToMs_(bvTotalMs_() - 1); return;
  }
  bvSeekToMs_(pos);
}
function bvGoToSlide_(i) {
  BV.slideIndex = Math.max(0, Math.min(BV.durs.length - 1, i));
  bvRenderSlide_();
  if (BV.playing) bvPlayCurrentSlide_(0); else bvUpdateTimeline_();
}

function bvRenderSlide_() {
  BV.frozenMs = 0;
  if (BV.el.endscreen) BV.el.endscreen.hidden = true;
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

  // Scène illustrée et animée (assets/briefing-scenes.js) : village, personnages, accessoires.
  if (BV.el.scene && typeof bvSceneSvg === 'function') {
    BV.el.scene.innerHTML = bvSceneSvg(m.id, slide);
    const svg = BV.el.scene.firstElementChild;
    if (svg && svg.pauseAnimations && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) svg.pauseAnimations();
  }
  if (BV.el.slide) BV.el.slide.scrollTop = 0;

  Array.from(BV.el.dots.children).forEach((d, i) => d.classList.toggle('active', i === BV.slideIndex));
  BV.el.prevModuleBtn.disabled = BV.moduleIndex === 0 && BV.slideIndex === 0;
  BV.el.nextModuleBtn.disabled = false;

  bvUpdatePlaylistActive_();
  bvUpdateTimeline_();
}

// Points de chapitre cliquables (un par diapositive) + durées estimées du module courant.
function bvRebuildDots_() {
  const slides = bvCurrentModuleSlides_();
  BV.durs = slides.map(bvSlideDurMs_);
  BV.el.dots.innerHTML = slides.map((sl, i) => `<button type="button" class="bv-dot" data-slide="${i}" title="${bvEscapeHtml_(sl.title)}" aria-label="Aller à : ${bvEscapeHtml_(sl.title)}"></button>`).join('');
  BV.el.dots.querySelectorAll('[data-slide]').forEach((d) => d.addEventListener('click', () => bvGoToSlide_(Number(d.dataset.slide))));
}

function bvGoNext_(auto) {
  bvClearTimers_(); bvStopSpeaking_();
  const slides = bvCurrentModuleSlides_();
  if (BV.slideIndex < slides.length - 1) {
    BV.slideIndex++;
    bvRenderSlide_();
    if (BV.playing) bvPlayCurrentSlide_(0);
    return;
  }
  const isLastModule = BV.moduleIndex >= BRIEFING_MODULES.length - 1;
  if (auto && !BV.autoNext) { bvPause_(); return; }
  if (isLastModule) { bvPause_(); bvShowEndOfSeries_(); return; }
  BV.moduleIndex++; BV.slideIndex = 0;
  bvRebuildDots_(); bvRenderSlide_();
  if (BV.playing) bvPlayCurrentSlide_(0);
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
  if (BV.playing) bvPlayCurrentSlide_(0);
}

function bvJumpToModule_(idx) {
  bvClearTimers_(); bvStopSpeaking_();
  BV.moduleIndex = Math.max(0, Math.min(BRIEFING_MODULES.length - 1, idx));
  BV.slideIndex = 0;
  bvRebuildDots_(); bvRenderSlide_();
  bvTogglePlaylist_(false);
  BV.playing = false; // repart du début de la maladie choisie
  bvPlay_();
}

function bvToggleMute_() {
  BV.muted = !BV.muted;
  BV.el.muteBtn.textContent = BV.muted ? '🔇' : '🔊';
  if (BV.playing) bvRestartHere_();
}

function bvShowEndOfSeries_() {
  if (BV.el.endscreen) BV.el.endscreen.hidden = false;
}

function bvBuildPlaylist_() {
  BV.el.playlist.innerHTML = BRIEFING_MODULES.map((m, i) => `
    <div class="bv-playlist-row">
      <button class="bv-playlist-item" data-idx="${i}">
        <span class="bv-pl-icon">${m.icon}</span>
        <span class="bv-pl-title">${bvEscapeHtml_(m.title)}</span>
        <span class="bv-pl-num">${bvEscapeHtml_(m.num)}</span>
      </button>
      <button class="bv-pl-dl" data-dl="${i}" title="Télécharger / envoyer cette vidéo" aria-label="Télécharger ou envoyer la vidéo : ${bvEscapeHtml_(m.title)}">⬇</button>
    </div>`).join('');
  BV.el.playlist.querySelectorAll('[data-idx]').forEach((btn) => {
    btn.addEventListener('click', () => bvJumpToModule_(Number(btn.dataset.idx)));
  });
  BV.el.playlist.querySelectorAll('[data-dl]').forEach((btn) => {
    btn.addEventListener('click', () => bvExportModule_(Number(btn.dataset.dl)));
  });
}
// Création du fichier vidéo d'une maladie (assets/briefing-video-export.js).
function bvExportModule_(idx) {
  if (typeof bvStartExport_ === 'function') bvStartExport_(idx);
  else if (typeof toast === 'function') toast('Export vidéo indisponible.', true);
}
function bvUpdatePlaylistActive_() {
  if (!BV.el.playlist) return;
  BV.el.playlist.querySelectorAll('.bv-playlist-item').forEach((btn, i) => btn.classList.toggle('active', i === BV.moduleIndex));
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
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.key !== 'Escape') return;
  if (e.key === 'Escape') bvClose_();
  else if (e.key === 'ArrowRight') bvSeekBy_(10000);
  else if (e.key === 'ArrowLeft') bvSeekBy_(-10000);
  else if (e.key === 'ArrowDown') bvGoNext_(false);
  else if (e.key === 'ArrowUp') bvGoPrev_();
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
      <button class="bv-icon-btn" id="bvMute" title="Son" aria-label="Couper / activer le son">🔊</button>
      <button class="bv-icon-btn" id="bvSettingsToggle" title="Réglages (voix, lecture auto)" aria-label="Réglages">⚙</button>
      <button class="bv-icon-btn" id="bvPlaylistToggle" title="Liste des maladies" aria-label="Liste des maladies">☰</button>
    </div>
    <div class="bv-settings" id="bvSettings" hidden>
      <label class="bv-autonext"><input type="checkbox" id="bvAutoNext" checked> Lecture auto (passer à la maladie suivante)</label>
      <label class="bv-autonext bv-voice-label">Voix <select id="bvVoice" class="bv-voice-select"></select></label>
    </div>
    <div class="bv-stage" id="bvStage">
      <div class="bv-scene" id="bvScene" aria-hidden="true"></div>
      <div class="bv-bigicon" id="bvBigIcon"></div>
      <div class="bv-slide">
        <h2 class="bv-slide-title" id="bvSlideTitle"></h2>
        <ul class="bv-lines" id="bvLines"></ul>
      </div>
      <div class="bv-endscreen" id="bvEndscreen" hidden>
        <div class="bv-endscreen-title">✅ Série terminée !</div>
        <div class="bv-endscreen-actions">
          <button class="bv-icon-btn bv-endscreen-btn" id="bvReplay">🔁 Revoir depuis le début</button>
          <button class="bv-icon-btn bv-endscreen-btn" id="bvStayEnd">◀ Revenir en arrière</button>
          <button class="bv-icon-btn bv-endscreen-btn" id="bvCloseEnd">Fermer</button>
        </div>
      </div>
    </div>
    <div class="bv-caption" id="bvCaption"></div>
    <div class="bv-timeline">
      <span class="bv-time" id="bvTimeCur">0:00</span>
      <input type="range" id="bvSeek" class="bv-seek" min="0" max="1000" value="0" step="1" aria-label="Position dans la vidéo">
      <span class="bv-time" id="bvTimeTot">0:00</span>
    </div>
    <div class="bv-dots-row">
      <button class="bv-mini" id="bvPrev" title="Diapositive précédente" aria-label="Diapositive précédente">‹</button>
      <div class="bv-dots" id="bvDots"></div>
      <button class="bv-mini" id="bvNext" title="Diapositive suivante" aria-label="Diapositive suivante">›</button>
    </div>
    <div class="bv-controls">
      <button class="bv-icon-btn" id="bvPrevModule" title="Maladie précédente" aria-label="Maladie précédente">⏮</button>
      <button class="bv-icon-btn bv-skip" id="bvBack10" title="Reculer de 10 secondes" aria-label="Reculer de 10 secondes">↺ 10 s</button>
      <button class="bv-play-btn" id="bvPlayPause" title="Lecture / Pause" aria-label="Lecture / Pause">⏸</button>
      <button class="bv-icon-btn bv-skip" id="bvFwd10" title="Avancer de 10 secondes" aria-label="Avancer de 10 secondes">10 s ↻</button>
      <button class="bv-icon-btn" id="bvNextModule" title="Maladie suivante" aria-label="Maladie suivante">⏭</button>
    </div>
    <div class="bv-export-row">
      <button class="bv-pill" id="bvExport" title="Créer un fichier vidéo à enregistrer ou à envoyer">🎬 Télécharger / envoyer cette vidéo</button>
    </div>
    <div class="bv-playlist-panel">
      <div class="bv-playlist-header">Toutes les maladies</div>
      <div class="bv-playlist" id="bvPlaylist"></div>
    </div>
  `;
  document.body.appendChild(div);

  BV.overlay = div;
  BV.el = {
    stage: div.querySelector('#bvStage'),
    scene: div.querySelector('#bvScene'),
    voiceSel: div.querySelector('#bvVoice'),
    slide: div.querySelector('.bv-slide'),
    bigIcon: div.querySelector('#bvBigIcon'),
    slideTitle: div.querySelector('#bvSlideTitle'),
    lines: div.querySelector('#bvLines'),
    caption: div.querySelector('#bvCaption'),
    dots: div.querySelector('#bvDots'),
    seek: div.querySelector('#bvSeek'),
    timeCur: div.querySelector('#bvTimeCur'),
    timeTot: div.querySelector('#bvTimeTot'),
    settings: div.querySelector('#bvSettings'),
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
  div.querySelector('#bvExport').addEventListener('click', () => bvExportModule_(BV.moduleIndex));
  div.querySelector('#bvBack10').addEventListener('click', () => bvSeekBy_(-10000));
  div.querySelector('#bvFwd10').addEventListener('click', () => bvSeekBy_(10000));
  div.querySelector('#bvSettingsToggle').addEventListener('click', () => { BV.el.settings.hidden = !BV.el.settings.hidden; });
  // Barre de position : on peut la faire glisser (ou la toucher) pour aller n'importe où dans la maladie.
  BV.el.seek.addEventListener('input', () => {
    BV.seeking = true;
    BV.el.timeCur.textContent = bvFmt_(Number(BV.el.seek.value) / 1000 * bvTotalMs_());
  });
  BV.el.seek.addEventListener('change', () => {
    const ms = Number(BV.el.seek.value) / 1000 * bvTotalMs_();
    BV.seeking = false;
    bvSeekToMs_(ms);
  });
  // Balayage gauche/droite sur l'image : diapositive suivante / précédente.
  let tx = 0, ty = 0;
  BV.el.stage.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; }, { passive: true });
  BV.el.stage.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) bvGoNext_(false); else bvGoPrev_(); }
  }, { passive: true });
  div.querySelector('#bvNextModule').addEventListener('click', () => bvJumpToModule_(BV.moduleIndex + 1));
  div.querySelector('#bvAutoNext').addEventListener('change', (e) => { BV.autoNext = e.target.checked; });
  bvFillVoiceList_();
  if ('speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged', bvFillVoiceList_);
  BV.el.voiceSel.addEventListener('change', (e) => {
    try { localStorage.setItem('bvVoice', e.target.value); } catch (err) { /* stockage indisponible */ }
    if (BV.playing) bvRestartHere_();
  });
  div.querySelector('#bvReplay').addEventListener('click', () => bvJumpToModule_(0));
  div.querySelector('#bvCloseEnd').addEventListener('click', bvClose_);
  div.querySelector('#bvStayEnd').addEventListener('click', () => { BV.el.endscreen.hidden = true; bvSeekToMs_(0); });
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

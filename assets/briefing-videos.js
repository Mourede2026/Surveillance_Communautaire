/**
 * Lecture vocale (Web Speech API) des scripts vidéo de formation intégrés au briefing
 * (assets/briefing-videos-data.js). Un RC ou un ASCQ peut appuyer sur "🔊 Écouter le script"
 * pour une lecture automatique en français, ou filmer un RC en train de le lire face caméra.
 * Dépend de BRIEFING_VIDEO_TTS (assets/briefing-videos-data.js).
 */
let __ttsCurrentPlayingId = null;
let __ttsQueue = [];
let __ttsQueueIndex = 0;
let __ttsFrenchVoice = null;

function __ttsLoadVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) {
    __ttsFrenchVoice = voices.find(v => v.lang === 'fr-FR') || voices.find(v => v.lang && v.lang.startsWith('fr')) || null;
  }
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  __ttsLoadVoices();
  window.speechSynthesis.onvoiceschanged = __ttsLoadVoices;
}

function __ttsSetStatus(id, msg) {
  const el = document.getElementById('tts-status-' + id);
  if (el) el.textContent = msg;
}

function __ttsCheckSupport(id) {
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) {
    __ttsSetStatus(id, "⚠️ La lecture vocale n'est pas disponible dans cette fenêtre (essaie Chrome/Safari).");
    return false;
  }
  return true;
}

function __ttsSplitIntoChunks(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let buf = '';
  sentences.forEach(s => {
    if ((buf + s).length > 180) {
      if (buf) chunks.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  });
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

function __ttsSpeakNextChunk(id) {
  const btn = document.getElementById('tts-btn-' + id);
  if (__ttsQueueIndex >= __ttsQueue.length) {
    if (btn) { btn.classList.remove('playing'); btn.textContent = '🔊 Écouter le script'; }
    __ttsCurrentPlayingId = null;
    return;
  }
  const utter = new SpeechSynthesisUtterance(__ttsQueue[__ttsQueueIndex]);
  utter.lang = 'fr-FR';
  if (__ttsFrenchVoice) utter.voice = __ttsFrenchVoice;
  utter.rate = 0.95;
  utter.onend = () => { __ttsQueueIndex++; __ttsSpeakNextChunk(id); };
  utter.onerror = () => {
    __ttsSetStatus(id, '❌ La lecture vocale a été interrompue par une erreur.');
    if (btn) { btn.classList.remove('playing'); btn.textContent = '🔊 Écouter le script'; }
    __ttsCurrentPlayingId = null;
  };
  window.speechSynthesis.speak(utter);
}

// Appelée par le bouton "🔊 Écouter le script" de chaque script vidéo (voir onclick="toggleSpeech('id')"
// généré dans assets/briefing-videos-data.js).
function toggleSpeech(id) {
  if (!__ttsCheckSupport(id)) return;
  const text = (typeof BRIEFING_VIDEO_TTS !== 'undefined') ? BRIEFING_VIDEO_TTS[id] : null;
  if (!text) return;
  const btn = document.getElementById('tts-btn-' + id);

  if (__ttsCurrentPlayingId === id) {
    window.speechSynthesis.cancel();
    if (btn) { btn.classList.remove('playing'); btn.textContent = '🔊 Écouter le script'; }
    __ttsCurrentPlayingId = null;
    return;
  }

  window.speechSynthesis.cancel();
  if (__ttsCurrentPlayingId) {
    const prevBtn = document.getElementById('tts-btn-' + __ttsCurrentPlayingId);
    if (prevBtn) { prevBtn.classList.remove('playing'); prevBtn.textContent = '🔊 Écouter le script'; }
  }

  __ttsSetStatus(id, '');
  __ttsQueue = __ttsSplitIntoChunks(text);
  __ttsQueueIndex = 0;
  __ttsCurrentPlayingId = id;
  if (btn) { btn.classList.add('playing'); btn.textContent = '⏹️ Arrêter la lecture'; }

  setTimeout(() => __ttsSpeakNextChunk(id), 50);
}

/**
 * Export d'une « vidéo » du briefing en vrai fichier vidéo (MP4 ou WebM selon le navigateur), à
 * enregistrer sur le téléphone ou à envoyer (WhatsApp, e-mail…) via le menu de partage.
 *
 * Principe : les diapositives d'une maladie (assets/briefing-video.js) sont dessinées une à une
 * sur un <canvas> 1280×720 (scène illustrée, titre, puces, sous-titres), enregistré en direct par
 * MediaRecorder. La création dure donc aussi longtemps que la vidéo (1 à 3 minutes) : l'écran doit
 * rester ouvert. IMPORTANT : un navigateur ne peut pas enregistrer sa voix de synthèse ; la vidéo
 * exportée est donc SANS VOIX, avec sous-titres (la voix reste disponible dans le lecteur).
 *
 * Point d'entrée : bvStartExport_(indexDuModule). Dépend de briefing-video.js (BV, bvGetAllSlides_,
 * bvSlideDurMs_, bvChunksOf_, bvPause_, bvEscapeHtml_, bvFmt_) et de briefing-scenes.js (bvSceneSvg).
 */
const BVX = { cache: {}, cancel: false, busy: false, panel: null };
const BVX_W = 1280, BVX_H = 720, BVX_SCENE_H = 270, BVX_CAP_H = 120;

function bvxPickMime_() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
  const candidats = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidats.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
}

// Sous-titres : phrases découpées en morceaux d'au plus 110 caractères, affichés chacun pendant
// une durée proportionnelle à sa longueur.
function bvxCaptionPieces_(narration) {
  const phrases = (String(narration || '').match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
  const out = [];
  phrases.forEach((s) => {
    if (s.length <= 110) { out.push(s); return; }
    let cur = '';
    s.split(/\s+/).forEach((w) => {
      if ((cur + ' ' + w).trim().length > 110) { out.push(cur.trim()); cur = w; } else cur = (cur + ' ' + w).trim();
    });
    if (cur) out.push(cur);
  });
  return out.length ? out : [String(narration || '')];
}

function bvxWrap_(ctx, text, maxW) {
  const lines = []; let cur = '';
  String(text).split(/\s+/).forEach((w) => {
    const test = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; } else cur = test;
  });
  if (cur) lines.push(cur);
  return lines;
}

function bvxRoundRect_(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function bvxThemeColors_(theme) {
  let c1 = '#0B3D3A', c2 = '#157A72';
  try {
    const t = document.createElement('div');
    t.className = 'bv-stage ' + theme; t.style.display = 'none';
    document.body.appendChild(t);
    const cs = getComputedStyle(t);
    c1 = cs.getPropertyValue('--bv-c1').trim() || c1; c2 = cs.getPropertyValue('--bv-c2').trim() || c2;
    t.remove();
  } catch (e) { /* couleurs par défaut */ }
  return { c1, c2 };
}

function bvxLoadScene_(moduleId, slide) {
  return new Promise((resolve) => {
    try {
      if (typeof bvSceneSvg !== 'function') { resolve(null); return; }
      const svg = bvSceneSvg(moduleId, slide).replace('<svg ', '<svg width="400" height="300" ');
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch (e) { resolve(null); }
  });
}

// Dessine une image de la vidéo : `t` = ms écoulées dans la diapositive, `dur` = sa durée.
function bvxDrawFrame_(ctx, m, colors, slide, img, t, dur, pieces) {
  const W = BVX_W, H = BVX_H, SH = BVX_SCENE_H, PY = SH, PH = H - BVX_CAP_H - SH;
  // Scène illustrée (même fond que dans le lecteur), image 400×300 calée en bas et centrée
  const sky = ctx.createLinearGradient(0, 0, 0, SH);
  sky.addColorStop(0, '#6ec6ff'); sky.addColorStop(0.62, '#eaf8ff'); sky.addColorStop(0.62, '#c27a45'); sky.addColorStop(1, '#c27a45');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, SH);
  if (img) { const k = Math.min(W / 400, SH / 300); ctx.drawImage(img, (W - 400 * k) / 2, SH - 300 * k, 400 * k, 300 * k); }
  // Nom de la maladie
  ctx.font = '700 22px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const label = `${m.icon} ${m.title} · ${m.num}`;
  const lw = Math.min(W - 40, ctx.measureText(label).width + 28);
  ctx.fillStyle = 'rgba(0,0,0,.42)'; bvxRoundRect_(ctx, 16, 14, lw, 38, 19); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(label, 30, 33, W - 70);
  // Panneau texte
  const g = ctx.createLinearGradient(0, PY, 0, PY + PH);
  g.addColorStop(0, colors.c2); g.addColorStop(1, colors.c1);
  ctx.fillStyle = g; ctx.fillRect(0, PY, W, PH);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(0, PY, W, 4);
  // Titre
  let tf = 40; ctx.font = `800 ${tf}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  while (tf > 24 && ctx.measureText(slide.title).width > W - 120) { tf -= 2; ctx.font = `800 ${tf}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`; }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(slide.title, W / 2, PY + 14 + tf / 2 + 6, W - 100);
  // Lignes : on prend la plus grande police qui tient dans le panneau
  const top = PY + 14 + tf + 22, avail = PY + PH - top - 8, boxW = Math.min(W - 120, 1000), x0 = (W - boxW) / 2;
  const FAM = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  let f = 30, mesures = [];
  for (; f >= 17; f -= 1) {
    let total = 0; mesures = [];
    slide.lines.forEach((l) => {
      ctx.font = `${l.type === 'subhead' ? '700' : l.type === 'warning' ? '700' : '500'} ${l.type === 'subhead' ? Math.round(f * 0.86) : f}px ${FAM}`;
      const pad = l.type === 'step' ? 46 : 0;
      const wr = bvxWrap_(ctx, (l.type === 'subhead' ? l.text.toUpperCase() : l.text), boxW - 36 - pad);
      const h = wr.length * f * 1.28 + 16;
      mesures.push({ l, wr, h, pad }); total += h + 8;
    });
    if (total <= avail) break;
  }
  let y = top;
  mesures.forEach((o, i) => {
    const appear = 350 + i * 330, a = Math.max(0, Math.min(1, (t - appear) / 300));
    if (a > 0) {
      ctx.globalAlpha = a;
      ctx.fillStyle = o.l.type === 'warning' ? 'rgba(255,196,0,.28)' : o.l.type === 'subhead' ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.14)';
      bvxRoundRect_(ctx, x0, y, boxW, o.h, 12); ctx.fill();
      if (o.l.type === 'warning') { ctx.strokeStyle = 'rgba(255,196,0,.7)'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (o.l.type === 'step') {
        ctx.beginPath(); ctx.arc(x0 + 30, y + o.h / 2, 15, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.fillStyle = '#111'; ctx.font = `800 ${Math.round(f * 0.8)}px ${FAM}`; ctx.textAlign = 'center'; ctx.fillText(String(o.l.num || ''), x0 + 30, y + o.h / 2 + 1);
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      }
      ctx.font = `${o.l.type === 'note' ? 'italic ' : ''}${o.l.type === 'subhead' || o.l.type === 'warning' ? '700' : '500'} ${o.l.type === 'subhead' ? Math.round(f * 0.86) : f}px ${FAM}`;
      o.wr.forEach((ln, k) => ctx.fillText(ln, x0 + 18 + o.pad, y + 8 + (k + 0.5) * f * 1.28, boxW - 36 - o.pad));
      ctx.globalAlpha = 1;
    }
    y += o.h + 8;
  });
  // Sous-titres
  ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, H - BVX_CAP_H, W, BVX_CAP_H);
  const tot = pieces.reduce((n, p) => n + p.length, 0) || 1; let acc = 0, cur = pieces[pieces.length - 1] || '';
  for (let i = 0; i < pieces.length; i++) { acc += pieces[i].length; if (t / dur <= acc / tot) { cur = pieces[i]; break; } }
  ctx.font = `500 28px ${FAM}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const wr = bvxWrap_(ctx, cur, W - 120).slice(0, 2);
  wr.forEach((ln, i) => ctx.fillText(ln, W / 2, H - BVX_CAP_H / 2 + (i - (wr.length - 1) / 2) * 36, W - 100));
}

/* ------------------------- Fenêtre de création / résultat ------------------------- */
function bvxEnsurePanel_() {
  if (BVX.panel) return BVX.panel;
  const p = document.createElement('div');
  p.className = 'bvx-panel'; p.hidden = true;
  BV.overlay.appendChild(p);
  BVX.panel = p;
  return p;
}
function bvxShow_(html) { const p = bvxEnsurePanel_(); p.hidden = false; p.innerHTML = '<div class="bvx-card">' + html + '</div>'; return p; }
function bvxClose_() { if (BVX.panel) BVX.panel.hidden = true; }
const bvxToast_ = (msg, err) => { if (typeof toast === 'function') toast(msg, err); else alert(msg); };

function bvxSaveFile_(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}
async function bvxShareFile_(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); }
    catch (e) { if (e && e.name !== 'AbortError') bvxToast_('Envoi impossible : ' + (e.message || e), true); }
  } else {
    bvxSaveFile_(blob, name);
    bvxToast_('Le partage direct n\'est pas disponible ici : la vidéo a été enregistrée, envoyez-la depuis vos fichiers.');
  }
}

function bvxShowResult_(m, res) {
  const mo = (res.blob.size / 1048576).toFixed(1).replace('.', ',');
  const canShare = !!(navigator.canShare && (() => { try { return navigator.canShare({ files: [new File([res.blob], res.name, { type: res.blob.type })] }); } catch (e) { return false; } })());
  const p = bvxShow_(`
    <div class="bvx-title">✅ Vidéo prête</div>
    <div class="bvx-sub">${bvEscapeHtml_(m.title)} · ${bvFmt_(res.durMs)} · ${mo} Mo<br>Vidéo avec images et sous-titres, <strong>sans voix</strong>.</div>
    <div class="bvx-actions">
      <button class="bvx-btn bvx-primary" id="bvxSave">⬇ Enregistrer sur le téléphone</button>
      ${canShare ? '<button class="bvx-btn" id="bvxShare">📤 Envoyer à quelqu\'un</button>' : ''}
      <button class="bvx-btn bvx-ghost" id="bvxClose">Fermer</button>
    </div>`);
  p.querySelector('#bvxSave').addEventListener('click', () => bvxSaveFile_(res.blob, res.name));
  const sh = p.querySelector('#bvxShare'); if (sh) sh.addEventListener('click', () => bvxShareFile_(res.blob, res.name, m.title));
  p.querySelector('#bvxClose').addEventListener('click', bvxClose_);
}

/* ------------------------- Création de la vidéo ------------------------- */
async function bvxRender_(idx, onProgress) {
  const m = BRIEFING_MODULES[idx];
  const slides = bvGetAllSlides_()[idx];
  const durs = slides.map(bvSlideDurMs_);
  const total = durs.reduce((n, d) => n + d, 0);
  const mime = bvxPickMime_();
  if (mime === null) throw new Error('Ce navigateur ne permet pas de créer une vidéo. Essayez avec Chrome ou Safari à jour.');

  const colors = bvxThemeColors_(m.theme);
  const imgs = await Promise.all(slides.map((s) => bvxLoadScene_(m.id, s)));
  const pieces = slides.map((s) => bvxCaptionPieces_(s.narration || s.title));

  const canvas = document.createElement('canvas');
  canvas.width = BVX_W; canvas.height = BVX_H;
  const ctx = canvas.getContext('2d');
  bvxDrawFrame_(ctx, m, colors, slides[0], imgs[0], 0, durs[0], pieces[0]); // première image avant le démarrage
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const fini = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start(500);

  await new Promise((resolve) => {
    const t0 = performance.now();
    (function boucle() {
      if (BVX.cancel) { resolve(); return; }
      const el = performance.now() - t0;
      let i = 0, acc = 0;
      while (i < durs.length - 1 && acc + durs[i] <= el) { acc += durs[i]; i++; }
      bvxDrawFrame_(ctx, m, colors, slides[i], imgs[i], el - acc, durs[i], pieces[i]);
      onProgress(Math.min(1, el / total), el, total);
      if (el >= total) { setTimeout(resolve, 600); return; }
      requestAnimationFrame(boucle);
    })();
  });
  if (rec.state !== 'inactive') rec.stop();
  await fini;
  stream.getTracks().forEach((t) => t.stop());
  if (BVX.cancel) return null;
  const type = (mime || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  const slug = String(m.title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return { blob, name: `briefing-${slug || m.id}.${type.includes('mp4') ? 'mp4' : 'webm'}`, durMs: total };
}

// Point d'entrée : crée (ou ressort du cache) la vidéo de la maladie `idx`, puis propose de
// l'enregistrer ou de l'envoyer.
async function bvStartExport_(idx) {
  if (BVX.busy) return;
  const m = BRIEFING_MODULES[idx];
  if (BV.playing) bvPause_();
  bvTogglePlaylist_(false);
  if (BVX.cache[m.id]) { bvxShowResult_(m, BVX.cache[m.id]); return; }

  BVX.busy = true; BVX.cancel = false;
  const dureeTxt = bvFmt_(bvGetAllSlides_()[idx].map(bvSlideDurMs_).reduce((n, d) => n + d, 0));
  const p = bvxShow_(`
    <div class="bvx-title">🎬 Création de la vidéo…</div>
    <div class="bvx-sub">${bvEscapeHtml_(m.title)} · durée ${dureeTxt}<br>Gardez cet écran ouvert jusqu'à la fin (la vidéo s'enregistre en temps réel).</div>
    <div class="bvx-bar"><div class="bvx-bar-fill" id="bvxFill"></div></div>
    <div class="bvx-pct" id="bvxPct">0 %</div>
    <div class="bvx-actions"><button class="bvx-btn bvx-ghost" id="bvxCancel">Annuler</button></div>`);
  p.querySelector('#bvxCancel').addEventListener('click', () => { BVX.cancel = true; });
  const fill = p.querySelector('#bvxFill'), pct = p.querySelector('#bvxPct');
  try {
    const res = await bvxRender_(idx, (r) => { fill.style.width = (r * 100).toFixed(1) + '%'; pct.textContent = Math.round(r * 100) + ' %'; });
    if (!res) { bvxClose_(); bvxToast_('Création annulée.'); }
    else { BVX.cache[m.id] = res; bvxShowResult_(m, res); }
  } catch (e) {
    bvxShow_(`<div class="bvx-title">⚠️ Création impossible</div><div class="bvx-sub">${bvEscapeHtml_(e.message || String(e))}</div><div class="bvx-actions"><button class="bvx-btn bvx-ghost" id="bvxClose">Fermer</button></div>`)
      .querySelector('#bvxClose').addEventListener('click', bvxClose_);
  } finally { BVX.busy = false; }
}

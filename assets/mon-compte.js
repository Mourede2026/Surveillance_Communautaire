/**
 * "Mon compte" — permet à l'utilisateur connecté de modifier lui-même son nom, son prénom, son
 * numéro de téléphone (identifiant de connexion) et son mot de passe, sans passer par un
 * superviseur. Utilisé sur les 6 espaces (RC, ASCQ, PF, RCSE, DEPARTEMENT, NATIONAL).
 *
 * Le backend (updateUser_ dans Code.gs) autorise déjà un compte à se modifier lui-même
 * (actor.ID === target.ID) — ce module se contente d'exposer une interface simple pour ça,
 * limitée aux identifiants (contrairement à la modale d'administration de assets/user-admin.js,
 * qui permet aussi de changer la géographie d'un subordonné : ça n'a pas sa place ici).
 */

function ensureMonCompteModal_() {
  if (document.getElementById('monCompteModalOverlay')) return;
  const div = document.createElement('div');
  div.id = 'monCompteModalOverlay';
  div.className = 'modal-overlay';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="modal-box">
      <h2 style="margin-top:0">Mon compte</h2>
      <div class="photo-ligne">
        <div id="monComptePhoto" class="photo-profil"></div>
        <div>
          <label class="btn-secondary" style="display:inline-block;padding:8px 14px;border-radius:8px;cursor:pointer">📷 Choisir une photo<input type="file" id="monComptePhotoInput" accept="image/*" style="display:none"></label>
          <button type="button" class="btn-secondary" id="monComptePhotoSupp">Retirer</button>
          <div class="petit" id="monComptePhotoMsg">La photo est enregistrée dans votre compte.</div>
        </div>
      </div>
      <div class="sig-bloc">
        <div class="sig-titre">✍️ Ma signature</div>
        <div class="petit">Dessinez votre signature (doigt ou souris). Elle sera utilisée sur vos rapports hebdomadaires et sur les listes de présence des suivis groupés.</div>
        <canvas id="sigPad" class="sig-pad" width="480" height="170"></canvas>
        <div class="sig-actions">
          <button type="button" class="btn-secondary btn-mini" id="sigEffacer">Effacer</button>
          <button type="button" class="btn-mini" id="sigEnreg">Enregistrer la signature</button>
          <button type="button" class="btn-secondary btn-mini" id="sigSupp">Supprimer ma signature</button>
        </div>
        <div class="petit" id="sigMsg"></div>
      </div>
      <form id="monCompteForm">
        <div class="field"><label>Nom</label><input name="Nom" required></div>
        <div class="field"><label>Prénom</label><input name="Prenom" required></div>
        <div class="field"><label>Téléphone (identifiant de connexion)</label><input name="Telephone" required></div>
        <div class="field"><label>Nouveau mot de passe (laisser vide pour ne pas changer)</label><input name="motDePasse" type="password" autocomplete="new-password"></div>
        <div class="field"><label>Confirmer le nouveau mot de passe</label><input name="motDePasseConfirm" type="password" autocomplete="new-password"></div>
        <div style="display:flex; gap:10px; margin-top:14px">
          <button type="submit">Enregistrer</button>
          <button type="button" class="btn-secondary" id="monCompteCancel">Annuler</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('monCompteCancel').addEventListener('click', () => { div.style.display = 'none'; });
  div.addEventListener('click', (e) => { if (e.target === div) div.style.display = 'none'; });
}

// Ouvre la modale, pré-remplie avec les informations actuelles de l'utilisateur connecté
// (Session.getUser()). onSaved(updatedUser) est rappelé après un enregistrement réussi, pour que
// la page appelante puisse rafraîchir l'affichage du nom dans l'en-tête si besoin.
function openMonCompteModal(onSaved) {
  ensureMonCompteModal_();
  const user = Session.getUser();
  if (!user) return;
  const overlay = document.getElementById('monCompteModalOverlay');
  const form = document.getElementById('monCompteForm');
  form.Nom.value = user.Nom || '';
  form.Prenom.value = user.Prenom || '';
  form.Telephone.value = user.Telephone || '';
  form.motDePasse.value = '';
  form.motDePasseConfirm.value = '';
  overlay.style.display = 'flex';
  photoAfficher_();
  sigPreparer_();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const mdp = fd.get('motDePasse');
    const mdpConfirm = fd.get('motDePasseConfirm');
    if (mdp && mdp !== mdpConfirm) { toast('Les deux mots de passe ne correspondent pas.', true); return; }
    const payload = { id: user.ID, Nom: fd.get('Nom'), Prenom: fd.get('Prenom'), Telephone: fd.get('Telephone') };
    if (mdp) payload.motDePasse = mdp;
    try {
      await Api.call('updateUser', payload);
      // Met à jour la session locale (nom/téléphone affichés dans l'en-tête, et surtout le
      // nouveau numéro de connexion s'il vient d'être changé) sans avoir à se reconnecter.
      const updatedUser = Object.assign({}, user, { Nom: payload.Nom, Prenom: payload.Prenom, Telephone: payload.Telephone });
      Session.setSession(Session.getToken(), updatedUser);
      toast('Vos informations ont été mises à jour.');
      overlay.style.display = 'none';
      if (onSaved) onSaved(updatedUser);
    } catch (err) { toast(err.message, true); }
  };
}


// ---- Photo de profil : redimensionnée côté appareil (carré 192 px, JPEG) puis enregistrée dans la
// colonne Photo de la feuille Utilisateurs (action setPhoto).
function photoReduire_(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const T = 192, cv = document.createElement('canvas'); cv.width = cv.height = T;
      const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      cv.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, T, T);
      URL.revokeObjectURL(url);
      let q = 0.78, out = cv.toDataURL('image/jpeg', q);
      while (out.length > 40000 && q > 0.3) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
    img.src = url;
  });
}
function photoAfficher_() {
  const u = Session.getUser() || {}, el = document.getElementById('monComptePhoto'); if (!el) return;
  el.innerHTML = /^data:image\//.test(u.Photo || '') ? '<img alt="" src="' + u.Photo + '" style="width:100%;height:100%;object-fit:cover">' : escHtml(((u.Prenom || '?')[0] + (u.Nom || '')[0]).toUpperCase());
  if (typeof window.majAvatarProfil_ === 'function') window.majAvatarProfil_();
}
document.addEventListener('change', async e => {
  if (e.target.id !== 'monComptePhotoInput' || !e.target.files[0]) return;
  try {
    const photo = await photoReduire_(e.target.files[0]);
    await Api.call('setPhoto', { photo });
    Session.setSession(Session.getToken(), Object.assign({}, Session.getUser(), { Photo: photo }));
    photoAfficher_(); toast('Photo de profil enregistrée.');
  } catch (err) { toast(err.message, true); }
  e.target.value = '';
});
document.addEventListener('click', async e => {
  if (e.target.id !== 'monComptePhotoSupp') return;
  try {
    await Api.call('setPhoto', { photo: '' });
    Session.setSession(Session.getToken(), Object.assign({}, Session.getUser(), { Photo: '' }));
    photoAfficher_(); toast('Photo retirée.');
  } catch (err) { toast(err.message, true); }
});


// ---- Signature : dessinée à main levée, recadrée et réduite (PNG transparent ≤ ~40 000 caractères) puis
// enregistrée dans la colonne Signature de la feuille Utilisateurs (action setSignature).
const SIG_ = { cv: null, trace: false, aTrace: false, dernier: null };
function sigMsg_(t) { const m = document.getElementById('sigMsg'); if (m) m.textContent = t || ''; }
function sigPreparer_() {
  const cv = document.getElementById('sigPad'); if (!cv) return;
  SIG_.cv = cv; SIG_.aTrace = false;
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
  const u = Session.getUser() || {};
  if (/^data:image\/png/.test(u.Signature || '')) {
    const img = new Image();
    img.onload = () => { const k = Math.min(cv.width * 0.9 / img.width, cv.height * 0.8 / img.height, 1.6); ctx.drawImage(img, (cv.width - img.width * k) / 2, (cv.height - img.height * k) / 2, img.width * k, img.height * k); };
    img.src = u.Signature; sigMsg_('Signature enregistrée. Redessinez-la pour la remplacer.');
  } else sigMsg_('Aucune signature enregistrée.');
  if (cv.dataset.pret) return; cv.dataset.pret = '1';
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignoré */ }
    if (!SIG_.aTrace) ctx.clearRect(0, 0, cv.width, cv.height); // un nouveau tracé remplace l'ancienne signature affichée
    SIG_.trace = true; SIG_.aTrace = true; const [x, y] = pos(e);
    ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0B1F3A'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.01, y + 0.01); ctx.stroke(); SIG_.dernier = [x, y];
  });
  cv.addEventListener('pointermove', e => {
    if (!SIG_.trace) return; e.preventDefault(); const [x, y] = pos(e), [px, py] = SIG_.dernier;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2); ctx.stroke(); SIG_.dernier = [x, y];
  });
  const fin = () => { SIG_.trace = false; };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin); cv.addEventListener('pointerleave', fin);
}
function sigExporter_() {
  const cv = SIG_.cv, w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) return null;
  const pad = 8; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  let k = Math.min(1, 360 / cw, 130 / ch), out = '';
  for (let i = 0; i < 6; i++) {
    const o = document.createElement('canvas'); o.width = Math.max(20, Math.round(cw * k)); o.height = Math.max(10, Math.round(ch * k));
    o.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, o.width, o.height); out = o.toDataURL('image/png');
    if (out.length <= 42000) break; k *= 0.8;
  }
  return out.length <= 44000 ? out : null;
}
document.addEventListener('click', async e => {
  const id = e.target.id;
  if (id === 'sigEffacer') { const cv = SIG_.cv; if (cv) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); SIG_.aTrace = false; sigMsg_('Zone effacée. Dessinez votre signature.'); } }
  if (id === 'sigEnreg') {
    if (!SIG_.aTrace) { sigMsg_('Dessinez d\'abord votre signature dans le cadre.'); return; }
    const sig = sigExporter_(); if (!sig) { sigMsg_('Signature trop complexe ou vide : redessinez-la plus simplement.'); return; }
    try { await Api.call('setSignature', { signature: sig }); Session.setSession(Session.getToken(), Object.assign({}, Session.getUser(), { Signature: sig })); SIG_.aTrace = false; sigMsg_('Signature enregistrée.'); toast('Signature enregistrée.'); }
    catch (err) { sigMsg_(err.message); toast(err.message, true); }
  }
  if (id === 'sigSupp') {
    try { await Api.call('setSignature', { signature: '' }); Session.setSession(Session.getToken(), Object.assign({}, Session.getUser(), { Signature: '' })); SIG_.aTrace = false; sigPreparer_(); toast('Signature supprimée.'); }
    catch (err) { toast(err.message, true); }
  }
});

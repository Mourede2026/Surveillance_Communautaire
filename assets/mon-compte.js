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

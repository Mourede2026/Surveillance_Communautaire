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

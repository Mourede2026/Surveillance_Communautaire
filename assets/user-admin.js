/**
 * Actions partagées sur les lignes de tableau "utilisateur" (Modifier / Supprimer / Activer-
 * Désactiver), utilisées sur les écrans National, RCSE, PF et ASCQ.
 *
 * Modifier et Supprimer ne sont proposés que pour les comptes que l'utilisateur connecté a
 * lui-même créés (u.CreePar === currentUserId), ou pour le compte NATIONAL qui gère tout —
 * même règle que côté backend (voir canManageUser_ dans Code.gs). Désactiver/Réactiver reste
 * disponible pour tout superviseur, direct ou indirect, comme avant.
 */

function ensureUserEditModal_() {
  if (document.getElementById('userEditModalOverlay')) return;
  const div = document.createElement('div');
  div.id = 'userEditModalOverlay';
  div.className = 'modal-overlay';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="modal-box">
      <h2 style="margin-top:0">Modifier le compte</h2>
      <form id="userEditForm">
        <div class="field"><label>Nom</label><input name="Nom" required></div>
        <div class="field"><label>Prénom</label><input name="Prenom" required></div>
        <div class="field"><label>Téléphone</label><input name="Telephone" required></div>
        <div class="field"><label>Nouveau mot de passe (laisser vide pour ne pas changer)</label><input name="motDePasse" type="password"></div>
        <div style="display:flex; gap:10px; margin-top:14px">
          <button type="submit">Enregistrer</button>
          <button type="button" class="btn-secondary" id="userEditCancel">Annuler</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('userEditCancel').addEventListener('click', () => { div.style.display = 'none'; });
  div.addEventListener('click', (e) => { if (e.target === div) div.style.display = 'none'; });
}

function openEditUserModal(u, onSaved) {
  ensureUserEditModal_();
  const overlay = document.getElementById('userEditModalOverlay');
  const form = document.getElementById('userEditForm');
  form.Nom.value = u.Nom || '';
  form.Prenom.value = u.Prenom || '';
  form.Telephone.value = u.Telephone || '';
  form.motDePasse.value = '';
  overlay.style.display = 'flex';
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = { id: u.ID, Nom: fd.get('Nom'), Prenom: fd.get('Prenom'), Telephone: fd.get('Telephone') };
    const mdp = fd.get('motDePasse');
    if (mdp) payload.motDePasse = mdp;
    try {
      await Api.call('updateUser', payload);
      toast('Compte mis à jour.');
      overlay.style.display = 'none';
      if (onSaved) onSaved();
    } catch (err) { toast(err.message, true); }
  };
}

async function deleteUserConfirm(u, onDeleted) {
  if (!confirm(`Supprimer définitivement le compte de ${u.Prenom} ${u.Nom} (${u.Telephone}) ? Cette action est irréversible.`)) return;
  try {
    await Api.call('deleteUser', { id: u.ID });
    toast('Compte supprimé.');
    if (onDeleted) onDeleted();
  } catch (err) { toast(err.message, true); }
}

// Construit le HTML des boutons d'action pour une ligne de tableau utilisateur.
function userRowActionsHtml(u, currentUserId, currentUserRole) {
  const actif = u.Actif === true || u.Actif === 'TRUE';
  // "Modifier"/"Supprimer" pour le créateur direct OU le responsable direct (les deux
  // coïncident à la création, mais on vérifie les deux pour rester robuste), et pour NATIONAL
  // qui gère tout.
  const peutGerer = currentUserRole === 'NATIONAL' || u.CreePar === currentUserId || u.ResponsableId === currentUserId;
  let html = `<button class="${actif ? 'btn-danger' : 'btn-secondary'}" data-toggle="${u.ID}|${actif ? 0 : 1}">${actif ? 'Désactiver' : 'Réactiver'}</button>`;
  if (peutGerer) {
    html += ` <button class="btn-secondary" data-edit="${u.ID}" style="margin-left:6px">Modifier</button>`;
    html += ` <button class="btn-danger" data-delete="${u.ID}" style="margin-left:6px">Supprimer</button>`;
  }
  return html;
}

// Attache les handlers toggle/modifier/supprimer sur un conteneur déjà rempli via
// userRowActionsHtml. usersById : { [ID]: objet utilisateur complet }. onChanged est rappelé
// après toute action réussie (généralement la fonction qui recharge le tableau).
function wireUserRowActions(container, usersById, onChanged) {
  container.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
    const [id, active] = b.dataset.toggle.split('|');
    try { await Api.call('setUserActive', { id, active: active === '1' }); toast('Statut mis à jour.'); onChanged(); }
    catch (err) { toast(err.message, true); }
  }));
  container.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const u = usersById[b.dataset.edit];
    if (u) openEditUserModal(u, onChanged);
  }));
  container.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => {
    const u = usersById[b.dataset.delete];
    if (u) deleteUserConfirm(u, onChanged);
  }));
}

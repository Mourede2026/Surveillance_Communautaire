/**
 * Actions partagées sur les lignes de tableau "utilisateur" (Modifier / Supprimer / Activer-
 * Désactiver), utilisées sur les écrans National, Département, RCSE, PF et ASCQ.
 *
 * Modifier est proposé à tout superviseur, direct ou indirect (ResponsableId dans la chaîne),
 * comme sur le backend (voir updateUser_ / isSupervisorOf_ dans Code.gs) — un RCSE peut par
 * exemple corriger un ASCQ ou un RC de sa zone, pas seulement les comptes qu'il a personnellement
 * créés. Supprimer reste réservé au créateur direct (ou à NATIONAL), plus destructeur.
 *
 * Le formulaire de modification permet aussi de corriger la géographie du compte (village,
 * arrondissement, commune, département — selon ce qui s'applique à son rôle), via des listes
 * déroulantes en cascade identiques à celles utilisées à la création. Dépend de
 * assets/geo-benin-data.js et assets/geo-utils.js (GEO_BENIN, slugGeo, wireCascadingGeoLive).
 * La "zone sanitaire" d'un RCSE (plusieurs communes) se gère via l'onglet "Assignations", pas ici
 * — un RCSE n'a donc que son département de modifiable dans ce formulaire.
 */

// Rubriques géographiques à afficher/modifier selon le rôle du compte édité, dans l'ordre.
const GEO_CHAMPS_PAR_ROLE = {
  RC: ['departement', 'commune', 'arrondissement', 'village', 'grappe'],
  ASCQ: ['departement', 'commune', 'arrondissement'],
  PF_CNLS_TP: ['departement', 'commune'],
  RCSE: ['departement'],
  DEPARTEMENT: ['departement']
};

function ensureUserEditModal_() {
  if (document.getElementById('userEditModalOverlay')) return;
  const div = document.createElement('div');
  div.id = 'userEditModalOverlay';
  div.className = 'modal-overlay';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="modal-box" style="max-height:90vh;overflow-y:auto">
      <h2 style="margin-top:0">Modifier le compte</h2>
      <form id="userEditForm">
        <div class="field"><label>Nom</label><input name="Nom" required></div>
        <div class="field"><label>Prénom</label><input name="Prenom" required></div>
        <div class="field"><label>Téléphone</label><input name="Telephone" required></div>
        <div class="field"><label>Nouveau mot de passe (laisser vide pour ne pas changer)</label><input name="motDePasse" type="password"></div>
        <div id="userEditGeo"></div>
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

const GEO_CHAMP_LABEL = { departement: 'Département', commune: 'Commune', arrondissement: 'Arrondissement', village: 'Village', grappe: 'Grappe' };

async function openEditUserModal(u, onSaved) {
  ensureUserEditModal_();
  const overlay = document.getElementById('userEditModalOverlay');
  const form = document.getElementById('userEditForm');
  form.Nom.value = u.Nom || '';
  form.Prenom.value = u.Prenom || '';
  form.Telephone.value = u.Telephone || '';
  form.motDePasse.value = '';

  const geoEl = document.getElementById('userEditGeo');
  const champs = GEO_CHAMPS_PAR_ROLE[u.Role] || [];
  let geoIdsCourants = null; // rempli une fois la cascade câblée (voir plus bas)

  if (!champs.length) {
    geoEl.innerHTML = '';
  } else {
    geoEl.innerHTML = `<fieldset style="margin-top:14px"><legend>Localisation</legend>
      ${champs.map(c => `<div class="field"><label>${GEO_CHAMP_LABEL[c]}</label><select id="edit-${c}"></select></div>`).join('')}
      ${champs.includes('grappe') ? '<div class="field"><label>Ou numéro d\'une nouvelle grappe (1 à 10)</label><select id="edit-grappe-nouvelle"><option value="">— Aucune —</option></select></div>' : ''}
      ${u.Role === 'RCSE' ? '<p style="font-size:.78rem;color:var(--ink-soft);margin:0">La zone sanitaire (liste des communes) se modifie depuis l\'onglet "Assignations".</p>' : ''}
    </fieldset>`;

    try {
      const { geo } = await Api.call('listGeo', {});
      const depSel = document.getElementById('edit-departement');
      const comSel = champs.includes('commune') ? document.getElementById('edit-commune') : null;
      const arrSel = champs.includes('arrondissement') ? document.getElementById('edit-arrondissement') : null;
      const vilSel = champs.includes('village') ? document.getElementById('edit-village') : null;
      const grpSel = champs.includes('grappe') ? document.getElementById('edit-grappe') : null;
      const grpNouvelleSel = champs.includes('grappe') ? document.getElementById('edit-grappe-nouvelle') : null;

      wireCascadingGeoLive(depSel, comSel, arrSel, vilSel, geo, (ids) => { geoIdsCourants = ids; }, grpSel);

      // Le choix "nouvelle grappe" (numérotée 1 à 10, voir assets/geo-utils.js) se recalcule à
      // chaque changement de village, pour ne proposer que les numéros encore libres.
      if (vilSel && grpNouvelleSel) {
        vilSel.addEventListener('change', () => fillGrappeNumeroteeSelect_(grpNouvelleSel, geo.grappes || [], vilSel.value));
      }

      // Pré-remplit avec les valeurs actuelles du compte, niveau par niveau (chaque niveau
      // déclenche le suivant, comme une vraie sélection au clavier).
      if (depSel && u.DepartementId) {
        depSel.value = u.DepartementId;
        depSel.dispatchEvent(new Event('change'));
      }
      if (comSel && u.CommuneId) {
        comSel.value = u.CommuneId;
        comSel.dispatchEvent(new Event('change'));
      }
      if (arrSel && u.ArrondissementId) {
        arrSel.value = u.ArrondissementId;
        arrSel.dispatchEvent(new Event('change'));
      }
      if (vilSel && u.VillageId) {
        vilSel.value = u.VillageId;
        vilSel.dispatchEvent(new Event('change'));
      }
      if (grpSel && u.GrappeId) {
        grpSel.value = u.GrappeId;
        grpSel.dispatchEvent(new Event('change'));
      }
    } catch (e) { geoEl.innerHTML += '<p style="font-size:.8rem;color:var(--red-600)">Géographie indisponible pour le moment.</p>'; }
  }

  // Numéros de grappe (1 à 10) encore libres pour le village choisi — voir assets/geo-utils.js.
  function fillGrappeNumeroteeSelect_(selectEl, grappes, villageId) {
    const disponibles = villageId ? grappesDisponiblesPourVillage_(grappes, villageId) : GRAPPES_NUMEROTEES;
    selectEl.innerHTML = '<option value="">— Aucune —</option>' + disponibles.map(nom => `<option value="${nom}">${nom}</option>`).join('');
  }

  overlay.style.display = 'flex';
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = { id: u.ID, Nom: fd.get('Nom'), Prenom: fd.get('Prenom'), Telephone: fd.get('Telephone') };
    const mdp = fd.get('motDePasse');
    if (mdp) payload.motDePasse = mdp;
    if (geoIdsCourants) {
      if (champs.includes('departement')) { payload.departementId = geoIdsCourants.depId; payload.departementNom = geoIdsCourants.depNom; }
      if (champs.includes('commune')) { payload.communeId = geoIdsCourants.comId; payload.communeNom = geoIdsCourants.comNom; }
      if (champs.includes('arrondissement')) { payload.arrondissementId = geoIdsCourants.arrId; payload.arrondissementNom = geoIdsCourants.arrNom; }
      if (champs.includes('village')) { payload.villageId = geoIdsCourants.vilId; payload.villageNom = geoIdsCourants.vilNom; }
      if (champs.includes('grappe')) { payload.grappeId = geoIdsCourants.grpId; payload.grappeNom = geoIdsCourants.grpNom; }
    }
    // Un numéro de nouvelle grappe choisi (1 à 10) prévaut sur une grappe existante sélectionnée :
    // on la crée d'abord, puis on l'assigne au compte comme n'importe quelle grappe existante.
    const grpNouvelleSel = document.getElementById('edit-grappe-nouvelle');
    if (grpNouvelleSel && grpNouvelleSel.value) {
      try {
        const villageId = payload.villageId || u.VillageId;
        const villageNom = payload.villageNom || u.VillageNom;
        const created = await Api.call('createGrappe', { villageId, villageNom, nom: grpNouvelleSel.value });
        payload.grappeId = created.item.ID; payload.grappeNom = created.item.Nom;
      } catch (err) { toast(err.message, true); return; }
    }
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

/**
 * Actions partagées sur les lignes de tableau "utilisateur" (Modifier / Supprimer / Activer-
 * Désactiver), utilisées sur les écrans National, Département, RCSE, PF et ASCQ.
 *
 * Modifier est proposé à tout superviseur, direct ou indirect (ResponsableId dans la chaîne),
 * comme sur le backend (voir updateUser_ / isSupervisorOf_ dans Code.gs) — un RCSE peut par
 * exemple corriger un ASCQ ou un RC de sa zone, pas seulement les comptes qu'il a personnellement
 * créés. Supprimer reste réservé au créateur direct (ou à NATIONAL), plus destructeur.
 *
 * Le formulaire de modification permet aussi de corriger la géographie "maison" du compte
 * (village, arrondissement, commune, département — selon ce qui s'applique à son rôle), via des
 * listes déroulantes en cascade identiques à celles utilisées à la création. Dépend de
 * assets/geo-benin-data.js et assets/geo-utils.js (GEO_BENIN, slugGeo, wireCascadingGeoLive).
 * La "zone sanitaire" d'un RCSE (plusieurs communes) se gère via l'onglet "Assignations", pas ici
 * — un RCSE n'a donc que son département de modifiable dans ce formulaire.
 *
 * Pour un RC spécifiquement, les GRAPPES couvertes se gèrent à part, en temps réel (indépendamment
 * du bouton "Enregistrer") : la liste des grappes déjà couvertes s'affiche avec un bouton de
 * retrait chacune, et un formulaire permet d'en ajouter une nouvelle (existante ou nouveau numéro
 * 1 à 10) — que le RC en ait déjà une ou aucune au départ.
 */

// Rubriques géographiques "maison" à afficher/modifier selon le rôle du compte édité (la grappe
// d'un RC se gère séparément, voir plus bas).
const GEO_CHAMPS_PAR_ROLE = {
  RC: ['departement', 'commune', 'arrondissement', 'village'],
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
      <div id="userEditGrappes"></div>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('userEditCancel').addEventListener('click', () => { div.style.display = 'none'; });
  div.addEventListener('click', (e) => { if (e.target === div) div.style.display = 'none'; });
}

const GEO_CHAMP_LABEL = { departement: 'Département', commune: 'Commune', arrondissement: 'Arrondissement', village: 'Village' };

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
  let vilSelRef = null; // réutilisé par la gestion des grappes, une fois la cascade câblée

  if (!champs.length) {
    geoEl.innerHTML = '';
  } else {
    geoEl.innerHTML = `<fieldset style="margin-top:14px"><legend>Localisation</legend>
      ${champs.map(c => `<div class="field"><label>${GEO_CHAMP_LABEL[c]}</label><select id="edit-${c}"></select></div>`).join('')}
      ${u.Role === 'RCSE' ? '<p style="font-size:.78rem;color:var(--ink-soft);margin:0">La zone sanitaire (liste des communes) se modifie depuis l\'onglet "Assignations".</p>' : ''}
    </fieldset>`;

    try {
      const { geo } = await Api.call('listGeo', {});
      const depSel = document.getElementById('edit-departement');
      const comSel = champs.includes('commune') ? document.getElementById('edit-commune') : null;
      const arrSel = champs.includes('arrondissement') ? document.getElementById('edit-arrondissement') : null;
      const vilSel = champs.includes('village') ? document.getElementById('edit-village') : null;
      vilSelRef = vilSel;

      wireCascadingGeoLive(depSel, comSel, arrSel, vilSel, geo, (ids) => { geoIdsCourants = ids; });

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
    } catch (e) { geoEl.innerHTML += '<p style="font-size:.8rem;color:var(--red-600)">Géographie indisponible pour le moment.</p>'; }
  }

  const grappesEl = document.getElementById('userEditGrappes');
  if (u.Role === 'RC') {
    await rendreGestionGrappesRc_(grappesEl, u, () => vilSelRef);
  } else {
    grappesEl.innerHTML = '';
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
    }
    try {
      await Api.call('updateUser', payload);
      toast('Compte mis à jour.');
      overlay.style.display = 'none';
      if (onSaved) onSaved();
    } catch (err) { toast(err.message, true); }
  };
}

// Gestion en temps réel (indépendante du bouton "Enregistrer") des grappes couvertes par un RC :
// liste de ce qu'il couvre déjà, avec un retrait possible pour chacune, et un formulaire
// d'ajout (grappe existante du village choisi, ou nouveau numéro 1 à 10) — fonctionne aussi bien
// pour changer complètement de grappe (retirer l'ancienne, en ajouter une nouvelle) que pour
// ajouter une première grappe à un RC qui n'en avait aucune.
async function rendreGestionGrappesRc_(el, u, getVilSel) {
  el.innerHTML = `<fieldset style="margin-top:14px"><legend>Grappes couvertes par ce RC</legend>
    <div id="userEditGrappesListe" style="margin-bottom:10px">Chargement…</div>
    <div class="grid grid-2">
      <div class="field"><label>Ajouter une grappe existante du village choisi ci-dessus</label><select id="userEditGrappeExistante"><option value="">— Choisir —</option></select></div>
      <div class="field"><label>Ou un nouveau numéro (1 à 10)</label><select id="userEditGrappeNouvelle"><option value="">— Choisir —</option></select></div>
    </div>
    <button type="button" class="btn-secondary" id="userEditGrappeAjouter">+ Ajouter cette grappe</button>
  </fieldset>`;

  const listeEl = document.getElementById('userEditGrappesListe');
  const existSel = document.getElementById('userEditGrappeExistante');
  const nouvSel = document.getElementById('userEditGrappeNouvelle');
  let geoGrappes = [];

  async function rafraichir() {
    try {
      const { grappes } = await Api.call('listGrappesDuRc', { userId: u.ID });
      listeEl.innerHTML = grappes.length
        ? grappes.map(g => `<span class="chip">${g.grappeNom} (${g.villageNom})<button type="button" data-remove-grappe="${g.grappeId}">×</button></span>`).join(' ')
        : '<span class="empty-hint">Aucune grappe assignée pour le moment.</span>';
      listeEl.querySelectorAll('[data-remove-grappe]').forEach(b => b.addEventListener('click', async () => {
        try { await Api.call('retirerGrappeRc', { userId: u.ID, grappeId: b.dataset.removeGrappe }); toast('Grappe retirée.'); rafraichir(); }
        catch (err) { toast(err.message, true); }
      }));
    } catch (e) { listeEl.innerHTML = '<span class="empty-hint">Erreur de chargement.</span>'; }
  }

  function rafraichirOptionsVillage() {
    const vilSel = getVilSel();
    const villageId = vilSel ? vilSel.value : '';
    existSel.innerHTML = '<option value="">— Choisir —</option>' + (villageId ? geoGrappes.filter(g => g.VillageId === villageId).map(g => `<option value="${g.ID}">${g.Nom}</option>`).join('') : '');
    const disponibles = villageId ? grappesDisponiblesPourVillage_(geoGrappes, villageId) : [];
    nouvSel.innerHTML = '<option value="">— Choisir —</option>' + disponibles.map(nom => `<option value="${nom}">${nom}</option>`).join('');
  }

  try {
    const { geo } = await Api.call('listGeo', {});
    geoGrappes = geo.grappes || [];
    rafraichirOptionsVillage();
    const vilSel = getVilSel();
    if (vilSel) vilSel.addEventListener('change', rafraichirOptionsVillage);
  } catch (e) { /* le formulaire d'ajout restera vide si la géo ne charge pas */ }

  document.getElementById('userEditGrappeAjouter').addEventListener('click', async () => {
    const vilSel = getVilSel();
    const villageId = vilSel ? vilSel.value : '';
    if (!villageId) { toast('Choisissez d\'abord un village ci-dessus.', true); return; }
    const villageNom = vilSel.options[vilSel.selectedIndex] ? vilSel.options[vilSel.selectedIndex].textContent : '';
    const grappeChoisie = nouvSel.value ? { grappeNom: nouvSel.value } : (existSel.value ? { grappeId: existSel.value } : null);
    if (!grappeChoisie) { toast('Choisissez une grappe existante ou un nouveau numéro.', true); return; }
    try {
      await Api.call('assignGrappeRc', Object.assign({ userId: u.ID, villageId, villageNom }, grappeChoisie));
      toast('Grappe ajoutée.');
      existSel.value = ''; nouvSel.value = '';
      rafraichir();
    } catch (err) { toast(err.message, true); }
  });

  rafraichir();
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

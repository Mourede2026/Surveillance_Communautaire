/**
 * Utilitaires pour la structure administrative du Bénin (Département > Commune >
 * Arrondissement > Village), chargée statiquement depuis geo-benin-data.js.
 * Les identifiants sont calculés de façon déterministe (même logique que le
 * backend Apps Script, fonction slug_) afin que les IDs générés côté client
 * correspondent exactement à ceux créés lors de l'import en base.
 */

function slugGeo(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlève les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function geoIds(depNom, comNom, arrNom, vilNom) {
  const depId = 'DEP-' + slugGeo(depNom);
  const comId = depId + '__COM-' + slugGeo(comNom);
  const arrId = comId + '__ARR-' + slugGeo(arrNom);
  const vilId = arrId + '__VIL-' + slugGeo(vilNom);
  return { depId, comId, arrId, vilId };
}

/**
 * Câble 4 <select> en cascade (département, commune, arrondissement, village).
 * Chaque select intermédiaire peut être omis (passer null) si non nécessaire,
 * par ex. pour un formulaire qui s'arrête au niveau commune.
 * onChange(ids) est appelé à chaque changement avec { depId, comId, arrId, vilId, depNom, comNom, arrNom, vilNom }.
 */
function wireCascadingGeo(depSel, comSel, arrSel, vilSel, onChange) {
  function fill(select, items, placeholder) {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>` + items.map(n => `<option value="${n}">${n}</option>`).join('');
  }

  fill(depSel, GEO_BENIN.map(d => d.nom), 'Sélectionner un département');
  if (comSel) fill(comSel, [], 'Sélectionner une commune');
  if (arrSel) fill(arrSel, [], 'Sélectionner un arrondissement');
  if (vilSel) fill(vilSel, [], 'Sélectionner un village');

  function emit() {
    const depNom = depSel ? depSel.value : '';
    const comNom = comSel ? comSel.value : '';
    const arrNom = arrSel ? arrSel.value : '';
    const vilNom = vilSel ? vilSel.value : '';
    const ids = geoIds(depNom || '_', comNom || '_', arrNom || '_', vilNom || '_');
    if (onChange) onChange({ ...ids, depNom, comNom, arrNom, vilNom });
  }

  if (depSel) depSel.addEventListener('change', () => {
    const dep = GEO_BENIN.find(d => d.nom === depSel.value);
    if (comSel) fill(comSel, dep ? dep.communes.map(c => c.nom) : [], 'Sélectionner une commune');
    if (arrSel) fill(arrSel, [], 'Sélectionner un arrondissement');
    if (vilSel) fill(vilSel, [], 'Sélectionner un village');
    emit();
  });
  if (comSel) comSel.addEventListener('change', () => {
    const dep = GEO_BENIN.find(d => d.nom === depSel.value);
    const com = dep ? dep.communes.find(c => c.nom === comSel.value) : null;
    if (arrSel) fill(arrSel, com ? com.arrondissements.map(a => a.nom) : [], 'Sélectionner un arrondissement');
    if (vilSel) fill(vilSel, [], 'Sélectionner un village');
    emit();
  });
  if (arrSel) arrSel.addEventListener('change', () => {
    const dep = GEO_BENIN.find(d => d.nom === depSel.value);
    const com = dep ? dep.communes.find(c => c.nom === comSel.value) : null;
    const arr = com ? com.arrondissements.find(a => a.nom === arrSel.value) : null;
    if (vilSel) fill(vilSel, arr ? arr.villages.slice() : [], 'Sélectionner un village');
    emit();
  });
  if (vilSel) vilSel.addEventListener('change', emit);
}

/**
 * Variante de wireCascadingGeo qui cascade sur les données RÉELLEMENT enregistrées dans le
 * Google Sheet (celles renvoyées par l'action listGeo), plutôt que sur la seule liste nationale
 * statique GEO_BENIN. Utile pour les formulaires qui doivent aussi proposer les communes /
 * arrondissements / villages ajoutés manuellement ("hors liste nationale"), qui n'existent pas
 * dans GEO_BENIN. Le département reste choisi dans la liste nationale (toujours les 12 mêmes,
 * aucun département personnalisé n'existe dans l'application).
 *
 * liveGeo : { communes, arrondissements, villages } tel que renvoyé par Api.call('listGeo', {}).
 * onChange(sel) est appelé à chaque changement avec
 * { depId, depNom, comId, comNom, arrId, arrNom, vilId, vilNom } — comId/arrId/vilId sont les
 * identifiants réels du Sheet (nécessaires pour les appels API), depId est déterministe.
 */
function wireCascadingGeoLive(depSel, comSel, arrSel, vilSel, liveGeo, onChange) {
  function fillNational(select, items, placeholder) {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>` + items.map(d => `<option value="DEP-${slugGeo(d.nom)}">${d.nom}</option>`).join('');
  }
  function fillLive(select, items, placeholder) {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>` + items.map(it => `<option value="${it.ID}">${it.Nom}</option>`).join('');
  }

  fillNational(depSel, GEO_BENIN, 'Sélectionner un département');
  if (comSel) fillLive(comSel, [], 'Sélectionner une commune');
  if (arrSel) fillLive(arrSel, [], 'Sélectionner un arrondissement');
  if (vilSel) fillLive(vilSel, [], 'Sélectionner un village');

  function selectedLabel(select) {
    if (!select || !select.value) return '';
    const opt = select.options[select.selectedIndex];
    return opt ? opt.textContent : '';
  }

  function emit() {
    if (onChange) onChange({
      depId: depSel ? depSel.value : '', depNom: selectedLabel(depSel),
      comId: comSel ? comSel.value : '', comNom: selectedLabel(comSel),
      arrId: arrSel ? arrSel.value : '', arrNom: selectedLabel(arrSel),
      vilId: vilSel ? vilSel.value : '', vilNom: selectedLabel(vilSel)
    });
  }

  if (depSel) depSel.addEventListener('change', () => {
    const coms = (liveGeo.communes || []).filter(c => c.DepartementId === depSel.value);
    if (comSel) fillLive(comSel, coms, 'Sélectionner une commune');
    if (arrSel) fillLive(arrSel, [], 'Sélectionner un arrondissement');
    if (vilSel) fillLive(vilSel, [], 'Sélectionner un village');
    emit();
  });
  if (comSel) comSel.addEventListener('change', () => {
    const arrs = (liveGeo.arrondissements || []).filter(a => a.CommuneId === comSel.value);
    if (arrSel) fillLive(arrSel, arrs, 'Sélectionner un arrondissement');
    if (vilSel) fillLive(vilSel, [], 'Sélectionner un village');
    emit();
  });
  if (arrSel) arrSel.addEventListener('change', () => {
    const vils = (liveGeo.villages || []).filter(v => v.ArrondissementId === arrSel.value);
    if (vilSel) fillLive(vilSel, vils, 'Sélectionner un village');
    emit();
  });
  if (vilSel) vilSel.addEventListener('change', emit);
}

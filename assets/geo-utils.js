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

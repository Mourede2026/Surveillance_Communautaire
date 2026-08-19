/**
 * Construit dynamiquement les formulaires 1 (alertes) et 2 (décès)
 * en reprenant fidèlement les rubriques des fiches papier du Bénin.
 */

const TYPES_ALERTE = [
  '1. Rougeole','2. Choléra','3. Méningite','4. PFA','5. FHV Lassa','6. FHV Ebola','7. Fièvre jaune',
  '8. Dengue','9. Anthrax','10. Shigellose','11. Grippes aviaires','12. Rage','13. COVID-19','14. Mpox',
  '15. Morsure de chien','16. Morsure de serpent','17. Morsure d\'autre animaux','18. Animaux malades',
  '19. Animaux morts','20. Autre événement inhabituel'
];

const SIGNES = ['Fièvre','Bouton sur le corps','Diarrhée aqueuse','Vomissement','Selles avec du sang',
  'Maux de tête','Saignements inexpliqués','Raideur nuque','Altération conscience','Bombement fontanelle',
  'Peur de la lumière','Peur de l\'eau ou des bruits de l\'eau','Convulsions','Yeux jaune','Fatigue intense',
  'Nausée','Maux de gorge','Toux','Douleurs abdominales','Manque d\'appétit',
  'Paralysie ou difficultés à marcher','Courbatures ou fatigues','Douleurs musculaires ou articulaires',
  'Présence de sang dans les urines','Irritabilité ou agressivité','Gonflement des ganglions',
  'Crachats teintés de sang','Lésions cutanées','Difficultés respiratoires'];

const TYPES_DECES = [
  {v:'1', l:'1 - Décès maternel'}, {v:'2', l:'2 - Décès de bébé (0-28 jours)'},
  {v:'3', l:'3 - Décès d\'enfant 1 mois à 1 an'}, {v:'4', l:'4 - Décès d\'enfant 1 à 5 ans'},
  {v:'5', l:'5 - Décès de personne de plus de 5 ans'}
];
const LIEUX_DECES = [
  {v:'1', l:'1 - Domicile'}, {v:'2', l:'2 - Accoucheuse'}, {v:'3', l:'3 - Lieu de culte'},
  {v:'4', l:'4 - Au cours du transport'}, {v:'5', l:'5 - À l\'étranger'}, {v:'6', l:'6 - Autre'}
];
const CIRCONSTANCES_DECES = [
  {v:'1', l:'1 - Grossesse/Avortement/Accouchement/Suites de couches'}, {v:'2', l:'2 - Maladie'},
  {v:'3', l:'3 - Accident de route'}, {v:'4', l:'4 - Accident domestique'}, {v:'5', l:'5 - Mort subite'},
  {v:'6', l:'6 - Violence'}, {v:'7', l:'7 - Autre'}
];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function geoHeader_(user, grappes) {
  grappes = grappes || [];
  let grappeField;
  if (grappes.length > 1) {
    grappeField = `<div class="field"><label>Grappe concernée</label><select name="grappeId" required>${grappes.map(g => `<option value="${g.ID}">N°${g.Numero}${g.Nom ? ' — ' + g.Nom : ''}</option>`).join('')}</select></div>`;
  } else if (grappes.length === 1) {
    grappeField = `<div class="field"><label>Grappe</label><input value="N°${grappes[0].Numero}${grappes[0].Nom ? ' — ' + grappes[0].Nom : ''}" disabled><input type="hidden" name="grappeId" value="${grappes[0].ID}"></div>`;
  } else {
    grappeField = `<div class="field" style="grid-column:1/-1"><p style="color:#C1432D;font-size:.85rem;margin:0">⚠️ Aucune grappe ne vous a été assignée — contactez votre ASCQ avant de notifier un cas.</p></div>`;
  }
  return `
  <fieldset>
    <legend>Localisation (pré-remplie depuis votre compte)</legend>
    <div class="grid grid-2">
      <div class="field"><label>Département</label><input value="${user.DepartementNom||''}" disabled></div>
      <div class="field"><label>Commune</label><input value="${user.CommuneNom||''}" disabled></div>
      <div class="field"><label>Arrondissement</label><input value="${user.ArrondissementNom||''}" disabled></div>
      <div class="field"><label>Village</label><input value="${user.VillageNom||''}" disabled></div>
      ${grappeField}
    </div>
  </fieldset>`;
}

function buildAlerteForm(form, user, grappes) {
  form.innerHTML = `
    <fieldset>
      <legend>Période</legend>
      <div class="grid grid-2">
        <div class="field"><label>Année</label><input name="annee" type="number" value="${new Date().getFullYear()}" required></div>
        <div class="field"><label>Semaine épidémiologique</label><input name="semaineEpi" type="number" required></div>
      </div>
    </fieldset>
    ${geoHeader_(user, grappes)}
    <fieldset>
      <legend>Identification du cas</legend>
      <div class="field"><label>Nom(s) & prénoms du cas</label><input name="nom" required></div>
      <div class="grid grid-2">
        <div class="field"><label>Sexe</label><select name="sexe"><option value="M">M</option><option value="F">F</option></select></div>
        <div class="field"><label>Téléphone du cas (ou parent)</label><input name="telephone"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Date de naissance (ou laisser vide)</label><input name="dateNaissance" type="date"></div>
        <div class="field"><label>Âge (si date de naissance inconnue)</label><input name="age" placeholder="Ex: 5 ans"></div>
      </div>
      <div class="field"><label>Adresse (repère, quartier...)</label><input name="adresse"></div>
    </fieldset>
    <fieldset>
      <legend>Type d'alerte</legend>
      <div class="field"><label>Type d'alerte</label>
        <select name="typeAlerte" required>${TYPES_ALERTE.map(t => `<option>${t}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Si "Autre", préciser</label><input name="autrePreciser"></div>
      <div class="grid grid-2">
        <div class="field"><label>Date de début de la maladie</label><input name="dateDebutMaladie" type="date" required></div>
        <div class="field"><label>Date de notification</label><input name="dateNotification" type="date" value="${todayISO()}" required></div>
      </div>
    </fieldset>
    <fieldset>
      <legend>Signes et symptômes (cocher tout ce qui s'applique)</legend>
      <div class="checks">${SIGNES.map(s => `<label><input type="checkbox" name="signes" value="${s}">${s}</label>`).join('')}</div>
    </fieldset>
    <fieldset>
      <legend>Ampleur de l'événement</legend>
      <div class="grid grid-4">
        <div class="field"><label>Personnes touchées</label><input name="personnesTouchees" type="number" min="0" value="1"></div>
        <div class="field"><label>Personnes décédées</label><input name="personnesMortes" type="number" min="0" value="0"></div>
        <div class="field"><label>Animaux malades</label><input name="animauxMalades" type="number" min="0" value="0"></div>
        <div class="field"><label>Animaux morts</label><input name="animauxMorts" type="number" min="0" value="0"></div>
      </div>
      <div class="field"><label>L'événement est-il en cours ?</label>
        <select name="enCours"><option value="Oui">Oui</option><option value="Non">Non</option></select>
      </div>
    </fieldset>
    <fieldset>
      <legend>Notificateur</legend>
      <div class="grid grid-2">
        <div class="field"><label>Nom prénom</label><input name="notifNomManuel" value="${user.Prenom} ${user.Nom}" disabled></div>
        <div class="field"><label>Centre de santé rattaché</label><input name="centreSante"></div>
      </div>
    </fieldset>
    <button type="submit" class="btn-block">Envoyer la notification d'alerte</button>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const signes = fd.getAll('signes');
    const payload = {
      annee: fd.get('annee'), semaineEpi: fd.get('semaineEpi'), mois: new Date().getMonth() + 1,
      departement: user.DepartementNom, zoneSanitaire: '', communeId: user.CommuneId, arrondissementId: user.ArrondissementId,
      villageId: user.VillageId, grappeId: fd.get('grappeId'), adresse: fd.get('adresse'), nom: fd.get('nom'), sexe: fd.get('sexe'),
      telephone: fd.get('telephone'), dateNaissance: fd.get('dateNaissance'), age: fd.get('age'),
      typeAlerte: fd.get('typeAlerte'), autrePreciser: fd.get('autrePreciser'),
      dateDebutMaladie: fd.get('dateDebutMaladie'), dateNotification: fd.get('dateNotification'),
      signes, personnesTouchees: fd.get('personnesTouchees'), personnesMortes: fd.get('personnesMortes'),
      animauxMalades: fd.get('animauxMalades'), animauxMorts: fd.get('animauxMorts'), enCours: fd.get('enCours'),
      titre: 'Relais Communautaire', centreSante: fd.get('centreSante')
    };
    try {
      await Api.call('submitAlerte', payload);
      toast('Alerte notifiée avec succès. Votre ASCQ a été informé.');
      form.reset();
    } catch (err) { toast(err.message, true); }
  });
}

function buildDecesForm(form, user, grappes) {
  form.innerHTML = `
    <fieldset>
      <legend>Période</legend>
      <div class="grid grid-2">
        <div class="field"><label>Année</label><input name="annee" type="number" value="${new Date().getFullYear()}" required></div>
        <div class="field"><label>Semaine épidémiologique</label><input name="semaineEpi" type="number" required></div>
      </div>
    </fieldset>
    ${geoHeader_(user, grappes)}
    <fieldset>
      <legend>Identification du/de la défunt(e)</legend>
      <div class="field"><label>Nom(s) & prénoms du défunt(e)</label><input name="nom" required></div>
      <div class="grid grid-2">
        <div class="field"><label>Nom d'un parent ou proche</label><input name="nomParent"></div>
        <div class="field"><label>Téléphone d'un parent ou proche</label><input name="telephoneParent"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Sexe</label><select name="sexe"><option value="M">M</option><option value="F">F</option></select></div>
        <div class="field"><label>Date de naissance (si connue)</label><input name="dateNaissance" type="date"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Âge au décès (années)</label><input name="ageAnnees" type="number" min="0"></div>
        <div class="field"><label>Âge au décès (mois, si &lt;1 an)</label><input name="ageMois" type="number" min="0"></div>
      </div>
    </fieldset>
    <fieldset>
      <legend>Circonstances du décès</legend>
      <div class="field"><label>Type de décès</label>
        <select name="typeDeces" required>${TYPES_DECES.map(t => `<option value="${t.v}">${t.l}</option>`).join('')}</select>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Date du décès</label><input name="dateDeces" type="date" required></div>
        <div class="field"><label>Date de notification</label><input name="dateNotification" type="date" value="${todayISO()}" required></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Lieu du décès</label>
          <select name="lieuDeces">${LIEUX_DECES.map(t => `<option value="${t.v}">${t.l}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Circonstances (selon les parents)</label>
          <select name="circonstances">${CIRCONSTANCES_DECES.map(t => `<option value="${t.v}">${t.l}</option>`).join('')}</select>
        </div>
      </div>
    </fieldset>
    <button type="submit" class="btn-block">Envoyer la notification de décès</button>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      annee: fd.get('annee'), semaineEpi: fd.get('semaineEpi'), mois: new Date().getMonth() + 1,
      departement: user.DepartementNom, zoneSanitaire: '', communeId: user.CommuneId, arrondissementId: user.ArrondissementId,
      villageId: user.VillageId, grappeId: fd.get('grappeId'), nom: fd.get('nom'), nomParent: fd.get('nomParent'), telephoneParent: fd.get('telephoneParent'),
      sexe: fd.get('sexe'), dateNaissance: fd.get('dateNaissance'), ageAnnees: fd.get('ageAnnees'), ageMois: fd.get('ageMois'),
      typeDeces: fd.get('typeDeces'), dateDeces: fd.get('dateDeces'), dateNotification: fd.get('dateNotification'),
      lieuDeces: fd.get('lieuDeces'), circonstances: fd.get('circonstances'), titre: 'Relais Communautaire'
    };
    try {
      await Api.call('submitDeces', payload);
      toast('Décès notifié avec succès. Votre ASCQ a été informé.');
      form.reset();
    } catch (err) { toast(err.message, true); }
  });
}

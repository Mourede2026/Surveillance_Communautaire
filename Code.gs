/**
 * PLATEFORME DE SURVEILLANCE A BASE COMMUNAUTAIRE - BENIN
 * Backend Google Apps Script.
 * Sert d'API JSON pour le frontend (hebergé sur GitHub Pages) et
 * enregistre toutes les données dans ce classeur Google Sheets.
 *
 * INSTALLATION : voir README.md à la racine du projet.
 *
 * HIÉRARCHIE DES COMPTES (du plus haut au plus bas) :
 *   NATIONAL  → RCSE  → PF_CNLS_TP  → ASCQ  → RC
 *
 * HIÉRARCHIE GÉOGRAPHIQUE STANDARD, importée UNE FOIS par le compte NATIONAL (du plus
 * large au plus fin) :
 *   Département → Commune → Arrondissement → Village
 * Les Grappes (sous-unité de village) ne font PAS partie de cette liste nationale : elles
 * sont créées localement par les ASCQ au moment où ils enregistrent leurs RC.
 *
 * NIVEAU GÉOGRAPHIQUE DE CHAQUE COMPTE — chaque niveau administratif est rattaché à un
 * regroupement de positions du niveau immédiatement inférieur (jamais un niveau unique
 * imposé), assigné DÈS LA CRÉATION du compte par son supérieur direct, afin qu'il puisse
 * immédiatement voir et utiliser la géographie déjà importée pour paramétrer ses propres
 * subalternes (aucune étape d'assignation séparée requise avant de pouvoir travailler) :
 *   - RCSE      : une "Zone Sanitaire" = un ou plusieurs COMMUNES (pas forcément dans le
 *                 même département — les zones sanitaires du Bénin peuvent regrouper des
 *                 communes de départements différents), choisies par le NATIONAL.
 *   - PF_CNLS_TP: UNE SEULE commune, choisie par le RCSE parmi les communes de sa zone.
 *   - ASCQ      : un ou plusieurs arrondissements, choisis par le PF parmi ceux de sa commune.
 *   - RC        : un ou plusieurs grappes (créées à la volée), choisies par l'ASCQ parmi
 *                 les villages de son/ses arrondissement(s).
 * Le modèle de périmètre (feuille Perimetres) reste générique : TypeCible peut être
 * 'Commune' | 'Arrondissement' | 'Grappe'. Seul le PF reste limité à UNE SEULE commune ;
 * tous les autres niveaux acceptent plusieurs périmètres pour un même compte.
 */

// ============================================================
// CONFIGURATION
// ============================================================

const SHEETS = {
  USERS: 'Utilisateurs',
  DEPARTEMENTS: 'Departements',
  COMMUNES: 'Communes',
  ARRONDISSEMENTS: 'Arrondissements',
  VILLAGES: 'Villages',
  GRAPPES: 'Grappes',
  PERIMETRES: 'Perimetres',
  ALERTES: 'Alertes',
  DECES: 'Deces',
  INVESTIGATIONS: 'Investigations',
  RAPPORTS: 'RapportsHebdo',
  CALENDRIER: 'CalendrierEpi',
  NOTIFICATIONS: 'Notifications',
  SESSIONS: 'Sessions',
  JOURNAL: 'JournalAssignations',
  SUIVIS: 'SuivisGroupes'
};

const ROLES = {
  RC: 'RC',             // Relais Communautaire (niveau : Grappe / Village)
  ASCQ: 'ASCQ',          // Agent de Santé Communautaire Qualifié (niveau : Arrondissement)
  PF: 'PF_CNLS_TP',      // Point Focal CNLS-TP (niveau : Commune)
  RCSE: 'RCSE',          // Coordination de zone sanitaire (niveau : Zone sanitaire = un groupe de communes)
  DEPARTEMENT: 'DEPARTEMENT', // Coordination départementale (niveau : Département) — chapeaute les RCSE de son département
  NATIONAL: 'NATIONAL'   // Compte national — coiffe tout, dessert les départements, gère la géographie standard
};

// Niveau géographique "typique" de chaque rôle — sert de repère pour l'UI et les
// contrôles de cohérence, mais le modèle de périmètre reste générique (voir en-tête).
const GEO_TYPIQUE = {
  [ROLES.NATIONAL]: null,
  [ROLES.RCSE]: 'Commune',       // "Zone Sanitaire" = un regroupement de communes
  [ROLES.PF]: 'Commune',
  [ROLES.ASCQ]: 'Arrondissement',
  [ROLES.RC]: 'Grappe'
};

// Qui a le droit de créer quel rôle (hiérarchie stricte à un seul niveau en dessous)
const CAN_CREATE = {
  [ROLES.NATIONAL]: [ROLES.DEPARTEMENT],
  [ROLES.DEPARTEMENT]: [ROLES.RCSE],
  [ROLES.RCSE]: [ROLES.PF],
  [ROLES.PF]: [ROLES.ASCQ],
  [ROLES.ASCQ]: [ROLES.RC]
};

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12h

// Colonnes de chaque feuille (ordre = ordre des colonnes dans le Sheet)
const COLS = {
  Utilisateurs: ['ID','Nom','Prenom','Telephone','MotDePasse','Role','ResponsableId',
    'DepartementId','CommuneId','ArrondissementId','VillageId','GrappeId',
    'DepartementNom','CommuneNom','ArrondissementNom','VillageNom','GrappeNom',
    'ZoneSanitaireNom','Actif','DateCreation','CreePar'],
  Communes: ['ID','Nom','DepartementId','DepartementNom'],
  Arrondissements: ['ID','Nom','CommuneId','CommuneNom'],
  Villages: ['ID','Nom','ArrondissementId','ArrondissementNom'],
  Grappes: ['ID','Nom','VillageId','VillageNom'],
  Perimetres: ['ID','UserId','TypeCible','CibleId','AssignePar','Date'],
  Alertes: ['ID','Annee','SemaineEpi','Mois','NPI','NAlerte','Departement','ZoneSanitaire',
    'CommuneId','ArrondissementId','VillageId','NGrappe','Adresse','Nom','Sexe','Telephone',
    'DateNaissance','Age','GPSLon','GPSLat','TypeAlerte','AutrePreciser','DateDebutMaladie',
    'DateNotification','Signes','PersonnesTouchees','PersonnesMortes','AnimauxMalades',
    'AnimauxMorts','EnCours','NotificateurId','NotificateurNom','Titre','CentreSante',
    'DateSaisie','Statut','InvestigationId'],
  Deces: ['ID','Annee','SemaineEpi','Mois','NPI','NDeces','Departement','ZoneSanitaire',
    'CommuneId','ArrondissementId','VillageId','NGrappe','Adresse','Nom','NomParent',
    'TelephoneParent','DateNaissance','AgeAnnees','AgeMois','AgeJours','Sexe','GPSLon','GPSLat',
    'TypeDeces','DateDeces','DateNotification','LieuDeces','Circonstances','CauseProbable',
    'NotificateurId','NotificateurNom','Titre','CentreSante','DateSaisie','Statut','InvestigationId'],
  Investigations: ['ID','RefType','RefId','ASCQId','Departement','ZoneSanitaire','CommuneId',
    'ArrondissementId','VillageId','Relais','TelRelais','ASCQNom','TelASCQ','GPSLon','GPSLat',
    'EvenementAvere','Source','Maladie','Description','Circonstances','DateSurvenue',
    'DateNotification','DateInvestigation','CasParCategorie','DecesParCategorie','Actions','DateSaisie'],
  RapportsHebdo: ['ID','Annee','SemaineEpi','Niveau','CompteId','CommuneId','ArrondissementId',
    'VillageId','NbAlertesDetectees','NbPersonnesTouchees','NbPersonnesDecedees',
    'NbAlertesVerifiees24_48h','NbAlertesAverees','DecesMaternel','DecesNeonatal',
    'DecesInfantile','DecesInfantoJuvenile','Deces5ansPlus','ActionsMenees','GenereLe'],
  CalendrierEpi: ['Annee','SemaineEpi','DateDebut','DateFin'],
  Notifications: ['ID','DestinataireId','Type','RefId','Message','Lu','DateCreation'],
  Sessions: ['Token','UserId','Expire'],
  JournalAssignations: ['ID','Type','CibleId','AssigneA','AssignePar','Date'],
  SuivisGroupes: ['ID','AscqId','AscqNom','ArrondissementId','ArrondissementNom','Date','Themes',
    'RcPresentsIds','RcPresentsNoms','NbPresents','PhotosUrls','Commentaires','DateCreation']
};

// ============================================================
// ENTREE API
// ============================================================

function doGet(e) {
  return json_({ ok: true, message: 'API Surveillance Communautaire - opérationnelle' });
}

function doPost(e) {
  try {
    reinitialiserCacheFeuilles_(); // une exécution = un cache neuf, jamais partagé entre requêtes
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;
    const payload = body.payload || {};
    const token = body.token;

    ensureSchema_(); // crée les feuilles/entêtes manquants au besoin

    const PUBLIC_ACTIONS = ['login', 'ping'];
    let user = null;
    if (!PUBLIC_ACTIONS.includes(action)) {
      user = getUserByToken_(token);
      if (!user) return json_({ ok: false, error: 'Session invalide ou expirée. Reconnectez-vous.' });
    }

    const handlers = {
      ping: () => ({ ok: true }),
      login: () => login_(payload),
      logout: () => { deleteSession_(token); return { ok: true }; },

      createUser: () => createUser_(user, payload),
      updateUser: () => updateUser_(user, payload),
      deleteUser: () => deleteUser_(user, payload),
      listUsers: () => ({ ok: true, users: listUsers_(user) }),
      setUserActive: () => setUserActive_(user, payload),

      createCommune: () => createGeo_(user, 'Communes', payload, [ROLES.DEPARTEMENT, ROLES.RCSE, ROLES.NATIONAL]),
      createArrondissement: () => createGeo_(user, 'Arrondissements', payload, [ROLES.DEPARTEMENT, ROLES.RCSE, ROLES.NATIONAL]),
      createVillage: () => createGeo_(user, 'Villages', payload, [ROLES.DEPARTEMENT, ROLES.RCSE, ROLES.NATIONAL]),
      createGrappe: () => createGeo_(user, 'Grappes', payload, [ROLES.ASCQ, ROLES.PF, ROLES.RCSE, ROLES.DEPARTEMENT, ROLES.NATIONAL]),
      listGeo: () => ({ ok: true, geo: listGeo_() }),
      importGeoBulk: () => importGeoBulk_(user, payload),

      assignPerimetre: () => assignPerimetre_(user, payload),
      assignCommuneRcse: () => assignCommuneRcse_(user, payload),
      listPerimetres: () => ({ ok: true, perimetres: listPerimetres_(user) }),
      assignArrondissementAscq: () => assignArrondissementAscq_(user, payload),
      listArrondissementsAscq: () => ({ ok: true, perimetres: listArrondissementsDesAscq_(user) }),
      assignGrappeRc: () => assignGrappeRc_(user, payload),
      retirerGrappeRc: () => retirerGrappeRc_(user, payload),
      listGrappesDuRc: () => ({ ok: true, grappes: listGrappesDuRc_(user, payload) }),
      listGrappesRc: () => ({ ok: true, perimetres: listGrappesDesRc_(user) }),
      importActeursBulk: () => importActeursBulk_(user, payload),

      submitAlerte: () => submitAlerte_(user, payload),
      submitDeces: () => submitDeces_(user, payload),
      submitInvestigation: () => submitInvestigation_(user, payload),
      submitSuiviGroupe: () => submitSuiviGroupe_(user, payload),
      listSuivisGroupes: () => ({ ok: true, suivis: listSuivisGroupes_(user) }),

      listAlertes: () => ({ ok: true, alertes: listScoped_(SHEETS.ALERTES, user) }),
      listDeces: () => ({ ok: true, deces: listScoped_(SHEETS.DECES, user) }),
      listInvestigations: () => ({ ok: true, investigations: listScoped_(SHEETS.INVESTIGATIONS, user) }),
      listRapports: () => ({ ok: true, rapports: listRapports_(user) }),
      listPerimetreRapport: () => ({ ok: true, perimetre: listPerimetreRapport_(user) }),
      listRapportDetail: () => Object.assign({ ok: true }, listRapportDetail_(user, payload)),

      importCalendrier: () => importCalendrier_(user, payload),
      clearCalendrier: () => clearCalendrier_(user, payload),
      listCalendrier: () => ({ ok: true, calendrier: readSheet_(SHEETS.CALENDRIER) }),

      listNotifications: () => ({ ok: true, notifications: listNotifications_(user) }),
      markNotificationRead: () => markNotificationRead_(user, payload),
      marquerToutesNotificationsLues: () => ({ ok: true, ...marquerToutesNotificationsLues_(user) }),

      getDashboard: () => ({ ok: true, dashboard: getDashboard_(user) }),
      getDashboardDetail: () => ({ ok: true, ...getDashboardDetail_(user) }),
      listCouverture: () => ({ ok: true, couverture: listCouverture_(user) }),
      genererRapportHebdo: () => genererRapportHebdo_(user, payload)
    };

    if (!handlers[action]) return json_({ ok: false, error: 'Action inconnue: ' + action });
    const result = handlers[action]();
    return json_(Object.assign({ ok: true }, result));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SCHEMA / UTILITAIRES FEUILLES
// ============================================================

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function ensureSchema_() {
  const ss = ss_();
  Object.keys(COLS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.appendRow(COLS[name]);
      sh.setFrozenRows(1);
    } else if (sh.getLastRow() === 0) {
      sh.appendRow(COLS[name]);
      sh.setFrozenRows(1);
    }
  });
  // Compte NATIONAL racine par défaut si aucun utilisateur n'existe
  const usersSh = ss.getSheetByName(SHEETS.USERS);
  if (usersSh.getLastRow() <= 1) {
    appendRow_(SHEETS.USERS, {
      ID: 'U-NAT-0001', Nom: 'Admin', Prenom: 'National', Telephone: '61790075',
      MotDePasse: 'national2026', Role: ROLES.NATIONAL, ResponsableId: '',
      Actif: true, DateCreation: nowStr_(), CreePar: 'SYSTEME'
    });
  }
}

// Cache des feuilles lues, valable pour UNE SEULE exécution du script (une requête = une
// exécution Apps Script). Sans lui, une même feuille (ex. Utilisateurs, Alertes) pouvait être
// relue intégralement des dizaines de fois au sein d'une seule requête — en particulier lors de
// la génération des rapports hebdomadaires manquants (une semaine = plusieurs lectures
// complètes ; plusieurs semaines manquantes = ce nombre multiplié d'autant), ce qui rendait
// l'actualisation des données très lente. Réinitialisé en tête de doGet_/doPost_ (jamais réutilisé
// d'une requête à l'autre, pour ne jamais servir de données obsolètes après une écriture).
let __sheetCache_ = {};
function reinitialiserCacheFeuilles_() { __sheetCache_ = {}; }

function readSheet_(name) {
  if (__sheetCache_[name]) return __sheetCache_[name];
  const sh = ss_().getSheetByName(name);
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  const rows = values.filter(r => r.join('') !== '').map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  __sheetCache_[name] = rows;
  return rows;
}

// Invalide le cache d'une feuille après une écriture, pour qu'une relecture ultérieure DANS LA
// MÊME requête voie bien les données à jour (rare, mais certaines actions lisent puis écrivent
// plusieurs fois de suite sur la même feuille).
function invaliderCacheFeuille_(name) { delete __sheetCache_[name]; }

function appendRow_(sheetName, obj) {
  const sh = ss_().getSheetByName(sheetName);
  const headers = COLS[sheetName];
  const row = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
  sh.appendRow(row);
  invaliderCacheFeuille_(sheetName);
  return obj;
}

function updateRowById_(sheetName, id, changes, idField) {
  idField = idField || 'ID';
  const sh = ss_().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idField);
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      // Une seule écriture pour toute la ligne (setValues sur la plage entière) plutôt qu'un
      // setValue() par champ modifié — chaque setValue() est un aller-retour à part avec
      // Google Sheets ; les regrouper accélère nettement les mises à jour (fiches
      // d'investigation, comptes utilisateurs, statuts...).
      const ligne = values[r].slice();
      headers.forEach((h, c) => { if (changes[h] !== undefined) ligne[c] = changes[h]; });
      sh.getRange(r + 1, 1, 1, headers.length).setValues([ligne]);
      invaliderCacheFeuille_(sheetName);
      return true;
    }
  }
  return false;
}

function newId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}

function nowStr_() {
  return Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyyy-MM-dd HH:mm:ss');
}

// Identifiants déterministes pour la géographie (même logique que geo-utils.js côté frontend :
// fonction slugGeo). Garantit que les IDs calculés côté client correspondent à ceux stockés ici.
function slug_(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function geoIds_(depNom, comNom, arrNom, vilNom, grpNom) {
  const depId = 'DEP-' + slug_(depNom);
  const comId = depId + '__COM-' + slug_(comNom);
  const arrId = comId + '__ARR-' + slug_(arrNom);
  const vilId = vilNom !== undefined ? arrId + '__VIL-' + slug_(vilNom) : undefined;
  const grpId = (vilId !== undefined && grpNom !== undefined) ? vilId + '__GRP-' + slug_(grpNom) : undefined;
  return { depId, comId, arrId, vilId, grpId };
}

// ============================================================
// AUTHENTIFICATION
// ============================================================

function login_(payload) {
  const users = readSheet_(SHEETS.USERS);
  const u = users.find(x => String(x.Telephone) === String(payload.telephone) && x.Actif !== false && x.Actif !== 'FALSE');
  if (!u) return { ok: false, error: 'Numéro de téléphone inconnu ou compte désactivé.' };
  if (String(u.MotDePasse) !== String(payload.motDePasse)) return { ok: false, error: 'Mot de passe incorrect.' };

  const token = Utilities.getUuid();
  appendRow_(SHEETS.SESSIONS, { Token: token, UserId: u.ID, Expire: Date.now() + SESSION_DURATION_MS });
  delete u.MotDePasse;
  return { ok: true, token: token, user: u };
}

function deleteSession_(token) {
  const sh = ss_().getSheetByName(SHEETS.SESSIONS);
  const values = sh.getDataRange().getValues();
  for (let r = values.length - 1; r >= 1; r--) {
    if (values[r][0] === token) sh.deleteRow(r + 1);
  }
}

function getUserByToken_(token) {
  if (!token) return null;
  const sessions = readSheet_(SHEETS.SESSIONS);
  const s = sessions.find(x => x.Token === token);
  if (!s || Number(s.Expire) < Date.now()) return null;
  const users = readSheet_(SHEETS.USERS);
  const u = users.find(x => x.ID === s.UserId);
  if (!u) return null;
  delete u.MotDePasse;
  return u;
}

// ============================================================
// GESTION DES UTILISATEURS (hiérarchie: NATIONAL > RCSE > PF > ASCQ > RC)
// ============================================================

function createUser_(actor, p) {
  const allowed = CAN_CREATE[actor.Role] || [];
  if (!allowed.includes(p.role)) {
    return { ok: false, error: `Un compte ${actor.Role} ne peut pas créer de compte ${p.role}.` };
  }
  if (!p.telephone || !p.motDePasse || !p.nom || !p.prenom) {
    return { ok: false, error: 'Nom, prénom, téléphone et mot de passe sont obligatoires.' };
  }
  if (p.role === ROLES.DEPARTEMENT && !p.departementId) {
    return { ok: false, error: 'Sélectionnez le département pris en charge par ce compte.' };
  }
  if (p.role === ROLES.RCSE && (!Array.isArray(p.communeIds) || !p.communeIds.length)) {
    return { ok: false, error: 'Sélectionnez au moins une commune pour composer la zone sanitaire de ce RCSE.' };
  }
  // Un compte DEPARTEMENT ne peut créer des RCSE qu'à l'intérieur de SON département : toutes
  // les communes choisies pour la zone sanitaire doivent appartenir à ce département.
  if (p.role === ROLES.RCSE && actor.Role === ROLES.DEPARTEMENT) {
    const communesSheet = readSheet_(SHEETS.COMMUNES);
    const horsDepartement = p.communeIds.some(id => {
      const c = communesSheet.find(x => x.ID === id);
      return !c || c.DepartementId !== actor.DepartementId;
    });
    if (horsDepartement) return { ok: false, error: 'Toutes les communes de la zone sanitaire doivent appartenir à votre département.' };
  }
  const users = readSheet_(SHEETS.USERS);
  if (users.some(u => String(u.Telephone) === String(p.telephone))) {
    return { ok: false, error: 'Ce numéro de téléphone est déjà utilisé.' };
  }
  // Le département d'un RCSE (et donc de tout ce qui est créé sous lui) vient TOUJOURS du compte
  // DEPARTEMENT qui le crée — une seule source de vérité, plutôt que d'être recalculé à partir
  // des communes choisies (ce qui pouvait produire des incohérences, ex. département affiché =
  // nom d'une commune, sur les formulaires d'alerte/décès en aval).
  const departementId = (p.role === ROLES.RCSE && actor.Role === ROLES.DEPARTEMENT) ? actor.DepartementId : (p.departementId || '');
  const departementNom = (p.role === ROLES.RCSE && actor.Role === ROLES.DEPARTEMENT) ? actor.DepartementNom : (p.departementNom || '');
  const newUser = {
    ID: newId_('U'), Nom: p.nom, Prenom: p.prenom, Telephone: p.telephone,
    MotDePasse: p.motDePasse, Role: p.role, ResponsableId: actor.ID,
    DepartementId: departementId, CommuneId: p.communeId || '',
    ArrondissementId: p.arrondissementId || '', VillageId: p.villageId || '', GrappeId: p.grappeId || '',
    DepartementNom: departementNom, CommuneNom: p.communeNom || '',
    ArrondissementNom: p.arrondissementNom || '', VillageNom: p.villageNom || '', GrappeNom: p.grappeNom || '',
    ZoneSanitaireNom: p.zoneSanitaireNom || '',
    Actif: true, DateCreation: nowStr_(), CreePar: actor.ID
  };
  appendRow_(SHEETS.USERS, newUser);

  // Le "poste" choisi à la création est enregistré comme un périmètre au même titre que ceux
  // qui pourront être assignés ensuite (un compte peut couvrir plusieurs positions du même
  // niveau — voir assignCommuneRcse_ / assignArrondissementAscq_ / assignGrappeRc_ — à
  // l'exception du PF CNLS-TP qui reste rattaché à une seule commune, et du DEPARTEMENT qui reste
  // rattaché à un seul département). La zone sanitaire d'un RCSE est immédiatement fonctionnelle
  // dès la création : aucune étape d'assignation séparée n'est nécessaire avant qu'il puisse voir
  // sa géographie et paramétrer ses PF.
  if (newUser.Role === ROLES.RCSE) {
    const perimRows = p.communeIds.map(comId => [newId_('PER'), newUser.ID, 'Commune', comId, actor.ID, nowStr_()]);
    appendRowsBulk_(SHEETS.PERIMETRES, perimRows);
  } else if (newUser.Role === ROLES.ASCQ && newUser.ArrondissementId) {
    appendRow_(SHEETS.PERIMETRES, {
      ID: newId_('PER'), UserId: newUser.ID, TypeCible: 'Arrondissement', CibleId: newUser.ArrondissementId,
      AssignePar: actor.ID, Date: nowStr_()
    });
  } else if (newUser.Role === ROLES.RC && newUser.GrappeId) {
    appendRow_(SHEETS.PERIMETRES, {
      ID: newId_('PER'), UserId: newUser.ID, TypeCible: 'Grappe', CibleId: newUser.GrappeId,
      AssignePar: actor.ID, Date: nowStr_()
    });
  }
  delete newUser.MotDePasse;
  return { ok: true, user: newUser };
}

// ============================================================
// IMPORT EN MASSE D'ACTEURS (RCSE, PF CNLS-TP, ASCQ, RC) PAR SITE D'INTERVENTION
// ============================================================
// Même règle de hiérarchie que createUser_ (CAN_CREATE) : NATIONAL importe des RCSE, un RCSE
// importe des PF, un PF importe des ASCQ, un ASCQ importe des RC. Chaque ligne ne fournit que
// le(s) niveau(x) géographique(s) non déjà connu(s) de l'acteur qui importe — les niveaux plus
// hauts de sa hiérarchie sont hérités automatiquement de son propre compte, exactement comme
// pour la création unitaire :
//  - NATIONAL -> RCSE  : zoneSanitaireNom + communesNoms (communes séparées par " ; ", qui
//    composent la zone sanitaire de ce RCSE — restreintes aux communes déjà importées)
//  - RCSE     -> PF    : communeNom (site = commune ; restreinte aux communes de la zone du RCSE)
//  - PF       -> ASCQ  : arrondissementNom (site = arrondissement ; département/commune = ceux du PF)
//  - ASCQ     -> RC    : villageNom (+ arrondissementNom optionnel pour désambiguïser si l'ASCQ couvre
//    plusieurs arrondissements et qu'un même nom de village existe dans plusieurs d'entre eux).
//    L'assignation d'une grappe précise à un RC importé en masse se fait ensuite via
//    assignGrappeRc_ (formulaire dédié), pour garder cet import simple.
// Les doublons (numéro de téléphone déjà utilisé — dans le Sheet ou dans le même import) sont
// ignorés et remontés dans "skipped" au lieu de faire échouer tout l'import.
function importActeursBulk_(actor, p) {
  const role = p.role;
  const allowed = CAN_CREATE[actor.Role] || [];
  if (!allowed.includes(role)) {
    return { ok: false, error: `Un compte ${actor.Role} ne peut pas importer de compte ${role}.` };
  }
  const rows = Array.isArray(p.rows) ? p.rows : [];
  if (!rows.length) return { ok: false, error: 'Aucune ligne à importer.' };

  const users = readSheet_(SHEETS.USERS);
  const existingPhones = {};
  users.forEach(u => { existingPhones[String(u.Telephone).trim()] = true; });

  let toutesCommunes = null, communesScope = null, arrsScope = null, vilsScope = null;
  if (role === ROLES.RCSE) {
    toutesCommunes = readSheet_(SHEETS.COMMUNES);
    // Un compte DEPARTEMENT ne peut importer de RCSE que dans SON département.
    if (actor.Role === ROLES.DEPARTEMENT) toutesCommunes = toutesCommunes.filter(c => c.DepartementId === actor.DepartementId);
  }
  if (role === ROLES.PF) {
    const mesCom = new Set(communesOfRcse_(actor.ID));
    communesScope = readSheet_(SHEETS.COMMUNES).filter(c => mesCom.has(c.ID));
  }
  if (role === ROLES.ASCQ) arrsScope = readSheet_(SHEETS.ARRONDISSEMENTS).filter(a => a.CommuneId === actor.CommuneId);
  if (role === ROLES.RC) {
    const mesArr = arrondissementsOfAscq_(actor.ID);
    vilsScope = readSheet_(SHEETS.VILLAGES).filter(v => mesArr.includes(v.ArrondissementId));
  }

  const newUserRows = [];
  const newPerimetreRows = [];
  const skipped = [];
  const seenPhones = {};
  let created = 0;

  rows.forEach((row, idx) => {
    const line = idx + 1;
    const nom = String(row.nom || '').trim();
    const prenom = String(row.prenom || '').trim();
    const telephone = String(row.telephone || '').trim();
    const motDePasse = String(row.motDePasse || '').trim();
    if (!nom || !prenom || !telephone || !motDePasse) {
      skipped.push({ line, raison: 'Nom, prénom, téléphone ou mot de passe manquant.' }); return;
    }
    if (existingPhones[telephone] || seenPhones[telephone]) {
      skipped.push({ line, raison: `Téléphone ${telephone} déjà utilisé (doublon).` }); return;
    }

    let dep = { id: '', nom: '' }, com = { id: '', nom: '' }, arr = { id: '', nom: '' }, vil = { id: '', nom: '' };
    let zoneSanitaireNom = '', communeIdsRcse = [];

    if (role === ROLES.RCSE) {
      zoneSanitaireNom = String(row.zoneSanitaireNom || '').trim();
      const communesNoms = String(row.communesNoms || '').split(';').map(s => s.trim()).filter(Boolean);
      if (!zoneSanitaireNom || !communesNoms.length) { skipped.push({ line, raison: 'Nom de la zone sanitaire et au moins une commune requis (communes séparées par ";").' }); return; }
      const introuvables = [];
      communesNoms.forEach(cn => {
        const c = toutesCommunes.find(x => x.Nom.toLowerCase() === cn.toLowerCase());
        if (c) communeIdsRcse.push(c.ID); else introuvables.push(cn);
      });
      if (introuvables.length) { skipped.push({ line, raison: `Commune(s) introuvable(s) (ou hors de votre département) : ${introuvables.join(', ')}.` }); return; }
      // Le département d'un RCSE vient toujours du compte DEPARTEMENT qui l'importe (une seule
      // source de vérité — voir createUser_).
      if (actor.Role === ROLES.DEPARTEMENT) dep = { id: actor.DepartementId, nom: actor.DepartementNom };
    } else if (role === ROLES.PF) {
      const comNom = String(row.communeNom || '').trim();
      if (!comNom) { skipped.push({ line, raison: 'Commune requise.' }); return; }
      const c = communesScope.find(x => x.Nom.toLowerCase() === comNom.toLowerCase());
      if (!c) { skipped.push({ line, raison: `Commune "${comNom}" introuvable dans votre/vos département(s).` }); return; }
      dep = { id: c.DepartementId, nom: c.DepartementNom }; com = { id: c.ID, nom: c.Nom };
    } else if (role === ROLES.ASCQ) {
      const arrNom = String(row.arrondissementNom || '').trim();
      if (!arrNom) { skipped.push({ line, raison: 'Arrondissement requis.' }); return; }
      const a = arrsScope.find(x => x.Nom.toLowerCase() === arrNom.toLowerCase());
      if (!a) { skipped.push({ line, raison: `Arrondissement "${arrNom}" introuvable dans votre commune.` }); return; }
      dep = { id: actor.DepartementId, nom: actor.DepartementNom }; com = { id: actor.CommuneId, nom: actor.CommuneNom };
      arr = { id: a.ID, nom: a.Nom };
    } else if (role === ROLES.RC) {
      const vilNom = String(row.villageNom || '').trim();
      const arrHint = String(row.arrondissementNom || '').trim();
      if (!vilNom) { skipped.push({ line, raison: 'Village requis.' }); return; }
      let matches = vilsScope.filter(x => x.Nom.toLowerCase() === vilNom.toLowerCase());
      if (matches.length > 1 && arrHint) matches = matches.filter(x => x.ArrondissementNom.toLowerCase() === arrHint.toLowerCase());
      if (!matches.length) { skipped.push({ line, raison: `Village "${vilNom}" introuvable dans votre/vos arrondissement(s).` }); return; }
      if (matches.length > 1) { skipped.push({ line, raison: `Village "${vilNom}" ambigu (plusieurs arrondissements) — précisez la colonne Arrondissement.` }); return; }
      const v = matches[0];
      dep = { id: actor.DepartementId, nom: actor.DepartementNom }; com = { id: actor.CommuneId, nom: actor.CommuneNom };
      arr = { id: v.ArrondissementId, nom: v.ArrondissementNom }; vil = { id: v.ID, nom: v.Nom };
    }

    const newUser = {
      ID: newId_('U') + '-' + idx, Nom: nom, Prenom: prenom, Telephone: telephone, MotDePasse: motDePasse,
      Role: role, ResponsableId: actor.ID,
      DepartementId: dep.id, CommuneId: com.id, ArrondissementId: arr.id, VillageId: vil.id, GrappeId: '',
      DepartementNom: dep.nom, CommuneNom: com.nom, ArrondissementNom: arr.nom, VillageNom: vil.nom, GrappeNom: '',
      ZoneSanitaireNom: zoneSanitaireNom,
      Actif: true, DateCreation: nowStr_(), CreePar: actor.ID
    };
    newUserRows.push(COLS.Utilisateurs.map(h => (newUser[h] !== undefined ? newUser[h] : '')));
    if (role === ROLES.RCSE && communeIdsRcse.length) {
      communeIdsRcse.forEach(comId => {
        const perimetre = { ID: newId_('PER') + '-' + idx + '-' + comId, UserId: newUser.ID, TypeCible: 'Commune', CibleId: comId, AssignePar: actor.ID, Date: nowStr_() };
        newPerimetreRows.push(COLS.Perimetres.map(h => (perimetre[h] !== undefined ? perimetre[h] : '')));
      });
    } else if (role === ROLES.ASCQ && arr.id) {
      const perimetre = { ID: newId_('PER') + '-' + idx, UserId: newUser.ID, TypeCible: 'Arrondissement', CibleId: arr.id, AssignePar: actor.ID, Date: nowStr_() };
      newPerimetreRows.push(COLS.Perimetres.map(h => (perimetre[h] !== undefined ? perimetre[h] : '')));
    }
    seenPhones[telephone] = true;
    created++;
  });

  if (newUserRows.length) appendRowsBulk_(SHEETS.USERS, newUserRows);
  if (newPerimetreRows.length) appendRowsBulk_(SHEETS.PERIMETRES, newPerimetreRows);

  return { ok: true, created, skipped };
}

// Modifier ou supprimer un compte est réservé à celui qui l'a créé LUI-MÊME (CreePar) — pas à
// tout superviseur indirect — ainsi qu'au compte NATIONAL qui gère l'ensemble de la plateforme.
// C'est plus restrictif que isSupervisorOf_ (qui autorise toute la chaîne au-dessus), utilisé
// lui pour la simple activation/désactivation et pour la visibilité en lecture.
function canManageUser_(actor, target) {
  return actor.Role === ROLES.NATIONAL || target.CreePar === actor.ID;
}

function updateUser_(actor, p) {
  const users = readSheet_(SHEETS.USERS);
  const target = users.find(u => u.ID === p.id);
  if (!target) return { ok: false, error: 'Utilisateur introuvable.' };
  // Modifier (corriger nom/téléphone/géo/mot de passe) est autorisé pour TOUT superviseur, direct
  // ou indirect (ex. un RCSE peut corriger un ASCQ ou un RC de sa zone, pas seulement les comptes
  // qu'il a personnellement créés) — contrairement à la suppression, qui reste réservée au
  // créateur direct (canManageUser_), plus destructrice.
  if (!isSupervisorOf_(actor, target) && actor.ID !== target.ID) {
    return { ok: false, error: 'Non autorisé à modifier ce compte : il ne dépend pas de vous.' };
  }
  const changes = {};
  ['Nom', 'Prenom', 'Telephone'].forEach(f => { if (p[f] !== undefined) changes[f] = p[f]; });
  // Les champs géographiques arrivent en camelCase (departementId, communeNom...) — même
  // convention que createUser_ — et non en PascalCase comme les colonnes du Sheet ; on les
  // fait donc correspondre explicitement plutôt que de comparer les noms tels quels.
  const champsGeo = {
    departementId: 'DepartementId', departementNom: 'DepartementNom',
    communeId: 'CommuneId', communeNom: 'CommuneNom',
    arrondissementId: 'ArrondissementId', arrondissementNom: 'ArrondissementNom',
    villageId: 'VillageId', villageNom: 'VillageNom',
    grappeId: 'GrappeId', grappeNom: 'GrappeNom'
  };
  Object.keys(champsGeo).forEach(f => { if (p[f] !== undefined) changes[champsGeo[f]] = p[f]; });
  if (p.motDePasse) changes.MotDePasse = p.motDePasse;
  updateRowById_(SHEETS.USERS, p.id, changes);
  return { ok: true };
}

// Supprime définitivement un compte que l'acteur a lui-même créé (ou n'importe quel compte pour
// le NATIONAL). Refusé si ce compte a lui-même créé des comptes en dessous (il faut d'abord les
// supprimer ou les réattribuer, pour ne jamais casser la chaîne hiérarchique de notification).
// Supprime aussi ses sessions actives (déconnexion immédiate) et ses périmètres assignés ; les
// alertes/décès/investigations déjà notifiés par ce compte restent dans l'historique tels quels.
function deleteUser_(actor, p) {
  const users = readSheet_(SHEETS.USERS);
  const target = users.find(u => u.ID === p.id);
  if (!target) return { ok: false, error: 'Utilisateur introuvable.' };
  if (target.ID === actor.ID) return { ok: false, error: 'Vous ne pouvez pas supprimer votre propre compte.' };
  if (!canManageUser_(actor, target)) {
    return { ok: false, error: 'Non autorisé à supprimer ce compte : seul son créateur peut le faire.' };
  }
  const aDesSubordonnes = users.some(u => u.ResponsableId === target.ID);
  if (aDesSubordonnes) {
    return { ok: false, error: 'Ce compte a créé d\'autres comptes en dessous de lui : supprimez-les (ou contactez-les pour réattribution) avant de pouvoir le supprimer.' };
  }
  const removed = deleteRowById_(SHEETS.USERS, target.ID);
  if (!removed) return { ok: false, error: 'Suppression impossible (compte introuvable dans le Sheet).' };
  deleteRowsWhere_(SHEETS.SESSIONS, 'UserId', target.ID);
  deleteRowsWhere_(SHEETS.PERIMETRES, 'UserId', target.ID);
  return { ok: true };
}

// Supprime la première ligne dont idField correspond à id. Retourne true si une ligne a été supprimée.
function deleteRowById_(sheetName, id, idField) {
  idField = idField || 'ID';
  const sh = ss_().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idField);
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) { sh.deleteRow(r + 1); invaliderCacheFeuille_(sheetName); return true; }
  }
  return false;
}

// Supprime TOUTES les lignes dont la colonne field correspond à value.
function deleteRowsWhere_(sheetName, field, value) {
  const sh = ss_().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const col = headers.indexOf(field);
  if (col < 0) return;
  for (let r = values.length - 1; r >= 1; r--) {
    if (String(values[r][col]) === String(value)) sh.deleteRow(r + 1);
  }
  invaliderCacheFeuille_(sheetName);
}

// Active ou désactive un compte. Autorisé pour tout superviseur (direct ou indirect) du compte
// cible, à n'importe quel niveau de la hiérarchie (NATIONAL peut désactiver n'importe qui, un
// RCSE peut désactiver ses PF et leur descendance, un PF ses ASCQ et leurs RC, etc.)
function setUserActive_(actor, p) {
  const users = readSheet_(SHEETS.USERS);
  const target = users.find(u => u.ID === p.id);
  if (!target) return { ok: false, error: 'Utilisateur introuvable.' };
  if (target.ID === actor.ID) return { ok: false, error: 'Vous ne pouvez pas désactiver votre propre compte.' };
  if (!isSupervisorOf_(actor, target)) return { ok: false, error: 'Non autorisé : ce compte ne dépend pas de vous.' };
  updateRowById_(SHEETS.USERS, p.id, { Actif: !!p.active });
  return { ok: true };
}

// actor est-il au-dessus de target dans la hiérarchie (direct ou indirect) ?
function isSupervisorOf_(actor, target) {
  const users = readSheet_(SHEETS.USERS);
  let cur = target;
  let guard = 0;
  while (cur && cur.ResponsableId && guard < 10) {
    if (cur.ResponsableId === actor.ID) return true;
    cur = users.find(u => u.ID === cur.ResponsableId);
    guard++;
  }
  return actor.Role === ROLES.NATIONAL; // NATIONAL voit/gère tout
}

// Liste des utilisateurs visibles pour actor (lui + toute sa descendance hiérarchique)
function listUsers_(actor) {
  const users = readSheet_(SHEETS.USERS);
  users.forEach(u => delete u.MotDePasse);
  if (actor.Role === ROLES.NATIONAL) return users;
  return users.filter(u => u.ID === actor.ID || isSupervisorOf_(actor, u));
}

// Remonte la chaîne hiérarchique complète d'un utilisateur (superviseur direct, puis le sien, etc.)
function chainAbove_(user) {
  const users = readSheet_(SHEETS.USERS);
  const chain = [];
  let cur = user;
  let guard = 0;
  while (cur && cur.ResponsableId && guard < 10) {
    const sup = users.find(u => u.ID === cur.ResponsableId);
    if (!sup) break;
    chain.push(sup);
    cur = sup;
    guard++;
  }
  return chain;
}

// ============================================================
// GEOGRAPHIE : Départements / Communes / Arrondissements / Villages / Grappes
// ============================================================
// Les départements n'ont pas de feuille dédiée (ils n'existent, historiquement, qu'implicitement
// via Communes.DepartementId/DepartementNom) : listDepartements_ en extrait la liste distincte.

function listDepartements_() {
  const communes = readSheet_(SHEETS.COMMUNES);
  const seen = {};
  const out = [];
  communes.forEach(c => {
    if (!seen[c.DepartementId]) { seen[c.DepartementId] = true; out.push({ id: c.DepartementId, nom: c.DepartementNom }); }
  });
  return out;
}

function createGeo_(actor, sheetName, p, allowedRoles) {
  if (!allowedRoles.includes(actor.Role)) return { ok: false, error: 'Non autorisé.' };
  let obj;
  if (sheetName === 'Communes') {
    const { depId, comId } = geoIds_(p.departementNom, p.nom);
    obj = { ID: comId, Nom: p.nom, DepartementId: depId, DepartementNom: p.departementNom };
  } else if (sheetName === 'Arrondissements') {
    obj = { ID: p.communeId + '__ARR-' + slug_(p.nom), Nom: p.nom, CommuneId: p.communeId, CommuneNom: p.communeNom || '' };
  } else if (sheetName === 'Villages') {
    obj = { ID: p.arrondissementId + '__VIL-' + slug_(p.nom), Nom: p.nom, ArrondissementId: p.arrondissementId, ArrondissementNom: p.arrondissementNom || '' };
  } else if (sheetName === 'Grappes') {
    if (!p.villageId) return { ok: false, error: 'Village requis pour créer une grappe.' };
    obj = { ID: p.villageId + '__GRP-' + slug_(p.nom), Nom: p.nom, VillageId: p.villageId, VillageNom: p.villageNom || '' };
  }
  const existing = readSheet_(sheetName);
  if (existing.some(x => x.ID === obj.ID)) return { ok: false, error: 'Cet élément existe déjà.' };
  appendRow_(sheetName, obj);
  return { ok: true, item: obj };
}

// Import en masse de toute la structure administrative (Département > Commune > Arrondissement >
// Village) depuis le fichier national, en une seule écriture par feuille (rapide, même pour
// plusieurs milliers de villages). Réservé au compte NATIONAL, qui "coiffe" toute la géographie
// standard du pays. Les doublons (même ID déterministe) sont ignorés.
function importGeoBulk_(actor, p) {
  if (actor.Role !== ROLES.NATIONAL) return { ok: false, error: 'Seul le compte national peut importer la structure administrative.' };
  const departements = p.departements || [];

  const existingCommunes = readSheet_(SHEETS.COMMUNES);
  const existingArrs = readSheet_(SHEETS.ARRONDISSEMENTS);
  const existingVillages = readSheet_(SHEETS.VILLAGES);
  const seenCom = new Set(existingCommunes.map(x => x.ID));
  const seenArr = new Set(existingArrs.map(x => x.ID));
  const seenVil = new Set(existingVillages.map(x => x.ID));

  const newCommunes = [], newArrs = [], newVillages = [];

  departements.forEach(dep => {
    const depId = 'DEP-' + slug_(dep.nom);
    (dep.communes || []).forEach(com => {
      const comId = depId + '__COM-' + slug_(com.nom);
      if (!seenCom.has(comId)) { seenCom.add(comId); newCommunes.push([comId, com.nom, depId, dep.nom]); }
      (com.arrondissements || []).forEach(arr => {
        const arrId = comId + '__ARR-' + slug_(arr.nom);
        if (!seenArr.has(arrId)) { seenArr.add(arrId); newArrs.push([arrId, arr.nom, comId, com.nom]); }
        (arr.villages || []).forEach(vilNom => {
          const vilId = arrId + '__VIL-' + slug_(vilNom);
          if (!seenVil.has(vilId)) { seenVil.add(vilId); newVillages.push([vilId, vilNom, arrId, arr.nom]); }
        });
      });
    });
  });

  appendRowsBulk_(SHEETS.COMMUNES, newCommunes);
  appendRowsBulk_(SHEETS.ARRONDISSEMENTS, newArrs);
  appendRowsBulk_(SHEETS.VILLAGES, newVillages);

  return { ok: true, communes: newCommunes.length, arrondissements: newArrs.length, villages: newVillages.length };
}

// Ecriture en masse (beaucoup plus rapide que plusieurs appendRow_ successifs)
function appendRowsBulk_(sheetName, rows) {
  if (!rows.length) return;
  const sh = ss_().getSheetByName(sheetName);
  const startRow = sh.getLastRow() + 1;
  sh.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function listGeo_() {
  return {
    departements: listDepartements_(),
    communes: readSheet_(SHEETS.COMMUNES),
    arrondissements: readSheet_(SHEETS.ARRONDISSEMENTS),
    villages: readSheet_(SHEETS.VILLAGES),
    grappes: readSheet_(SHEETS.GRAPPES)
  };
}

// ============================================================
// PÉRIMÈTRES / ASSIGNATIONS — un niveau d'assignation par palier de la hiérarchie.
// Chaque fonction : (1) vérifie que l'acteur est bien le superviseur direct attendu pour ce
// palier, (2) vérifie que la cible appartient bien au propre périmètre de l'acteur (visibilité
// en cascade — on ne peut assigner que ce qu'on voit soi-même), (3) journalise l'assignation.
// ============================================================

// NATIONAL assigne une commune supplémentaire à la zone sanitaire d'un compte RCSE (une zone
// sanitaire peut regrouper des communes de départements différents ; plusieurs communes possibles
// pour un même RCSE, comme pour les arrondissements d'un ASCQ ou les grappes d'un RC).
function assignCommuneRcse_(actor, p) {
  if (actor.Role !== ROLES.NATIONAL && actor.Role !== ROLES.DEPARTEMENT) return { ok: false, error: 'Seul un compte Département (ou national) peut assigner une commune à une zone sanitaire.' };
  const users = readSheet_(SHEETS.USERS);
  const target = users.find(u => u.ID === p.userId);
  if (!target || target.Role !== ROLES.RCSE) return { ok: false, error: 'Compte RCSE introuvable.' };
  if (!p.communeId) return { ok: false, error: 'Commune manquante.' };
  if (actor.Role === ROLES.DEPARTEMENT) {
    if (target.DepartementId !== actor.DepartementId) return { ok: false, error: 'Ce RCSE ne dépend pas de votre département.' };
    const commune = readSheet_(SHEETS.COMMUNES).find(c => c.ID === p.communeId);
    if (!commune || commune.DepartementId !== actor.DepartementId) return { ok: false, error: 'Cette commune n\'appartient pas à votre département.' };
  }
  const dejaAssigne = readSheet_(SHEETS.PERIMETRES).some(x => x.UserId === target.ID && x.TypeCible === 'Commune' && x.CibleId === p.communeId);
  if (dejaAssigne) return { ok: false, error: 'Cette commune est déjà assignée à la zone sanitaire de ce RCSE.' };
  const entry = { ID: newId_('PER'), UserId: target.ID, TypeCible: 'Commune', CibleId: p.communeId, AssignePar: actor.ID, Date: nowStr_() };
  appendRow_(SHEETS.PERIMETRES, entry);
  appendRow_(SHEETS.JOURNAL, { ID: newId_('LOG'), Type: 'Commune', CibleId: p.communeId, AssigneA: target.ID, AssignePar: actor.ID, Date: nowStr_() });
  return { ok: true, perimetre: entry };
}

// RCSE assigne des arrondissements aux PF CNLS-TP des communes de sa zone sanitaire.
// (Conservé tel quel dans son principe : c'est le mécanisme historique. Seule la portée du
// contrôle change — la cible doit désormais appartenir aux communes de la zone du RCSE.)
function assignPerimetre_(actor, p) {
  if (actor.Role !== ROLES.RCSE) return { ok: false, error: 'Seul un RCSE peut assigner un périmètre à un PF.' };
  const users = readSheet_(SHEETS.USERS);
  const target = users.find(u => u.ID === p.userId);
  if (!target) return { ok: false, error: 'Utilisateur introuvable.' };
  if (p.typeCible !== 'Arrondissement' || target.Role !== ROLES.PF) {
    return { ok: false, error: 'Seuls des arrondissements peuvent être assignés, et uniquement à un compte PF CNLS-TP.' };
  }
  const mesArrs = arrondissementsOfRcse_(actor.ID);
  if (!mesArrs.includes(p.cibleId)) return { ok: false, error: 'Cet arrondissement ne fait pas partie des communes de votre zone sanitaire.' };
  const entry = { ID: newId_('PER'), UserId: p.userId, TypeCible: p.typeCible, CibleId: p.cibleId, AssignePar: actor.ID, Date: nowStr_() };
  appendRow_(SHEETS.PERIMETRES, entry);
  appendRow_(SHEETS.JOURNAL, { ID: newId_('LOG'), Type: p.typeCible, CibleId: p.cibleId, AssigneA: p.userId, AssignePar: actor.ID, Date: nowStr_() });
  return { ok: true, perimetre: entry };
}

function listPerimetres_(actor) {
  const all = readSheet_(SHEETS.PERIMETRES);
  if (actor.Role === ROLES.NATIONAL) return all;
  return all.filter(x => x.UserId === actor.ID);
}

// Un PF assigne un arrondissement supplémentaire à un de ses ASCQ (en plus de celui choisi à la
// création du compte). Un ASCQ peut ainsi couvrir plusieurs arrondissements ; il reçoit alors un
// rapport hebdomadaire distinct pour chacun (voir genererRapportsPourSemaine_ / listRapports_).
function assignArrondissementAscq_(actor, p) {
  if (actor.Role !== ROLES.PF) return { ok: false, error: 'Seul un PF CNLS-TP peut assigner un arrondissement à un ASCQ.' };
  const users = readSheet_(SHEETS.USERS);
  const target = users.find(u => u.ID === p.userId);
  if (!target || target.Role !== ROLES.ASCQ) return { ok: false, error: 'Compte ASCQ introuvable.' };
  if (!isSupervisorOf_(actor, target)) return { ok: false, error: 'Cet ASCQ ne dépend pas de vous.' };
  if (!p.arrondissementId) return { ok: false, error: 'Arrondissement manquant.' };
  const dejaAssigne = readSheet_(SHEETS.PERIMETRES).some(x => x.UserId === target.ID && x.TypeCible === 'Arrondissement' && x.CibleId === p.arrondissementId);
  if (dejaAssigne) return { ok: false, error: 'Cet arrondissement est déjà assigné à cet ASCQ.' };
  const entry = { ID: newId_('PER'), UserId: target.ID, TypeCible: 'Arrondissement', CibleId: p.arrondissementId, AssignePar: actor.ID, Date: nowStr_() };
  appendRow_(SHEETS.PERIMETRES, entry);
  appendRow_(SHEETS.JOURNAL, { ID: newId_('LOG'), Type: 'Arrondissement', CibleId: p.arrondissementId, AssigneA: target.ID, AssignePar: actor.ID, Date: nowStr_() });
  return { ok: true, perimetre: entry };
}

// Périmètres arrondissement des ASCQ, visibles pour : un ASCQ (les siens), un PF (ceux de tous
// ses ASCQ, pour l'écran "Mes ASCQ" et le formulaire d'assignation), le RCSE et le NATIONAL (tous
// ceux de leur périmètre).
function listArrondissementsDesAscq_(actor) {
  const perimetres = readSheet_(SHEETS.PERIMETRES).filter(p => p.TypeCible === 'Arrondissement');
  if (actor.Role === ROLES.ASCQ) return perimetres.filter(p => p.UserId === actor.ID);
  if (actor.Role === ROLES.PF) {
    const users = readSheet_(SHEETS.USERS);
    const mesAscq = users.filter(u => u.Role === ROLES.ASCQ && u.ResponsableId === actor.ID).map(u => u.ID);
    return perimetres.filter(p => mesAscq.includes(p.UserId));
  }
  if (actor.Role === ROLES.RCSE) {
    const users = readSheet_(SHEETS.USERS);
    const mesArrs = new Set(arrondissementsOfRcse_(actor.ID));
    const ascqIds = users.filter(u => u.Role === ROLES.ASCQ).map(u => u.ID);
    return perimetres.filter(p => ascqIds.includes(p.UserId) && mesArrs.has(p.CibleId));
  }
  if (actor.Role === ROLES.NATIONAL) {
    const users = readSheet_(SHEETS.USERS);
    const ascqIds = users.filter(u => u.Role === ROLES.ASCQ).map(u => u.ID);
    return perimetres.filter(p => ascqIds.includes(p.UserId));
  }
  return [];
}

// Un ASCQ assigne une grappe supplémentaire à un de ses RC (en plus de celle, éventuelle, choisie
// à la création du compte). Un RC peut ainsi couvrir plusieurs grappes, et une même grappe/village
// peut être couverte par plusieurs RC — aucune exclusivité n'est imposée entre RC. Si la grappe
// n'existe pas encore pour le village indiqué, elle est créée à la volée.
function assignGrappeRc_(actor, p) {
  const users = readSheet_(SHEETS.USERS);
  const target = users.find(u => u.ID === p.userId);
  if (!target || target.Role !== ROLES.RC) return { ok: false, error: 'Compte RC introuvable.' };
  // Autorisé pour tout superviseur, direct ou indirect (même règle que la modification de compte,
  // voir updateUser_) — pas seulement l'ASCQ direct du RC.
  if (!isSupervisorOf_(actor, target)) return { ok: false, error: 'Ce RC ne dépend pas de vous.' };
  if (!p.villageId) return { ok: false, error: 'Village manquant.' };
  const villages = readSheet_(SHEETS.VILLAGES);
  const village = villages.find(v => v.ID === p.villageId);
  if (!village) return { ok: false, error: 'Village introuvable.' };

  let grappeId = p.grappeId, grappeNom = p.grappeNom || '';
  if (!grappeId && grappeNom) {
    const created = createGeo_(actor, 'Grappes', { villageId: p.villageId, villageNom: village.Nom, nom: grappeNom }, [ROLES.ASCQ, ROLES.PF, ROLES.RCSE, ROLES.DEPARTEMENT, ROLES.NATIONAL]);
    if (!created.ok) return created;
    grappeId = created.item.ID;
  }
  if (!grappeId) return { ok: false, error: 'Sélectionnez une grappe existante ou indiquez le nom d\'une nouvelle grappe.' };

  const dejaAssigne = readSheet_(SHEETS.PERIMETRES).some(x => x.UserId === target.ID && x.TypeCible === 'Grappe' && x.CibleId === grappeId);
  if (dejaAssigne) return { ok: false, error: 'Cette grappe est déjà assignée à ce RC.' };
  const entry = { ID: newId_('PER'), UserId: target.ID, TypeCible: 'Grappe', CibleId: grappeId, AssignePar: actor.ID, Date: nowStr_() };
  appendRow_(SHEETS.PERIMETRES, entry);
  appendRow_(SHEETS.JOURNAL, { ID: newId_('LOG'), Type: 'Grappe', CibleId: grappeId, AssigneA: target.ID, AssignePar: actor.ID, Date: nowStr_() });
  return { ok: true, perimetre: entry };
}

// Retire une grappe de la couverture d'un RC (sans toucher aux autres grappes qu'il couvre
// éventuellement). Autorisé pour tout superviseur, direct ou indirect — même règle que
// assignGrappeRc_. Un RC peut se retrouver sans aucune grappe (ce n'est pas bloqué ici) ; c'est
// à l'appelant de lui en assigner une nouvelle si besoin.
function retirerGrappeRc_(actor, p) {
  const users = readSheet_(SHEETS.USERS);
  const target = users.find(u => u.ID === p.userId);
  if (!target || target.Role !== ROLES.RC) return { ok: false, error: 'Compte RC introuvable.' };
  if (!isSupervisorOf_(actor, target)) return { ok: false, error: 'Ce RC ne dépend pas de vous.' };
  const entry = readSheet_(SHEETS.PERIMETRES).find(x => x.UserId === target.ID && x.TypeCible === 'Grappe' && x.CibleId === p.grappeId);
  if (!entry) return { ok: false, error: 'Cette grappe n\'est pas assignée à ce RC.' };
  deleteRowById_(SHEETS.PERIMETRES, entry.ID);
  // Si la grappe retirée était la grappe "maison" enregistrée sur le compte, on la vide aussi
  // pour ne pas laisser un compte pointer vers une grappe qu'il ne couvre plus.
  if (target.GrappeId === p.grappeId) updateRowById_(SHEETS.USERS, target.ID, { GrappeId: '', GrappeNom: '' });
  return { ok: true };
}

// Toutes les grappes actuellement couvertes par un RC (nom + village), pour affichage dans le
// formulaire de modification de son compte.
function listGrappesDuRc_(actor, p) {
  const users = readSheet_(SHEETS.USERS);
  const target = users.find(u => u.ID === p.userId);
  if (!target || target.Role !== ROLES.RC) return [];
  if (!isSupervisorOf_(actor, target) && actor.ID !== target.ID) return [];
  const grappesSheet = readSheet_(SHEETS.GRAPPES);
  return readSheet_(SHEETS.PERIMETRES).filter(x => x.UserId === target.ID && x.TypeCible === 'Grappe').map(x => {
    const g = grappesSheet.find(gg => gg.ID === x.CibleId);
    return { grappeId: x.CibleId, grappeNom: g ? g.Nom : x.CibleId, villageNom: g ? g.VillageNom : '' };
  });
}

// Périmètres grappe des RC, visibles pour : un RC (les siens), un ASCQ (ceux de tous ses RC).
function listGrappesDesRc_(actor) {
  const perimetres = readSheet_(SHEETS.PERIMETRES).filter(p => p.TypeCible === 'Grappe');
  if (actor.Role === ROLES.RC) return perimetres.filter(p => p.UserId === actor.ID);
  if (actor.Role === ROLES.ASCQ) {
    const users = readSheet_(SHEETS.USERS);
    const mesRc = users.filter(u => u.Role === ROLES.RC && u.ResponsableId === actor.ID).map(u => u.ID);
    return perimetres.filter(p => mesRc.includes(p.UserId));
  }
  return [];
}

// Liste des communes qui composent la zone sanitaire d'un RCSE (peut en avoir plusieurs, y
// compris de départements différents).
function communesOfRcse_(rcseId) {
  return readSheet_(SHEETS.PERIMETRES).filter(p => p.UserId === rcseId && p.TypeCible === 'Commune').map(p => p.CibleId);
}

// Liste des arrondissements couverts par un ASCQ (peut en avoir plusieurs).
function arrondissementsOfAscq_(ascqId) {
  return readSheet_(SHEETS.PERIMETRES).filter(p => p.UserId === ascqId && p.TypeCible === 'Arrondissement').map(p => p.CibleId);
}

function arrondissementsOfPf_(pfId) {
  return readSheet_(SHEETS.PERIMETRES).filter(p => p.UserId === pfId && p.TypeCible === 'Arrondissement').map(p => p.CibleId);
}

// Tous les arrondissements situés dans la zone sanitaire (un ou plusieurs communes) d'un RCSE.
function arrondissementsOfRcse_(rcseId) {
  const comIds = new Set(communesOfRcse_(rcseId));
  if (!comIds.size) return [];
  return readSheet_(SHEETS.ARRONDISSEMENTS).filter(a => comIds.has(a.CommuneId)).map(a => a.ID);
}

// ============================================================
// FORMULAIRES 1 & 2 (RC) — soumission + notification en cascade
// ============================================================

// Les formulaires envoient des clés en camelCase (ex: "typeAlerte") alors que les colonnes du
// Sheet sont en PascalCase (ex: "TypeAlerte") — cette table fait la correspondance explicite.
// (Un simple Object.assign(p) ne suffit pas : les clés ne correspondent pas à la casse près, ce
// qui écrivait silencieusement des cellules vides pour tous les champs du formulaire.)
const ALERTE_FIELD_MAP = {
  annee: 'Annee', semaineEpi: 'SemaineEpi', mois: 'Mois', npi: 'NPI', nAlerte: 'NAlerte',
  departement: 'Departement', zoneSanitaire: 'ZoneSanitaire', communeId: 'CommuneId',
  arrondissementId: 'ArrondissementId', villageId: 'VillageId', grappeNom: 'NGrappe',
  adresse: 'Adresse', nom: 'Nom', sexe: 'Sexe', telephone: 'Telephone',
  dateNaissance: 'DateNaissance', age: 'Age', gpsLon: 'GPSLon', gpsLat: 'GPSLat',
  typeAlerte: 'TypeAlerte', autrePreciser: 'AutrePreciser', dateDebutMaladie: 'DateDebutMaladie',
  dateNotification: 'DateNotification', personnesTouchees: 'PersonnesTouchees',
  personnesMortes: 'PersonnesMortes', animauxMalades: 'AnimauxMalades', animauxMorts: 'AnimauxMorts',
  enCours: 'EnCours', titre: 'Titre', centreSante: 'CentreSante'
};
const DECES_FIELD_MAP = {
  annee: 'Annee', semaineEpi: 'SemaineEpi', mois: 'Mois', npi: 'NPI', nDeces: 'NDeces',
  departement: 'Departement', zoneSanitaire: 'ZoneSanitaire', communeId: 'CommuneId',
  arrondissementId: 'ArrondissementId', villageId: 'VillageId', grappeNom: 'NGrappe',
  adresse: 'Adresse', nom: 'Nom', nomParent: 'NomParent', telephoneParent: 'TelephoneParent',
  dateNaissance: 'DateNaissance', ageAnnees: 'AgeAnnees', ageMois: 'AgeMois', ageJours: 'AgeJours',
  sexe: 'Sexe', gpsLon: 'GPSLon', gpsLat: 'GPSLat', typeDeces: 'TypeDeces', dateDeces: 'DateDeces',
  dateNotification: 'DateNotification', lieuDeces: 'LieuDeces', circonstances: 'Circonstances',
  causeProbable: 'CauseProbable', titre: 'Titre', centreSante: 'CentreSante'
};
function mapFields_(p, fieldMap) {
  const obj = {};
  Object.keys(fieldMap).forEach(k => { if (p[k] !== undefined) obj[fieldMap[k]] = p[k]; });
  return obj;
}

function submitAlerte_(actor, p) {
  if (actor.Role !== ROLES.RC) return { ok: false, error: 'Seul un Relais Communautaire peut soumettre ce formulaire.' };
  const obj = Object.assign(mapFields_(p, ALERTE_FIELD_MAP), {
    ID: newId_('ALT'), NotificateurId: actor.ID, NotificateurNom: actor.Prenom + ' ' + actor.Nom,
    DateSaisie: nowStr_(), Statut: 'Nouveau', InvestigationId: '',
    Signes: Array.isArray(p.signes) ? p.signes.join('|') : (p.signes || '')
  });
  appendRow_(SHEETS.ALERTES, obj);
  cascadeNotify_(actor, 'ALERTE', obj.ID, `Nouvelle alerte (${p.typeAlerte || ''}) notifiée par ${obj.NotificateurNom} - Village: ${p.villageNom || actor.VillageNom || ''}`);
  return { ok: true, alerte: obj };
}

function submitDeces_(actor, p) {
  if (actor.Role !== ROLES.RC) return { ok: false, error: 'Seul un Relais Communautaire peut soumettre ce formulaire.' };
  const obj = Object.assign(mapFields_(p, DECES_FIELD_MAP), {
    ID: newId_('DC'), NotificateurId: actor.ID, NotificateurNom: actor.Prenom + ' ' + actor.Nom,
    DateSaisie: nowStr_(), Statut: 'Nouveau', InvestigationId: ''
  });
  appendRow_(SHEETS.DECES, obj);
  cascadeNotify_(actor, 'DECES', obj.ID, `Nouveau décès communautaire notifié par ${obj.NotificateurNom} - Village: ${p.villageNom || actor.VillageNom || ''}`);
  return { ok: true, deces: obj };
}

// Notifie l'ASCQ superviseur direct + toute la chaîne au-dessus (PF, RCSE, NATIONAL)
function cascadeNotify_(rcUser, type, refId, message) {
  const chain = chainAbove_(rcUser); // [ASCQ, PF, RCSE, ...]
  // Garde-fou : la chaîne remonte uniquement vers les superviseurs (jamais le RC lui-même,
  // ni un autre RC) — on l'impose explicitement ici pour ne jamais notifier par erreur un
  // compte RC, même si une donnée de hiérarchie (ResponsableId) venait à être incohérente.
  chain.filter(sup => sup.Role !== ROLES.RC && sup.ID !== rcUser.ID).forEach(sup => {
    appendRow_(SHEETS.NOTIFICATIONS, {
      ID: newId_('NOTIF'), DestinataireId: sup.ID, Type: type, RefId: refId,
      Message: message, Lu: false, DateCreation: nowStr_()
    });
  });
}

function listNotifications_(actor) {
  return readSheet_(SHEETS.NOTIFICATIONS).filter(n => n.DestinataireId === actor.ID)
    .sort((a, b) => new Date(b.DateCreation) - new Date(a.DateCreation));
}

function markNotificationRead_(actor, p) {
  updateRowById_(SHEETS.NOTIFICATIONS, p.id, { Lu: true });
  return { ok: true };
}

// Purge d'un coup toutes les notifications non lues de l'utilisateur connecté (bouton "Tout
// marquer comme lu" du RCSE) : la pastille "Notifications non lues" de son tableau de bord
// retombe à 0. Ne touche ni aux alertes, ni aux décès, ni à aucune autre donnée de surveillance —
// seule la boîte de notifications de ce compte est vidée.
function marquerToutesNotificationsLues_(actor) {
  const notifs = readSheet_(SHEETS.NOTIFICATIONS).filter(n => n.DestinataireId === actor.ID && (n.Lu === false || n.Lu === 'FALSE'));
  notifs.forEach(n => updateRowById_(SHEETS.NOTIFICATIONS, n.ID, { Lu: true }));
  return { count: notifs.length };
}

// ============================================================
// FORMULAIRE 3 (ASCQ) — investigation d'une alerte/décès
// ============================================================

function submitInvestigation_(actor, p) {
  if (actor.Role !== ROLES.ASCQ) return { ok: false, error: 'Seul un ASCQ peut soumettre une fiche d\'investigation.' };
  const obj = Object.assign({}, p, {
    ID: newId_('INV'), ASCQId: actor.ID, ASCQNom: actor.Prenom + ' ' + actor.Nom,
    DateSaisie: nowStr_(),
    CasParCategorie: JSON.stringify(p.casParCategorie || {}),
    DecesParCategorie: JSON.stringify(p.decesParCategorie || {})
  });
  appendRow_(SHEETS.INVESTIGATIONS, obj);
  const targetSheet = p.refType === 'DECES' ? SHEETS.DECES : SHEETS.ALERTES;
  updateRowById_(targetSheet, p.refId, { Statut: 'Investigué', InvestigationId: obj.ID });
  const chain = chainAbove_(actor); // [PF, RCSE, NATIONAL]
  chain.forEach(sup => appendRow_(SHEETS.NOTIFICATIONS, {
    ID: newId_('NOTIF'), DestinataireId: sup.ID, Type: 'INVESTIGATION', RefId: obj.ID,
    Message: `Investigation complétée par ${obj.ASCQNom} sur ${p.refType} ${p.refId}`, Lu: false, DateCreation: nowStr_()
  }));
  return { ok: true, investigation: obj };
}

// ============================================================
// SUIVI GROUPÉ DES RC (par l'ASCQ)
// ============================================================

// Dossier Drive où sont rangées les photos de séance des suivis groupés (créé une seule fois).
function dossierPhotosSuivi_() {
  const nom = 'Surveillance_Communautaire_PhotosSuiviGroupe';
  const it = DriveApp.getFoldersByName(nom);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(nom);
}

// Enregistre une liste de photos (data URLs "data:image/xxx;base64,...", déjà redimensionnées
// côté client) dans Drive, et renvoie leurs URLs de partage (lecture pour quiconque a le lien).
function enregistrerPhotosSuivi_(photosDataUrl, nomBase) {
  const dossier = dossierPhotosSuivi_();
  const urls = [];
  (photosDataUrl || []).forEach((dataUrl, i) => {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(dataUrl || '');
    if (!m) return;
    const mime = m[1], data = m[2];
    const ext = mime.split('/')[1].replace('jpeg', 'jpg');
    const blob = Utilities.newBlob(Utilities.base64Decode(data), mime, `${nomBase}_${i + 1}.${ext}`);
    const file = dossier.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    urls.push(file.getUrl());
  });
  return urls;
}

// Enregistre une séance de suivi groupé : thèmes abordés (définitions de cas uniquement — voir
// assets/briefing-data.js côté frontend, aucune saisie libre), liste de présence des RC (cochés
// parmi les RC de l'ASCQ, plutôt qu'un simple nombre), et au moins une photo de la séance
// (obligatoire). La date du suivi est celle choisie par l'ASCQ (peut différer d'aujourd'hui si
// saisie a posteriori, mais reste la date RETENUE de la séance).
function submitSuiviGroupe_(actor, p) {
  if (actor.Role !== ROLES.ASCQ) return { ok: false, error: 'Seul un compte ASCQ peut enregistrer un suivi groupé.' };
  if (!p.date) return { ok: false, error: 'La date du suivi est obligatoire.' };
  if (!Array.isArray(p.themes) || !p.themes.length) return { ok: false, error: 'Sélectionnez au moins un thème abordé (définition de cas).' };
  if (!Array.isArray(p.rcPresentsIds) || !p.rcPresentsIds.length) return { ok: false, error: 'Cochez au moins un RC dans la liste de présence.' };
  if (!Array.isArray(p.photos) || !p.photos.length) return { ok: false, error: 'Au moins une photo de la séance est obligatoire.' };

  const mesRc = readSheet_(SHEETS.USERS).filter(u => u.Role === ROLES.RC && u.ResponsableId === actor.ID);
  const rcValides = mesRc.filter(u => p.rcPresentsIds.includes(u.ID));
  if (!rcValides.length) return { ok: false, error: 'Aucun des RC cochés ne dépend de votre compte.' };

  const urls = enregistrerPhotosSuivi_(p.photos, `suivi_${actor.ID}_${p.date}`);
  if (!urls.length) return { ok: false, error: 'Les photos envoyées sont invalides ou n\'ont pas pu être enregistrées.' };

  const rec = {
    ID: newId_('SUI'), AscqId: actor.ID, AscqNom: actor.Prenom + ' ' + actor.Nom,
    ArrondissementId: p.arrondissementId || actor.ArrondissementId || '', ArrondissementNom: p.arrondissementNom || actor.ArrondissementNom || '',
    Date: p.date, Themes: JSON.stringify(p.themes),
    RcPresentsIds: JSON.stringify(rcValides.map(u => u.ID)),
    RcPresentsNoms: JSON.stringify(rcValides.map(u => u.Prenom + ' ' + u.Nom)),
    NbPresents: rcValides.length, PhotosUrls: JSON.stringify(urls),
    Commentaires: p.commentaires || '', DateCreation: nowStr_()
  };
  appendRow_(SHEETS.SUIVIS, rec);
  return { ok: true, suivi: rec };
}

// Historique des suivis groupés d'un ASCQ (les siens uniquement).
// Tous les ASCQ visibles par l'utilisateur connecté (lui-même s'il est ASCQ, ou tous les ASCQ
// de son périmètre s'il est au-dessus) — sert à donner à PF/RCSE/DEPARTEMENT/NATIONAL accès aux
// synthèses de suivi groupé de leurs ASCQ, en plus de l'ASCQ lui-même.
function ascqIdsVisibles_(actor) {
  const users = readSheet_(SHEETS.USERS);
  if (actor.Role === ROLES.ASCQ) return [actor.ID];
  if (actor.Role === ROLES.PF) {
    return users.filter(u => u.Role === ROLES.ASCQ && u.ResponsableId === actor.ID).map(u => u.ID);
  }
  if (actor.Role === ROLES.RCSE) {
    const pfIds = users.filter(u => u.Role === ROLES.PF && u.ResponsableId === actor.ID).map(u => u.ID);
    return users.filter(u => u.Role === ROLES.ASCQ && pfIds.includes(u.ResponsableId)).map(u => u.ID);
  }
  if (actor.Role === ROLES.DEPARTEMENT) {
    const rcseIds = users.filter(u => u.Role === ROLES.RCSE && u.DepartementId === actor.DepartementId).map(u => u.ID);
    const pfIds = users.filter(u => u.Role === ROLES.PF && rcseIds.includes(u.ResponsableId)).map(u => u.ID);
    return users.filter(u => u.Role === ROLES.ASCQ && pfIds.includes(u.ResponsableId)).map(u => u.ID);
  }
  if (actor.Role === ROLES.NATIONAL) return users.filter(u => u.Role === ROLES.ASCQ).map(u => u.ID);
  return [];
}

// Suivis groupés visibles par l'utilisateur connecté : les siens s'il est ASCQ, ceux de tous
// ses ASCQ s'il est PF/RCSE/DEPARTEMENT/NATIONAL (synthèse en lecture — la saisie reste
// réservée à l'ASCQ lui-même, voir submitSuiviGroupe_).
function listSuivisGroupes_(actor) {
  const ascqIds = ascqIdsVisibles_(actor);
  if (!ascqIds.length) return [];
  return readSheet_(SHEETS.SUIVIS).filter(s => ascqIds.includes(s.AscqId))
    .sort((a, b) => new Date(b.Date) - new Date(a.Date));
}

// Tous les arrondissements situés dans le département d'un compte DEPARTEMENT (union des
// arrondissements de toutes les zones sanitaires — RCSE — de ce département).
function arrondissementsOfDepartement_(departementId) {
  const users = readSheet_(SHEETS.USERS);
  const rcses = users.filter(u => u.Role === ROLES.RCSE && u.DepartementId === departementId);
  const arrs = new Set();
  rcses.forEach(rcse => arrondissementsOfRcse_(rcse.ID).forEach(id => arrs.add(id)));
  return [...arrs];
}

function listScoped_(sheetName, actor) {
  const rows = readSheet_(sheetName);
  if (actor.Role === ROLES.NATIONAL) return rows;
  if (actor.Role === ROLES.RC) return rows.filter(r => r.NotificateurId === actor.ID);
  if (actor.Role === ROLES.ASCQ) {
    // Un ASCQ peut couvrir plusieurs arrondissements (partagés avec d'éventuels autres ASCQ du
    // même arrondissement).
    const arrs = arrondissementsOfAscq_(actor.ID);
    return rows.filter(r => arrs.includes(r.ArrondissementId));
  }
  if (actor.Role === ROLES.PF) {
    const arrs = arrondissementsOfPf_(actor.ID);
    return rows.filter(r => arrs.includes(r.ArrondissementId));
  }
  if (actor.Role === ROLES.RCSE) {
    const arrs = arrondissementsOfRcse_(actor.ID);
    return rows.filter(r => arrs.includes(r.ArrondissementId));
  }
  if (actor.Role === ROLES.DEPARTEMENT) {
    const arrs = arrondissementsOfDepartement_(actor.DepartementId);
    return rows.filter(r => arrs.includes(r.ArrondissementId));
  }
  return [];
}

// ============================================================
// CALENDRIER EPIDEMIOLOGIQUE (import annuel, semaine 1..52/53)
// ============================================================

function importCalendrier_(actor, p) {
  if (actor.Role !== ROLES.NATIONAL) return { ok: false, error: 'Seul le compte national peut importer le calendrier.' };
  const rows = (p.rows || []).slice(0, 53); // garde-fou : jamais plus de 53 semaines (52 + éventuelle semaine 53)
  const cleaned = rows.filter(r => Number(r.semaine) >= 1 && Number(r.semaine) <= 53);
  cleaned.forEach(r => appendRow_(SHEETS.CALENDRIER, {
    Annee: r.annee, SemaineEpi: r.semaine, DateDebut: r.dateDebut, DateFin: r.dateFin
  }));
  return { ok: true, count: cleaned.length };
}

// Supprime les semaines importées. Si p.annee est fourni, ne supprime que cette année-là ;
// sinon vide tout le calendrier.
function clearCalendrier_(actor, p) {
  if (actor.Role !== ROLES.NATIONAL) return { ok: false, error: 'Seul le compte national peut modifier le calendrier.' };
  const sh = ss_().getSheetByName(SHEETS.CALENDRIER);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const anneeCol = headers.indexOf('Annee');
  let removed = 0;
  for (let r = values.length - 1; r >= 1; r--) {
    if (!p.annee || String(values[r][anneeCol]) === String(p.annee)) {
      sh.deleteRow(r + 1);
      removed++;
    }
  }
  return { ok: true, removed };
}

function semaineCouranteInfo_() {
  const cal = readSheet_(SHEETS.CALENDRIER);
  const today = new Date();
  const match = cal.find(r => new Date(r.DateDebut) <= today && today <= new Date(r.DateFin));
  return match || null;
}

// ============================================================
// FORMULAIRE / SUPPORT 4 — RAPPORT HEBDOMADAIRE AUTOMATIQUE
// ============================================================

// A appeler manuellement (bouton "Générer") ou via un déclencheur horaire hebdomadaire (voir README).
function genererRapportHebdo_(actor, p) {
  if (![ROLES.ASCQ, ROLES.PF, ROLES.RCSE, ROLES.NATIONAL].includes(actor.Role) && actor.Role !== undefined) {
    // autorisé pour tous les niveaux administrateurs, ou déclencheur système (actor peut être null)
  }
  if (p && p.annee && p.semaine) {
    supprimerRapportsPourSemaine_(p.annee, p.semaine);
    return { ok: true, rapports: genererRapportsPourSemaine_(p.annee, p.semaine) };
  }
  // Sans semaine précisée : comble les semaines passées du calendrier qui n'ont encore aucun
  // rapport (pour que la navigation Précédent/Suivant ait un historique à parcourir, pas
  // seulement la semaine courante), puis régénère TOUJOURS la semaine en cours (celle-ci peut
  // évoluer en cours de semaine — "actualiser" doit refléter les dernières notifications).
  const semaineInfo = semaineCouranteInfo_();
  if (!semaineInfo) return { ok: false, error: 'Aucune semaine épidémiologique correspondante dans le calendrier importé.' };
  genererRapportsManquants_(semaineInfo.Annee, semaineInfo.SemaineEpi);
  supprimerRapportsPourSemaine_(semaineInfo.Annee, semaineInfo.SemaineEpi);
  return { ok: true, rapports: genererRapportsPourSemaine_(semaineInfo.Annee, semaineInfo.SemaineEpi) };
}

// Supprime les rapports déjà générés pour une semaine donnée (tous niveaux confondus), afin de
// pouvoir la régénérer proprement sans laisser d'anciennes lignes dupliquées/obsolètes.
function supprimerRapportsPourSemaine_(annee, semaine) {
  const sh = ss_().getSheetByName(SHEETS.RAPPORTS);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const anneeCol = headers.indexOf('Annee'), semCol = headers.indexOf('SemaineEpi');
  for (let r = values.length - 1; r >= 1; r--) {
    if (String(values[r][anneeCol]) === String(annee) && String(values[r][semCol]) === String(semaine)) sh.deleteRow(r + 1);
  }
}

// Génère les rapports de toutes les semaines du calendrier déjà écoulées (DateFin <= aujourd'hui,
// semaine courante exclue) qui n'ont encore aucun rapport enregistré — pour que la navigation
// Précédent/Suivant des rapports ait un historique à parcourir, pas seulement la semaine
// courante. Les semaines déjà générées ne sont jamais touchées ici (voir genererRapportHebdo_
// pour la régénération explicite de la semaine courante).
function genererRapportsManquants_(anneeCourante, semaineCourante) {
  const cal = readSheet_(SHEETS.CALENDRIER);
  const existants = readSheet_(SHEETS.RAPPORTS);
  const dejaGenere = new Set(existants.map(r => r.Annee + '-' + r.SemaineEpi));
  const today = new Date();
  // Plafond de semaines traitées en un seul appel : avec le cache de feuilles (readSheet_), un
  // gros retard à combler reste rapide, mais on borne quand même le pire des cas (première
  // utilisation après une longue interruption) pour ne jamais faire traîner une simple
  // consultation du rapport. S'il reste plus de semaines à générer, elles le seront au prochain
  // appel (chaque semaine traitée est immédiatement marquée générée, donc jamais reprise à zéro).
  const PLAFOND_SEMAINES_PAR_APPEL = 12;
  let traitees = 0;
  cal.filter(r => new Date(r.DateFin) <= today && !(String(r.Annee) === String(anneeCourante) && String(r.SemaineEpi) === String(semaineCourante)))
    .sort((a, b) => (Number(a.Annee) - Number(b.Annee)) || (Number(a.SemaineEpi) - Number(b.SemaineEpi)))
    .forEach(r => {
      if (traitees >= PLAFOND_SEMAINES_PAR_APPEL) return;
      const key = r.Annee + '-' + r.SemaineEpi;
      if (dejaGenere.has(key)) return;
      genererRapportsPourSemaine_(r.Annee, r.SemaineEpi);
      traitees++;
    });
}

function genererRapportsPourSemaine_(annee, semaine) {
  const alertes = readSheet_(SHEETS.ALERTES).filter(a => String(a.Annee) === String(annee) && String(a.SemaineEpi) === String(semaine));
  const deces = readSheet_(SHEETS.DECES).filter(d => String(d.Annee) === String(annee) && String(d.SemaineEpi) === String(semaine));
  const investigations = readSheet_(SHEETS.INVESTIGATIONS);
  const users = readSheet_(SHEETS.USERS);
  const perimetres = readSheet_(SHEETS.PERIMETRES);
  const generated = [];

  // IMPORTANT : la synthèse (cases ci-dessus) doit correspondre EXACTEMENT à ce que montre le
  // détail du rapport (listRapportDetail_) — c'est-à-dire les événements AVÉRÉS uniquement
  // (alertes investiguées avec EvenementAvere = "Oui") + tous les décès notifiés (considérés
  // avérés dès leur notification, voir listRapportDetail_). Avant cette correction,
  // NbPersonnesTouchees/NbPersonnesDecedees comptaient TOUTES les alertes (même non avérées) et
  // ignoraient les décès du formulaire dédié, d'où des écarts du type "0 événement avéré / 1
  // personne touchée" affichés en même temps.
  function computeAggregate_(alertesSub, decesSub) {
    const investiguees = alertesSub.filter(a => a.Statut === 'Investigué');
    const averees = investiguees.filter(a => {
      const inv = investigations.find(i => i.ID === a.InvestigationId);
      return inv && String(inv.EvenementAvere).toLowerCase() === 'oui';
    });
    const nbCasAverees = averees.reduce((s, a) => {
      const inv = investigations.find(i => i.ID === a.InvestigationId);
      return s + (sumJsonValues_(inv && inv.CasParCategorie) || Number(a.PersonnesTouchees) || 0);
    }, 0);
    const nbDecesAlertesAverees = averees.reduce((s, a) => {
      const inv = investigations.find(i => i.ID === a.InvestigationId);
      return s + (sumJsonValues_(inv && inv.DecesParCategorie) || Number(a.PersonnesMortes) || 0);
    }, 0);
    const nbDecesDeclares = decesSub.reduce((s, d) => {
      const inv = investigations.find(i => i.ID === d.InvestigationId);
      return s + (inv ? (sumJsonValues_(inv.DecesParCategorie) || 1) : 1);
    }, 0);
    return {
      NbAlertesDetectees: alertesSub.length,
      NbPersonnesTouchees: nbCasAverees,
      NbPersonnesDecedees: nbDecesAlertesAverees + nbDecesDeclares,
      NbAlertesVerifiees24_48h: investiguees.length,
      NbAlertesAverees: averees.length + decesSub.length,
      DecesMaternel: decesSub.filter(d => String(d.TypeDeces) === '1').length,
      DecesNeonatal: decesSub.filter(d => String(d.TypeDeces) === '2').length,
      DecesInfantile: decesSub.filter(d => ['2', '3'].includes(String(d.TypeDeces))).length,
      DecesInfantoJuvenile: decesSub.filter(d => ['2', '3', '4'].includes(String(d.TypeDeces))).length,
      Deces5ansPlus: decesSub.filter(d => String(d.TypeDeces) === '5').length
    };
  }

  // Niveau ASCQ : un seul rapport par arrondissement (et non par ASCQ), puisque le Support 4
  // se construit à l'échelle de l'arrondissement. Si plusieurs ASCQ sont rattachés au même
  // arrondissement, ils partagent exactement ce même rapport ; si un ASCQ couvre plusieurs
  // arrondissements, il reçoit un rapport distinct pour chacun (voir listRapports_).
  const arrondissementsAvecAscq = {};
  perimetres.filter(pe => pe.TypeCible === 'Arrondissement').forEach(pe => {
    const proprietaire = users.find(u => u.ID === pe.UserId);
    if (proprietaire && proprietaire.Role === ROLES.ASCQ) arrondissementsAvecAscq[pe.CibleId] = true;
  });
  Object.keys(arrondissementsAvecAscq).forEach(arrId => {
    const aSub = alertes.filter(a => a.ArrondissementId === arrId);
    const dSub = deces.filter(d => d.ArrondissementId === arrId);
    const rec = Object.assign(
      { ID: newId_('RAP'), Annee: annee, SemaineEpi: semaine, Niveau: 'ASCQ', CompteId: arrId, ArrondissementId: arrId, GenereLe: nowStr_() },
      computeAggregate_(aSub, dSub)
    );
    appendRow_(SHEETS.RAPPORTS, rec);
    generated.push(rec);
  });

  // Niveau PF (par arrondissement assigné)
  users.filter(u => u.Role === ROLES.PF).forEach(pf => {
    const arrs = perimetres.filter(pe => pe.UserId === pf.ID && pe.TypeCible === 'Arrondissement').map(pe => pe.CibleId);
    if (!arrs.length) return;
    const aSub = alertes.filter(a => arrs.includes(a.ArrondissementId));
    const dSub = deces.filter(d => arrs.includes(d.ArrondissementId));
    const rec = Object.assign({ ID: newId_('RAP'), Annee: annee, SemaineEpi: semaine, Niveau: 'PF', CompteId: pf.ID, GenereLe: nowStr_() }, computeAggregate_(aSub, dSub));
    appendRow_(SHEETS.RAPPORTS, rec);
    generated.push(rec);
  });

  // Niveau RCSE (par département assigné, un ou plusieurs)
  users.filter(u => u.Role === ROLES.RCSE).forEach(rcse => {
    const arrs = arrondissementsOfRcse_(rcse.ID);
    if (!arrs.length) return;
    const aSub = alertes.filter(a => arrs.includes(a.ArrondissementId));
    const dSub = deces.filter(d => arrs.includes(d.ArrondissementId));
    const rec = Object.assign({ ID: newId_('RAP'), Annee: annee, SemaineEpi: semaine, Niveau: 'RCSE', CompteId: rcse.ID, GenereLe: nowStr_() }, computeAggregate_(aSub, dSub));
    appendRow_(SHEETS.RAPPORTS, rec);
    generated.push(rec);
  });

  // Niveau DEPARTEMENT (toutes les zones sanitaires — RCSE — de ce département confondues)
  users.filter(u => u.Role === ROLES.DEPARTEMENT).forEach(dep => {
    const arrs = arrondissementsOfDepartement_(dep.DepartementId);
    if (!arrs.length) return;
    const aSub = alertes.filter(a => arrs.includes(a.ArrondissementId));
    const dSub = deces.filter(d => arrs.includes(d.ArrondissementId));
    const rec = Object.assign({ ID: newId_('RAP'), Annee: annee, SemaineEpi: semaine, Niveau: 'DEPARTEMENT', CompteId: dep.ID, GenereLe: nowStr_() }, computeAggregate_(aSub, dSub));
    appendRow_(SHEETS.RAPPORTS, rec);
    generated.push(rec);
  });

  // Niveau NATIONAL (tout le pays confondu)
  const recNat = Object.assign({ ID: newId_('RAP'), Annee: annee, SemaineEpi: semaine, Niveau: 'NATIONAL', CompteId: 'NATIONAL', GenereLe: nowStr_() }, computeAggregate_(alertes, deces));
  appendRow_(SHEETS.RAPPORTS, recNat);
  generated.push(recNat);

  return generated;
}

// S'assure que TOUTES les semaines épidémiologiques déjà écoulées (calendrier importé, DateFin
// <= aujourd'hui, semaine en cours exclue) ont un rapport enregistré dans RapportsHebdo — quitte
// à le générer avec des zéros partout si aucune alerte/décès n'a été notifié cette semaine-là.
// Sans cet appel, une semaine sans la moindre notification n'aurait tout simplement AUCUNE ligne
// de rapport (donc rien à afficher), au lieu d'un rapport à 0 : le rapport hebdomadaire doit
// toujours exister pour une semaine terminée, même quand il n'y a rien à y mettre. Rappelée à
// chaque consultation de la liste des rapports (listRapports_) ; ne refait rien pour une semaine
// déjà générée (voir genererRapportsManquants_), donc sans coût une fois les rapports à jour.
function ensureRapportsPassesGeneres_() {
  const info = semaineCouranteInfo_();
  if (!info) return; // aucun calendrier importé : rien à générer
  genererRapportsManquants_(info.Annee, info.SemaineEpi);
}

function listRapports_(actor) {
  ensureRapportsPassesGeneres_();
  const all = readSheet_(SHEETS.RAPPORTS);
  if (actor.Role === ROLES.NATIONAL) return all.filter(r => r.Niveau === 'NATIONAL');
  if (actor.Role === ROLES.DEPARTEMENT) {
    // Un DEPARTEMENT reçoit, en plus de son propre rapport départemental, les rapports RCSE
    // (par zone sanitaire), PF (par commune) et ASCQ (par arrondissement) de tout son périmètre.
    const users = readSheet_(SHEETS.USERS);
    const rcses = users.filter(u => u.Role === ROLES.RCSE && u.DepartementId === actor.DepartementId);
    const rcseIds = rcses.map(u => u.ID);
    const pfIds = users.filter(u => u.Role === ROLES.PF && rcseIds.includes(u.ResponsableId)).map(u => u.ID);
    const mesArrs = arrondissementsOfDepartement_(actor.DepartementId);
    return all.filter(r =>
      (r.Niveau === 'DEPARTEMENT' && r.CompteId === actor.ID) ||
      (r.Niveau === 'RCSE' && rcseIds.includes(r.CompteId)) ||
      (r.Niveau === 'PF' && pfIds.includes(r.CompteId)) ||
      (r.Niveau === 'ASCQ' && mesArrs.includes(r.ArrondissementId))
    );
  }
  if (actor.Role === ROLES.RCSE) {
    // Un RCSE reçoit, en plus de son propre rapport de zone, les rapports PF (par commune) et
    // ASCQ (par arrondissement) de tout son périmètre — pour permettre le détail par
    // commune/arrondissement en plus de la zone sanitaire complète (voir listPerimetreRapport_).
    const users = readSheet_(SHEETS.USERS);
    const pfIds = users.filter(u => u.Role === ROLES.PF && u.ResponsableId === actor.ID).map(u => u.ID);
    const mesArrs = arrondissementsOfRcse_(actor.ID);
    return all.filter(r =>
      (r.Niveau === 'RCSE' && r.CompteId === actor.ID) ||
      (r.Niveau === 'PF' && pfIds.includes(r.CompteId)) ||
      (r.Niveau === 'ASCQ' && mesArrs.includes(r.ArrondissementId))
    );
  }
  if (actor.Role === ROLES.PF) {
    // Un PF reçoit, en plus de son propre rapport de commune, les rapports ASCQ (par
    // arrondissement) de ses arrondissements — pour le détail par arrondissement.
    const mesArrs = arrondissementsOfPf_(actor.ID);
    return all.filter(r =>
      (r.Niveau === 'PF' && r.CompteId === actor.ID) ||
      (r.Niveau === 'ASCQ' && mesArrs.includes(r.ArrondissementId))
    );
  }
  // Niveau ASCQ : un rapport par arrondissement couvert (partagé avec les autres ASCQ du même
  // arrondissement ; un ASCQ avec plusieurs arrondissements reçoit un rapport par arrondissement).
  if (actor.Role === ROLES.ASCQ) {
    const mesArrs = arrondissementsOfAscq_(actor.ID);
    return all.filter(r => r.Niveau === 'ASCQ' && mesArrs.includes(r.ArrondissementId));
  }
  return [];
}

// Hiérarchie géographique disponible pour construire les listes déroulantes en cascade du
// rapport hebdomadaire (bouton "Par commune" / "Par arrondissement" côté PF et RCSE).
//  - PF  : la liste de SES arrondissements (sa commune est déjà connue, c'est la vue par défaut).
//  - RCSE: pour chaque PF de sa zone, sa commune ET la liste des arrondissements de ce PF —
//    permet de choisir d'abord une commune, puis un arrondissement de cette commune.
function listPerimetreRapport_(actor) {
  const arrondissementsSheet = readSheet_(SHEETS.ARRONDISSEMENTS);
  function arrsDe_(ids) { return arrondissementsSheet.filter(a => ids.includes(a.ID)).map(a => ({ id: a.ID, nom: a.Nom })); }

  if (actor.Role === ROLES.PF) {
    return { arrondissements: arrsDe_(arrondissementsOfPf_(actor.ID)) };
  }
  if (actor.Role === ROLES.RCSE) {
    const users = readSheet_(SHEETS.USERS);
    const pfs = users.filter(u => u.Role === ROLES.PF && u.ResponsableId === actor.ID);
    const communes = pfs.map(pf => ({
      pfId: pf.ID, communeId: pf.CommuneId, nom: pf.CommuneNom,
      arrondissements: arrsDe_(arrondissementsOfPf_(pf.ID))
    }));
    return { zoneSanitaireNom: zoneSanitaireNomDeRcse_(actor), communes: communes };
  }
  if (actor.Role === ROLES.DEPARTEMENT) {
    const users = readSheet_(SHEETS.USERS);
    const rcses = users.filter(u => u.Role === ROLES.RCSE && u.DepartementId === actor.DepartementId);
    const zones = rcses.map(rcse => {
      const pfs = users.filter(u => u.Role === ROLES.PF && u.ResponsableId === rcse.ID);
      return {
        rcseId: rcse.ID, nom: zoneSanitaireNomDeRcse_(rcse),
        communes: pfs.map(pf => ({ pfId: pf.ID, communeId: pf.CommuneId, nom: pf.CommuneNom, arrondissements: arrsDe_(arrondissementsOfPf_(pf.ID)) }))
      };
    });
    return { departementNom: actor.DepartementNom, zones: zones };
  }
  return {};
}

// Libellés des types de décès (doit rester synchronisé avec TYPES_DECES dans assets/forms.js),
// utilisés quand un décès n'a pas encore été investigué par l'ASCQ (il apparaît quand même dans
// le rapport, voir listRapportDetail_).
const TYPES_DECES_LABELS = {
  '1': 'Décès maternel', '2': 'Décès de bébé (0-28 jours)', '3': "Décès d'enfant 1 mois à 1 an",
  '4': 'Décès d\'enfant 1 à 5 ans', '5': 'Décès de personne de plus de 5 ans'
};

// Somme les valeurs numériques d'un objet JSON (ex: CasParCategorie / DecesParCategorie)
function sumJsonValues_(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr || '{}');
    return Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);
  } catch (e) { return 0; }
}

// Détail COMPLET des événements AVÉRÉS (confirmés par l'ASCQ, EvenementAvere = "Oui") pour une
// semaine épidémiologique donnée, dans le périmètre de l'utilisateur connecté. Reprend, pour
// chaque événement, TOUTES les rubriques de la fiche officielle "10_BJ_Fiche d'investigation des
// événements de santé par les ASCQ" (et non plus seulement la ligne de synthèse), plus :
//  - la liste des SITES NOTIFICATEURS (les RC / villages à l'origine des cas comptabilisés dans
//    la synthèse du rapport de la semaine), pour objectiver d'où viennent les données ;
//  - les SIGNATAIRES du rapport (ASCQ, PF CCLS-TP, RCSE responsables du périmètre couvert), pour
//    le bas de page du rapport imprimé/exporté en PDF.
// Renvoie { detail, sites, signataires }.
function listRapportDetail_(actor, p) {
  const annee = p.annee, semaine = p.semaine;
  const investigations = readSheet_(SHEETS.INVESTIGATIONS);
  const villages = readSheet_(SHEETS.VILLAGES);
  const arrondissements = readSheet_(SHEETS.ARRONDISSEMENTS);
  const users = readSheet_(SHEETS.USERS);
  const userById_ = {}; users.forEach(u => userById_[u.ID] = u);

  function resolveGeo_(villageId, arrondissementIdFallback) {
    const v = villages.find(x => x.ID === villageId);
    const arrId = v ? v.ArrondissementId : arrondissementIdFallback;
    const arr = arrondissements.find(x => x.ID === arrId);
    return {
      village: v ? v.Nom : '',
      arrondissement: v ? v.ArrondissementNom : (arr ? arr.Nom : ''),
      commune: arr ? arr.CommuneNom : ''
    };
  }

  let alertes = readSheet_(SHEETS.ALERTES).filter(a => String(a.Annee) === String(annee) && String(a.SemaineEpi) === String(semaine));
  let deces = readSheet_(SHEETS.DECES).filter(d => String(d.Annee) === String(annee) && String(d.SemaineEpi) === String(semaine));

  // Périmètre PROPRE de l'utilisateur connecté (sert de garde-fou de sécurité ci-dessous).
  let mesArrondissements = null; // null = pas de restriction (NATIONAL)
  if (actor.Role === ROLES.ASCQ) mesArrondissements = arrondissementsOfAscq_(actor.ID);
  else if (actor.Role === ROLES.PF) mesArrondissements = arrondissementsOfPf_(actor.ID);
  else if (actor.Role === ROLES.RCSE) mesArrondissements = arrondissementsOfRcse_(actor.ID);
  else if (actor.Role === ROLES.DEPARTEMENT) mesArrondissements = arrondissementsOfDepartement_(actor.DepartementId);
  else if (actor.Role !== ROLES.NATIONAL) return { detail: [], sites: [], signataires: {} };

  // Périmètre EFFECTIF du rapport consulté (celui de la ligne RapportsHebdo affichée : un PF, un
  // RCSE ou un DEPARTEMENT peut demander le détail d'un niveau EN DESSOUS du sien — voir
  // listPerimetreRapport_ / listRapports_, qui exposent déjà ces rapports plus fins).
  let arrondissementsVises;
  if (p.niveau === 'ASCQ' && p.arrondissementId) arrondissementsVises = [p.arrondissementId];
  else if (p.niveau === 'PF' && p.compteId) arrondissementsVises = arrondissementsOfPf_(p.compteId);
  else if (p.niveau === 'RCSE' && p.compteId) arrondissementsVises = arrondissementsOfRcse_(p.compteId);
  else if (p.niveau === 'DEPARTEMENT' && p.compteId) {
    const compte = users.find(u => u.ID === p.compteId);
    arrondissementsVises = compte ? arrondissementsOfDepartement_(compte.DepartementId) : [];
  }
  else if (p.niveau === 'NATIONAL') arrondissementsVises = null;
  else arrondissementsVises = mesArrondissements;

  // Sécurité : le rapport demandé ne peut jamais sortir du périmètre propre de l'utilisateur.
  if (mesArrondissements) {
    arrondissementsVises = (arrondissementsVises || mesArrondissements).filter(id => mesArrondissements.includes(id));
  }

  if (arrondissementsVises) {
    alertes = alertes.filter(a => arrondissementsVises.includes(a.ArrondissementId));
    deces = deces.filter(d => arrondissementsVises.includes(d.ArrondissementId));
  }

  const rows = [];
  const sitesParNotificateur = {}; // NotificateurId -> agrégat pour le "point des sites notificateurs"

  function enregistrerSite_(notificateurId, notificateurNom, geo, nbCas, nbDeces) {
    if (!notificateurId) return;
    if (!sitesParNotificateur[notificateurId]) {
      const rc = userById_[notificateurId];
      sitesParNotificateur[notificateurId] = {
        relaisId: notificateurId,
        relaisNom: notificateurNom || (rc ? (rc.Prenom + ' ' + rc.Nom) : ''),
        telephoneRelais: rc ? rc.Telephone : '',
        village: geo.village, arrondissement: geo.arrondissement, commune: geo.commune,
        nbEvenements: 0, nbCas: 0, nbDeces: 0
      };
    }
    const s = sitesParNotificateur[notificateurId];
    s.nbEvenements += 1;
    s.nbCas += nbCas;
    s.nbDeces += nbDeces;
  }

  alertes.forEach(a => {
    const inv = investigations.find(i => i.ID === a.InvestigationId);
    if (!inv || String(inv.EvenementAvere).toLowerCase() !== 'oui') return; // seulement les événements avérés
    const geo = resolveGeo_(a.VillageId, a.ArrondissementId);
    const casParCategorie = safeParseJson_(inv.CasParCategorie);
    const decesParCategorie = safeParseJson_(inv.DecesParCategorie);
    const nbCas = sumJsonValues_(inv.CasParCategorie) || Number(a.PersonnesTouchees) || 0;
    const nbDeces = sumJsonValues_(inv.DecesParCategorie) || Number(a.PersonnesMortes) || 0;
    rows.push({
      refType: 'ALERTE', refId: a.ID,
      date: a.DateNotification || a.DateDebutMaladie,
      departement: inv.Departement || a.Departement || '', zoneSanitaire: inv.ZoneSanitaire || a.ZoneSanitaire || '',
      commune: geo.commune, arrondissement: geo.arrondissement, village: geo.village,
      relais: inv.Relais || a.NotificateurNom || '', telRelais: inv.TelRelais || (userById_[a.NotificateurId] ? userById_[a.NotificateurId].Telephone : ''),
      ascqNom: inv.ASCQNom || '', telAscq: inv.TelASCQ || '',
      gpsLat: inv.GPSLat || a.GPSLat || '', gpsLon: inv.GPSLon || a.GPSLon || '',
      evenementAvere: inv.EvenementAvere || '', source: inv.Source || '',
      maladie: inv.Maladie || a.TypeAlerte || '', evenement: inv.Maladie || a.TypeAlerte || '',
      description: inv.Description || '', circonstances: inv.Circonstances || '',
      dateSurvenue: inv.DateSurvenue || a.DateDebutMaladie || '',
      dateNotification: inv.DateNotification || a.DateNotification || '',
      dateInvestigation: inv.DateInvestigation || '',
      casParCategorie: casParCategorie, decesParCategorie: decesParCategorie,
      nombreCas: nbCas, nombreDeces: nbDeces, actions: inv.Actions || '',
      notificateurNom: a.NotificateurNom || ''
    });
    enregistrerSite_(a.NotificateurId, a.NotificateurNom, geo, nbCas, nbDeces);
  });

  // Contrairement aux alertes, un décès notifié par un RC est considéré directement comme une
  // donnée avérée : il est compté dans le rapport dès sa notification, sans attendre
  // l'investigation de l'ASCQ (celle-ci reste utile pour préciser la cause/les circonstances,
  // mais n'est jamais une condition pour qu'il apparaisse ici).
  deces.forEach(d => {
    const inv = investigations.find(i => i.ID === d.InvestigationId);
    const geo = resolveGeo_(d.VillageId, d.ArrondissementId);
    const nbCas = inv ? (sumJsonValues_(inv.CasParCategorie) || 0) : 0;
    const nbDeces = inv ? (sumJsonValues_(inv.DecesParCategorie) || 1) : 1;
    const libelleTypeDeces = TYPES_DECES_LABELS[String(d.TypeDeces)] || 'Décès communautaire';
    rows.push({
      refType: 'DECES', refId: d.ID,
      date: d.DateDeces,
      departement: (inv && inv.Departement) || d.Departement || '', zoneSanitaire: (inv && inv.ZoneSanitaire) || d.ZoneSanitaire || '',
      commune: geo.commune, arrondissement: geo.arrondissement, village: geo.village,
      relais: (inv && inv.Relais) || d.NotificateurNom || '', telRelais: (inv && inv.TelRelais) || (userById_[d.NotificateurId] ? userById_[d.NotificateurId].Telephone : ''),
      ascqNom: (inv && inv.ASCQNom) || '', telAscq: (inv && inv.TelASCQ) || '',
      gpsLat: (inv && inv.GPSLat) || d.GPSLat || '', gpsLon: (inv && inv.GPSLon) || d.GPSLon || '',
      evenementAvere: (inv && inv.EvenementAvere) || 'Oui (décès communautaire)', source: (inv && inv.Source) || '',
      maladie: (inv && inv.Maladie) || libelleTypeDeces, evenement: (inv && inv.Maladie) || libelleTypeDeces,
      description: (inv && inv.Description) || '', circonstances: (inv && inv.Circonstances) || d.Circonstances || '',
      dateSurvenue: (inv && inv.DateSurvenue) || d.DateDeces || '',
      dateNotification: (inv && inv.DateNotification) || d.DateNotification || '',
      dateInvestigation: (inv && inv.DateInvestigation) || '',
      casParCategorie: safeParseJson_(inv ? inv.CasParCategorie : ''), decesParCategorie: safeParseJson_(inv ? inv.DecesParCategorie : ''),
      nombreCas: nbCas, nombreDeces: nbDeces, actions: (inv && inv.Actions) || '',
      notificateurNom: d.NotificateurNom || ''
    });
    enregistrerSite_(d.NotificateurId, d.NotificateurNom, geo, nbCas, nbDeces);
  });

  rows.sort((x, y) => new Date(x.date) - new Date(y.date));
  const sites = Object.values(sitesParNotificateur).sort((x, y) => String(x.village).localeCompare(String(y.village)));
  const signataires = computeSignataires_(p.niveau, p.compteId, p.arrondissementId || (rows[0] ? rows[0].arrondissement : ''));

  return { detail: rows, sites: sites, signataires: signataires };
}

// Parse sûr d'un champ JSON (CasParCategorie / DecesParCategorie) vers un objet simple.
function safeParseJson_(jsonStr) {
  try { return JSON.parse(jsonStr || '{}'); } catch (e) { return {}; }
}

// Noms à faire figurer en bas de page du rapport hebdomadaire imprimé : l'ASCQ (ou les ASCQ,
// si plusieurs couvrent le même arrondissement), le PF CCLS-TP et le RCSE responsables du
// périmètre du rapport consulté. niveau/compteId sont ceux de la ligne RapportsHebdo affichée
// (r.Niveau / r.CompteId côté frontend) ; arrondissementId sert à retrouver le ou les ASCQ pour
// un rapport de niveau ASCQ.
// Signataires (ASCQ/PF/RCSE + téléphones) ET périmètre géographique (département, zone
// sanitaire, commune, arrondissement) du rapport hebdomadaire consulté — sert à préremplir
// l'en-tête de la fiche hebdomadaire même quand aucun événement n'a eu lieu cette semaine
// (le périmètre vient du compte lui-même, pas des événements). niveau/compteId sont ceux de la
// ligne RapportsHebdo affichée (r.Niveau / r.CompteId côté frontend) ; arrondissementId sert à
// retrouver le ou les ASCQ et le nom de l'arrondissement pour un rapport de niveau ASCQ.
// Nom de la zone sanitaire d'un RCSE : la concaténation des communes des DIFFÉRENTS PF qu'il a
// créés (ex. PF de Djidja, Abomey, Agbangnizoun -> "Djidja-Abomey-Agbangnizoun"), dans l'ordre
// où ces PF ont été créés, sans doublon. Si le RCSE n'a pas encore de PF (tout début
// d'activité), on retombe sur les communes assignées à sa zone à sa création (Perimetres), puis
// en dernier recours sur le champ ZoneSanitaireNom saisi manuellement.
function zoneSanitaireNomDeRcse_(rcseUser) {
  const users = readSheet_(SHEETS.USERS);
  const pfs = users.filter(u => u.Role === ROLES.PF && u.ResponsableId === rcseUser.ID);
  const communes = [];
  pfs.forEach(pf => { if (pf.CommuneNom && communes.indexOf(pf.CommuneNom) === -1) communes.push(pf.CommuneNom); });
  if (communes.length) return communes.join('-');

  const perimetres = readSheet_(SHEETS.PERIMETRES).filter(pe => pe.UserId === rcseUser.ID && pe.TypeCible === 'Commune');
  if (perimetres.length) {
    const communesSheet = readSheet_(SHEETS.COMMUNES);
    const noms = [];
    perimetres.forEach(pe => {
      const c = communesSheet.find(x => x.ID === pe.CibleId);
      if (c && noms.indexOf(c.Nom) === -1) noms.push(c.Nom);
    });
    if (noms.length) return noms.join('-');
  }
  return rcseUser.ZoneSanitaireNom || '';
}

// Nom de la zone sanitaire d'un utilisateur : c'est TOUJOURS celui du RCSE qui le chapeaute (la
// zone sanitaire n'existe qu'au niveau RCSE — PF/ASCQ/RC n'ont pas leur propre champ "zone
// sanitaire", ils héritent de celui de leur RCSE). Remonte la hiérarchie jusqu'au premier RCSE
// trouvé ; renvoie '' si l'utilisateur est lui-même NATIONAL ou orphelin.
function zoneSanitaireDe_(user) {
  if (!user) return '';
  const rcse = user.Role === ROLES.RCSE ? user : chainAbove_(user).find(u => u.Role === ROLES.RCSE);
  return rcse ? zoneSanitaireNomDeRcse_(rcse) : '';
}

function computeSignataires_(niveau, compteId, arrondissementId) {
  const users = readSheet_(SHEETS.USERS);
  const perimetres = readSheet_(SHEETS.PERIMETRES);
  const out = {
    ascq: '', pf: '', rcse: '', departementResp: '', ascqTel: '', pfTel: '', rcseTel: '', departementTel: '',
    departement: '', zoneSanitaire: '', commune: '', arrondissement: ''
  };

  function nomComplet_(u) { return u ? (u.Prenom + ' ' + u.Nom) : ''; }

  if (niveau === 'ASCQ' && arrondissementId) {
    const ascqIds = perimetres.filter(pe => pe.TypeCible === 'Arrondissement' && pe.CibleId === arrondissementId).map(pe => pe.UserId);
    const ascqs = users.filter(u => ascqIds.includes(u.ID) && u.Role === ROLES.ASCQ);
    out.ascq = ascqs.map(nomComplet_).join(', ');
    out.ascqTel = ascqs.map(u => u.Telephone).filter(Boolean).join(', ');
    if (ascqs[0]) {
      out.departement = ascqs[0].DepartementNom || '';
      out.zoneSanitaire = zoneSanitaireDe_(ascqs[0]);
      out.commune = ascqs[0].CommuneNom || '';
      const arr = readSheet_(SHEETS.ARRONDISSEMENTS).find(a => a.ID === arrondissementId);
      out.arrondissement = arr ? arr.Nom : (ascqs[0].ArrondissementNom || '');
      const chain = chainAbove_(ascqs[0]);
      const pf = chain.find(u => u.Role === ROLES.PF);
      const rcse = chain.find(u => u.Role === ROLES.RCSE);
      const dep = chain.find(u => u.Role === ROLES.DEPARTEMENT);
      out.pf = nomComplet_(pf); out.pfTel = pf ? pf.Telephone : '';
      out.rcse = nomComplet_(rcse); out.rcseTel = rcse ? rcse.Telephone : '';
      out.departementResp = nomComplet_(dep); out.departementTel = dep ? dep.Telephone : '';
    }
  } else if (niveau === 'PF') {
    const pf = users.find(u => u.ID === compteId);
    out.pf = nomComplet_(pf); out.pfTel = pf ? pf.Telephone : '';
    if (pf) {
      out.departement = pf.DepartementNom || ''; out.zoneSanitaire = zoneSanitaireDe_(pf); out.commune = pf.CommuneNom || '';
      const chain = chainAbove_(pf);
      const rcse = chain.find(u => u.Role === ROLES.RCSE);
      const dep = chain.find(u => u.Role === ROLES.DEPARTEMENT);
      out.rcse = nomComplet_(rcse); out.rcseTel = rcse ? rcse.Telephone : '';
      out.departementResp = nomComplet_(dep); out.departementTel = dep ? dep.Telephone : '';
    }
  } else if (niveau === 'RCSE') {
    const rcse = users.find(u => u.ID === compteId);
    out.rcse = nomComplet_(rcse); out.rcseTel = rcse ? rcse.Telephone : '';
    if (rcse) {
      out.departement = rcse.DepartementNom || ''; out.zoneSanitaire = zoneSanitaireDe_(rcse);
      const dep = chainAbove_(rcse).find(u => u.Role === ROLES.DEPARTEMENT);
      out.departementResp = nomComplet_(dep); out.departementTel = dep ? dep.Telephone : '';
    }
  } else if (niveau === 'DEPARTEMENT') {
    const dep = users.find(u => u.ID === compteId);
    out.departementResp = nomComplet_(dep); out.departementTel = dep ? dep.Telephone : '';
    if (dep) out.departement = dep.DepartementNom || '';
  }
  return out;
}

// ============================================================
// TABLEAU DE BORD
// ============================================================

function getDashboard_(actor) {
  const alertes = listScoped_(SHEETS.ALERTES, actor);
  const deces = listScoped_(SHEETS.DECES, actor);
  const notifications = listNotifications_(actor);
  return {
    totalAlertes: alertes.length,
    alertesNonInvestiguees: alertes.filter(a => a.Statut !== 'Investigué').length,
    totalDeces: deces.length,
    notificationsNonLues: notifications.filter(n => n.Lu === false || n.Lu === 'FALSE').length
  };
}

// Détail géographique des 4 pastilles du tableau de bord (Alertes / Décès / Non investiguées),
// dans le périmètre de l'utilisateur connecté : pour chaque village, arrondissement et commune
// où il y a EU AU MOINS UN CAS (alerte ou décès), le nombre d'alertes, de décès et d'alertes non
// investiguées. Sert à afficher, sous les pastilles, "quels villages/arrondissements/communes
// ont des cas" plutôt que de simples totaux globaux.
function getDashboardDetail_(actor) {
  const alertes = listScoped_(SHEETS.ALERTES, actor);
  const deces = listScoped_(SHEETS.DECES, actor);
  const villages = readSheet_(SHEETS.VILLAGES);
  const arrondissements = readSheet_(SHEETS.ARRONDISSEMENTS);

  function resolveGeo_(villageId, arrondissementIdFallback) {
    const v = villages.find(x => x.ID === villageId);
    const arrId = v ? v.ArrondissementId : arrondissementIdFallback;
    const arr = arrondissements.find(x => x.ID === arrId);
    return {
      village: v ? v.Nom : '',
      arrondissement: v ? v.ArrondissementNom : (arr ? arr.Nom : ''),
      commune: arr ? arr.CommuneNom : ''
    };
  }

  function agrege_(niveauCle) {
    const parCle = {};
    function ajoute_(geo, champ) {
      const cle = geo[niveauCle];
      if (!cle) return;
      if (!parCle[cle]) {
        parCle[cle] = { nom: cle, village: geo.village, arrondissement: geo.arrondissement, commune: geo.commune,
          nbAlertes: 0, nbNonInvestiguees: 0, nbDeces: 0 };
      }
      parCle[cle][champ]++;
    }
    alertes.forEach(a => {
      const geo = resolveGeo_(a.VillageId, a.ArrondissementId);
      ajoute_(geo, 'nbAlertes');
      if (a.Statut !== 'Investigué') ajoute_(geo, 'nbNonInvestiguees');
    });
    deces.forEach(d => {
      const geo = resolveGeo_(d.VillageId, d.ArrondissementId);
      ajoute_(geo, 'nbDeces');
    });
    return Object.values(parCle).sort((x, y) => (y.nbAlertes + y.nbDeces) - (x.nbAlertes + x.nbDeces));
  }

  return {
    parVillage: agrege_('village'),
    parArrondissement: agrege_('arrondissement'),
    parCommune: agrege_('commune')
  };
}

// Liste, pour l'utilisateur connecté, le SITE de chacun de ses subordonnés (directs et
// indirects) : un ASCQ voit le village de chacun de ses RC ; un PF voit l'arrondissement de
// chacun de ses ASCQ ET le village de chacun des RC de cet ASCQ ; un RCSE voit tout, jusqu'au
// village de chaque RC, pour toute sa zone (commune -> PF -> arrondissement -> ASCQ -> village
// -> RC). Une ligne par RC (le niveau le plus fin) ; les ASCQ/PF sans aucun RC apparaissent
// quand même, avec les colonnes RC/village vides, pour rester visibles.
function listCouverture_(actor) {
  const users = readSheet_(SHEETS.USERS);
  const nomComplet_ = u => u ? (u.Prenom + ' ' + u.Nom) : '';
  // Champs "éditables" d'un compte (ID/Nom/Prenom/Telephone), sous un préfixe donné — sert au
  // frontend (couverture.js) pour ouvrir la fiche de modification d'un subordonné INDIRECT
  // (ex. un RCSE qui corrige un ASCQ ou un RC), sans dupliquer une table dédiée pour chaque
  // niveau intermédiaire.
  function editable_(prefixe, u) {
    if (!u) return {};
    const o = {};
    o[prefixe + 'Id'] = u.ID; o[prefixe + 'NomChamp'] = u.Nom; o[prefixe + 'PrenomChamp'] = u.Prenom; o[prefixe + 'Telephone'] = u.Telephone;
    o[prefixe + 'Role'] = u.Role;
    o[prefixe + 'DepartementId'] = u.DepartementId; o[prefixe + 'DepartementNom'] = u.DepartementNom;
    o[prefixe + 'CommuneId'] = u.CommuneId; o[prefixe + 'CommuneNom'] = u.CommuneNom;
    o[prefixe + 'ArrondissementId'] = u.ArrondissementId; o[prefixe + 'ArrondissementNom'] = u.ArrondissementNom;
    o[prefixe + 'VillageId'] = u.VillageId; o[prefixe + 'VillageNom'] = u.VillageNom;
    return o;
  }

  if (actor.Role === ROLES.ASCQ) {
    const rcs = users.filter(u => u.Role === ROLES.RC && u.ResponsableId === actor.ID);
    return rcs.map(rc => Object.assign({
      rc: nomComplet_(rc), telephoneRc: rc.Telephone, arrondissement: rc.ArrondissementNom || '', village: rc.VillageNom || ''
    }, editable_('rc', rc))).sort((a, b) => a.village.localeCompare(b.village));
  }

  if (actor.Role === ROLES.PF) {
    const ascqs = users.filter(u => u.Role === ROLES.ASCQ && u.ResponsableId === actor.ID);
    const rows = [];
    ascqs.forEach(ascq => {
      const rcs = users.filter(u => u.Role === ROLES.RC && u.ResponsableId === ascq.ID);
      const base = { ascq: nomComplet_(ascq), arrondissement: ascq.ArrondissementNom || '' };
      if (!rcs.length) {
        rows.push(Object.assign({ rc: '', village: '' }, base));
      } else {
        rcs.forEach(rc => rows.push(Object.assign({ rc: nomComplet_(rc), village: rc.VillageNom || '' }, base, editable_('rc', rc))));
      }
    });
    return rows.sort((a, b) => a.arrondissement.localeCompare(b.arrondissement) || a.village.localeCompare(b.village));
  }

  if (actor.Role === ROLES.RCSE) {
    const pfs = users.filter(u => u.Role === ROLES.PF && u.ResponsableId === actor.ID);
    const rows = [];
    pfs.forEach(pf => {
      const ascqs = users.filter(u => u.Role === ROLES.ASCQ && u.ResponsableId === pf.ID);
      if (!ascqs.length) { rows.push({ commune: pf.CommuneNom || '', pf: nomComplet_(pf), ascq: '', arrondissement: '', rc: '', village: '' }); return; }
      ascqs.forEach(ascq => {
        const rcs = users.filter(u => u.Role === ROLES.RC && u.ResponsableId === ascq.ID);
        const base = { commune: pf.CommuneNom || '', pf: nomComplet_(pf), ascq: nomComplet_(ascq), arrondissement: ascq.ArrondissementNom || '' };
        if (!rcs.length) {
          rows.push(Object.assign({ rc: '', village: '' }, base, editable_('ascq', ascq)));
        } else {
          rcs.forEach(rc => rows.push(Object.assign({ rc: nomComplet_(rc), village: rc.VillageNom || '' }, base, editable_('ascq', ascq), editable_('rc', rc))));
        }
      });
    });
    return rows.sort((a, b) => a.commune.localeCompare(b.commune) || a.arrondissement.localeCompare(b.arrondissement) || a.village.localeCompare(b.village));
  }

  if (actor.Role === ROLES.DEPARTEMENT) {
    const rcses = users.filter(u => u.Role === ROLES.RCSE && u.DepartementId === actor.DepartementId);
    const rows = [];
    rcses.forEach(rcse => {
      const zoneNom = zoneSanitaireNomDeRcse_(rcse);
      const pfs = users.filter(u => u.Role === ROLES.PF && u.ResponsableId === rcse.ID);
      if (!pfs.length) { rows.push({ zone: zoneNom, commune: '', pf: '', ascq: '', arrondissement: '', rc: '', village: '' }); return; }
      pfs.forEach(pf => {
        const ascqs = users.filter(u => u.Role === ROLES.ASCQ && u.ResponsableId === pf.ID);
        if (!ascqs.length) { rows.push(Object.assign({ zone: zoneNom, commune: pf.CommuneNom || '', pf: nomComplet_(pf), ascq: '', arrondissement: '', rc: '', village: '' }, editable_('pf', pf))); return; }
        ascqs.forEach(ascq => {
          const rcs = users.filter(u => u.Role === ROLES.RC && u.ResponsableId === ascq.ID);
          const base = { zone: zoneNom, commune: pf.CommuneNom || '', pf: nomComplet_(pf), ascq: nomComplet_(ascq), arrondissement: ascq.ArrondissementNom || '' };
          if (!rcs.length) {
            rows.push(Object.assign({ rc: '', village: '' }, base, editable_('pf', pf), editable_('ascq', ascq)));
          } else {
            rcs.forEach(rc => rows.push(Object.assign({ rc: nomComplet_(rc), village: rc.VillageNom || '' }, base, editable_('pf', pf), editable_('ascq', ascq), editable_('rc', rc))));
          }
        });
      });
    });
    return rows.sort((a, b) => a.zone.localeCompare(b.zone) || a.commune.localeCompare(b.commune) || a.village.localeCompare(b.village));
  }

  return [];
}

// ============================================================
// DECLENCHEUR HEBDOMADAIRE (à activer manuellement — voir README)
// ============================================================

function triggerHebdomadaire_() {
  const info = semaineCouranteInfo_();
  if (info) { supprimerRapportsPourSemaine_(info.Annee, info.SemaineEpi); genererRapportsPourSemaine_(info.Annee, info.SemaineEpi); }
}

// ============================================================
// MIGRATION MANUELLE — à exécuter UNE SEULE FOIS depuis l'éditeur Apps Script
// (menu déroulant des fonctions en haut → sélectionner "migrerUtilisateurs_" → ▶ Exécuter)
// pour convertir une feuille Utilisateurs créée avec une ancienne version du script
// (colonnes Departement/Commune/Arrondissement/Village en texte + MotDePasseHash) vers la
// structure actuelle (DepartementNom/... + MotDePasse en clair), SANS perdre les comptes déjà créés.
//
// Comme les anciens mots de passe étaient hachés (donc impossibles à récupérer), chaque compte
// migré reçoit temporairement son NUMÉRO DE TÉLÉPHONE comme mot de passe. Communiquez ce mot de
// passe temporaire à chaque titulaire de compte (ou modifiez-le vous-même directement dans la
// colonne MotDePasse du Sheet après migration), et invitez-les à le changer dès leur connexion.
// ============================================================
function migrerUtilisateurs_() {
  const sh = ss_().getSheetByName(SHEETS.USERS);
  if (!sh) { Logger.log('Feuille Utilisateurs introuvable.'); return { migrated: 0, message: 'Feuille Utilisateurs introuvable.' }; }
  const values = sh.getDataRange().getValues();
  if (values.length < 1) { Logger.log('Feuille vide, rien à migrer.'); return { migrated: 0, message: 'Feuille vide, rien à migrer.' }; }
  const oldHeaders = values[0];
  const oldRows = values.slice(1).filter(r => r.join('') !== '');

  function get(row, h) {
    const i = oldHeaders.indexOf(h);
    return i >= 0 ? row[i] : '';
  }

  const newRows = oldRows.map(r => {
    const departementNom = get(r, 'DepartementNom') || get(r, 'Departement') || '';
    const communeNom = get(r, 'CommuneNom') || get(r, 'Commune') || '';
    const arrondissementNom = get(r, 'ArrondissementNom') || get(r, 'Arrondissement') || '';
    const villageNom = get(r, 'VillageNom') || get(r, 'Village') || '';
    const ids = geoIds_(departementNom || '_', communeNom || '_', arrondissementNom || '_', villageNom || '_');
    const telephone = get(r, 'Telephone');
    const motDePasseExistant = get(r, 'MotDePasse'); // déjà en clair si une migration a déjà tourné
    return [
      get(r, 'ID'), get(r, 'Nom'), get(r, 'Prenom'), telephone,
      motDePasseExistant || String(telephone), // mot de passe temporaire = numéro de téléphone
      get(r, 'Role'), get(r, 'ResponsableId'),
      departementNom ? ids.depId : (get(r, 'DepartementId') || ''),
      communeNom ? ids.comId : (get(r, 'CommuneId') || ''),
      arrondissementNom ? ids.arrId : (get(r, 'ArrondissementId') || ''),
      villageNom ? ids.vilId : (get(r, 'VillageId') || ''),
      get(r, 'GrappeId') || '',
      departementNom, communeNom, arrondissementNom, villageNom, get(r, 'GrappeNom') || '',
      get(r, 'ZoneSanitaireNom') || '',
      get(r, 'Actif') === '' ? true : get(r, 'Actif'),
      get(r, 'DateCreation'), get(r, 'CreePar')
    ];
  });

  sh.clear();
  sh.appendRow(COLS.Utilisateurs);
  sh.setFrozenRows(1);
  if (newRows.length) sh.getRange(2, 1, newRows.length, COLS.Utilisateurs.length).setValues(newRows);
  const message = 'Migration terminée : ' + newRows.length + ' compte(s) migré(s). Mot de passe temporaire = numéro de téléphone pour les comptes qui n\'avaient pas encore de mot de passe en clair.';
  Logger.log(message);
  return { migrated: newRows.length, message: message };
}

// ============================================================
// MIGRATION MANUELLE — INTRODUCTION DU RÔLE NATIONAL (à exécuter UNE SEULE FOIS, après
// migrerUtilisateurs_ si nécessaire, depuis l'éditeur Apps Script ou le menu ⚙️ Surveillance -
// Outils ci-dessous) pour les classeurs créés AVANT l'introduction du niveau NATIONAL, où le
// compte RCSE unique (U-RCSE-0001) faisait office de racine nationale.
//
// Cette migration :
//  1) Convertit ce compte RCSE racine en compte NATIONAL (même téléphone/mot de passe, pour ne
//     pas perdre l'accès), et crée un premier compte RCSE "de transition" par département déjà
//     utilisé par au moins un PF existant, avec pour mot de passe temporaire son numéro de
//     téléphone national + un suffixe (à communiquer/changer manuellement). Sa "zone sanitaire"
//     de transition regroupe TOUTES les communes du département (pas seulement celles déjà
//     utilisées par un PF), pour ne rien restreindre par rapport à avant — à ajuster ensuite
//     depuis l'écran national si vos zones sanitaires réelles ne suivent pas les départements.
//  2) Réattache chaque PF existant (ResponsableId) à ce nouveau RCSE de son département.
// Vérifiez toujours le résultat dans le Sheet après exécution avant d'informer les utilisateurs.
// ============================================================
function migrerVersNational_() {
  ensureSchema_();
  const users = readSheet_(SHEETS.USERS);
  const ancienneRacine = users.find(u => u.ID === 'U-RCSE-0001' && u.Role === 'RCSE');
  if (!ancienneRacine) {
    return { ok: false, message: 'Aucun ancien compte racine "U-RCSE-0001" trouvé — migration probablement déjà effectuée, ou classeur déjà créé avec la structure NATIONAL.' };
  }

  updateRowById_(SHEETS.USERS, ancienneRacine.ID, { Role: ROLES.NATIONAL, DepartementId: '', DepartementNom: '' });

  const pfs = users.filter(u => u.Role === ROLES.PF && u.ResponsableId === ancienneRacine.ID);
  const toutesCommunes = readSheet_(SHEETS.COMMUNES);
  const parDepartement = {};
  pfs.forEach(pf => {
    const depNom = pf.DepartementNom || 'Departement-inconnu';
    if (!parDepartement[depNom]) parDepartement[depNom] = { depId: pf.DepartementId || ('DEP-' + slug_(depNom)), pfs: [] };
    parDepartement[depNom].pfs.push(pf);
  });

  let rcseCrees = 0, pfReattaches = 0;
  Object.keys(parDepartement).forEach((depNom, idx) => {
    const info = parDepartement[depNom];
    const rcse = {
      ID: newId_('U') + '-MIG' + idx, Nom: 'RCSE', Prenom: depNom, Telephone: ancienneRacine.Telephone + '-' + (idx + 1),
      MotDePasse: 'rcse' + (idx + 1) + '2026', Role: ROLES.RCSE, ResponsableId: ancienneRacine.ID,
      DepartementId: '', CommuneId: '', ArrondissementId: '', VillageId: '', GrappeId: '',
      DepartementNom: '', CommuneNom: '', ArrondissementNom: '', VillageNom: '', GrappeNom: '',
      ZoneSanitaireNom: depNom + ' (transition)',
      Actif: true, DateCreation: nowStr_(), CreePar: ancienneRacine.ID
    };
    appendRow_(SHEETS.USERS, rcse);
    const communesDuDep = toutesCommunes.filter(c => c.DepartementId === info.depId);
    communesDuDep.forEach(c => appendRow_(SHEETS.PERIMETRES, { ID: newId_('PER'), UserId: rcse.ID, TypeCible: 'Commune', CibleId: c.ID, AssignePar: ancienneRacine.ID, Date: nowStr_() }));
    rcseCrees++;
    info.pfs.forEach(pf => { updateRowById_(SHEETS.USERS, pf.ID, { ResponsableId: rcse.ID }); pfReattaches++; });
  });

  const message = `Migration NATIONAL terminée : ${rcseCrees} compte(s) RCSE de transition créé(s) (téléphones : ${ancienneRacine.Telephone}-1, -2, ...), ${pfReattaches} PF réattaché(s). Mots de passe temporaires : rcse12026, rcse22026, ... à communiquer puis à changer. Le compte ${ancienneRacine.Telephone} est maintenant le compte NATIONAL.`;
  Logger.log(message);
  return { ok: true, rcseCrees, pfReattaches, message };
}

// ============================================================
// MENU PERSONNALISÉ DANS LE GOOGLE SHEET
// ============================================================
// Contournement fiable au cas où le menu déroulant "Sélectionner une fonction" de l'éditeur
// Apps Script n'affiche pas (ou plus) toutes les fonctions du script — un bug d'affichage de
// l'éditeur qui arrive de temps en temps, sans rapport avec le code lui-même. Ce menu, lui,
// s'affiche directement dans le Google Sheet (onglet du haut) et exécute les fonctions
// correspondantes sans jamais passer par ce menu déroulant.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Surveillance - Outils')
    .addItem('Tester l\'exécution (diagnostic)', 'runTestDiagnostic_')
    .addSeparator()
    .addItem('Exécuter la migration des utilisateurs', 'runMigrerUtilisateurs_')
    .addItem('Exécuter la migration vers le rôle NATIONAL', 'runMigrerVersNational_')
    .addToUi();
}

function runTestDiagnostic_() {
  SpreadsheetApp.getUi().alert(
    '✅ Ce menu fonctionne : les fonctions du script s\'exécutent normalement.\n\n' +
    'Le souci ne concerne donc que l\'affichage du menu déroulant "Sélectionner une fonction" ' +
    'de l\'éditeur Apps Script (un bug d\'interface), pas votre code. Vous pouvez utiliser ce ' +
    'menu ⚙️ Surveillance - Outils pour exécuter les fonctions à la place.'
  );
}

function runMigrerUtilisateurs_() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Migrer les utilisateurs',
    'Cette opération convertit la feuille Utilisateurs vers la structure la plus récente, sans supprimer aucun compte. Continuer ?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  try {
    const res = migrerUtilisateurs_();
    ui.alert(res && res.message ? res.message : 'Migration terminée.');
  } catch (err) {
    ui.alert('Erreur pendant la migration : ' + (err && err.message ? err.message : err));
  }
}

function runMigrerVersNational_() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Migrer vers le rôle NATIONAL',
    'Cette opération transforme votre compte RCSE racine (U-RCSE-0001) en compte NATIONAL et crée un compte RCSE de transition par département déjà utilisé. À exécuter UNE SEULE FOIS. Continuer ?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  try {
    const res = migrerVersNational_();
    ui.alert(res && res.message ? res.message : 'Migration terminée.');
  } catch (err) {
    ui.alert('Erreur pendant la migration : ' + (err && err.message ? err.message : err));
  }
}

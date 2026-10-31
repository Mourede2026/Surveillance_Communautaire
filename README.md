# SIVEC — Système d'Information et de Veille Épidémiologique Communautaire

Plateforme de surveillance à base communautaire (Bénin) : frontend statique (GitHub Pages) +
backend Google Apps Script / Google Sheets.

## Hiérarchie des comptes

```
NATIONAL  ->  RCSE  ->  PF CNLS-TP  ->  ASCQ  ->  RC
```

- **NATIONAL** — importe la structure administrative standard du pays (départements, communes,
  arrondissements, villages) et crée les comptes **RCSE**, en leur assignant directement les
  communes qui composent leur **Zone Sanitaire**.
- **RCSE** — coordination d'une **Zone Sanitaire** : un regroupement de communes (pas
  nécessairement du même département) assigné par le NATIONAL dès la création du compte. Crée
  les comptes **PF CNLS-TP** (une commune de sa zone chacun) et leur assigne des arrondissements.
- **PF CNLS-TP** — rattaché à **une seule commune** (aucune commune supplémentaire n'est
  assignable à un PF). Crée les comptes **ASCQ** et leur assigne des arrondissements.
- **ASCQ** — rattaché à un ou plusieurs **arrondissements**. Crée les comptes **RC** et leur
  assigne des grappes.
- **RC** (relais communautaire) — rattaché à **un seul village** (choisi parmi ceux de
  l'arrondissement de son ASCQ) et à une **grappe principale** dans ce village, identifiée par un
  **numéro de 1 à 20** (nom facultatif). Optionnellement, l'ASCQ peut lui assigner d'autres grappes
  (même village, autre village de son arrondissement ou autre arrondissement de la commune). Une
  même grappe peut être couverte par plusieurs RC.

Chaque niveau reçoit son périmètre géographique **dès la création de son compte** par son
supérieur direct (aucune étape d'assignation séparée à effectuer avant de pouvoir travailler), et
ne voit / n'assigne ensuite que ce qui se trouve dans son propre périmètre.

## Géographie

```
Département -> Commune -> Arrondissement -> Village -> Grappe
```

Les 4 premiers niveaux sont chargés une fois pour toutes par le compte **NATIONAL** (onglet
"Géographie nationale" -> "Importer la structure administrative nationale") à partir de la liste
officielle des 12 départements / 77 communes / 546 arrondissements / 3 769 villages
(`assets/geo-benin-data.js`). Les **grappes** n'existent pas dans cette liste nationale : elles
sont créées à la volée par les ASCQ (numéro de 1 à 20, nom facultatif) au fil de la création ou de l'assignation de leurs RC.

Chaque utilisateur peut choisir la **couleur de son application** (menu du profil > « Couleur de
l'application ») ; le choix est enregistré dans la colonne `Couleur` de la feuille `Utilisateurs`.

RCSE, PF et ASCQ peuvent chacun ajouter des arrondissements ou villages "hors liste nationale"
dans leur propre périmètre si un site d'intervention n'y figure pas.

## Installation / migration

Voir les commentaires en tête de `Code.gs` pour l'installation du backend Apps Script.

**Classeurs déjà en production avant l'introduction du rôle NATIONAL** : exécutez une seule fois
`migrerVersNational_()` (menu Google Sheet **Surveillance - Outils -> Exécuter la migration vers
le rôle NATIONAL**, ou depuis l'éditeur Apps Script). Cette migration transforme le compte RCSE
racine existant en compte NATIONAL et crée un compte RCSE de transition par département déjà
utilisé par vos PF existants (zone sanitaire de transition = toutes les communes de ce
département), en réattachant automatiquement les PF concernés. Vérifiez le résultat dans le Sheet
et communiquez les nouveaux mots de passe temporaires aux titulaires des comptes RCSE créés — vous
pourrez ensuite ajuster les communes de chaque zone sanitaire depuis l'écran national si elles ne
correspondent pas exactement aux vraies zones sanitaires.


## Suivi groupé des RC (ASCQ)

- **Planning** : l'ASCQ planifie une séance (date, heure, lieu, village(s), RC convoqués, thèmes). Les niveaux
  PF, RCSE, Département et National la voient (onglet « Suivi groupé RC ») et reçoivent une notification.
- **Compte rendu** : filtre par village -> cases à cocher des RC présents (sélection conservée d'un village à
  l'autre), thèmes, et au moins une photo **ou** un document (PDF, Word, Excel, texte ; 5 Mo max).
- Nouvelle feuille `PlanningsSuivis` et nouvelles colonnes de `SuivisGroupes` : créées automatiquement.
  **Après mise à jour de Code.gs, redéployez une nouvelle version de l'application web.**


## Serveur autonome (sans Google Sheets) — recommandé

Le dossier `server/` fait de l'application **son propre serveur** : plus de Google Sheets ni d'Apps Script.
Il exécute `Code.gs` (mêmes règles métier) sur une base locale `data/db.json`, stocke les photos et
documents dans `data/uploads/`, sert l'application et fournit l'**interface d'administration des données**
(`admin.html`, compte NATIONAL : voir/chercher/modifier/supprimer chaque table, exports JSON/Excel/CSV,
import, sauvegardes).

```bash
cd server && npm install        # une seule fois (Excel import/export)
cd .. && node server/server.js  # puis ouvrir http://localhost:3000
```

Variables utiles : `PORT` (3000), `DATA_DIR` (./data), `PUBLIC_URL` (URL publique du site, pour les liens des
fichiers), `INITIAL_NATIONAL_PASSWORD` (mot de passe du premier compte NATIONAL), `ALLOWED_ORIGIN` (*).

**Premier démarrage** : compte NATIONAL `61790075` / `national2026` (ou `INITIAL_NATIONAL_PASSWORD`) — changez le
mot de passe immédiatement (« Mon compte »).

**Reprendre vos données Google Sheets** : Google Sheets > Fichier > Télécharger > Excel (.xlsx), puis
`admin.html` > « Importer des données » > classeur Excel. (Les photos déjà stockées sur Drive gardent leurs liens Drive.)

**Hébergement** : le serveur doit tourner sur une machine allumée en permanence avec un **disque persistant**
(VPS, Render/Railway/Fly avec volume, etc.). Un `Dockerfile` est fourni (volume `/data`). GitHub Pages ne peut pas
l'héberger. Placez-le derrière HTTPS (reverse proxy / hébergeur). **Sauvegardes** : automatiques chaque nuit dans
`data/backups` (30 jours) ; téléchargez-les régulièrement ailleurs.

Le mode Google Sheets reste possible : sans serveur, `assets/api.js` utilise l'URL Apps Script d'origine.


## Cycle de vie d'un suivi groupé (preuves et traçabilité)

1. **Planification** (ASCQ) : date, heure, lieu, village(s), RC convoqués, thèmes. Les RC convoqués sont notifiés ;
   PF, RCSE, Département et National voient le planning et sont notifiés.
2. **Compte rendu** (ASCQ, après la séance) : date réelle (jamais dans le futur), lieu, village(s) -> RC présents,
   thèmes, au moins une photo **ou** un document, commentaires. Les absents (convoqués non présents) sont déduits
   automatiquement. Confirmation avant dépôt.
3. **Verrouillage** : une fois déposé, le rapport ne peut plus être modifié ni remplacé (aucune action de
   modification n'existe côté API ; un doublon et un second dépôt pour la même séance sont refusés).
   L'ASCQ peut le consulter à tout moment (Historique -> « Voir la fiche »).
4. **Contrôle hiérarchique** : chaque niveau supérieur voit, pour son périmètre, le planning, l'historique avec
   la mention Réalisé / Non réalisé / À venir, le taux de réalisation, et la fiche complète de chaque séance
   (présence nominative, photos, documents, commentaires), imprimable ou exportable en PDF.
   Filtres : statut, ASCQ, période, recherche libre.

Seul le compte NATIONAL peut intervenir directement sur les données brutes, via `admin.html` (serveur autonome).


## Décès communautaires : confirmation par l'ASCQ

Un décès notifié par un RC arrive à l'ASCQ avec le statut « En attente ». L'ASCQ (onglet « Décès à confirmer »)
le **confirme** ou **ne le confirme pas** (motif obligatoire) ; la décision est définitive. Seuls les décès
**confirmés** sont comptés dans le rapport hebdomadaire (synthèse et détail). Le RC et la hiérarchie sont notifiés
de la décision. Les décès enregistrés avant cette mise à jour restent « En attente » jusqu'à leur confirmation.

## Suppression de comptes

Tout compte supérieur peut supprimer un compte de sa descendance (à n'importe quel niveau) ; le National peut tout
supprimer (sauf les comptes nationaux). Si le compte a des comptes en dessous (ex. un ASCQ et ses RC), l'interface
liste ces comptes et exige de taper SUPPRIMER : tout l'ensemble est alors supprimé. Les lignes sont réellement
effacées de la feuille « Utilisateurs » (ainsi que sessions, périmètres et notifications du compte). Les données
déjà saisies (alertes, décès, suivis, rapports) sont conservées, avec le nom de leur auteur, comme historique.

## Activités (liens de collecte, formations, tests)

- Les niveaux **ASCQ, PF, RCSE, Département et National** ouvrent l'onglet « 🔗 Activités » → « Demander une activité » : type, titre, lien https, consignes, date limite, et **niveaux destinataires** (uniquement en dessous du leur, dans leur propre hiérarchie).
- Les comptes destinataires reçoivent une notification et voient l'activité dans leur onglet « Activités » (lien, consignes, commentaires), puis marquent « Ouvert » / « Fait ».
- Le demandeur suit l'avancement compte par compte, peut modifier, **commenter** (les destinataires sont notifiés), archiver ou supprimer. Un niveau bas ne peut jamais en demander à un niveau haut ; le RC n'en crée pas.
- Après mise à jour de `Code.gs` : « Déployer » → « Gérer les déploiements » → nouvelle version.

**Échéance (obligatoire)** : toute activité a une échéance. Le lendemain de cette date, elle disparaît de l'espace des destinataires (et ne peut plus être marquée « fait »). Seul le demandeur la retrouve, marquée « Échue », avec tout son suivi ; il peut prolonger l'échéance pour la rendre de nouveau visible.

## Profil, thème, orientation

- Bouton rond « profil » (silhouette blanche) en haut à droite de chaque espace : modifier ses paramètres (Mon compte), thème clair / sombre / auto, changer de compte (comptes déjà connectés sur l'appareil, sans mot de passe stocké, seulement le jeton de session), ajouter un compte, se déconnecter.
- L'application installée accepte toutes les orientations (`"orientation": "any"` dans `manifest.json`) ; mise en page adaptée au paysage sur téléphone. Sur Android, il faut parfois **désinstaller puis réinstaller** l'application pour que le nouveau manifeste soit pris en compte.
- Nouvelle action `getMe` dans `Code.gs` : redéployez une nouvelle version.

## Nettoyage (tous les niveaux supérieurs au RC)

Onglet « 🗑️ Nettoyage des données » pour ASCQ, PF, RCSE, Département et National. Hors national, on ne peut supprimer que les **paramétrages** : les comptes situés sous soi (toute la descendance, jamais le sien) et les activités qu'on a créées. Les **données collectées** (alertes, décès, investigations, rapports, suivis groupés) ne sont supprimables que par le National, qui peut aussi vider journal, calendrier et géographie. Contrôlé côté serveur ; confirmation en tapant SUPPRIMER. Redéployez `Code.gs`.

## Tendances, photo de profil, rotation

- **Tableau de bord** de chaque espace : un graphique par événement notifié (maladies, décès) sur les semaines épidémiologiques d'une année (choix de l'année), en histogramme à barres collées ou en courbe. Sans notification, la série reste à zéro. Périmètre calculé côté serveur (action `getTendances`).
- Les boutons « Mon compte » et « Déconnexion » de la barre latérale ont été retirés : tout passe par le bouton profil.
- **Photo de profil** : profil → « Modifier mes paramètres » → « Choisir une photo ». Redimensionnée (192 px) puis enregistrée dans la colonne `Photo` de la feuille `Utilisateurs` (créée automatiquement). Redéployez `Code.gs`.
- **Rotation** : `orientation: any` + déverrouillage au démarrage. L'application déjà installée garde l'ancien manifeste : **désinstallez-la puis réinstallez-la** depuis le navigateur (et vérifiez que la rotation automatique est activée sur le téléphone).

**Filtres des graphiques** : Département → Commune → Arrondissement → Village (en cascade, limités au périmètre du compte ; un niveau n'apparaît que s'il offre plus d'un choix), plus l'année. Filtrage fait côté serveur (`getTendances`, paramètre `filtre`). Redéployez `Code.gs`.

## Guide d'utilisation intégré

Bouton **📖 Guide** (barre du haut, et entrée du menu profil) : un guide complet par niveau (RC, ASCQ, PF, RCSE, Département, National), de la connexion jusqu'à chaque fonction de l'espace. Sommaire, recherche, précédent / suivant, suivi des sections lues, impression. Contenu modifiable dans `assets/guide-data.js` ; chargé à la demande et disponible hors ligne une fois visité.


## Identité visuelle SIVEC

- Le logo de l'application reste l'illustration d'origine (`assets/icons/logo_master.png` ; version légère pour l'animation : `assets/sivec-logo.png`), associée au nom **SIVEC**.
- Il s'affiche dans la barre latérale (ordinateur), la barre du haut (téléphone) et la page de connexion de tous les espaces ; les icônes de l'application installée et le favicon (`assets/icons/`) sont ceux d'origine.
- Après mise à jour, le cache de l'application passe en version `sivec-v25` : les téléphones se mettent à jour à la prochaine ouverture.

## Export Excel du tableau de bord

- **Tendances** (tous les espaces) : bouton « ⬇ Exporter en Excel » dans la barre des filtres. Le fichier reprend les filtres actifs (année, département, commune, arrondissement, village) : feuille *Filtres* (récapitulatif), feuille *Synthèse* (total et nombre de notifications par semaine épidémiologique, pour chaque événement) et feuille *Graphiques* (image de chaque graphique).
- **Détail géographique** (ASCQ, PF, RCSE, Département) : bouton « ⬇ Exporter en Excel » : feuilles *Villages*, *Arrondissements* et *Communes*.
- Le fichier .xlsx est produit dans le navigateur par `assets/export-excel.js` (aucune librairie, fonctionne hors ligne).

## Animation d'ouverture (spot de 30 s avec son)

- **Histoire** : un matin dans un village, des enfants ont de la fièvre et des boutons ; la communauté prévient le relais communautaire ; le RC enregistre l'alerte sur son application ; l'ASCQ et toute la chaîne sont informés ; l'ASCQ investigue et la riposte s'organise ; le logo de l'application apparaît en fin de spot.
- `assets/sivec-intro.js` dessine le spot en canvas (aucun fichier vidéo) ; le son est dans `assets/sivec-spot.m4a` (30 s) et `assets/sivec-sting.m4a` (révélation du logo seule, ≈ 4,6 s). Musique et bruitages sont synthétisés (aucun échantillon sous licence).
- Page de connexion : spot complet au tout premier lancement (bouton « Passer »), puis seulement la révélation du logo une fois par session ; bouton « ▶ Découvrir SIVEC en 30 secondes » pour revoir le spot.
- **Son** : les navigateurs interdisent de démarrer un son sans geste de l'utilisateur. Au lancement automatique, un bouton « 🔇 Activer le son » (en haut à gauche) apparaît : un appui lance le son en le recalant sur l'image. Quand on clique sur « ▶ Découvrir SIVEC en 30 secondes », le son démarre tout de suite.
- L'animation est désactivée si l'appareil demande de réduire les animations.
- Pour rejouer le spot comme au premier lancement : effacer la clé `sivec_film_vu` du stockage local du navigateur.

## Alertes infection validées, signatures et liste de présence

**À déployer ensemble** : le front-end (ce dossier) ET `Code.gs` (Google Apps Script : « Nouveau déploiement »). Les nouvelles colonnes (`Signature` dans Utilisateurs ; `AutresPresentsIds`, `AutresPresentsNoms` dans SuivisGroupes) sont créées automatiquement au premier appel.

- **Alerte infection validée** : quand un ASCQ investigue et valide un événement (fiche « événement avéré ») ou confirme un décès, les niveaux supérieurs reçoivent une notification de synthèse (type `ALERTE_VALIDEE`) et la voient dans le tableau de bord (carte « Alertes infection validées par l'ASCQ ») : affection / événement, village, arrondissement, commune, cas touchés, cas décédés, animaux touchés et décédés (si l'événement concerne des animaux), résumé, notificateur et ASCQ validateur. Filtre de recherche et export Excel. Action serveur : `listAlertesValidees`.
- **Correction d'un défaut** : la fiche d'investigation n'enregistrait pas la maladie, le caractère avéré, le résumé ni les actions (noms de champs du formulaire différents des colonnes). C'est corrigé dans `submitInvestigation_` (`INVESTIGATION_FIELD_MAP`) ; les fiches déjà enregistrées gardent leurs colonnes vides : leur alerte reste comptée comme validée (seul « Non » exclut), avec l'affection tirée de l'alerte.
- **Signature** : « Mon compte › Ma signature » (dessin au doigt ou à la souris, PNG réduit enregistré dans Utilisateurs.Signature, action `setSignature`). Elle apparaît dans le rapport hebdomadaire (signature au-dessus de la ligne, nom et prénom dessous) pour le rapporteur du niveau concerné ; sans signature enregistrée, la place reste vide pour signer à la main. Les signatures ne sont pas renvoyées dans la liste des comptes (poids).
- **Liste de présence des suivis groupés** (`assets/liste-presence.js`, action `getListePresence`) : en-tête département, zone sanitaire, commune, arrondissement, date ; colonnes N° d'ordre, Nom et prénom, Qualification, Provenance (arrondissement ou village), Contact téléphonique, Signature. Participants : l'ASCQ, les RC présents et les « autres participants » (superviseurs cochés dans le formulaire de suivi, action `listSuperviseurs`). Visible dans la fiche du suivi et via « 👥 Présence » ; impression / PDF et export Excel (signatures en images).

## Mode hors connexion

`assets/hors-ligne.js` (chargé juste après `api.js` dans toutes les pages d'espace) enveloppe `Api.call`.

- **Relais communautaire** : une **alerte** ou un **décès** peut être notifié sans réseau. La notification est gardée sur le téléphone (IndexedDB, file d'attente) puis envoyée automatiquement, dans l'ordre, au retour de la connexion (événement `online`, ouverture de l'application, retour au premier plan, minuteur de 45 s) ou avec « Envoyer maintenant ». Onglet **Historique › Envois en attente** : liste, « Réessayer », « Supprimer ».
- **Aucun doublon** : chaque envoi porte un `clientId`. Si la réponse du serveur se perd, le renvoi est reconnu (`dejaRecu_` dans `Code.gs`, sous verrou `LockService`). Le serveur conserve l'heure réelle de saisie (`DateSaisie`) et note `ClientId`, `HorsLigne`, `SynchroniseLe` dans Alertes / Décès ; le message à l'ASCQ précise « saisie hors connexion le … ».
- **Tous les niveaux** : lecture seule hors connexion. Toute lecture réussie (actions `list…` / `get…`) est mémorisée par compte ; sans réseau, la dernière copie est servie, avec la date de mise à jour dans le bandeau. Il faut avoir ouvert les écrans au moins une fois avec connexion. Les autres actions (création, modification, suppression…) demandent une connexion.
- **Ouverture sans réseau** : sur la page de connexion, une session déjà ouverte sur l'appareil permet « Continuer » ; sans réseau, l'application reprend directement l'espace de l'utilisateur.
- **Session expirée pendant l'absence** : rien n'est perdu ; le bandeau invite à se reconnecter, puis les notifications partent. Un envoi **refusé** par le serveur est conservé avec son motif (jamais renvoyé en boucle).
- **Déconnexion** : les données mises en cache sont effacées de l'appareil ; les notifications en attente sont conservées (elles ne sont envoyées que depuis le compte qui les a saisies).
- À déployer : le front-end ET `Code.gs` (nouveau déploiement). Cache de l'application : `sivec-v28`.

## Investigation : données du RC modifiables, suppression, calendrier en PDF

- **Données complètes du RC** : dans « À investiguer » (alertes) et « Décès à confirmer », l'ASCQ voit **toutes** les données saisies par le RC (identification, signes, ampleur, animaux, localisation, semaine épidémiologique, saisie hors connexion…). Module `assets/notification-rc.js`.
- **Corriger avant de valider** : bouton « ✏️ Modifier les données » (champs : identité, type d'alerte, signes, dates, personnes et animaux touchés / décédés, circonstances du décès…). Interdit une fois la notification validée (alerte investiguée, décès confirmé). La fiche d'investigation est préremplie avec l'événement, la date de début et le nom du RC. Action serveur : `modifierNotificationRc`.
- **Supprimer une notification du RC** : bouton « 🗑️ Supprimer » (motif obligatoire). Retire la notification, sa fiche d'investigation éventuelle et les notifications envoyées aux niveaux supérieurs. Action serveur : `supprimerNotificationRc`.
- **Traçabilité** : chaque correction (avant / après) et chaque suppression (copie de sauvegarde de la notification et de sa fiche) est écrite dans la feuille **JournalModifications** (auteur, date, motif). Le RC reçoit une notification « ✏️ corrigée » ou « 🗑️ supprimée » avec le motif. Colonnes `ModifieParAscq`, `DateModification` ajoutées à Alertes et Décès. Ces actions sont réservées à l'ASCQ du périmètre.
- **Calendrier épidémiologique en PDF** : carte « 📅 Calendrier épidémiologique » dans le tableau de bord de tous les profils (RC, ASCQ, PF, RCSE, Département, National) : choix de l'année et bouton « ⬇ Télécharger le PDF » (A4, deux colonnes de semaines, semaine en cours surlignée, logo). PDF fabriqué dans le navigateur (`assets/pdf-mini.js`, `assets/calendrier-pdf.js`), sans dépendance ; fonctionne hors connexion avec le dernier calendrier chargé. Le calendrier reste créé uniquement par l'administrateur national.
- À déployer : le front-end ET `Code.gs` (nouveau déploiement). Cache de l'application : `sivec-v30`.

## Tâches (recensement et suivi de cas) et preuves de sensibilisation

**À déployer ensemble** : le front-end (ce dossier) ET `Code.gs` (Apps Script : « Nouveau déploiement »). Les nouvelles feuilles (`TachesCas`, `TachesSuivis`, `Sensibilisations`) et la colonne `Questionnaire` de `Activites` sont créées automatiquement au premier appel. Les photos de sensibilisation utilisent le même dossier Drive que les suivis groupés : si ce n'est pas déjà fait, exécutez une fois `autoriserDrive` dans l'éditeur Apps Script. Cache de l'application : `sivec-v31`.

### Activité de type « Tâche (recensement et suivi) »
- **Création** (ASCQ, PF, RCSE, Département, National) : Activités › Demander une activité › type *Tâche (recensement et suivi)*. Le demandeur rédige **dans la plateforme** : (1) les *informations clés du cas* à recenser, (2) le *questionnaire de suivi quotidien*, (3) la *durée du suivi* (1 à 90 jours). Types de questions : texte court, texte long, nombre, date, choix unique, choix multiples, oui/non ; chaque question peut être obligatoire ; ordre modifiable. Les destinataires sont toujours les **RC de sa hiérarchie**. L'échéance (facultative) = date limite pour **recenser de nouveaux cas** (sans date, le recensement reste ouvert) ; le suivi des cas déjà recensés se poursuit jusqu'à la fin de sa durée, même après l'échéance.
- **Relais communautaire** : Activités › « Ouvrir la tâche » › *Recenser un cas* (formulaire généré, date de recensement) puis *Mes cas* : chaque cas est suivi jour par jour (Jour 1 … Jour N). Rattrapage possible des jours manqués ; ressaisir un jour remplace la saisie. Le RC peut **clôturer** un cas avec une issue (Guéri, Décédé, Référé / transféré, Perdu de vue, Autre). Un badge « N cas à suivre » apparaît dans le menu Activités.
- **Données collectées** : onglet *🗂️ Données collectées* (demandeur et National) : totaux (cas, en suivi, suivis saisis, suivis en retard), filtres, dossier de chaque cas (réponses + suivi jour par jour), export CSV (cas ; suivis journaliers). Visible par le demandeur et le National uniquement.
- Supprimer la tâche supprime ses cas et suivis. Le questionnaire peut être modifié après l'envoi (voir « Modifier une activité envoyée »).
- **Hors connexion** : recensement d'un cas, suivi du jour et sensibilisation passent par la file d'attente de `hors-ligne.js` (sans doublon grâce au `clientId`). Les cas doivent avoir été chargés une fois en ligne pour pouvoir être suivis ensuite hors connexion.

### Preuves de sensibilisation communautaire
- **RC** : menu *📣 Sensibilisations* › *Nouvelle sensibilisation* : date (pas dans le futur), thème, lieu, **statistiques des personnes sensibilisées, sans les noms** — adultes hommes, adultes femmes, enfants garçons, enfants filles (enfant = moins de 18 ans), total calculé en direct — et **1 à 5 photos** de la séance (réduites automatiquement, stockées dans Drive). Au moins une personne et une photo sont obligatoires. Historique dans *Mes sensibilisations*.
- **ASCQ, PF, RCSE, Département, National** : menu *📣 Sensibilisations* (lecture) : séances des RC de leur périmètre, totaux personnes / adultes (H, F) / enfants (G, F), filtres (texte, dates), photos, détail de la répartition, export CSV (une ligne par séance). Une notification (type `SENSIBILISATION`) est envoyée à toute la chaîne hiérarchique.
- Nouveaux fichiers : `assets/taches.js`, `assets/sensibilisations.js`. Nouvelles actions : `tacheEnregistrerCas`, `tacheSaisirSuivi`, `listTacheCas`, `submitSensibilisation`, `listSensibilisations`.
- Le serveur autonome (`server/`) fournit maintenant un `LockService` factice (inexistant avant), nécessaire à `avecVerrou_` (alertes, décès, tâches, sensibilisations).

## Rapport de séance + liste de présence (suivi groupé)
- **Rapport de séance** : la liste de présence (fiche du suivi › « 👥 Présence », impression/PDF et export Excel) s'ouvre désormais **avec le rapport de séance**, placé avant la liste (saut de page à l'impression). Contenu : en-tête (département, zone sanitaire, commune, arrondissement, date, lieu, animateur, village(s), objectif), **thèmes développés**, **résumé structuré de chaque thème choisi** (signes, définition du cas alerte, transmission, prévention, conduite à tenir du RC, rôle du RC — extraits automatiquement des modules de briefing, `assets/rapport-seance.js`), participation (présents, absents, autres acteurs), observations, pièces jointes. L'Excel contient deux feuilles : « Rapport de séance » et « Liste de présence ».
- **Autres acteurs** : dans le formulaire de suivi groupé de l'ASCQ, bloc « Autres acteurs présents (sans compte SIVEC) » (ex. médecin chef de commune) : nom, prénom, qualification (obligatoires), provenance, contact ; bouton **« + Ajouter un autre acteur »** pour en ajouter autant que nécessaire. Ils figurent dans la liste de présence (signature à la main) et dans le décompte « autres acteurs » du rapport. Nouvelle colonne `AutresActeurs` (feuille des suivis), créée automatiquement. Cache : `sivec-v32`.

## Prise de photo : appareil photo + galerie
Partout où l'application demande une photo (suivi groupé de l'ASCQ, preuve de sensibilisation du RC, photo de profil dans « Mon compte »), deux boutons sont proposés : **📷 Prendre une photo** (ouvre directement l'appareil photo du téléphone, `capture="environment"`, caméra frontale pour la photo de profil) et **🖼️ Choisir dans la galerie**. Sur ordinateur, « Prendre une photo » ouvre le sélecteur de fichiers habituel. Cache : `sivec-v33`.

## Modifier une activité envoyée / une séance planifiée ; échéance facultative
- **Échéance facultative** : une activité ou une tâche peut être créée sans date limite (elle reste ouverte jusqu'à son archivage) ; la date peut être ajoutée, changée ou supprimée à tout moment.
- **Modifier une activité envoyée** (Activités › « Voir / Modifier », par le compte qui l'a créée) : la fenêtre rouvre **le même formulaire qu'à la création, pré-rempli** (comme un brouillon) : titre, **type**, consignes, lien, échéance et **niveaux destinataires** ; on peut transformer une activité classique en tâche (modèle de questionnaire proposé) et une tâche sans aucun cas recensé en activité classique. Pour une **tâche** : questions d'enregistrement et de suivi (ajout, modification, ordre, retrait) et durée du suivi. Les questions existantes gardent leur identifiant, donc leurs réponses déjà collectées (leur intitulé, type et choix restent modifiables) ; une question ajoutée reçoit un identifiant jamais utilisé ; retirer une question masque ses réponses (confirmation demandée). Une nouvelle durée s'applique aussi aux cas dont le suivi n'est pas clôturé. **Les destinataires reçoivent une notification** « Activité modifiée » listant ce qui change.
- **Modifier une séance planifiée** (ASCQ, Suivi groupé › Planning › « ✏️ Modifier ») : date, heure, lieu, objectif, thèmes. Les RC convoqués et la hiérarchie sont notifiés. Villages et RC convoqués ne changent pas (annuler puis replanifier). Cache : `sivec-v35`.

## Point de la semaine (tableau de bord des niveaux supérieurs au RC)
En tête du bloc « Alertes validées » du tableau de bord (ASCQ, PF, RCSE, Département, National), un encadré **« 🗓️ Point de la semaine »** résume les événements **validés par les ASCQ** de la semaine épidémiologique choisie (semaine en cours par défaut, boutons « Semaine précédente / suivante » ; sans calendrier importé : semaine du lundi au dimanche). Structure : une phrase d'introduction (« Point de la semaine S43 / 2026 (du … au …) : N événements de santé validés par les ASCQ dans votre périmètre : »), puis **une ligne par affection ou type de décès, avec le total puis les arrondissements et leur nombre de cas**, **alertes avant décès** :
- 3 cas suspects de rougeole : Finagnon (2), Dan (1)
- 3 décès maternels : Minankpon (3)
- 6 décès >= 5 ans : Djidja (3), Agouna (2), Setto (1)

puis une ligne « Bilan » (personnes touchées dont décès, animaux touchés dont morts). Les alertes animales (« 5 animaux touchés (rage), dont 2 morts : Abomey (5) ») figurent entre les alertes et les décès. Les arrondissements sont triés par nombre de cas décroissant. **Aucun nom d'auteur** (ni notificateur ni ASCQ), pas de village ; la date retenue est celle de la validation. Bouton « 📋 Copier le texte » pour le coller dans un bulletin ou un message. Le périmètre de chacun est respecté. Cache : `sivec-v36`.

## Alarme sonore et notifications en direct (tous les niveaux)
`assets/alerte-sonore.js` est chargé sur toutes les pages d'espace (RC, ASCQ, PF, RCSE, Département, National) :
- **🚨 Sirène** (deux tons alternés d'environ 3,5 s, plus vibration sur téléphone) dès qu'un relais communautaire notifie une **alerte** ou un **décès** : l'ASCQ et tous les niveaux au-dessus la reçoivent (la notification est déjà envoyée à toute la chaîne hiérarchique par le serveur).
- **🔔 Carillon** pour les autres nouvelles notifications : activité publiée ou modifiée (la cible la reçoit, le badge « Activités » se met à jour), séance planifiée, sensibilisation, validation, correction…
- Un message s'affiche à chaque nouvelle notification ; si l'onglet est en arrière-plan et que l'utilisateur a autorisé les notifications du navigateur, une notification système est aussi affichée.
- Bouton **« 🔔 Son »** dans la barre du haut : « Touchez pour activer le son » (les navigateurs exigent un premier geste), « Son activé », « Son coupé » ; le choix est mémorisé sur l'appareil. Couper le son n'empêche pas les messages.
- Fonctionnement : sondage de `listNotifications` toutes les 20 secondes tant que la page est ouverte (et au retour sur l'onglet / du réseau) ; les notifications déjà présentes à l'ouverture ne sonnent pas. **Limite** : une application statique (GitHub Pages + Apps Script) ne peut pas faire de « push » serveur : l'alarme sonne uniquement si l'application est ouverte (même en arrière-plan), pas si elle est fermée. Cache : `sivec-v37`.

## Approbation des sensibilisations par l'ASCQ (paramétrable)
- **Circuit** : une sensibilisation enregistrée par un RC est **« En attente »**. Seuls le RC et **son ASCQ** la voient (notification « Sensibilisation à approuver » + carillon pour l'ASCQ). L'ASCQ l'**approuve** (✔) ou la **rejette** (✖, motif obligatoire) depuis la liste ou la fiche (filtre « En attente » par défaut, bandeau « N en attente de votre approbation »). Une sensibilisation rejetée peut encore être approuvée ensuite ; le RC peut aussi la ré-enregistrer après correction.
- **Remontée** : PF, RCSE, Département et National **ne voient que les sensibilisations approuvées** et ne sont notifiés qu'**au moment de l'approbation** (« … approuvée par l'ASCQ »). Le RC est notifié de chaque décision (avec le motif en cas de rejet) et voit le statut de chacune de ses sensibilisations.
- **Paramètre national** : dans *📣 Sensibilisations*, le compte National coche/décoche « Exiger la validation de l'ASCQ… » (feuille `Parametres`, clé `validationAscq`, **activé par défaut** ; voir aussi la section suivante). Désactivé, les nouvelles sensibilisations remontent directement (les « en attente » existantes restent à décider par l'ASCQ). Un RC sans ASCQ dans sa chaîne hiérarchique n'a pas d'approbateur : sa sensibilisation est transmise directement.
- Nouvelles colonnes (créées automatiquement) : `Statut`, `ApprouveParId`, `ApprouveParNom`, `DateDecision`, `MotifRejet`. Anciennes saisies sans statut = approuvées. Nouvelles actions : `decideSensibilisation`, `getParametres`, `setParametre`. Cache : `sivec-v38`.

## Validation par l'ASCQ avant toute remontée (alertes, décès, sensibilisations)
**Règle** : tout ce que produit un relais communautaire — **alertes, décès, sensibilisations** — est d'abord vu et traité par **son ASCQ** ; PF, RCSE, Département et National **ne le voient ni ne le reçoivent (ni liste, ni tableau de bord, ni notification, ni alarme) avant la validation de l'ASCQ**. **Exception** : les activités et tâches (recensement et suivi de cas) demandées par un niveau supérieur ne passent pas par cette validation. Le paramètre national `validationAscq` (case à cocher dans *📣 Sensibilisations* et en tête du bloc « Alertes validées » du tableau de bord National ; **activé par défaut**) désactive la règle : tout remonte alors immédiatement, comme avant.
- **Alerte** : à la notification, seul l'ASCQ est prévenu (notification + alarme). Quand l'ASCQ soumet la fiche d'investigation et que l'**événement est avéré**, l'alerte devient visible des niveaux supérieurs et ils reçoivent « Alerte infection validée » (alarme sonore). Événement non avéré : rien ne remonte.
- **Décès** : seul l'ASCQ est prévenu ; **confirmé** (ou investigué et avéré), il remonte et est notifié aux niveaux supérieurs ; **non confirmé** : rien ne remonte (le RC est informé de la décision).
- **Sensibilisation** : « En attente » puis approuvée/rejetée par l'ASCQ (section précédente).
- **Filtrage** : appliqué côté serveur à toutes les listes, tableaux de bord et exports des niveaux supérieurs. L'ASCQ et le RC concerné voient tout leur périmètre ; le nettoyage des données du National atteint tous les enregistrements. Un RC sans ASCQ dans sa chaîne est transmis directement. **Point d'attention** : tant que l'ASCQ n'a pas validé, les niveaux supérieurs ne savent rien ; pensez à un ASCQ suppléant pour les absences. Cache : `sivec-v39`.

## Supprimer des données collectées (demandeur d'une tâche)
Dans Activités › *🗂️ Données collectées*, le **demandeur** de la tâche (et le National) garde la main **ligne par ligne** : case à cocher par cas, case « tout sélectionner » (cas affichés, selon les filtres), **sélection rapide par relais communautaire** (pour retirer les données de certaines personnes), bouton **🗑** sur chaque ligne et « Supprimer ce cas » dans le dossier. La suppression retire le cas **et tout son suivi** définitivement (confirmation demandée) ; chaque relais concerné est notifié (« N cas que vous aviez recensé(s)… ont été supprimé(s) par … »). Un autre compte ne peut pas supprimer ces données ; le RC peut continuer à recenser de nouveaux cas. Action serveur : `tacheSupprimerCas`. Le demandeur peut aussi modifier son activité à tout moment (voir « Modifier une activité envoyée »). Cache : `sivec-v40`.

## Activités « en continu » (à renseigner plusieurs fois, sans « terminé »)
- **Création / modification** : case **« Activité en continu »** dans le formulaire (création et « Voir / Modifier », activable ou désactivable à tout moment). Pour le destinataire, l'activité n'a **plus de bouton « J'ai terminé »** (le serveur le refuse aussi) ; elle reste ouverte jusqu'à son **échéance** (facultative) ou son archivage, puis disparaît comme les autres activités.
- **Destinataire** : boutons **➕ Renseigner** (date ≤ aujourd'hui, nombre facultatif, note facultative — autant de fois que nécessaire, plusieurs le même jour possible) et **📋 Mes renseignements (N)** (liste, suppression de ses propres lignes). Badge « 🔁 En continu · N renseignement(s) » ; ces activités ne comptent pas dans le badge « à faire » du menu. Fonctionne hors connexion (file d'attente, sans doublon).
- **Demandeur** : le détail de l'activité affiche, par compte, le nombre de renseignements et la date du dernier ; l'onglet **🗂️ Données collectées** (ou « 📋 Voir / supprimer les renseignements ») liste toutes les lignes (compte, lieu, date, nombre, note), avec export CSV et **suppression ligne par ligne ou par sélection** (le compte concerné est notifié). Supprimer l'activité supprime ses renseignements.
- Nouvelle feuille `ActivitesRealisations`, nouvelle colonne `EnContinu` (créées automatiquement) ; actions `renseignerActivite`, `listRealisations`, `supprimerRealisations`. Cache : `sivec-v41`.

## Plusieurs suivis par jour, suppression réservée au demandeur, photos dans le rapport de séance
- **Suivi de cas : plusieurs fois par jour** — chaque suivi **s'ajoute** (il ne remplace plus le précédent) avec un **moment** : Matin, Midi, Soir ou Autre (heure précise). Chaque suivi renseigne les mêmes **variables clés** du questionnaire de suivi. Le demandeur règle dans le questionnaire le nombre de **« Suivis attendus par jour »** (1 à 6 ; « 3 » = matin, midi et soir, modifiable ensuite) : une journée n'est « complète » que lorsque ce nombre est atteint ; sinon elle reste « à compléter ». Garde-fou : 6 suivis maximum par cas et par jour. Le dossier du cas et l'export CSV affichent le moment de chaque suivi.
- **Le relais communautaire ne peut plus rien supprimer ni remplacer** de ce qu'il a saisi : ni ses suivis, ni ses renseignements d'activité en continu (le serveur refuse). **Seul le demandeur de l'activité (et le National) peut supprimer**, ligne par ligne : renseignements (case par ligne / sélection), cas, et désormais **chaque ligne de suivi** (🗑 dans le dossier du cas) ; le relais est notifié. Action serveur : `tacheSupprimerSuivis`. Nouvelles colonnes `Moment`, `Heure` (feuille des suivis).
- **Rapport de séance (suivi groupé)** : la section **« 5. Photos de la séance »** affiche les photos de la séance en grand (2 par ligne, légendes « Photo 1 / N »), **à la suite du rapport et avant la liste de présence** (écran, impression/PDF). Les photos Google Drive sont converties en images directes ; l'export Excel liste leurs liens. Cache : `sivec-v42`.

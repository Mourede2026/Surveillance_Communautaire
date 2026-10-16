# Surveillance_Communautaire

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
- **RC** (relais communautaire) — rattaché à un village et à une ou plusieurs **grappes**
  (sous-unité du village, créées à la volée par l'ASCQ). Une même grappe peut être couverte par
  plusieurs RC.

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
sont créées à la volée par les ASCQ, au fil de la création ou de l'assignation de leurs RC.

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

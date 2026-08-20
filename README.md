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

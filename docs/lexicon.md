# Lexique bilingue

**Ce document est normatif.** Le glossaire du produit est en français, le code est en
anglais. La correspondance ci-dessous est la seule autorisée : **aucun synonyme**, dans
aucun sens.

Il existe parce que le choix « glossaire français, code anglais » crée un risque de
dérive de vocabulaire — deux développeurs, ou deux agents, traduisant le même terme
différemment produisent deux concepts là où le produit n'en a qu'un. Une table figée rend
cette dérive mécaniquement impossible : il n'y a pas à décider, il y a à consulter.

En cas de doute sur un terme absent de cette table, l'ajouter ici **avant** de l'employer
dans le code.

## Entités

| Français | Code | Note |
|---|---|---|
| Avis | `review` | |
| Jeu | `game` | |
| Utilisateur | `user` | |
| Administrateur | `admin` | |
| Tag | `tag` | |
| Suggestion de tag | `tagSuggestion` | |
| Screenshot | `screenshot` | |
| Note de mise à jour | `updateNote` | |

## Notation

| Français | Code | Note |
|---|---|---|
| Note globale | `overallScore` | Sur 20. Saisie ou calculée |
| Note de domaine | `domainScore` | Sur 20, dans un Avis |
| Domaine | `domain` | Un des sept axes critiquables |
| Pondération | `weighting` | Importance de 0 à 100 par Domaine |
| Note relue | `readerScore` | Recalculée selon les critères du lecteur |
| Note pondérée | `weightedScore` | Le résultat de la pondération |
| Pas évaluable | `notApplicable` | Le Domaine n'a pas de sens pour ce Jeu |
| Vide | `empty` | Aucun jugement porté — distinct de `notApplicable` |
| Synthèse par domaine | `domainSummary` | Moyenne par Domaine sur une fiche de jeu |
| Mode d'obtention | `mode` | `weighted` · `simpleMean` · `none` |
| Moyenne simple | `simpleMean` | Repli, toujours étiqueté |
| Temps de jeu | `playtime` | En heures, entier, sans borne haute |
| Jeu terminé | `completed` | |

### Les sept Domaines

| Français | Code |
|---|---|
| gameplay | `gameplay` |
| histoire | `story` |
| ambiance | `atmosphere` |
| direction artistique et graphismes | `artDirection` |
| bande-son | `soundtrack` |
| durée de vie et rythme | `pacing` |
| technique | `technical` |

## Surfaces et états

| Français | Code | Note |
|---|---|---|
| Fil | `feed` | |
| Fiche de jeu | `gamePage` | |
| Page publique | `publicPage` | Lisible sans compte |
| En cours de rédaction | `draft` | Reporté après la V0 |
| Publié | `published` | |
| Spoiler | `spoiler` | Syntaxe `\|\|texte\|\|` |
| Audience | `audience` | Détermine ce qui est sérialisé |

## Pièges de traduction

Quelques cas où l'anglais « naturel » serait faux :

- **Note globale → `overallScore`**, jamais `globalScore`. « Global » en anglais évoque la
  portée mondiale, pas la synthèse.
- **Note relue → `readerScore`**, jamais `reviewedScore` ni `rereadScore`. C'est la note
  *du lecteur*, ce que le nom doit dire — INV-5 exige que toute note porte son
  propriétaire.
- **Pas évaluable → `notApplicable`**, jamais `notRated` ni `unrated`. `notRated`
  décrirait `empty`, qui est un état différent.
- **Avis → `review`**, jamais `opinion` ni `critique`.
- **Pondération → `weighting`** (le réglage), à distinguer de `weight` (la valeur d'un
  seul Domaine).

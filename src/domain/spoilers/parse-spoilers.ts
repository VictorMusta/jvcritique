/**
 * LE parseur de spoilers. Implémentation UNIQUE, partagée serveur et client (R-D6).
 *
 * Deux parseurs divergeraient, et la divergence serait exactement le trou : le serveur
 * croirait avoir masqué un passage que le client afficherait en clair. C'est pour ça qu'il
 * vit dans le domaine, sans aucune dépendance au framework — les deux côtés appellent le
 * même code ou n'appellent rien.
 *
 * Grammaire (D10, complétée par R-D10) :
 *
 * | Entrée              | Sortie                                             |
 * |---------------------|----------------------------------------------------|
 * | `\|\|texte\|\|`     | un spoiler contenant `texte`                       |
 * | lecture             | de gauche à droite : le premier ouvre, le suivant ferme |
 * | imbrication         | aucune — un `\|\|` dans un spoiler ouvert le ferme |
 * | `\|\|` non fermé    | **littéral**, ce n'est pas un spoiler              |
 * | `\|\|\|\|`          | spoiler vide : **littéral**, ignoré                |
 * | `\\|\|`             | un `\|\|` littéral                                 |
 * | `\\x`               | littéral, **antislash compris**                    |
 * | `\\\\|\|`           | un antislash littéral, **puis** un délimiteur      |
 * | sauts de ligne      | autorisés dans un spoiler                          |
 */

export type Segment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "spoiler"; readonly text: string };

type Token = { t: "char"; c: string } | { t: "delim" };

const DELIM = "||";

/**
 * Première passe : résoudre les échappements et repérer les délimiteurs.
 *
 * Séparée de l'appariement parce que la règle « un `||` non fermé est littéral » exige de
 * connaître la suite du texte. Tenter les deux en un seul parcours obligerait à revenir en
 * arrière, et c'est là qu'on introduit des trous.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    if (input[i] === "\\") {
      if (input.startsWith(DELIM, i + 1)) {
        // `\||` → un `||` littéral, qui n'ouvre ni ne ferme rien.
        tokens.push({ t: "char", c: "|" }, { t: "char", c: "|" });
        i += 3;
        continue;
      }

      if (input[i + 1] === "\\" && input.startsWith(DELIM, i + 2)) {
        // `\\||` → un antislash littéral, PUIS un délimiteur. On n'avance que de deux :
        // le `||` sera vu comme délimiteur au tour suivant.
        tokens.push({ t: "char", c: "\\" });
        i += 2;
        continue;
      }

      // Antislash devant autre chose : littéral, antislash compris (R-D10).
      tokens.push({ t: "char", c: "\\" });
      i += 1;
      continue;
    }

    if (input.startsWith(DELIM, i)) {
      tokens.push({ t: "delim" });
      i += 2;
      continue;
    }

    tokens.push({ t: "char", c: input[i]! });
    i += 1;
  }

  return tokens;
}

/**
 * Découpe un texte d'avis en segments.
 *
 * Fonction PURE. Rend toujours au moins un segment pour une entrée non vide, et jamais de
 * segment de texte vide — ce qui évite aux surfaces d'affichage d'avoir à filtrer.
 */
export function parseSpoilers(input: string): Segment[] {
  const tokens = tokenize(input);
  const segments: Segment[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer.length > 0) {
      segments.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.t === "char") {
      buffer += token.c;
      i += 1;
      continue;
    }

    // Délimiteur : chercher sa fermeture.
    let close = i + 1;
    while (close < tokens.length && tokens[close]!.t !== "delim") {
      close += 1;
    }

    if (close >= tokens.length) {
      // Jamais fermé → littéral. C'est cette règle qui rend l'ordre
      // « parser puis tronquer » obligatoire : tronquer d'abord couperait la fermeture
      // et transformerait un spoiler en texte clair.
      buffer += DELIM;
      i += 1;
      continue;
    }

    const content = tokens
      .slice(i + 1, close)
      .map((t) => (t.t === "char" ? t.c : ""))
      .join("");

    if (content.length === 0) {
      // Spoiler vide → les quatre barres sont littérales.
      buffer += DELIM + DELIM;
      i = close + 1;
      continue;
    }

    flush();
    segments.push({ kind: "spoiler", text: content });
    i = close + 1;
  }

  flush();

  return segments;
}

/** Vrai si le texte contient au moins un spoiler réel. */
export function hasSpoiler(input: string): boolean {
  return parseSpoilers(input).some((segment) => segment.kind === "spoiler");
}

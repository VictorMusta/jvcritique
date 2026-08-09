import { describe, expect, it } from "vitest";

import { decideDirection, SEUIL } from "./use-slider-gesture";

/**
 * Ces cas décrivent le geste réel de quelqu'un qui tient son téléphone. Ils existent parce
 * que le défaut d'origine — poser le doigt sur un curseur déplaçait la note avant tout
 * geste — était invisible au typage et ne se voyait qu'au pouce, sur un vrai appareil.
 */
describe("decideDirection", () => {
  it("ne tranche pas tant que le doigt n'a presque pas bougé", () => {
    // Personne ne pose le doigt parfaitement immobile. Trancher trop tôt attribuerait
    // l'intention à un tremblement.
    expect(decideDirection(0, 0)).toBeNull();
    expect(decideDirection(3, 2)).toBeNull();
    expect(decideDirection(SEUIL - 1, SEUIL - 1)).toBeNull();
  });

  it("reconnaît un défilement vers le bas", () => {
    expect(decideDirection(2, 40)).toBe("verticale");
  });

  it("reconnaît un défilement vers le haut", () => {
    // Le signe ne doit pas compter : on raisonne sur des distances.
    expect(decideDirection(-2, -40)).toBe("verticale");
  });

  it("reconnaît un glissement pour noter, dans les deux sens", () => {
    expect(decideDirection(40, 3)).toBe("horizontale");
    expect(decideDirection(-40, 3)).toBe("horizontale");
  });

  it("tranche dès que l'un des deux axes dépasse le seuil", () => {
    // Un défilement franc commence souvent par un mouvement vertical net alors que
    // l'horizontal est encore nul. Exiger que LES DEUX dépassent le seuil retarderait la
    // décision, et la note aurait le temps de bouger.
    expect(decideDirection(0, SEUIL)).toBe("verticale");
    expect(decideDirection(SEUIL, 0)).toBe("horizontale");
  });

  it("donne le geste parfaitement diagonal au DÉFILEMENT", () => {
    // Choix délibéré : ne rien faire est moins grave que déplacer une note par surprise.
    expect(decideDirection(20, 20)).toBe("verticale");
  });

  it("suit l'axe dominant même quand le geste est brouillon", () => {
    // Un pouce ne trace pas une ligne droite.
    expect(decideDirection(30, 22)).toBe("horizontale");
    expect(decideDirection(22, 30)).toBe("verticale");
  });
});

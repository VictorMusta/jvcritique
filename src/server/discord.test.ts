import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type * as Discord from "./discord";

/**
 * Ce qui part réellement dans le salon Discord.
 *
 * Une annonce est vue par tout un salon, d'un coup. Une fuite ici n'a aucun recours — on ne
 * rattrape pas un message lu par cinq personnes.
 *
 * Le passage masqué N'EST PLUS retiré : Discord sait masquer, avec la même syntaxe que nous.
 * La propriété à tenir devient donc plus fine — il doit arriver COUVERT, quoi qu'il arrive à
 * la troncature.
 */

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DISCORD_WEBHOOK_URL = "https://exemple.invalid/webhook";
process.env.APP_URL = "https://jvcritique.exemple.fr";

let annoncerAvis: typeof Discord.annoncerAvis;

beforeAll(async () => {
  const module_ = await import("./discord");
  annoncerAvis = module_.annoncerAvis;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Remplace `fetch` et rend ce qui aurait été envoyé. */
function interceptor() {
  const appels: { url: string; corps: unknown }[] = [];

  // Le corps est typé `string` plutôt que `BodyInit` : le module n'envoie que du JSON
  // sérialisé, et l'annoncer évite une conversion qui masquerait un changement de format.
  vi.stubGlobal("fetch", (url: string, init: { body: string }) => {
    appels.push({ url, corps: JSON.parse(init.body) });
    // `null` et pas `""` : le constructeur REFUSE un corps sur un 204, et l'exception
    // partait droit dans le `catch` du module — le test passait en éprouvant le mauvais
    // chemin. C'est bien le code de réponse que Discord renvoie sur un webhook accepté.
    return Promise.resolve(new Response(null, { status: 204 }));
  });

  return appels;
}

const base = {
  reviewId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  gameTitle: "Outer Wilds",
  authorName: "Victor",
  score: 18,
  body: "Le meilleur jeu d'exploration jamais fait.",
  isPrivate: false,
};

/**
 * Compte les délimiteurs `||` que DISCORD verra, c'est-à-dire non précédés d'une barre
 * oblique inverse d'échappement. Un total impair signifie un masquage laissé ouvert — donc
 * du texte affiché en clair.
 */
function delimiteurs(texte: string): number {
  return (texte.match(/(?<!\\)\|\|/g) ?? []).length;
}

/** L'encart tel qu'il part. Lève si rien n'est parti — c'est alors le test qui ment. */
function description(appels: { corps: unknown }[]): string {
  const corps = appels[0]?.corps as
    | { embeds: { description?: string }[] }
    | undefined;
  const rendu = corps?.embeds[0]?.description;

  if (rendu === undefined) {
    throw new Error("aucune annonce interceptée");
  }

  return rendu;
}

describe("annoncerAvis — ce qui ne doit JAMAIS partir", () => {
  it("n'annonce PAS un avis privé", async () => {
    // La fuite la plus bête possible : le contenu resterait protégé, mais le salon
    // apprendrait que quelqu'un vient d'écrire sur tel jeu, avec sa note.
    const appels = interceptor();

    await annoncerAvis({ ...base, isPrivate: true });

    expect(appels).toHaveLength(0);
  });

  it("livre le spoiler MASQUÉ, dans la syntaxe de Discord", async () => {
    const appels = interceptor();

    await annoncerAvis({
      ...base,
      body: "La fin est terrible : ||le soleil explose|| et je m'en remets pas.",
    });

    expect(description(appels)).toBe(
      "La fin est terrible : ||le soleil explose|| et je m'en remets pas.",
    );
  });

  it("ne laisse JAMAIS un masquage ouvert, quelle que soit la troncature", async () => {
    // LA propriété qui remplace le retrait pur et simple. Couper entre les deux `||` perdrait
    // la fermeture, et Discord afficherait la suite en clair — au moment précis où le message
    // est vu par le plus de monde. On balaie donc TOUTES les longueurs de corps possibles.
    const appels = interceptor();
    const long = "a".repeat(240);

    for (let n = 0; n <= 90; n += 1) {
      await annoncerAvis({
        ...base,
        body: `${long}${"b".repeat(n)} ||le soleil explose|| et voilà.`,
      });
    }

    for (const appel of appels) {
      const rendu = description([appel]);
      expect(delimiteurs(rendu) % 2, `laissé ouvert : ${rendu}`).toBe(0);
      // Et si le passage est coupé, ce qui en reste est à l'intérieur du masquage.
      if (rendu.includes("soleil")) {
        expect(rendu).toMatch(/\|\|[^|]*soleil[^|]*\|\|/);
      }
    }
  });

  it("échappe les barres verticales du texte de l'auteur", async () => {
    // Sans ça, deux `|` littéraux voisins ouvriraient un masquage côté Discord et avaleraient
    // tout le reste de l'aperçu.
    const appels = interceptor();

    await annoncerAvis({ ...base, body: "Le combo A|B est cassé." });

    expect(description(appels)).toBe("Le combo A\\|B est cassé.");
  });

  it("n'ouvre PAS un masquage là où notre grammaire dit « littéral »", async () => {
    // `\||` vaut un `||` littéral chez nous. Discord ignore nos échappements : recopier le
    // corps brut lui ferait interpréter un délimiteur que notre parseur avait déclaré texte.
    const appels = interceptor();

    await annoncerAvis({ ...base, body: String.raw`Un pipe double \|| et rien d'autre.` });

    const rendu = description(appels);
    expect(delimiteurs(rendu)).toBe(0);
    expect(rendu).toContain("rien d'autre");
  });

  it("neutralise les mentions", async () => {
    // Sans ça, un titre de jeu contenant `@everyone` déclencherait une notification à tout
    // le serveur. Personne ne doit pouvoir faire sonner le téléphone des autres en nommant
    // son avis.
    const appels = interceptor();

    await annoncerAvis({ ...base, gameTitle: "@everyone Valheim" });

    expect(appels[0]?.corps).toMatchObject({ allowed_mentions: { parse: [] } });
  });
});

describe("annoncerAvis — le message", () => {
  it("porte le jeu, l'auteur, la note et le lien", async () => {
    const appels = interceptor();

    await annoncerAvis(base);

    expect(appels).toHaveLength(1);
    expect(appels[0]?.corps).toMatchObject({
      embeds: [
        {
          title: "Outer Wilds",
          url: "https://jvcritique.exemple.fr/review/3f2504e0-4f89-41d3-9a0c-0305e82c3301",
          author: { name: "Victor vient de publier un avis" },
          fields: [{ name: "Sa note", value: "18 / 20" }],
        },
      ],
    });
  });

  it("omet la note quand l'avis n'en porte pas de saisie", async () => {
    const appels = interceptor();

    await annoncerAvis({ ...base, score: null });

    const embed = (appels[0]?.corps as { embeds: { fields?: unknown }[] }).embeds[0];
    expect(embed?.fields).toBeUndefined();
  });
});

describe("annoncerAvis — ne casse jamais la publication", () => {
  // `false` et non `undefined` : l'échec doit être SIGNALÉ, pas avalé. C'est ce que
  // l'appelant lit pour ne PAS marquer l'avis comme annoncé — sans quoi un avis que personne
  // n'a vu serait réputé publié dans le salon, et aucun rattrapage ne le retrouverait.
  it("avale une panne réseau", async () => {
    // Un avis publié dont l'annonce échoue reste un avis publié.
    vi.stubGlobal("fetch", () => Promise.reject(new Error("réseau coupé")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(annoncerAvis(base)).resolves.toBe(false);
  });

  it("avale un refus de Discord", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("webhook inconnu", { status: 404 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(annoncerAvis(base)).resolves.toBe(false);
  });
});

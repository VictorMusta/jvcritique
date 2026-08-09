import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type * as Discord from "./discord";

/**
 * Ce qui part réellement dans le salon Discord.
 *
 * Les deux premiers cas sont des propriétés de SÉCURITÉ : une annonce est vue par tout un
 * salon, d'un coup, sans que personne n'ait cliqué. Une fuite ici n'a aucun recours — on ne
 * rattrape pas un message lu par cinq personnes.
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
    return Promise.resolve(new Response("", { status: 204 }));
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

describe("annoncerAvis — ce qui ne doit JAMAIS partir", () => {
  it("n'annonce PAS un avis privé", async () => {
    // La fuite la plus bête possible : le contenu resterait protégé, mais le salon
    // apprendrait que quelqu'un vient d'écrire sur tel jeu, avec sa note.
    const appels = interceptor();

    await annoncerAvis({ ...base, isPrivate: true });

    expect(appels).toHaveLength(0);
  });

  it("ne laisse PAS fuiter un spoiler dans l'extrait", async () => {
    // LE cas pour lequel l'audience « extrait » a été créée. Un robot fabrique un aperçu
    // que tout un salon voit sans avoir cliqué.
    const appels = interceptor();

    await annoncerAvis({
      ...base,
      body: "La fin est terrible : ||le soleil explose|| et je m'en remets pas.",
    });

    const charge = JSON.stringify(appels[0]?.corps);

    expect(charge).not.toContain("soleil explose");
    expect(charge).toContain("passage masqué");
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
  it("avale une panne réseau", async () => {
    // Un avis publié dont l'annonce échoue reste un avis publié.
    vi.stubGlobal("fetch", () => Promise.reject(new Error("réseau coupé")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(annoncerAvis(base)).resolves.toBeUndefined();
  });

  it("avale un refus de Discord", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("webhook inconnu", { status: 404 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(annoncerAvis(base)).resolves.toBeUndefined();
  });
});

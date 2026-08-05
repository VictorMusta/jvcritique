import { afterEach, describe, expect, it, vi } from "vitest";

import { errorMessages } from "~/messages/fr";
import { fail, guard, isFrameworkControlError, ok } from "./result";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Result — forme figée (D9)", () => {
  it("porte les données en cas de succès", () => {
    const result = ok({ id: "abc" });

    expect(result.ok).toBe(true);
    // Le champ `data` n'existe que sur la branche succès : c'est le type qui empêche
    // de le lire sans avoir vérifié `ok`.
    expect(result).toMatchObject({ data: { id: "abc" } });
  });

  it("puise le message d'échec dans le fichier de libellés, jamais sur place", () => {
    const result = fail("NOT_AUTHENTICATED");

    expect(result).toEqual({
      ok: false,
      code: "NOT_AUTHENTICATED",
      message: errorMessages.NOT_AUTHENTICATED,
    });
  });

  it("ne laisse fuir aucun vocabulaire technique dans les messages", () => {
    // EXPERIENCE.md interdit « Network error » et exige que le produit parle comme un
    // pote. Ce test empêche qu'un message technique s'installe par inadvertance.
    const forbidden = [
      "error",
      "exception",
      "null",
      "undefined",
      "database",
      "server",
      "network",
      "timeout",
      "SQL",
    ];

    for (const [code, message] of Object.entries(errorMessages)) {
      for (const word of forbidden) {
        expect(
          message.toLowerCase().includes(word.toLowerCase()),
          `Le message de ${code} contient « ${word} » : ${message}`,
        ).toBe(false);
      }
    }
  });
});

describe("guard — R-D9, le piège des erreurs de contrôle du framework", () => {
  it("RE-LANCE une erreur de redirection au lieu de l'avaler", async () => {
    // LE test qui compte.
    //
    // `redirect()` de Next lève une exception pour interrompre le rendu — c'est son mode
    // de fonctionnement normal. Un try/catch attrape-tout la convertirait en échec
    // silencieux : l'utilisateur resterait sur place avec un message générique, et rien
    // dans les journaux ne dirait pourquoi.
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/feed;307;",
    });

    await expect(
      guard(() => {
        throw redirectError;
      }),
    ).rejects.toBe(redirectError);
  });

  it("RE-LANCE aussi une erreur de page introuvable", async () => {
    const notFoundError = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });

    await expect(
      guard(() => {
        throw notFoundError;
      }),
    ).rejects.toBe(notFoundError);
  });

  it("convertit une erreur inattendue en échec UNEXPECTED", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await guard(() => {
      throw new Error("la connexion a lâché");
    });

    expect(result).toEqual({
      ok: false,
      code: "UNEXPECTED",
      message: errorMessages.UNEXPECTED,
    });
    // La trace part dans les journaux serveur, pas à l'écran.
    expect(spy).toHaveBeenCalledOnce();
    // Et le détail technique ne se retrouve pas dans le message rendu.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("lâché");
    }
  });

  it("laisse passer un succès sans y toucher", async () => {
    const result = await guard(() => Promise.resolve(ok(42)));

    expect(result).toEqual({ ok: true, data: 42 });
  });

  it("laisse passer un échec métier sans le convertir en UNEXPECTED", async () => {
    const result = await guard(() => Promise.resolve(fail<number>("NOT_FOUND")));

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("isFrameworkControlError — détection par convention de préfixe", () => {
  it("reconnaît tout digest préfixé NEXT_", () => {
    // Détecté par le préfixe et non en important `isRedirectError` de `next/dist/...` :
    // ce chemin est interne et change entre versions majeures. Le préfixe couvre les
    // mécanismes présents et à venir — y compris ceux qu'on ne connaît pas encore.
    for (const digest of [
      "NEXT_REDIRECT;replace;/;307;",
      "NEXT_HTTP_ERROR_FALLBACK;404",
      "NEXT_UN_MECANISME_FUTUR",
    ]) {
      expect(isFrameworkControlError(Object.assign(new Error(), { digest }))).toBe(
        true,
      );
    }
  });

  it("ne confond pas une vraie erreur avec un mécanisme de contrôle", () => {
    expect(isFrameworkControlError(new Error("boum"))).toBe(false);
    expect(isFrameworkControlError({ digest: 42 })).toBe(false);
    expect(isFrameworkControlError({ digest: "AUTRE_CHOSE" })).toBe(false);
    expect(isFrameworkControlError(null)).toBe(false);
    expect(isFrameworkControlError(undefined)).toBe(false);
    expect(isFrameworkControlError("NEXT_REDIRECT")).toBe(false);
  });
});

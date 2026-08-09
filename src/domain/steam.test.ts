import { describe, expect, it } from "vitest";

import { appIdSteam, couvertureSteam } from "./steam";

/**
 * Le lien Steam est un champ LIBRE, rempli à la main et collé de n'importe où.
 *
 * Ce qui est éprouvé ici tient surtout au refus : une adresse qui n'est pas Steam ne doit
 * jamais servir à fabriquer l'URL d'une image, sans quoi n'importe qui pourrait faire charger
 * n'importe quoi au navigateur des autres depuis un champ de formulaire.
 */

describe("appIdSteam — les formes que Steam produit", () => {
  it("lit l'identifiant, avec ou sans nom de jeu à la suite", () => {
    expect(appIdSteam("https://store.steampowered.com/app/367520")).toBe("367520");
    expect(
      appIdSteam("https://store.steampowered.com/app/367520/Hollow_Knight/"),
    ).toBe("367520");
  });

  it("survit aux paramètres et aux ancres", () => {
    expect(
      appIdSteam("https://store.steampowered.com/app/383870/Firewatch/?snr=1_7_7_230"),
    ).toBe("383870");
    expect(appIdSteam("https://store.steampowered.com/app/383870#avis")).toBe("383870");
  });

  it("accepte les sous-domaines de Steam et la communauté", () => {
    expect(appIdSteam("https://steamcommunity.com/app/367520")).toBe("367520");
  });
});

describe("appIdSteam — ce qu'il refuse", () => {
  it("refuse un hôte qui n'est pas Steam, même avec le bon chemin", () => {
    // LE cas qui compte. Sans vérification d'hôte, ce champ libre servirait à faire charger
    // une image depuis n'importe quel domaine par le navigateur de tout le monde.
    expect(appIdSteam("https://exemple.test/app/367520")).toBeNull();
    expect(appIdSteam("https://store.steampowered.com.exemple.test/app/1")).toBeNull();
  });

  it("refuse une URL illisible ou absente", () => {
    expect(appIdSteam(null)).toBeNull();
    expect(appIdSteam("pas une url")).toBeNull();
  });

  it("refuse une page Steam qui ne désigne aucun jeu", () => {
    expect(appIdSteam("https://store.steampowered.com/")).toBeNull();
    expect(appIdSteam("https://store.steampowered.com/app/")).toBeNull();
  });
});

describe("couvertureSteam", () => {
  it("compose l'adresse de l'image d'en-tête", () => {
    expect(couvertureSteam("https://store.steampowered.com/app/367520/Hollow_Knight/")).toBe(
      "https://cdn.cloudflare.steamstatic.com/steam/apps/367520/header.jpg",
    );
  });

  it("rend `null` plutôt qu'une adresse inventée", () => {
    expect(couvertureSteam(null)).toBeNull();
    expect(couvertureSteam("https://exemple.test/app/1")).toBeNull();
  });
});

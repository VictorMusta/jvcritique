"use client";

import { useEffect, useState } from "react";

import type { Screenshot } from "~/server/db/queries/reviews";

/**
 * Galerie des captures d'un avis, avec visionneuse plein écran — FR-8 et FR-29.
 *
 * LE ZOOM EST CELUI DU NAVIGATEUR, pas une réimplémentation.
 *
 * Écrire son propre pincement demande de gérer deux doigts, l'inertie, les limites, le
 * double-tap, et de le faire correctement sur chaque appareil. Le navigateur sait déjà tout
 * ça. Il suffit de ne pas l'en empêcher — et c'est exactement pourquoi le `viewport` de
 * l'application ne pose ni `maximumScale` ni `userScalable`, contrairement au réflexe
 * habituel des applications mobiles.
 *
 * L'image est donc servie en pleine résolution dans un conteneur qui défile, et le pincement
 * agit dessus nativement. Zéro code de geste, zéro bug de geste.
 */
export function ScreenshotGallery({
  screenshots,
  gameTitle,
}: {
  readonly screenshots: readonly Screenshot[];
  readonly gameTitle: string;
}) {
  const [ouverte, setOuverte] = useState<Screenshot | null>(null);

  // Fermer avec Échap : au clavier, une vue plein écran sans sortie est un piège.
  useEffect(() => {
    if (ouverte === null) {
      return;
    }

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOuverte(null);
      }
    };

    window.addEventListener("keydown", surTouche);

    // Le fond ne défile plus pendant que la visionneuse est ouverte, sinon un pincement
    // ou un glissement fait bouger la page derrière.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = avant;
    };
  }, [ouverte]);

  if (screenshots.length === 0) {
    return null;
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-s2">
        {screenshots.map((image, index) => (
          <li key={image.id}>
            <button
              type="button"
              onClick={() => setOuverte(image)}
              className="block w-full"
              aria-label={`Agrandir la capture ${index + 1} sur ${screenshots.length} de ${gameTitle}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/screenshot/${image.storageKey}?v=vignette`}
                alt=""
                width={image.width}
                height={image.height}
                loading="lazy"
                /*
                 * `width` et `height` sont posés pour que le navigateur RÉSERVE la place
                 * avant que l'image arrive. Sans eux, le texte saute sous les doigts au
                 * fur et à mesure des chargements — sur un fil, c'est la différence entre
                 * lisible et pénible.
                 */
                className="aspect-video w-full rounded-[8px] border border-border object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {ouverte ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Capture de ${gameTitle}`}
          className="fixed inset-0 z-50 flex flex-col bg-bg/95"
        >
          <div className="flex justify-end p-s4">
            <button
              type="button"
              onClick={() => setOuverte(null)}
              autoFocus
              className="rounded-[8px] border border-border bg-surface px-s4 py-s2 text-[12px] text-text"
            >
              Fermer
            </button>
          </div>

          {/*
            Conteneur défilant dans les deux sens : une fois l'image agrandie au pincement,
            il faut pouvoir se déplacer dedans. `touch-action: pinch-zoom` autorise
            explicitement le geste que le navigateur sait déjà faire.
          */}
          <div
            className="flex-1 overflow-auto p-s4"
            style={{ touchAction: "pinch-zoom" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/screenshot/${ouverte.storageKey}`}
              alt={`Capture de ${gameTitle}`}
              width={ouverte.width}
              height={ouverte.height}
              className="mx-auto h-auto max-w-full"
            />
          </div>

          <p className="px-s5 pb-s5 text-center text-[11px] text-text-muted">
            Pince pour zoomer.
          </p>
        </div>
      ) : null}
    </>
  );
}

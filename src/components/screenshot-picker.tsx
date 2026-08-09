"use client";

import { useEffect, useRef, useState } from "react";

import type { NewScreenshot } from "~/server/db/queries/reviews";

/**
 * Dépôt des captures d'écran d'un avis — FR-8.
 *
 * Les fichiers partent AU CHOIX, pas à la publication. L'auteur voit donc ses images
 * apparaître pendant qu'il écrit, et une image refusée se signale tout de suite plutôt
 * qu'au moment de publier — quand il a déjà tout rédigé et qu'un échec coûte cher.
 *
 * Conséquence assumée : abandonner la rédaction laisse des fichiers orphelins sur le
 * volume. Le balayage périodique est hors périmètre, et à cinq amis quelques fichiers
 * perdus ne justifient pas une tâche planifiée.
 */

type EnCours = { id: string; nom: string };

export function ScreenshotPicker({
  images,
  onChange,
}: {
  readonly images: readonly NewScreenshot[];
  readonly onChange: (images: NewScreenshot[]) => void;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState<EnCours[]>([]);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [survol, setSurvol] = useState(false);

  async function deposer(fichiers: readonly File[] | FileList) {
    setErreurs([]);

    // Les dépôts sont SÉQUENTIELS et non parallèles : chaque image consomme de la mémoire
    // et un cœur pendant son réencodage, et le VPS est partagé avec les projets voisins.
    // Envoyer huit captures d'un coup les ferait tous ramer.
    for (const fichier of Array.from(fichiers)) {
      const marqueur = { id: crypto.randomUUID(), nom: fichier.name };
      setEnCours((liste) => [...liste, marqueur]);

      try {
        const corps = new FormData();
        corps.append("image", fichier);

        const reponse = await fetch("/api/upload", {
          method: "POST",
          body: corps,
        });

        const donnees: unknown = await reponse.json();

        if (!reponse.ok) {
          const message =
            typeof donnees === "object" &&
            donnees !== null &&
            "erreur" in donnees &&
            typeof donnees.erreur === "string"
              ? donnees.erreur
              : "Cette image n'a pas pu être envoyée.";

          // Le nom du fichier est repris : avec plusieurs images, « échec » tout seul ne
          // dit pas laquelle a échoué.
          setErreurs((liste) => [...liste, `${fichier.name} — ${message}`]);
        } else {
          onChange([...images, donnees as NewScreenshot]);
        }
      } catch {
        setErreurs((liste) => [
          ...liste,
          `${fichier.name} — l'envoi a été interrompu.`,
        ]);
      } finally {
        setEnCours((liste) => liste.filter((e) => e.id !== marqueur.id));
      }
    }

    // Vider le champ permet de re-sélectionner le même fichier juste après un échec.
    if (champ.current) {
      champ.current.value = "";
    }
  }

  /**
   * Ne garde que les images d'un transfert, et refuse le reste.
   *
   * Un presse-papiers contient presque toujours autre chose en même temps — du texte brut,
   * du HTML, parfois un fichier quelconque. Sans ce tri, coller un morceau de texte
   * déclencherait un envoi qui échouerait plus loin, avec un message qui parlerait de format
   * alors que l'utilisateur croyait n'avoir rien fait de spécial.
   */
  function imagesDe(transfert: DataTransfer | null): File[] {
    if (transfert === null) return [];

    return Array.from(transfert.files).filter((f) => f.type.startsWith("image/"));
  }

  /*
   * COLLER UNE IMAGE — demandé par Victor pour simplifier le dépôt sur téléphone.
   *
   * L'écouteur est posé sur le DOCUMENT, pas sur une zone à viser. Sur téléphone, il n'y a
   * pas de « clic dans le cadre avant de coller » : on appuie longuement, on choisit
   * « Coller », et l'évènement part de là où le doigt se trouvait. Exiger un focus préalable
   * rendrait le geste inatteignable précisément sur l'appareil qu'il s'agit d'aider.
   *
   * Il n'y a qu'un sélecteur de captures à l'écran à la fois — le formulaire d'un avis — donc
   * pas d'ambiguïté sur la destination.
   */
  useEffect(() => {
    const coller = (evenement: ClipboardEvent) => {
      const fichiers = imagesDe(evenement.clipboardData);

      if (fichiers.length === 0) return;

      // Empêche le navigateur d'insérer aussi l'image dans le champ de texte qui a le focus.
      evenement.preventDefault();
      void deposer(fichiers);
    };

    document.addEventListener("paste", coller);
    return () => document.removeEventListener("paste", coller);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * BOUTON DE COLLAGE — demandé par Victor après coup, et il a raison.
   *
   * Le geste natif ne suffit pas sur téléphone : l'appui long ne propose « Coller » que si
   * l'élément visé accepte du texte. Sur un formulaire dont la zone de captures n'est pas un
   * champ de saisie, il n'y a souvent RIEN à viser. Un bouton ne dépend de rien.
   *
   * Il n'apparaît que si le navigateur sait lire le presse-papiers. Un bouton qui échoue
   * toujours est pire que pas de bouton : la voie du geste natif, elle, reste ouverte.
   */
  const [peutLire, setPeutLire] = useState(false);

  useEffect(() => {
    // Testé au montage et pas au rendu : `navigator` n'existe pas sur le serveur, et le
    // rendu serveur et le rendu client différeraient.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeutLire(typeof navigator !== "undefined" && "clipboard" in navigator &&
      typeof navigator.clipboard.read === "function");
  }, []);

  async function collerDepuisPressePapiers() {
    setErreurs([]);

    try {
      const elements = await navigator.clipboard.read();
      const fichiers: File[] = [];

      for (const element of elements) {
        // Un élément de presse-papiers porte PLUSIEURS représentations du même contenu —
        // une image copiée depuis une page web arrive souvent avec son HTML. On prend la
        // première qui est une image et on ignore le reste.
        const type = element.types.find((t) => t.startsWith("image/"));

        if (type !== undefined) {
          const blob = await element.getType(type);
          const extension = type.split("/")[1] ?? "png";
          fichiers.push(
            new File([blob], `presse-papiers.${extension}`, { type }),
          );
        }
      }

      if (fichiers.length === 0) {
        setErreurs([
          "Le presse-papiers ne contient pas d’image. Copie une capture, puis reviens ici.",
        ]);
        return;
      }

      await deposer(fichiers);
    } catch {
      /*
       * Un seul message pour tous les échecs, et c'est délibéré.
       *
       * Permission refusée, presse-papiers vide, navigateur qui exige un geste plus direct :
       * du point de vue de celui qui clique, c'est la même situation et le même recours. Lui
       * détailler laquelle des trois s'est produite ne l'avancerait à rien.
       */
      setErreurs([
        "Impossible de lire le presse-papiers — ton navigateur l’a refusé. " +
          "Tu peux toujours passer par « Choisir un fichier », ou coller directement avec Ctrl+V.",
      ]);
    }
  }

  function retirer(cle: string) {
    onChange(images.filter((i) => i.storageKey !== cle));
  }

  return (
    <section className="flex flex-col gap-s4">
      <h2 className="font-display text-[15px] font-semibold">Tes captures</h2>

      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-s2">
          {images.map((image) => (
            <li key={image.storageKey} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/screenshot/${image.storageKey}?v=vignette`}
                alt=""
                width={image.width}
                height={image.height}
                className="aspect-video w-full rounded-[8px] border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => retirer(image.storageKey)}
                aria-label="Retirer cette image"
                className="absolute right-[4px] top-[4px] rounded-full border border-border bg-bg/90 px-s2 text-[12px] leading-tight text-text"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {enCours.map((e) => (
        <p key={e.id} aria-live="polite" className="text-[12px] text-text-muted">
          Envoi de {e.nom}…
        </p>
      ))}

      {/*
        GLISSER-DÉPOSER, presque gratuit une fois le collage écrit : c'est la même liste de
        fichiers, extraite du même objet de transfert. Sans intérêt sur téléphone, mais c'est
        le geste naturel sur ordinateur, où l'on a la capture sous la souris.
      */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          const fichiers = imagesDe(e.dataTransfer);
          if (fichiers.length > 0) void deposer(fichiers);
        }}
        className={`rounded-[8px] border border-dashed p-s4 ${
          survol ? "border-accent bg-surface-raised" : "border-border"
        }`}
      >
        <input
          ref={champ}
          id="captures"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void deposer(e.target.files);
            }
          }}
          className="text-[12px] text-text-muted file:mr-s4 file:rounded-[8px] file:border file:border-border file:bg-surface-raised file:px-s4 file:py-s2 file:text-[12px] file:text-text"
        />

        {peutLire ? (
          <button
            type="button"
            onClick={() => void collerDepuisPressePapiers()}
            className="mt-s3 flex items-center gap-s2 rounded-[8px] border border-accent px-s4 py-s3 text-[12px] font-semibold text-accent-text"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="8" y="2" width="8" height="4" rx="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
            Coller du presse-papiers
          </button>
        ) : null}

        <p className="mt-s3 text-[11px] italic leading-snug text-text-muted">
          Tu peux aussi faire glisser une image ici, ou la coller avec Ctrl+V.
        </p>
      </div>

      <p className="text-[11px] italic text-text-muted">
        JPEG, PNG ou WebP, 25 Mo maximum par image. Elles sont réencodées et leurs données
        de localisation retirées.
      </p>

      {erreurs.map((message) => (
        <p key={message} aria-live="polite" className="text-[12px] text-negative">
          {message}
        </p>
      ))}
    </section>
  );
}

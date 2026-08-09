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

        <p className="mt-s3 text-[11px] italic leading-snug text-text-muted">
          Tu peux aussi <strong className="font-semibold not-italic">coller</strong> une image
          — appui long puis « Coller » sur téléphone, Ctrl+V sur ordinateur — ou la faire
          glisser ici.
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

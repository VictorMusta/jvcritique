"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barre de navigation du bas.
 *
 * Le LIBELLÉ ACCOMPAGNE TOUJOURS L'ICÔNE — règle explicite de la spine, et sa justification
 * est concrète : les icônes de ce produit ne sont pas conventionnelles. Une fiole, un
 * grimoire, un alambic ne veulent rien dire hors contexte. Un onglet réduit à sa seule
 * icône n'est plus identifiable.
 *
 * Les libellés sont à 11 px, qui est un PLANCHER et non une cible : ils ne descendent
 * jamais en dessous et doivent survivre à un agrandissement du texte système.
 */

const items = [
  { href: "/", label: "Fil", glyph: "◈" },
  { href: "/publish", label: "Écrire", glyph: "✎" },
  { href: "/games", label: "Jeux", glyph: "◇" },
  { href: "/profile", label: "Profil", glyph: "◉" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface"
    >
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ href, label, glyph }) => {
          // Le fil est à la racine : sans le cas particulier, tout chemin commencerait par
          // « / » et les quatre onglets seraient actifs en même temps.
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-[2px] py-2 ${
                  active ? "text-accent-text" : "text-text-muted"
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {glyph}
                </span>
                <span className="text-[11px] font-semibold leading-tight">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

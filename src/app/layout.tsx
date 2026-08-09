import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";

import { auth } from "~/server/auth";
import { compterNonLues } from "~/server/db/queries/notifications";
import { TabBar } from "~/components/tab-bar";
import { themeValide } from "~/domain/themes";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "jvcritiqué",
  description:
    "Les avis de jeux de tes potes, notés selon TES critères. Pas selon les leurs.",
  applicationName: "jvcritiqué",
  icons: [
    { rel: "icon", url: "/favicon.png", type: "image/png" },
    // iOS ignore le manifeste pour l'icône de l'écran d'accueil et ne lit que celle-ci.
    { rel: "apple-touch-icon", url: "/icons/apple-touch-icon.png" },
  ],
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#171310",
  width: "device-width",
  initialScale: 1,
  /**
   * `maximumScale` et `userScalable` ne sont VOLONTAIREMENT pas posés.
   *
   * FR-29 exige de pouvoir zoomer sur les captures au doigt, et WCAG interdit de désactiver
   * le zoom utilisateur. C'est le premier point de l'exigence d'accessibilité qui soit
   * réellement vérifiable — donc le seul qu'on ne peut pas se permettre de rater par
   * habitude de copier-coller un `viewport` d'application mobile.
   */
};

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  // Axes figés par la spine : SOFT 60, WONK 1. L'abandon de React Native au profit d'une
  // PWA a supprimé la contrainte d'instance statique, donc la version variable partout.
  axes: ["SOFT", "WONK", "opsz"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
   * La variante de couleurs vient d'un cookie (FR-20).
   *
   * Lire un cookie rend la route dynamique — ce qui ne coûte rien ici : toutes les routes le
   * sont déjà, puisque D3 impose le recalcul des notes à la lecture. La contrainte de R-D13,
   * qui voulait garder une page statique, ne s'applique pas à cette application-ci.
   *
   * Une valeur inconnue retombe sur le défaut : un cookie est modifiable par son porteur, et
   * n'importe quelle chaîne atterrirait sinon dans un attribut du document.
   */
  const theme = themeValide((await cookies()).get("theme")?.value);

  return (
    <html
      lang="fr"
      data-theme={theme}
      className={`${fraunces.variable} ${inter.variable}`}
    >
      <body>
        {/* pb-20 réserve la hauteur de la barre du bas : sans ça, le dernier avis du fil
            reste inaccessible sous la navigation. */}
        <div className="mx-auto min-h-screen w-full max-w-2xl pb-20">
          {children}
        </div>
        <TabBar nonLues={await compterNonLues((await auth())?.user?.id ?? null)} />
      </body>
    </html>
  );
}

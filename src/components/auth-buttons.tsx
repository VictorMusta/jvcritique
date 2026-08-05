import { signIn, signOut } from "~/server/auth";

/**
 * Connexion et déconnexion par actions serveur dans un formulaire.
 *
 * Pas de composant client, pas de `onClick` : un `<form action={…}>` fonctionne même sans
 * JavaScript, et surtout ça évite d'embarquer la logique d'authentification dans le paquet
 * envoyé au navigateur.
 */

export function SignInButton({ label = "Se connecter avec Discord" }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="rounded-[8px] border border-accent bg-accent px-s5 py-[13px] font-semibold text-bg"
      >
        {label}
      </button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="rounded-[8px] border border-border px-s4 py-s2 text-[12px] text-text-muted"
      >
        Se déconnecter
      </button>
    </form>
  );
}

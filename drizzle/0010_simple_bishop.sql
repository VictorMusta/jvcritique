CREATE TABLE "jvcritique_game_todo" (
	"userId" varchar(255) NOT NULL,
	"gameId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jvcritique_game_todo_userId_gameId_pk" PRIMARY KEY("userId","gameId")
);
--> statement-breakpoint
-- REPRISE DES DONNÉES — décidée par Victor : « transforme les ça me tente en jeux à faire
-- dans la todolist ». Les réactions posées par ses amis sont converties, pas effacées.
--
-- `DISTINCT` est indispensable : « ça me tente » vivait sur un AVIS. Trois personnes écrivant
-- sur le même jeu produisaient trois réactions pour un seul jeu à jouer, et la clé primaire
-- de la nouvelle table refuserait le doublon.
--
-- `createdAt` reprend la date de la réaction la plus ancienne : la liste se lit du plus
-- récent au plus ancien, et tout dater d'aujourd'hui écraserait l'ordre dans lequel les
-- envies sont venues.
INSERT INTO "jvcritique_game_todo" ("userId", "gameId", "createdAt")
SELECT rr."userId", r."gameId", MIN(rr."createdAt")
FROM "jvcritique_review_reaction" rr
JOIN "jvcritique_review" r ON r."id" = rr."reviewId"
WHERE rr."kind" = 'tempting'
GROUP BY rr."userId", r."gameId"
ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM "jvcritique_review_reaction" WHERE "kind" = 'tempting';--> statement-breakpoint
ALTER TABLE "jvcritique_review_reaction" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
-- Renommage pendant que la colonne est du texte libre : sans ces deux lignes, la conversion
-- vers le nouveau type énuméré échouerait sur chaque ligne existante.
--
-- Le sens change avec le nom : « d'accord avec toi » devient « bon avis », ce qui n'est pas
-- la même chose. C'est ce que Victor a demandé.
UPDATE "jvcritique_review_reaction" SET "kind" = 'up' WHERE "kind" = 'sameHere';--> statement-breakpoint
UPDATE "jvcritique_review_reaction" SET "kind" = 'down' WHERE "kind" = 'disagree';--> statement-breakpoint
DROP TYPE "public"."jvcritique_reaction_kind";--> statement-breakpoint
CREATE TYPE "public"."jvcritique_reaction_kind" AS ENUM('up', 'down');--> statement-breakpoint
ALTER TABLE "jvcritique_review_reaction" ALTER COLUMN "kind" SET DATA TYPE "public"."jvcritique_reaction_kind" USING "kind"::"public"."jvcritique_reaction_kind";--> statement-breakpoint
ALTER TABLE "jvcritique_game_todo" ADD CONSTRAINT "jvcritique_game_todo_userId_jvcritique_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."jvcritique_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_game_todo" ADD CONSTRAINT "jvcritique_game_todo_gameId_jvcritique_game_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."jvcritique_game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_todo_user_created_idx" ON "jvcritique_game_todo" USING btree ("userId","createdAt" DESC NULLS LAST);

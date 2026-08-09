CREATE TABLE "jvcritique_profile_showcase" (
	"userId" varchar(255) NOT NULL,
	"gameId" uuid NOT NULL,
	"position" smallint NOT NULL,
	"words" varchar(60) NOT NULL,
	CONSTRAINT "jvcritique_profile_showcase_userId_position_pk" PRIMARY KEY("userId","position"),
	CONSTRAINT "profile_showcase_position_range" CHECK ("jvcritique_profile_showcase"."position" between 1 and 5),
	CONSTRAINT "profile_showcase_words_not_blank" CHECK ("jvcritique_profile_showcase"."words" ~ '[^[:space:]]')
);
--> statement-breakpoint
ALTER TABLE "jvcritique_profile_showcase" ADD CONSTRAINT "jvcritique_profile_showcase_userId_jvcritique_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."jvcritique_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_profile_showcase" ADD CONSTRAINT "jvcritique_profile_showcase_gameId_jvcritique_game_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."jvcritique_game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_showcase_user_game_idx" ON "jvcritique_profile_showcase" USING btree ("userId","gameId");
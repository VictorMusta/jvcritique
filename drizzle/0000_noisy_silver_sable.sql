CREATE TYPE "public"."jvcritique_domain" AS ENUM('gameplay', 'story', 'atmosphere', 'artDirection', 'soundtrack', 'pacing', 'technical');--> statement-breakpoint
CREATE TABLE "jvcritique_account" (
	"userId" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "jvcritique_account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "jvcritique_game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"steamUrl" varchar(2048),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jvcritique_review_domain_score" (
	"reviewId" uuid NOT NULL,
	"domain" "jvcritique_domain" NOT NULL,
	"value" smallint,
	"notApplicable" boolean DEFAULT false NOT NULL,
	CONSTRAINT "jvcritique_review_domain_score_reviewId_domain_pk" PRIMARY KEY("reviewId","domain"),
	CONSTRAINT "review_domain_score_exclusive" CHECK (("jvcritique_review_domain_score"."notApplicable" = true and "jvcritique_review_domain_score"."value" is null)
       or ("jvcritique_review_domain_score"."notApplicable" = false and "jvcritique_review_domain_score"."value" is not null and "jvcritique_review_domain_score"."value" between 0 and 20))
);
--> statement-breakpoint
CREATE TABLE "jvcritique_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gameId" uuid NOT NULL,
	"authorId" varchar(255) NOT NULL,
	"overallScoreManual" smallint,
	"playtimeHours" integer,
	"completed" boolean DEFAULT false NOT NULL,
	"whyRecommend" text,
	"whatMissed" text,
	"whatHated" text,
	"whyNotRecommend" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "review_overall_score_range" CHECK ("jvcritique_review"."overallScoreManual" is null or "jvcritique_review"."overallScoreManual" between 0 and 20),
	CONSTRAINT "review_playtime_non_negative" CHECK ("jvcritique_review"."playtimeHours" is null or "jvcritique_review"."playtimeHours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "jvcritique_session" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jvcritique_user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"emailVerified" timestamp with time zone,
	"image" varchar(255),
	"bannedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jvcritique_verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "jvcritique_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "jvcritique_weighting" (
	"userId" varchar(255) NOT NULL,
	"domain" "jvcritique_domain" NOT NULL,
	"weight" smallint NOT NULL,
	CONSTRAINT "jvcritique_weighting_userId_domain_pk" PRIMARY KEY("userId","domain"),
	CONSTRAINT "weighting_weight_range" CHECK ("jvcritique_weighting"."weight" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "jvcritique_account" ADD CONSTRAINT "jvcritique_account_userId_jvcritique_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."jvcritique_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_review_domain_score" ADD CONSTRAINT "jvcritique_review_domain_score_reviewId_jvcritique_review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."jvcritique_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_review" ADD CONSTRAINT "jvcritique_review_gameId_jvcritique_game_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."jvcritique_game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_review" ADD CONSTRAINT "jvcritique_review_authorId_jvcritique_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."jvcritique_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_session" ADD CONSTRAINT "jvcritique_session_userId_jvcritique_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."jvcritique_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_weighting" ADD CONSTRAINT "jvcritique_weighting_userId_jvcritique_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."jvcritique_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "jvcritique_account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "game_title_lower_idx" ON "jvcritique_game" USING btree (lower("title"));--> statement-breakpoint
CREATE UNIQUE INDEX "review_author_game_idx" ON "jvcritique_review" USING btree ("authorId","gameId");--> statement-breakpoint
CREATE INDEX "review_created_at_idx" ON "jvcritique_review" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "review_game_id_idx" ON "jvcritique_review" USING btree ("gameId");--> statement-breakpoint
CREATE INDEX "t_user_id_idx" ON "jvcritique_session" USING btree ("userId");
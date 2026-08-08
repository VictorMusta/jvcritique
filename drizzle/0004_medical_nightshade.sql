CREATE TYPE "public"."jvcritique_reaction_kind" AS ENUM('tempting', 'sameHere', 'disagree');--> statement-breakpoint
CREATE TABLE "jvcritique_review_reaction" (
	"reviewId" uuid NOT NULL,
	"userId" varchar(255) NOT NULL,
	"kind" "jvcritique_reaction_kind" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jvcritique_review_reaction_reviewId_userId_pk" PRIMARY KEY("reviewId","userId")
);
--> statement-breakpoint
ALTER TABLE "jvcritique_review_reaction" ADD CONSTRAINT "jvcritique_review_reaction_reviewId_jvcritique_review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."jvcritique_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_review_reaction" ADD CONSTRAINT "jvcritique_review_reaction_userId_jvcritique_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."jvcritique_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_reaction_review_id_idx" ON "jvcritique_review_reaction" USING btree ("reviewId");
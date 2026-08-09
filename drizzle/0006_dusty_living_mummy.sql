CREATE TABLE "jvcritique_review_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reviewId" uuid NOT NULL,
	"authorId" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "review_comment_body_not_blank" CHECK ("jvcritique_review_comment"."body" ~ '[^[:space:]]')
);
--> statement-breakpoint
ALTER TABLE "jvcritique_review_comment" ADD CONSTRAINT "jvcritique_review_comment_reviewId_jvcritique_review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."jvcritique_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_review_comment" ADD CONSTRAINT "jvcritique_review_comment_authorId_jvcritique_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."jvcritique_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_comment_review_id_idx" ON "jvcritique_review_comment" USING btree ("reviewId");
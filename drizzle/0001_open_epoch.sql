CREATE TABLE "jvcritique_review_update_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reviewId" uuid NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_update_note_body_not_blank" CHECK (length(trim("jvcritique_review_update_note"."body")) > 0)
);
--> statement-breakpoint
ALTER TABLE "jvcritique_review_update_note" ADD CONSTRAINT "jvcritique_review_update_note_reviewId_jvcritique_review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."jvcritique_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_update_note_review_id_idx" ON "jvcritique_review_update_note" USING btree ("reviewId");
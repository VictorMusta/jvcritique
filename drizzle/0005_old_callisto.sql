CREATE TABLE "jvcritique_review_screenshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reviewId" uuid NOT NULL,
	"storageKey" varchar(128) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jvcritique_review_screenshot_storageKey_unique" UNIQUE("storageKey"),
	CONSTRAINT "review_screenshot_dimensions_positive" CHECK ("jvcritique_review_screenshot"."width" > 0 and "jvcritique_review_screenshot"."height" > 0)
);
--> statement-breakpoint
ALTER TABLE "jvcritique_review_screenshot" ADD CONSTRAINT "jvcritique_review_screenshot_reviewId_jvcritique_review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."jvcritique_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_screenshot_review_id_idx" ON "jvcritique_review_screenshot" USING btree ("reviewId");
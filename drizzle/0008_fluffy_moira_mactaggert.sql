CREATE TYPE "public"."jvcritique_notification_kind" AS ENUM('comment', 'reaction', 'edit');--> statement-breakpoint
CREATE TABLE "jvcritique_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar(255) NOT NULL,
	"actorId" varchar(255) NOT NULL,
	"reviewId" uuid NOT NULL,
	"kind" "jvcritique_notification_kind" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"readAt" timestamp with time zone,
	CONSTRAINT "notification_not_self" CHECK ("jvcritique_notification"."userId" <> "jvcritique_notification"."actorId")
);
--> statement-breakpoint
ALTER TABLE "jvcritique_notification" ADD CONSTRAINT "jvcritique_notification_userId_jvcritique_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."jvcritique_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_notification" ADD CONSTRAINT "jvcritique_notification_actorId_jvcritique_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."jvcritique_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_notification" ADD CONSTRAINT "jvcritique_notification_reviewId_jvcritique_review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."jvcritique_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "jvcritique_notification" USING btree ("userId","createdAt" DESC NULLS LAST);
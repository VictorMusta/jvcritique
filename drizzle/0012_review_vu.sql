CREATE TABLE "jvcritique_review_vu" (
	"userId" varchar(255) NOT NULL,
	"reviewId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jvcritique_review_vu_userId_reviewId_pk" PRIMARY KEY("userId","reviewId")
);
--> statement-breakpoint
ALTER TABLE "jvcritique_review_vu" ADD CONSTRAINT "jvcritique_review_vu_userId_jvcritique_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."jvcritique_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jvcritique_review_vu" ADD CONSTRAINT "jvcritique_review_vu_reviewId_jvcritique_review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."jvcritique_review"("id") ON DELETE cascade ON UPDATE no action;
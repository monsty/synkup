-- Couverture : une clé dans le bucket plutôt qu'une URL.
ALTER TABLE "Album" RENAME COLUMN "coverUrl" TO "coverKey";

-- Photos : versions affichage et miniature, type et taille de l'originale.
ALTER TABLE "Photo"
  ADD COLUMN "displayKey" TEXT NOT NULL,
  ADD COLUMN "thumbKey" TEXT NOT NULL,
  ADD COLUMN "contentType" TEXT NOT NULL,
  ADD COLUMN "byteSize" INTEGER NOT NULL;

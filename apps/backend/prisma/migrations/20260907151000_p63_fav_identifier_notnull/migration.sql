-- Favorites always point at a concrete entity (0 nulls verified)
ALTER TABLE "user_favorites" ALTER COLUMN "entityIdentifier" SET NOT NULL;

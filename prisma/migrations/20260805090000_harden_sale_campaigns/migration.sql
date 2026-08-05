-- Keep one recoverable record per campaign/variant before enforcing idempotency.
WITH merged AS (
  SELECT
    (ARRAY_AGG("id" ORDER BY "createdAt" ASC, "id" ASC))[1] AS keep_id,
    BOOL_OR("applied") AS applied,
    MIN("appliedAt") AS applied_at,
    BOOL_OR("reverted") AS reverted,
    MAX("revertedAt") AS reverted_at
  FROM "price_changes"
  GROUP BY "campaignId", "variantId"
  HAVING COUNT(*) > 1
)
UPDATE "price_changes" AS price_change
SET
  "applied" = merged.applied,
  "appliedAt" = merged.applied_at,
  "reverted" = merged.reverted,
  "revertedAt" = merged.reverted_at
FROM merged
WHERE price_change."id" = merged.keep_id;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "campaignId", "variantId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS row_number
  FROM "price_changes"
)
DELETE FROM "price_changes" AS price_change
USING ranked
WHERE price_change."id" = ranked."id"
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "price_changes_campaignId_variantId_key"
ON "price_changes"("campaignId", "variantId");

ALTER TABLE "sale_campaigns"
  ALTER COLUMN "discountValue" TYPE DECIMAL(18, 2);

ALTER TABLE "price_changes"
  ALTER COLUMN "originalPrice" TYPE DECIMAL(18, 2),
  ALTER COLUMN "salePrice" TYPE DECIMAL(18, 2),
  ALTER COLUMN "currentPrice" TYPE DECIMAL(18, 2),
  ALTER COLUMN "originalCompareAtPrice" TYPE DECIMAL(18, 2);

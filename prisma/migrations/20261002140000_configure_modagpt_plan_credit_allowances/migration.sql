UPDATE "ModaGptBillingPlan"
SET
  "monthlyCredits" = CASE "id"
    WHEN 'FREE' THEN NULL
    WHEN 'PLUS' THEN 2000
    WHEN 'PRO' THEN 6000
    WHEN 'BUSINESS' THEN 12000
    WHEN 'FASHION_PRO' THEN 25000
  END,
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('FREE', 'PLUS', 'PRO', 'BUSINESS', 'FASHION_PRO');

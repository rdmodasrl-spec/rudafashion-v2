CREATE TABLE "RestaurantIngredient" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "category" VARCHAR(24) NOT NULL,
    "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" VARCHAR(160),
    "requestHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantIngredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantRecipe" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
    "yieldQuantity" DECIMAL(14,3) NOT NULL,
    "yieldUnit" VARCHAR(16) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" VARCHAR(160),
    "requestHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantRecipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantRecipeItem" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "ingredientCodeSnapshot" VARCHAR(80) NOT NULL,
    "ingredientNameSnapshot" VARCHAR(200) NOT NULL,
    "unitSnapshot" VARCHAR(16) NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "wasteRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantRecipeItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantIngredient_materialId_key"
    ON "RestaurantIngredient"("materialId");
CREATE UNIQUE INDEX "RestaurantIngredient_merchantId_idempotencyKey_key"
    ON "RestaurantIngredient"("merchantId", "idempotencyKey");
CREATE INDEX "RestaurantIngredient_merchantId_category_updatedAt_idx"
    ON "RestaurantIngredient"("merchantId", "category", "updatedAt");

CREATE UNIQUE INDEX "RestaurantRecipe_dishId_version_key"
    ON "RestaurantRecipe"("dishId", "version");
CREATE UNIQUE INDEX "RestaurantRecipe_merchantId_idempotencyKey_key"
    ON "RestaurantRecipe"("merchantId", "idempotencyKey");
CREATE INDEX "RestaurantRecipe_merchantId_dishId_status_idx"
    ON "RestaurantRecipe"("merchantId", "dishId", "status");

CREATE UNIQUE INDEX "RestaurantRecipeItem_recipeId_ingredientId_key"
    ON "RestaurantRecipeItem"("recipeId", "ingredientId");
CREATE INDEX "RestaurantRecipeItem_merchantId_ingredientId_idx"
    ON "RestaurantRecipeItem"("merchantId", "ingredientId");

ALTER TABLE "RestaurantIngredient"
    ADD CONSTRAINT "RestaurantIngredient_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantIngredient"
    ADD CONSTRAINT "RestaurantIngredient_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantRecipe"
    ADD CONSTRAINT "RestaurantRecipe_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantRecipe"
    ADD CONSTRAINT "RestaurantRecipe_dishId_fkey"
    FOREIGN KEY ("dishId") REFERENCES "RestaurantDish"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantRecipeItem"
    ADD CONSTRAINT "RestaurantRecipeItem_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "RestaurantRecipe"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantRecipeItem"
    ADD CONSTRAINT "RestaurantRecipeItem_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "RestaurantIngredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

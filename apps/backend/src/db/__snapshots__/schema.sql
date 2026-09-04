-- index ErrorLog_createdAt_idx
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt" DESC);

-- index ErrorLog_requestId_idx
CREATE INDEX "ErrorLog_requestId_idx" ON "ErrorLog"("requestId");

-- index HouseholdInvitation_invitedEmail_status_idx
CREATE INDEX "HouseholdInvitation_invitedEmail_status_idx" ON "HouseholdInvitation"("invitedEmail", "status");

-- index HouseholdInvitation_token_idx
CREATE INDEX "HouseholdInvitation_token_idx" ON "HouseholdInvitation"("token");

-- index Plan_householdId_state_createdAt_idx
CREATE INDEX "Plan_householdId_state_createdAt_idx" ON "Plan"("householdId", "state", "createdAt" DESC);

-- index PlanIngredientRoute_planId_idx
CREATE INDEX "PlanIngredientRoute_planId_idx" ON "PlanIngredientRoute"("planId");

-- index PlanSlot_planId_slotNumber_idx
CREATE INDEX "PlanSlot_planId_slotNumber_idx" ON "PlanSlot"("planId", "slotNumber");

-- index Recipe_householdId_isHidden_name_idx
CREATE INDEX "Recipe_householdId_isHidden_name_idx" ON "Recipe"("householdId", "isHidden", "name");

-- index RecipeIngredient_recipeId_sortOrder_idx
CREATE INDEX "RecipeIngredient_recipeId_sortOrder_idx" ON "RecipeIngredient"("recipeId", "sortOrder");

-- index RecipeTag_householdId_name_idx
CREATE INDEX "RecipeTag_householdId_name_idx" ON "RecipeTag"("householdId", "name");

-- index RecipeTagAssignment_recipeId_idx
CREATE INDEX "RecipeTagAssignment_recipeId_idx" ON "RecipeTagAssignment"("recipeId");

-- index RecipeTagAssignment_tagId_idx
CREATE INDEX "RecipeTagAssignment_tagId_idx" ON "RecipeTagAssignment"("tagId");

-- index ShoppingListItem_storeId_isChecked_updatedAt_idx
CREATE INDEX "ShoppingListItem_storeId_isChecked_updatedAt_idx" ON "ShoppingListItem"("storeId", "isChecked", "updatedAt");

-- index Store_householdId_idx
CREATE INDEX "Store_householdId_idx" ON "Store"("householdId");

-- index User_email_idx
CREATE INDEX "User_email_idx" ON "User"("email" COLLATE NOCASE);

-- index UserStoreOrder_userId_idx
CREATE INDEX "UserStoreOrder_userId_idx" ON "UserStoreOrder"("userId");

-- table AppSetting
CREATE TABLE "AppSetting" ( "key" TEXT NOT NULL PRIMARY KEY CHECK(length("key") <= 100), "value" TEXT NOT NULL CHECK(length("value") <= 1000), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP );

-- table ErrorLog
CREATE TABLE "ErrorLog" ( "id" TEXT NOT NULL PRIMARY KEY, "requestId" TEXT NOT NULL CHECK(length("requestId") <= 100), "userId" TEXT, "route" TEXT NOT NULL CHECK(length("route") <= 255), "method" TEXT NOT NULL CHECK(length("method") <= 10), "statusCode" INTEGER NOT NULL, "code" TEXT NOT NULL CHECK(length("code") <= 100), "message" TEXT NOT NULL CHECK(length("message") <= 1000), "stack" TEXT CHECK("stack" IS NULL OR length("stack") <= 4000), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL );

-- table Household
CREATE TABLE "Household" ( "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100), "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT );

-- table HouseholdInvitation
CREATE TABLE "HouseholdInvitation" ( "id" TEXT NOT NULL PRIMARY KEY, "householdId" TEXT NOT NULL, "invitedEmail" TEXT NOT NULL COLLATE NOCASE CHECK(length("invitedEmail") <= 255), "invitedById" TEXT NOT NULL, "token" TEXT NOT NULL UNIQUE CHECK(length("token") <= 255), "status" TEXT NOT NULL DEFAULT 'pending' CHECK(length("status") <= 50), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE, FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE );

-- table HouseholdMember
CREATE TABLE "HouseholdMember" ( "id" TEXT NOT NULL PRIMARY KEY, "householdId" TEXT NOT NULL, "userId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE, FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE, UNIQUE ("householdId", "userId") );

-- table Plan
CREATE TABLE "Plan" ( "id" TEXT NOT NULL PRIMARY KEY, "householdId" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'draft' CHECK("state" IN ('draft', 'active', 'archived')), "slotCount" INTEGER NOT NULL DEFAULT 4 CHECK("slotCount" >= 1 AND "slotCount" <= 12), "defaultStoreId" TEXT, "dispatchedAt" DATETIME, "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE, FOREIGN KEY ("defaultStoreId") REFERENCES "Store" ("id") ON DELETE SET NULL, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT );

-- table PlanIngredientRoute
CREATE TABLE "PlanIngredientRoute" ( "id" TEXT NOT NULL PRIMARY KEY, "planId" TEXT NOT NULL, "ingredientId" TEXT NOT NULL, "storeId" TEXT, "overridden" INTEGER, "checked" INTEGER, "isUnsure" INTEGER, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE, FOREIGN KEY ("ingredientId") REFERENCES "RecipeIngredient" ("id") ON DELETE CASCADE, FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL, UNIQUE ("planId", "ingredientId") );

-- table PlanSlot
CREATE TABLE "PlanSlot" ( "id" TEXT NOT NULL PRIMARY KEY, "planId" TEXT NOT NULL, "slotNumber" INTEGER NOT NULL CHECK("slotNumber" >= 1), "tagIds" TEXT NOT NULL DEFAULT '[]', "maxCookingTimeMinutes" INTEGER, "pickedRecipeId" TEXT, "pinned" INTEGER, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE, FOREIGN KEY ("pickedRecipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL, UNIQUE ("planId", "slotNumber") );

-- table QuantityUnit
CREATE TABLE "QuantityUnit" ( "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL CHECK(length("name") <= 50), "abbreviation" TEXT NOT NULL CHECK(length("abbreviation") <= 10), "sortOrder" INTEGER NOT NULL, "category" TEXT NOT NULL CHECK(length("category") <= 50) );

-- table Recipe
CREATE TABLE "Recipe" ( "id" TEXT NOT NULL PRIMARY KEY, "householdId" TEXT NOT NULL, "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 200), "description" TEXT CHECK("description" IS NULL OR length("description") <= 2000), "steps" TEXT CHECK("steps" IS NULL OR length("steps") <= 50000), "source" TEXT CHECK("source" IS NULL OR (length("source") >= 1 AND length("source") <= 200)), "sourceUrl" TEXT CHECK("sourceUrl" IS NULL OR length("sourceUrl") <= 500), "isHidden" INTEGER, "isPoolExcluded" INTEGER, "cookingTimeMinutes" INTEGER, "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT );

-- table RecipeIngredient
CREATE TABLE "RecipeIngredient" ( "id" TEXT NOT NULL PRIMARY KEY, "recipeId" TEXT NOT NULL, "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 200), "shoppingName" TEXT CHECK("shoppingName" IS NULL OR length("shoppingName") <= 255), "qty" REAL, "shoppingQty" REAL, "unitId" TEXT, "shoppingUnitId" TEXT REFERENCES "QuantityUnit" ("id") ON DELETE SET NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, "notes" TEXT CHECK("notes" IS NULL OR length("notes") <= 500), "excluded" INTEGER, "isUnsure" INTEGER, "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE, FOREIGN KEY ("unitId") REFERENCES "QuantityUnit" ("id") ON DELETE SET NULL, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT );

-- table RecipeTag
CREATE TABLE "RecipeTag" ( "id" TEXT NOT NULL PRIMARY KEY, "householdId" TEXT NOT NULL, "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 50), "colorKey" TEXT CHECK("colorKey" IS NULL OR length("colorKey") <= 30), "createdById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, UNIQUE("householdId", "name" COLLATE NOCASE) );

-- table RecipeTagAssignment
CREATE TABLE "RecipeTagAssignment" ( "id" TEXT NOT NULL PRIMARY KEY, "recipeId" TEXT NOT NULL, "tagId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE, FOREIGN KEY ("tagId") REFERENCES "RecipeTag" ("id") ON DELETE CASCADE, UNIQUE("recipeId", "tagId") );

-- table RefreshToken
CREATE TABLE "RefreshToken" ( "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "token" TEXT NOT NULL UNIQUE CHECK(length("token") <= 255), "expiresAt" DATETIME NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE );

-- table ShoppingListItem
CREATE TABLE "ShoppingListItem" ( "id" TEXT NOT NULL PRIMARY KEY, "storeId" TEXT NOT NULL, "storeItemId" TEXT, "qty" REAL, "unitId" TEXT, "notes" TEXT CHECK("notes" IS NULL OR length("notes") <= 1000), "isChecked" BOOLEAN, "checkedAt" DATETIME, "checkedBy" TEXT, "checkedUpdatedAt" DATETIME, "isSample" BOOLEAN, "isUnsure" BOOLEAN, "isIdea" BOOLEAN, "snoozedUntil" DATETIME, "isPrivate" INTEGER, "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE, FOREIGN KEY ("storeItemId") REFERENCES "StoreItem" ("id") ON DELETE CASCADE, FOREIGN KEY ("unitId") REFERENCES "QuantityUnit" ("id") ON DELETE SET NULL, FOREIGN KEY ("checkedBy") REFERENCES "User" ("id") ON DELETE SET NULL, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT );

-- table Store
CREATE TABLE "Store" ( "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100), "householdId" TEXT, "isHidden" INTEGER, "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT );

-- table StoreAisle
CREATE TABLE "StoreAisle" ( "id" TEXT NOT NULL PRIMARY KEY, "storeId" TEXT NOT NULL, "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100), "nameNorm" TEXT NOT NULL CHECK(length("nameNorm") >= 1 AND length("nameNorm") <= 100), "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT, UNIQUE ("storeId", "nameNorm") );

-- table StoreItem
CREATE TABLE "StoreItem" ( "id" TEXT NOT NULL PRIMARY KEY, "storeId" TEXT NOT NULL, "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100), "nameNorm" TEXT NOT NULL CHECK(length("nameNorm") >= 1 AND length("nameNorm") <= 100), "aisleId" TEXT, "sectionId" TEXT, "usageCount" INTEGER NOT NULL DEFAULT 0, "lastUsedAt" DATETIME, "isHidden" BOOLEAN NOT NULL DEFAULT 0, "isFavorite" BOOLEAN NOT NULL DEFAULT 0, "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE, FOREIGN KEY ("aisleId") REFERENCES "StoreAisle" ("id") ON DELETE SET NULL, FOREIGN KEY ("sectionId") REFERENCES "StoreSection" ("id") ON DELETE SET NULL, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT, UNIQUE ("storeId", "nameNorm") );

-- table StoreSection
CREATE TABLE "StoreSection" ( "id" TEXT NOT NULL PRIMARY KEY, "storeId" TEXT NOT NULL, "aisleId" TEXT NOT NULL, "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100), "nameNorm" TEXT NOT NULL CHECK(length("nameNorm") >= 1 AND length("nameNorm") <= 100), "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE, FOREIGN KEY ("aisleId") REFERENCES "StoreAisle" ("id") ON DELETE CASCADE, FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT, FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT, UNIQUE ("storeId", "aisleId", "nameNorm") );

-- table User
CREATE TABLE "User" ( "id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL UNIQUE CHECK(length("email") <= 255), "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100), "password" TEXT NOT NULL CHECK(length("password") <= 255), "scopes" TEXT NOT NULL DEFAULT '' CHECK(length("scopes") <= 500), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL );

-- table UserStoreOrder
CREATE TABLE "UserStoreOrder" ( "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "storeId" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE, FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE, UNIQUE ("userId", "storeId") );
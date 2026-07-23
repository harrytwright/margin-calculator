import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Supplier
  await db.schema
    .createTable('Supplier')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('notes', 'text')
    .execute()

  // SupplierContact (1:1 via unique supplierId)
  await db.schema
    .createTable('SupplierContact')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text')
    .addColumn('email', 'text')
    .addColumn('phone', 'text')
    .addColumn('supplierId', 'integer', (col) =>
      col.notNull().unique().references('Supplier.id').onDelete('cascade')
    )
    .execute()

  // Pricing (shared, Stripe-style BigInt + ISO currency code)
  await db.schema
    .createTable('Pricing')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('cost', 'integer', (col) => col.notNull()) // BigInt maps to INTEGER in SQLite (up to 8 bytes)
    .addColumn('currency', 'text', (col) =>
      col.notNull().check(sql`length(currency) = 3`)
    )
    .execute()

  await db.schema
    .createIndex('Pricing_cost_currency_idx')
    .on('Pricing')
    .columns(['cost', 'currency'])
    .execute()

  // Ingredient
  await db.schema
    .createTable('Ingredient')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('category', 'text', (col) => col.notNull())
    .addColumn('conversionRule', 'text')
    .addColumn('allergensContains', 'bigint', (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn('allergensMayContain', 'bigint', (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn('glutenCereals', 'text')
    .addColumn('treeNuts', 'text')
    .addColumn('supplierId', 'integer', (col) =>
      col.references('Supplier.id').onDelete('set null')
    )
    .addColumn('notes', 'text')
    .addColumn('lastPurchased', 'text')
    .execute()

  await db.schema
    .createIndex('Ingredient_category_idx')
    .on('Ingredient')
    .column('category')
    .execute()

  await db.schema
    .createIndex('Ingredient_slug_idx')
    .on('Ingredient')
    .column('slug')
    .execute()

  await db.schema
    .createIndex('Ingredient_allergensContains_idx')
    .on('Ingredient')
    .column('allergensContains')
    .execute()

  await db.schema
    .createIndex('Ingredient_allergensMayContain_idx')
    .on('Ingredient')
    .column('allergensMayContain')
    .execute()

  // IngredientCost (links Ingredient -> Pricing with historical tracking)
  await db.schema
    .createTable('IngredientCost')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('unit', 'text', (col) => col.notNull())
    .addColumn('vat', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('validFrom', 'text', (col) =>
      col.notNull().defaultTo(sql`(datetime('now'))`)
    )
    .addColumn('validTo', 'text')
    .addColumn('ingredientId', 'integer', (col) =>
      col.notNull().references('Ingredient.id').onDelete('cascade')
    )
    .addColumn('pricingId', 'integer', (col) =>
      col.notNull().references('Pricing.id').onDelete('cascade')
    )
    .execute()

  await db.schema
    .createIndex('IngredientCost_pricingId_idx')
    .on('IngredientCost')
    .column('pricingId')
    .execute()

  // Recipe
  await db.schema
    .createTable('Recipe')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('stage', 'text', (col) =>
      col
        .notNull()
        .defaultTo('development')
        .check(sql`stage IN ('development', 'active', 'discontinued')`)
    )
    .addColumn('class', 'text', (col) =>
      col
        .notNull()
        .defaultTo('menu_item')
        .check(sql`class IN ('menu_item', 'base_template', 'sub_recipe')`)
    )
    .addColumn('category', 'text')
    .addColumn('targetMargin', 'integer', (col) => col.notNull().defaultTo(20))
    .addColumn('yieldAmount', 'real')
    .addColumn('yieldUnit', 'text')
    .addColumn('parentId', 'integer', (col) =>
      col.references('Recipe.id').onDelete('set null')
    )
    .execute()

  // RecipeIngredients
  await db.schema
    .createTable('RecipeIngredients')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('recipeId', 'integer', (col) =>
      col.notNull().references('Recipe.id').onDelete('cascade')
    )
    .addColumn('ingredientId', 'integer', (col) =>
      col.references('Ingredient.id').onDelete('set null')
    )
    .addColumn('subRecipeId', 'integer', (col) =>
      col.references('Recipe.id').onDelete('set null')
    )
    .addColumn('quantity', 'real', (col) => col.notNull())
    .addColumn('unit', 'text', (col) => col.notNull())
    .addColumn('notes', 'text')
    .execute()

  await db.schema
    .createIndex('RecipeIngredients_recipeId_idx')
    .on('RecipeIngredients')
    .column('recipeId')
    .execute()

  await db.schema
    .createIndex('RecipeIngredients_ingredientId_idx')
    .on('RecipeIngredients')
    .column('ingredientId')
    .execute()

  // RecipePrice (links Recipe -> Pricing with historical tracking)
  await db.schema
    .createTable('RecipePrice')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('vat', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('validFrom', 'text', (col) =>
      col.notNull().defaultTo(sql`(datetime('now'))`)
    )
    .addColumn('validTo', 'text')
    .addColumn('recipeId', 'integer', (col) =>
      col.notNull().references('Recipe.id').onDelete('cascade')
    )
    .addColumn('pricingId', 'integer', (col) =>
      col.notNull().references('Pricing.id').onDelete('cascade')
    )
    .execute()

  await db.schema
    .createIndex('RecipePrice_pricingId_idx')
    .on('RecipePrice')
    .column('pricingId')
    .execute()

  // Seed generic supplier
  await db
    .insertInto('Supplier')
    .values({ slug: 'generic', name: 'Generic Supplier' })
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('RecipePrice').ifExists().execute()
  await db.schema.dropTable('RecipeIngredients').ifExists().execute()
  await db.schema.dropTable('Recipe').ifExists().execute()
  await db.schema.dropTable('IngredientCost').ifExists().execute()
  await db.schema.dropTable('Ingredient').ifExists().execute()
  await db.schema.dropTable('Pricing').ifExists().execute()
  await db.schema.dropTable('SupplierContact').ifExists().execute()
  await db.schema.dropTable('Supplier').ifExists().execute()
}

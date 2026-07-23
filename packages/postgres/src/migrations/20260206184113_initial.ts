import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Enums
  await sql`CREATE TYPE "RecipeStage" AS ENUM ('development', 'active', 'discontinued')`.execute(
    db
  )
  await sql`CREATE TYPE "RecipeClass" AS ENUM ('menu_item', 'base_template', 'sub_recipe')`.execute(
    db
  )

  // Supplier
  await db.schema
    .createTable('Supplier')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('notes', 'varchar(512)')
    .execute()

  // SupplierContact (1:1 via unique supplierId)
  await db.schema
    .createTable('SupplierContact')
    .addColumn('id', 'serial', (col) => col.primaryKey())
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
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('cost', 'bigint', (col) => col.notNull())
    .addColumn('currency', sql`char(3)`, (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex('Pricing_cost_currency_idx')
    .on('Pricing')
    .columns(['cost', 'currency'])
    .execute()

  // Ingredient
  await db.schema
    .createTable('Ingredient')
    .addColumn('id', 'serial', (col) => col.primaryKey())
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
    .addColumn('lastPurchased', 'timestamp')
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
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('unit', 'text', (col) => col.notNull())
    .addColumn('vat', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('validFrom', sql`timestamp(0)`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('validTo', sql`timestamp(0)`)
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
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('stage', sql`"RecipeStage"`, (col) =>
      col.notNull().defaultTo('development')
    )
    .addColumn('class', sql`"RecipeClass"`, (col) =>
      col.notNull().defaultTo('menu_item')
    )
    .addColumn('category', 'text')
    .addColumn('targetMargin', 'integer', (col) => col.notNull().defaultTo(20))
    .addColumn('yieldAmount', 'decimal')
    .addColumn('yieldUnit', 'text')
    .addColumn('parentId', 'integer', (col) =>
      col.references('Recipe.id').onDelete('set null')
    )
    .execute()

  // RecipeIngredients
  await db.schema
    .createTable('RecipeIngredients')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('recipeId', 'integer', (col) =>
      col.notNull().references('Recipe.id').onDelete('cascade')
    )
    .addColumn('ingredientId', 'integer', (col) =>
      col.references('Ingredient.id').onDelete('set null')
    )
    .addColumn('subRecipeId', 'integer', (col) =>
      col.references('Recipe.id').onDelete('set null')
    )
    .addColumn('quantity', 'decimal', (col) => col.notNull())
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
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('vat', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('validFrom', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('validTo', 'timestamp')
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

  await sql`DROP TYPE IF EXISTS "RecipeClass"`.execute(db)
  await sql`DROP TYPE IF EXISTS "RecipeStage"`.execute(db)
}

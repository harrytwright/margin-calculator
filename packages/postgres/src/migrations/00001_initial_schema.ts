import { Kysely, sql } from 'kysely'

/**
 * Initial database schema for PostgreSQL.
 * This is a squashed migration containing the complete schema.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create Supplier table
  await db.schema
    .createTable('Supplier')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('contactName', 'text')
    .addColumn('contactEmail', 'text')
    .addColumn('contactPhone', 'text')
    .addColumn('notes', 'text')
    .execute()

  // Create Recipe table (self-referential, so created before Ingredient)
  await db.schema
    .createTable('Recipe')
    .addColumn('id', 'serial', (col) => col.primaryKey())
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
    .addColumn('sellPrice', 'integer', (col) => col.notNull())
    .addColumn('includesVat', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('targetMargin', 'integer', (col) => col.notNull().defaultTo(20))
    .addColumn('yieldAmount', 'decimal')
    .addColumn('yieldUnit', 'text')
    .addColumn('parentId', 'integer', (col) =>
      col.references('Recipe.id').onDelete('set null')
    )
    .execute()

  // Create Ingredient table
  await db.schema
    .createTable('Ingredient')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('category', 'text', (col) => col.notNull())
    .addColumn('purchaseUnit', 'text', (col) => col.notNull())
    .addColumn('purchaseCost', 'decimal', (col) => col.notNull())
    .addColumn('includesVat', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('conversionRule', 'text')
    .addColumn('supplierId', 'integer', (col) =>
      col.references('Supplier.id').onDelete('set null')
    )
    .addColumn('notes', 'text')
    .addColumn('lastPurchased', 'timestamp')
    .execute()

  // Create indexes for Ingredient
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

  // Create RecipeIngredients junction table
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
    .addColumn('unit', 'text', (col) => col.notNull())
    .addColumn('notes', 'text')
    .execute()

  // Create indexes for RecipeIngredients
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
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order to handle foreign key constraints
  await db.schema.dropTable('RecipeIngredients').execute()
  await db.schema.dropTable('Ingredient').execute()
  await db.schema.dropTable('Recipe').execute()
  await db.schema.dropTable('Supplier').execute()
}

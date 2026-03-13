import {
  DatabaseContext,
  DB,
  IDType,
  NewPricing,
  NewRecipe,
  NewRecipeIngredients,
  NewRecipePrice,
  Pricing,
  Recipe,
  RecipeIngredients,
  RecipePrice,
  TransactionOr,
  UpdateRecipe,
} from '@menubook/shared'

import type { CacheAdapter } from '../cache'
// import type { DatabaseContext } from '../datastore/context'
// import type { Recipe, RecipeIngredients } from '../interfaces/database'
import { Transaction } from 'kysely'
import { handleError } from '../datastore/handleError'
import { parseWithSchema } from '../validation'
import {
  recipeCreateSchema,
  recipeIngredientDeleteSchema,
  recipeIngredientInputArraySchema,
  recipeIngredientInputSchema,
  recipePricingInputSchema,
  recipeUpdateSchema,
} from '../validation/zod'
import { ConfigService } from './config'

/** Cache key patterns for invalidation */
const CACHE_PATTERNS = {
  /** Invalidate all margin calculations */
  margin: 'margin:*',
  /** Invalidate all dashboard stats */
  dashboard: 'dashboard:*',
} as const

export type RecipePricing = Omit<RecipePrice, 'recipeId' | 'pricingId'> &
  Omit<Pricing, 'id'>

export type RecipeWithPricing = Recipe & {
  cost: RecipePricing | null
}

export type RecipeIngredientReference = RecipeIngredients & {
  name: string | null
  slug: string
  type: 'ingredient' | 'recipe'
}

export type FindOptions = {
  withIngredients?: boolean
  withHistoricalPrices?: boolean
  withChildren?: boolean
}

export type RecipeResult<O extends FindOptions = {}> = RecipeWithPricing &
  (O extends { withIngredients: true }
    ? { ingredients: RecipeIngredientReference[] }
    : {}) &
  (O extends { withHistoricalPrices: true }
    ? { historicalPricing: RecipePricing[] }
    : {}) &
  (O extends { withChildren: true } ? { children: RecipeWithPricing[] } : {})

type RecipeIngredientBase = Omit<
  NewRecipeIngredients,
  'recipeId' | 'ingredientId' | 'subRecipeId'
>

export type RecipeIngredientInput = RecipeIngredientBase &
  (
    | Pick<NewRecipeIngredients, 'ingredientId' | 'subRecipeId'>
    | { type: 'ingredient' | 'recipe'; slug: string }
  )

export type NewRecipeIngredientInputRef = Pick<
  NewRecipeIngredients,
  'ingredientId' | 'subRecipeId'
>

export interface RecipeServiceOptions {
  /** Cache adapter for invalidation on mutations */
  cache?: CacheAdapter
}

export class RecipeService {
  private cache?: CacheAdapter

  constructor(
    private context: DatabaseContext,
    private readonly config: ConfigService,
    options: RecipeServiceOptions = {}
  ) {
    this.cache = options.cache
  }

  /**
   * Invalidate cache entries affected by recipe changes.
   * Called automatically on upsert/delete.
   */
  private async invalidateCache(): Promise<void> {
    if (!this.cache) return
    await Promise.all([
      this.cache.invalidatePattern(CACHE_PATTERNS.margin),
      this.cache.invalidatePattern(CACHE_PATTERNS.dashboard),
    ])
  }

  private get database() {
    return this.context.db
  }

  get transaction() {
    return this.database.transaction()
  }

  // The CLI will set a global value, bar the UI command, to say whether this is running as a CLI/TUI or not
  get isInCLIMode() {
    // @ts-ignore
    return globalThis[Symbol.for('isCLI')] === true
  }

  async exists(slug: string, trx?: Transaction<DB>) {
    return !!(await (trx ?? this.database)
      .selectFrom('Recipe')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst())
  }

  find(trx?: Transaction<DB>): Promise<RecipeWithPricing[]> {
    const jsonObjectFrom = this.context.helpers.jsonObjectFrom

    return (trx ?? this.database)
      .selectFrom('Recipe')
      .selectAll('Recipe')
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom('RecipePrice')
            .innerJoin('Pricing', 'RecipePrice.pricingId', 'Pricing.id')
            .select([
              'RecipePrice.id',
              'RecipePrice.vat',
              'RecipePrice.validTo',
              'RecipePrice.validFrom',
              'Pricing.cost',
              'Pricing.currency',
            ])
            .where('RecipePrice.validTo', 'is', null)
            .whereRef('RecipePrice.recipeId', '=', 'Recipe.id')
        )
          .$castTo<RecipePricing | null>()
          .as('cost'),
      ])
      .execute()
  }

  async findById<const O extends FindOptions>(
    id: IDType,
    optionsOrTrx?: TransactionOr<O>,
    trx?: Transaction<DB>
  ): Promise<RecipeResult<O>> {
    let opts: FindOptions
    if (optionsOrTrx instanceof Transaction) {
      trx = optionsOrTrx
      opts = {
        withChildren: false,
        withIngredients: false,
        withHistoricalPrices: false,
      }
    } else {
      opts = optionsOrTrx ?? {
        withChildren: false,
        withIngredients: false,
        withHistoricalPrices: false,
      }
    }

    const query = async (trx: Transaction<DB>): Promise<RecipeResult<O>> => {
      let base = await this.__unsafe_fetch(id, trx)

      const [ingredients, history, children] = await Promise.all([
        opts.withIngredients
          ? this.__unsafe_fetchIngredients(base.id, trx)
          : undefined,
        opts.withHistoricalPrices
          ? this.__unsafe_fetchHistoricalPrices(base.id, trx)
          : undefined,
        opts.withChildren
          ? this.__unsafe_fetchChildren(base.id, trx)
          : undefined,
      ])

      return {
        ...base,
        ...(ingredients && { ingredients }),
        ...(history && { historicalPricing: history }),
        ...(children && { children }),
      } as RecipeResult<O>
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  create(
    args: NewRecipe,
    pricing?: Omit<NewRecipePrice, 'recipeId' | 'pricingId'> & NewPricing,
    ingredients?: RecipeIngredientInput[],
    trx?: Transaction<DB>
  ): Promise<RecipeWithPricing> {
    const validatedArgs = parseWithSchema(
      recipeCreateSchema,
      args,
      'Invalid recipe data'
    )
    const validatedPricing = pricing
      ? parseWithSchema(
          recipePricingInputSchema,
          pricing,
          'Invalid recipe pricing data'
        )
      : undefined
    const validatedIngredients = ingredients?.length
      ? parseWithSchema(
          recipeIngredientInputArraySchema,
          ingredients,
          'Invalid recipe ingredient data'
        )
      : undefined

    const query = async (trx: Transaction<DB>): Promise<RecipeWithPricing> => {
      const exists = await this.exists(validatedArgs.slug, trx)

      if (exists)
        throw Object.assign(
          new Error(`Recipe with slug '${validatedArgs.slug}' already exists`),
          { code: 'ERR_CONFLICT_409' }
        )

      const record = await trx
        .insertInto('Recipe')
        .values(validatedArgs)
        .returning('id')
        .executeTakeFirstOrThrow()

      if (validatedPricing) {
        await this.updatePricingHistory(record.id, validatedPricing, trx)
      }

      if (validatedIngredients?.length) {
        const resolved = (
          await this.__unsafe_resolveIngredientRef(validatedIngredients, trx)
        ).map((ref, idx) => ({
          quantity: validatedIngredients[idx].quantity,
          unit: validatedIngredients[idx].unit,
          notes: validatedIngredients[idx].notes ?? null,
          ...ref,
          recipeId: record.id,
        }))

        await trx.insertInto('RecipeIngredients').values(resolved).execute()
      }

      return this.__unsafe_fetch(validatedArgs.slug, trx)
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  update(slug: string, args: UpdateRecipe, trx?: Transaction<DB>) {
    const validatedArgs = parseWithSchema(
      recipeUpdateSchema,
      args,
      'Invalid recipe update'
    )

    const query = async (trx: Transaction<DB>) => {
      if (validatedArgs.slug && validatedArgs.slug !== slug)
        throw Object.assign(
          new Error(`Cannot change slug of recipe '${slug}'`),
          { code: 'ERR_BAD_REQUEST_400' }
        )

      const value = await trx
        .updateTable('Recipe')
        .set(validatedArgs)
        .where('slug', '=', slug)
        .executeTakeFirst()

      if (!value.numUpdatedRows)
        throw Object.assign(new Error('Failed to update recipe'), {
          code: 'ERR_INTERNAL_SERVER_ERROR_500',
        })

      return this.__unsafe_fetch(slug, trx)
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  async delete(slug: IDType, trx?: Transaction<DB>) {
    const query = async (trx: Transaction<DB>) => {
      const result = await trx
        .deleteFrom('Recipe')
        .where(typeof slug === 'string' ? 'slug' : 'id', '=', slug)
        .executeTakeFirst()

      const deleted = result.numDeletedRows > 0n

      if (deleted) {
        await this.invalidateCache()
      }

      return deleted
    }

    return trx ? query(trx) : this.database.transaction().execute(query)
  }

  async updatePricingHistory(
    recipeId: number,
    pricing: Omit<NewRecipePrice, 'recipeId' | 'pricingId'> & NewPricing,
    trx?: Transaction<DB>
  ): Promise<RecipePricing> {
    const validatedPricing = parseWithSchema(
      recipePricingInputSchema,
      pricing,
      'Invalid recipe pricing data'
    )

    const query = async (trx: Transaction<DB>): Promise<RecipePricing> => {
      const [cost, pricingData] = splitRecipePricingToTables(validatedPricing)

      const time = new Date()

      // Close current active record
      await trx
        .updateTable('RecipePrice')
        .set({
          validTo: this.context.type === 'postgres' ? time : time.toISOString(),
        })
        .where((eb) =>
          eb.and([eb('recipeId', '=', recipeId), eb('validTo', 'is', null)])
        )
        .executeTakeFirst()

      // Insert Pricing row
      const pricingRecord = await trx
        .insertInto('Pricing')
        .values({
          ...pricingData, // @ts-ignore Handle sqlite BigInt cast
          cost:
            this.context.type === 'postgres'
              ? pricingData.cost
              : BigInt(pricingData.cost),
        })
        .returning('id')
        .executeTakeFirstOrThrow()

      // Insert RecipePrice row
      await trx
        .insertInto('RecipePrice')
        .values({
          ...cost, // @ts-ignore Handle sqlite boolean/date casts
          vat: this.context.type === 'postgres' ? cost.vat : +cost.vat,
          validFrom:
            this.context.type === 'postgres' ? time : time.toISOString(),
          pricingId: pricingRecord.id,
          recipeId,
        })
        .execute()
      
      return this.__unsafe_fetchCurrentPricing(recipeId, trx)
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  handleIngredient(
    recipe: IDType,
    command: 'put',
    args: RecipeIngredientInput,
    trx?: Transaction<DB>
  ): Promise<RecipeIngredientReference>
  handleIngredient(
    recipe: IDType,
    command: 'delete',
    args: string,
    trx?: Transaction<DB>
  ): Promise<boolean>
  handleIngredient(
    recipe: IDType,
    command: 'put' | 'delete',
    args: RecipeIngredientInput | string,
    trx?: Transaction<DB>
  ): Promise<RecipeIngredientReference | boolean> {
    const validatedInput =
      command === 'put'
        ? parseWithSchema(
            recipeIngredientInputSchema,
            args,
            'Invalid recipe ingredient'
          )
        : undefined
    const validatedSlug =
      command === 'delete'
        ? parseWithSchema(
            recipeIngredientDeleteSchema,
            args,
            'Invalid ingredient reference'
          )
        : undefined

    const query = async (
      trx: Transaction<DB>
    ): Promise<RecipeIngredientReference | boolean> => {
      const recipeRecord = await trx
        .selectFrom('Recipe')
        .select('id')
        .where(typeof recipe === 'string' ? 'slug' : 'id', '=', recipe)
        .executeTakeFirstOrThrow(
          handleError({ [typeof recipe === 'string' ? 'slug' : 'id']: recipe })
        )

      if (command === 'delete') {
        const slug = validatedSlug as string

        // Try ingredient first, then sub-recipe
        const ingredient = await trx
          .selectFrom('Ingredient')
          .select('id')
          .where('slug', '=', slug)
          .executeTakeFirst()

        const subRecipe = ingredient
          ? undefined
          : await trx
              .selectFrom('Recipe')
              .select('id')
              .where('slug', '=', slug)
              .executeTakeFirst()

        if (!ingredient && !subRecipe) return false

        const result = await trx
          .deleteFrom('RecipeIngredients')
          .where((eb) =>
            eb.and([
              eb('recipeId', '=', recipeRecord.id),
              ingredient
                ? eb('ingredientId', '=', ingredient.id)
                : eb('subRecipeId', '=', subRecipe!.id),
            ])
          )
          .executeTakeFirst()

        return result.numDeletedRows > 0n
      }

      // put
      const input = validatedInput as RecipeIngredientInput
      const ref = await this.__unsafe_resolveIngredientRef(input, trx)

      // Upsert: delete existing then insert
      await trx
        .deleteFrom('RecipeIngredients')
        .where((eb) =>
          eb.and([
            eb('recipeId', '=', recipeRecord.id),
            ref.ingredientId
              ? eb('ingredientId', '=', ref.ingredientId)
              : eb('subRecipeId', '=', ref.subRecipeId!),
          ])
        )
        .executeTakeFirst()

      await trx
        .insertInto('RecipeIngredients')
        .values({
          recipeId: recipeRecord.id,
          quantity: input.quantity,
          unit: input.unit,
          notes: input.notes ?? null,
          ...ref,
        })
        .execute()

      // Fetch and return the inserted reference
      const ingredients = await this.__unsafe_fetchIngredients(
        recipeRecord.id,
        trx
      )
      const match = ingredients.find((i) =>
        ref.ingredientId
          ? i.ingredientId === ref.ingredientId
          : i.subRecipeId === ref.subRecipeId
      )

      if (!match)
        throw Object.assign(new Error('Failed to insert recipe ingredient'), {
          code: 'ERR_INTERNAL_SERVER_ERROR_500',
        })

      return match
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  async __unsafe_fetchCurrentPricing(
    recipeId: number,
    trx?: Transaction<DB>
  ): Promise<RecipePricing> {
    return (trx ?? this.database)
      .selectFrom('RecipePrice')
      .innerJoin('Pricing', 'RecipePrice.pricingId', 'Pricing.id')
      .select([
        'RecipePrice.id',
        'RecipePrice.vat',
        'RecipePrice.validFrom',
        'RecipePrice.validTo',
        'Pricing.cost',
        'Pricing.currency',
      ])
      .where((eb) =>
        eb.and([
          eb('RecipePrice.recipeId', '=', recipeId),
          eb('RecipePrice.validTo', 'is', null),
        ])
      )
      .executeTakeFirstOrThrow(handleError({ recipeId }))
  }

  private async __unsafe_resolveIngredientRef(
    input: RecipeIngredientInput,
    trx: Transaction<DB>
  ): Promise<NewRecipeIngredientInputRef>
  private async __unsafe_resolveIngredientRef(
    input: RecipeIngredientInput[],
    trx: Transaction<DB>
  ): Promise<NewRecipeIngredientInputRef[]>
  private async __unsafe_resolveIngredientRef(
    input: RecipeIngredientInput | RecipeIngredientInput[],
    trx: Transaction<DB>
  ): Promise<NewRecipeIngredientInputRef[] | NewRecipeIngredientInputRef> {
    if (Array.isArray(input)) {
      return Promise.all(
        input.map((i) => this.__unsafe_resolveIngredientRef(i, trx))
      )
    }

    if ('slug' in input) {
      const table = input.type === 'ingredient' ? 'Ingredient' : 'Recipe'
      const record = await trx
        .selectFrom(table)
        .select('id')
        .where('slug', '=', input.slug)
        .executeTakeFirstOrThrow(handleError({ slug: input.slug }))

      return input.type === 'ingredient'
        ? { ingredientId: record.id, subRecipeId: null }
        : { ingredientId: null, subRecipeId: record.id }
    }
    return {
      ingredientId: input.ingredientId ?? null,
      subRecipeId: input.subRecipeId ?? null,
    }
  }

  async __unsafe_fetch(
    id: IDType,
    trx?: Transaction<DB>
  ): Promise<RecipeWithPricing> {
    const base = trx ?? this.database
    const jsonObjectFrom = this.context.helpers.jsonObjectFrom

    return base
      .selectFrom('Recipe')
      .selectAll('Recipe')
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom('RecipePrice')
            .innerJoin('Pricing', 'RecipePrice.pricingId', 'Pricing.id')
            .select([
              'RecipePrice.id',
              'RecipePrice.vat',
              'RecipePrice.validTo',
              'RecipePrice.validFrom',
              'Pricing.cost',
              'Pricing.currency',
            ])
            .where('RecipePrice.validTo', 'is', null)
            .whereRef('RecipePrice.recipeId', '=', 'Recipe.id')
        )
          .$castTo<RecipePricing | null>()
          .as('cost'),
      ])
      .where(typeof id === 'string' ? 'slug' : 'id', '=', id)
      .executeTakeFirstOrThrow(
        handleError({ [typeof id === 'string' ? 'slug' : 'id']: id })
      )
  }

  async __unsafe_fetchIngredients(
    recipeId: number,
    trx?: Transaction<DB>
  ): Promise<RecipeIngredientReference[]> {
    const base = trx ?? this.database

    return base
      .selectFrom('RecipeIngredients')
      .leftJoin('Ingredient', 'RecipeIngredients.ingredientId', 'Ingredient.id')
      .leftJoin(
        'Recipe as SubRecipe',
        'RecipeIngredients.subRecipeId',
        'SubRecipe.id'
      )
      .select((eb) => [
        'RecipeIngredients.id',
        'RecipeIngredients.ingredientId',
        'RecipeIngredients.subRecipeId',
        'RecipeIngredients.recipeId',
        'RecipeIngredients.quantity',
        'RecipeIngredients.unit',
        'RecipeIngredients.notes',
        /* Coalesce to get slug from either Ingredient or SubRecipe */
        eb
          .fn<string>('coalesce', [
            eb.ref('Ingredient.slug'),
            eb.ref('SubRecipe.slug'),
          ])
          .as('slug'),
        eb
          .fn<string>('coalesce', [
            eb.ref('Ingredient.name'),
            eb.ref('SubRecipe.name'),
          ])
          .as('name'),
        /* Type discriminator: if ingredientId is not null, it's an ingredient */
        eb
          .case()
          .when('RecipeIngredients.ingredientId', 'is not', null)
          .then(eb.val<'ingredient' | 'recipe'>('ingredient'))
          .else(eb.val<'ingredient' | 'recipe'>('recipe'))
          .end()
          .as('type'),
      ])
      .where('RecipeIngredients.recipeId', '=', recipeId)
      .execute()
  }

  async __unsafe_fetchHistoricalPrices(
    recipeId: number,
    trx?: Transaction<DB>
  ): Promise<RecipePricing[]> {
    const base = trx ?? this.database

    return base
      .selectFrom('RecipePrice')
      .innerJoin('Pricing', 'RecipePrice.pricingId', 'Pricing.id')
      .select([
        'RecipePrice.id',
        'RecipePrice.vat',
        'RecipePrice.validFrom',
        'RecipePrice.validTo',
        'Pricing.cost',
        'Pricing.currency',
      ])
      .where((eb) =>
        eb.and([
          eb('RecipePrice.recipeId', '=', recipeId),
          eb('RecipePrice.validTo', 'is not', null),
        ])
      )
      .orderBy('RecipePrice.validFrom', 'desc')
      .execute()
  }

  async __unsafe_fetchChildren(
    recipeId: number,
    trx?: Transaction<DB>
  ): Promise<RecipeWithPricing[]> {
    const base = trx ?? this.database
    const jsonObjectFrom = this.context.helpers.jsonObjectFrom

    return base
      .selectFrom('Recipe')
      .selectAll('Recipe')
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom('RecipePrice')
            .innerJoin('Pricing', 'RecipePrice.pricingId', 'Pricing.id')
            .select([
              'RecipePrice.id',
              'RecipePrice.vat',
              'RecipePrice.validTo',
              'RecipePrice.validFrom',
              'Pricing.cost',
              'Pricing.currency',
            ])
            .where('RecipePrice.validTo', 'is', null)
            .whereRef('RecipePrice.recipeId', '=', 'Recipe.id')
        )
          .$castTo<RecipePricing | null>()
          .as('cost'),
      ])
      .where('Recipe.parentId', '=', recipeId)
      .execute()
  }
}

function splitRecipePricingToTables(
  data: Omit<NewRecipePrice, 'recipeId' | 'pricingId'> & NewPricing
): [Omit<NewRecipePrice, 'recipeId' | 'pricingId'>, NewPricing] {
  const { cost, currency, ...rest } = data
  return [rest, { cost, currency }]
}

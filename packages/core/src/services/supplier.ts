import log from '@harrytwright/logger'
import {
  DatabaseContext,
  DB,
  NewSupplier,
  NewSupplierContact,
  Supplier,
  SupplierContact,
  UpdateSupplier,
  UpdateSupplierContact,
} from '@menubook/shared'
import { Transaction, UpdateResult } from 'kysely'

import { handleError } from '../datastore/handleError'
import { hasChanges } from '../utils'
import { parseWithSchema } from '../validation'
import { supplierCreateSchema, supplierUpdateSchema } from '../validation/zod'

type IDType = string | number

// Excessive, but for future versions might be needed
export type FindOptions = {
  allowJoins: boolean
  includeGeneric: boolean
}

export type SupplierWithContact = Supplier & { contact: SupplierContact | null }

export type NewSupplierWithContact = NewSupplier & {
  contact?: Omit<NewSupplierContact, 'supplierId'>
}
export type UpdateSupplierWithContact = UpdateSupplier & {
  contact?: Omit<UpdateSupplierContact, 'supplierId'>
}

export class SupplierService {
  constructor(private readonly context: DatabaseContext) {}

  get database() {
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

  find(
    options?: Partial<FindOptions>,
    trx?: Transaction<DB>
  ): Promise<(Supplier & { contact?: SupplierContact | null | undefined })[]> {
    const base = (trx ?? this.database).selectFrom('Supplier')
    const jsonObjectFrom = this.context.helpers.jsonObjectFrom

    const opts: FindOptions = Object.assign(
      { allowJoins: true, includeGeneric: false },
      options
    )

    return base
      .selectAll('Supplier')
      .$if(!opts.includeGeneric, (eb) => eb.where('slug', '!=', 'generic'))
      .$if(opts.allowJoins, (eb) =>
        eb.select((eb) =>
          jsonObjectFrom(
            eb
              .selectFrom('SupplierContact')
              .select([
                'SupplierContact.id',
                'SupplierContact.name',
                'SupplierContact.email',
                'SupplierContact.phone',
                'SupplierContact.supplierId',
              ])
              .whereRef('SupplierContact.supplierId', '=', 'Supplier.id')
          ).as('contact')
        )
      )
      .execute()
  }

  findById(id: IDType, trx?: Transaction<DB>): Promise<SupplierWithContact> {
    const base = (trx ?? this.database).selectFrom('Supplier')
    const jsonObjectFrom = this.context.helpers.jsonObjectFrom

    return base
      .selectAll('Supplier')
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('SupplierContact')
            .select([
              'SupplierContact.id',
              'SupplierContact.name',
              'SupplierContact.email',
              'SupplierContact.phone',
              'SupplierContact.supplierId',
            ])
            .whereRef('SupplierContact.supplierId', '=', 'Supplier.id')
        ).as('contact')
      )
      .where(typeof id === 'string' ? 'slug' : 'id', '=', id)
      .executeTakeFirstOrThrow(
        handleError({ [typeof id === 'string' ? 'slug' : 'id']: id })
      )
  }

  create(
    args: NewSupplierWithContact,
    trx?: Transaction<DB>
  ): Promise<SupplierWithContact> {
    const validatedArgs = parseWithSchema(
      supplierCreateSchema,
      args,
      'Invalid supplier data'
    )

    const query = async (trx: Transaction<DB>) => {
      const exists = await this.exists(validatedArgs.slug, trx)

      if (exists)
        throw Object.assign(
          new Error(
            `Supplier with slug '${validatedArgs.slug}' already exists`
          ),
          { code: 'ERR_CONFLICT_409' }
        )

      const [supplier, contact] = splitSupplierToTables(validatedArgs)

      let value = await trx
        .insertInto('Supplier')
        .values(supplier)
        .executeTakeFirst()

      if (!value.insertId)
        throw Object.assign(new Error('Failed to create supplier'), {
          code: 'ERR_INTERNAL_SERVER_ERROR_500',
        })

      if (contact) {
        value = await trx
          .insertInto('SupplierContact')
          .values({
            ...contact,
            supplierId: Number(value.insertId),
          })
          .executeTakeFirst()

        if (!value.insertId)
          throw Object.assign(
            new Error('Failed to handle suppliers contact details'),
            { code: 'ERR_INTERNAL_SERVER_ERROR_500' }
          )
      }

      return this.findById(validatedArgs.slug, trx)
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  update(id: IDType, args: UpdateSupplierWithContact, trx?: Transaction<DB>) {
    const validatedArgs = parseWithSchema(
      supplierUpdateSchema,
      args,
      'Invalid supplier update'
    )

    const query = async (trx: Transaction<DB>) => {
      const prev = await this.findById(id, trx)

      const [supplier, contact] = splitSupplierToTables(validatedArgs)

      // Only the contact details can be updated via this function
      if (
        this.isInCLIMode &&
        hasChanges(prev, supplier, {
          slug: 'slug',
          notes: 'notes',
          name: 'name',
        })
      ) {
        throw new Error(
          `CLI cannot make changes to supplier '${prev.slug}' without deleting and recreating.`
        )
      }

      // Slug cannot be changed. Immutable after creation, would break the CLI if done, will
      // keep this the same for the UI tool
      if (supplier.slug && hasChanges(prev, supplier, { slug: 'slug' }))
        throw Object.assign(
          new Error(`Cannot change slug of supplier '${prev.slug}'`),
          { code: 'ERR_BAD_REQUEST_400' }
        )

      let value: UpdateResult

      // Only run this if the supplier has any keys
      if (supplier && Object.keys(supplier).length > 0) {
        value = await trx
          .updateTable('Supplier')
          .set(supplier)
          .where(typeof id === 'string' ? 'slug' : 'id', '=', id)
          .executeTakeFirst()

        if (Number(value.numUpdatedRows) > 0)
          log.verbose(
            'services:supplier',
            {
              [typeof id === 'string' ? 'slug' : 'id']: id,
              changes: [supplier],
            },
            'Updated supplier %s',
            id
          )
      }

      if (contact && Object.keys(contact).length > 0 && !prev.contact) {
        // Contact is new, need to insert
        const inserted = await trx
          .insertInto('SupplierContact')
          .values({ ...contact, supplierId: prev.id })
          .executeTakeFirst()

        if (!inserted.insertId)
          throw Object.assign(
            new Error('Failed to handle suppliers contact details'),
            { code: 'ERR_INTERNAL_SERVER_ERROR_500' }
          )
      } else if (
        contact &&
        hasChanges(prev.contact, contact, {
          name: 'name',
          email: 'email',
          phone: 'phone',
        })
      ) {
        // Contact is updated, need to update
        value = await trx
          .updateTable('SupplierContact')
          .set(contact)
          .where('supplierId', '=', prev.id)
          .executeTakeFirst()

        if (Number(value.numUpdatedRows) > 0)
          log.verbose(
            'services:supplier',
            {
              [typeof id === 'string' ? 'slug' : 'id']: id,
              changes: [contact],
            },
            "Updated %s's contact details",
            id
          )
      }

      // Clear out, have what we need
      return this.findById(id, trx)
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  async exists(slug: IDType, trx?: Transaction<DB>) {
    return !!(await (trx ?? this.database)
      .selectFrom('Supplier')
      .select('id')
      .where(typeof slug === 'string' ? 'slug' : 'id', '=', slug)
      .executeTakeFirst())
  }

  async delete(slug: string, trx?: Transaction<DB>) {
    const result = await (trx ?? this.database)
      .deleteFrom('Supplier')
      .where('slug', '=', slug)
      .executeTakeFirst()

    return result.numDeletedRows > 0n
  }

  async upsert(
    slug: string,
    data: NewSupplierWithContact,
    trx?: Transaction<DB>
  ) {
    const validatedData = parseWithSchema(
      supplierCreateSchema,
      { ...data, slug },
      'Invalid supplier data'
    )

    const base = trx ?? this.database

    const [supplier, contact] = splitSupplierToTables(validatedData)

    let value = await base
      .insertInto('Supplier')
      .values({
        ...supplier,
        slug: slug,
      })
      .returning('id as id')
      .onConflict((oc) => oc.column('slug').doUpdateSet(supplier))
      .executeTakeFirst()

    if (value === undefined) return false

    if (contact && Object.keys(contact).length > 0) {
      await base
        .insertInto('SupplierContact')
        .values({ ...contact, supplierId: value.id })
        .onConflict((oc) => oc.column('supplierId').doUpdateSet(contact))
        .executeTakeFirst()
    }

    return true
  }

  // async processor(
  //   importer: Importer,
  //   data: SupplierResolvedImportData,
  //   filePath: string | undefined,
  //   trx?: Transaction<DB>
  // ): Promise<ImportOutcome> {
  //   const query = async (trx: Transaction<DB>) => {
  //     // Workaround for the throwing on findById
  //     let prev: Selectable<Supplier> | undefined = undefined
  //     try {
  //       // Load up the previous data if it exists
  //       prev = await this.findById(data.slug, trx)
  //     } catch (e) {
  //       if (!(e instanceof NotFound)) throw e
  //     }
  //
  //     // Check if any mutable fields have changed
  //     const hasChanged = hasChanges(prev, data, {
  //       name: 'name',
  //     })
  //
  //     if (prev && !hasChanged) return 'ignored'
  //
  //     const res = await this.upsert(data, trx)
  //     if (res.insertId === undefined)
  //       throw new Error('Failed to upsert supplier')
  //
  //     return prev ? 'upserted' : 'created'
  //   }
  //
  //   return trx ? query(trx) : this.database.transaction().execute(query)
  // }
}

function splitSupplierToTables(
  data: NewSupplierWithContact
): [NewSupplier, Omit<NewSupplierContact, 'supplierId'> | undefined]
function splitSupplierToTables(
  data: UpdateSupplierWithContact
): [UpdateSupplier, Omit<UpdateSupplierContact, 'supplierId'> | undefined]
function splitSupplierToTables(
  data: NewSupplierWithContact | UpdateSupplierWithContact
): [
  NewSupplier | UpdateSupplier,
  (
    | Omit<NewSupplierContact, 'supplierId'>
    | Omit<UpdateSupplierContact, 'supplierId'>
    | undefined
  ),
] {
  if (!data.contact) return [data, undefined]

  const contact = data.contact
  delete data.contact

  return [data, contact]
}

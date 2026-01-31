// This is the top level of the mapper, this allows me to have weird joins and still keep
// it the same
import { Insertable, Selectable, Updateable } from 'kysely'

export class Base<
  E extends Record<any, any>,
  J extends Record<any, any>,
  Z extends Record<any, any>,
> {
  // Convert the entity to the JSON
  mapEntityToJSON(entity: Partial<Selectable<E>>): J {
    throw new Error('Must be implemented')
  }

  mapJSONToEntity(json: Z): Insertable<E> | Updateable<E> {
    return json
  }
}

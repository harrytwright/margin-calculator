import { DB } from '@menubook/prisma'
import { Transaction } from 'kysely'

export type TransactionOr<T, D = DB> = Transaction<D> | T

export type IDType = number | string

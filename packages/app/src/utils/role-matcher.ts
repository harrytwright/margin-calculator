// works like <resource>:<action>(:<attribute>)
import assert from 'assert'

export function matcher(
  routePermissions: string | string[],
  userPermissions: string[],
  mustMatch: boolean = false
): boolean {
  if (Array.isArray(routePermissions)) {
    return mustMatch
      ? must(routePermissions, userPermissions)
      : should(routePermissions, userPermissions)
  }

  const parts = routePermissions.split(':')
  assert(
    parts.length >= 2,
    'Must have format `<resource>:<action>(:<attribute>)`'
  )

  for (const userPermission of <RegExp[]>(
    userPermissions.map(require('glob-to-regexp'))
  )) {
    if (userPermission.test(routePermissions)) return true
  }

  return false
}

/**
 * This is where we have a request that a user must have all the permissions to access
 * */
const must = (routePermissions: string[], userPermissions: string[]) => {
  let fullPermissions = false
  for (const routePermission of routePermissions) {
    fullPermissions = matcher(routePermission, userPermissions)
  }
  return fullPermissions
}

const should = (routePermissions: string[], userPermissions: string[]) => {
  for (const routePermission of routePermissions) {
    if (matcher(routePermission, userPermissions)) return true
  }
  return false
}

// Cache adapter interface and registry
export {
  getCache,
  getDefaultCache,
  getRegisteredCaches,
  hasCache,
  registerCache,
} from './adapter'
export type { CacheAdapter } from './adapter'

// Cache implementations
export { TTLCache } from './memory'
export { NoopCache } from './noop'

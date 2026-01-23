import logger from '@harrytwright/logger'

enum KEYS {
  start = 'start',
  end = 'end',
}

class Timers {
  log: typeof logger

  #unfinished: Map<string, number> = new Map()
  #finished: Record<string, number> = {}

  constructor(log: typeof logger = logger) {
    this.log = log
  }

  get unfinished() {
    return this.#unfinished
  }

  get finished() {
    return this.#finished
  }

  timeHandler = (level: KEYS, name: string) => {
    const now = Date.now()
    switch (level) {
      case KEYS.start:
        this.#unfinished.set(name, now)
        break
      case KEYS.end: {
        if (this.#unfinished.has(name)) {
          const ms = now - this.#unfinished.get(name)!
          this.#finished[name] = ms
          this.#unfinished.delete(name)
          this.log.timing(name, { took: ms }, `Completed in ${ms}ms`)
        } else {
          this.log.silly(
            'timing',
            "Tried to end timer that doesn't exist:",
            name
          )
        }
      }
    }
  }
}

const timer: Timers = new Timers()

export async function time<T>(
  name: string,
  fn: () => Promise<T>,
  log: typeof logger = logger
): Promise<T> {
  timer.timeHandler.call(Object.assign(timer, { log: log }), KEYS.start, name)

  function end() {
    timer.timeHandler.call(Object.assign(timer, { log: log }), KEYS.end, name)
  }

  try {
    const result = await fn()
    end()
    return result
  } catch (err) {
    end()
    return Promise.reject(err)
  }
}

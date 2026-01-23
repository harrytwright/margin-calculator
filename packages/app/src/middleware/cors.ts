import { registerMiddleware } from '@harrytwright/api/dist/core'

export const cors = registerMiddleware('cors', function () {
  const cors = require('cors')

  let origins: string | string[] =
    this.config.get('cors') || /* istanbul ignore next */ '*'
  if (!Array.isArray(origins)) {
    origins = [...origins.split(',')]
  }

  return cors({
    origin: origins,
    methods: 'HEAD,GET,POST,PATCH,DELETE,PUT',
    credentials: true,
  })
})

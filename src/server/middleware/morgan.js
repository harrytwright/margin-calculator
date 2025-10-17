/**
 * This is a stripped version of morgan.
 *
 * Since morgan does so much but I only need certain
 * things, easier to just rewrite and plug them
 *
 * @see https://github.com/expressjs/morgan
 * */

/**
 * @callback ExpressHandler
 *
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} [next]
 *
 * @returns void
 * */

/**
 * @typedef {Object} RequestContext
 *
 * @property {string} url
 * @property {string} method
 * @property {string | undefined} response-time
 * @property {string | undefined} status
 * @property {any} query
 * @property {any} params
 * @property {string} referrer
 * @property {string | undefined} remote-addr
 * @property {string} userAgent
 * @property {string | undefined} path
 * @property {string} mountpath
 * */

/**
 * This callback is displayed as part of the Requester class.
 * @callback RequestContextCallback
 * @param {RequestContext} ctx
 * @param {Express.Request} req
 * @param {Express.Response} res
 */

const URL = require('url')

const onFinished = require('on-finished')
const onHeaders = require('on-headers')

const SKIP_URLS = ['/health/readiness', '/metrics']

// Skip readiness calls
function skip(req, _) {
  return SKIP_URLS.includes(req.originalUrl || req.url)
}

/**
 * Take logging object and build an express middleware
 *
 * @param {Object} logger
 * @param {Function} logger.http
 * @param {RequestContextCallback} [onLog]
 *
 * @return {ExpressHandler}
 * */
const morgan = (logger, onLog) => (req, res, next) => {
  // request data
  req._startAt = undefined
  req._startTime = undefined
  req._remoteAddress = getip(req)

  // response data
  res._startAt = undefined
  res._startTime = undefined

  // record request start
  recordStartTime.call(req)

  function logRequest() {
    if (skip(req, res)) return

    const ctx = context(req, res)
    ctx.trace = req.id

    onLog && onLog(ctx, req, res)

    // Named after its original home
    logger.http(
      'morgan',
      ctx,
      '%s %s %d - %fms',
      ctx.method,
      ctx.url,
      ctx.status,
      ctx['response-time']
    )
  }

  // record response start
  onHeaders(res, recordStartTime)

  // log when response finished
  onFinished(res, logRequest)

  next()
}

/**
 * Anything needed to be logged should be here
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @returns {RequestContext}
 */
function context(req, res) {
  let url = req.originalUrl || req.url
  let path = req.route?.path || req.baseUrl || req.path || url
  const method = req.method

  const responseTime = (digits) => {
    if (!req._startAt || !res._startAt) {
      // missing request and/or response start time
      return
    }

    // calculate diff
    const ms =
      (res._startAt[0] - req._startAt[0]) * 1e3 +
      (res._startAt[1] - req._startAt[1]) * 1e-6

    // return truncated value
    return ms.toFixed(digits === undefined ? 3 : digits)
  }

  const status = headersSent(res) ? String(res.statusCode) : undefined

  const referrer = req.headers.referer || req.headers.referrer

  const remoteAddr = getip(req)

  const ua = req.headers['user-agent']

  let query
  if (req.query && Object.keys(req.query).length > 0) {
    query = req.query
    /* eslint-disable-next-line */
    url = URL.parse(url).pathname
  }

  let params
  if (req.params && Object.keys(req.params).length > 0) {
    params = req.params
  }

  return {
    url,
    method,
    'response-time': responseTime(3),
    status,
    query,
    params,
    referrer,
    'remote-addr': remoteAddr,
    userAgent: ua,
    path,
    // Build out own mouthpath, since we cannot get it properly
    mountpath: `${req.__unsafe_basepath || ''}${path}`.replace(/\/$/, ''),
  }
}

/**
 * Get request IP address.
 *
 * @private
 * @param {IncomingMessage} req
 * @return {string}
 */
function getip(req) {
  /* istanbul ignore next: not sure how to test this, when I do will fix */
  return (
    req.ip ||
    req._remoteAddress ||
    (req.connection && req.connection.remoteAddress) ||
    undefined
  )
}

/**
 * Determine if the response headers have been sent.
 *
 * @param {object} res
 * @returns {boolean}
 * @private
 */
function headersSent(res) {
  // istanbul ignore next: node.js 0.8 support
  return typeof res.headersSent !== 'boolean'
    ? Boolean(res._header)
    : res.headersSent
}

/**
 * Record the start time.
 * @private
 */
function recordStartTime() {
  this._startAt = process.hrtime()
  this._startTime = new Date()
}

module.exports = { morgan }

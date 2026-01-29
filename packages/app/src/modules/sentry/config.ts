export interface BaseSentryConfig extends Record<string, any> {
  // The sentry DSN, this way any application can set this as they wish
  'sentry-dsn': [null, StringConstructor]
  'sentry-sample-rate': NumberConstructor
}

export const types: BaseSentryConfig = {
  'sentry-dsn': [null, String],
  'sentry-sample-rate': Number,
}

export const defaults = {
  'sentry-sample-rate': 1,
}

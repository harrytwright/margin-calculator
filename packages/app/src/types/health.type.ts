export type HealthIndicator =
  | { error: Error; key: string }
  | { status: 'healthy'; key: string; details?: string }

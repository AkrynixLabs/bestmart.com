/** Minutes to wait before attempt n+1 of an outbox email: 1, 5, 25, 125, ... */
export function retryDelayMinutes(attempts: number): number {
  return 5 ** Math.max(0, attempts - 1)
}

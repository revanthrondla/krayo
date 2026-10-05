/**
 * Converts an unknown error into a message that is safe to show a user.
 *
 * Errors raised by the database or a backend call can contain schema names,
 * constraint names and policy details, so they are logged for developers and
 * replaced with a friendly message in the interface. Errors the app raises
 * itself (plain `Error` instances with no backend metadata) are passed through
 * because they are written for users.
 */
export function friendlyMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof console !== 'undefined') console.error(err);

  if (err && typeof err === 'object') {
    const candidate = err as { code?: unknown; details?: unknown; hint?: unknown; status?: unknown; message?: unknown };
    const looksBackend =
      candidate.code !== undefined ||
      candidate.details !== undefined ||
      candidate.hint !== undefined ||
      candidate.status !== undefined;
    if (looksBackend) return fallback;
    if (typeof candidate.message === 'string' && candidate.message.trim() && err instanceof Error) {
      return candidate.message;
    }
  }

  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

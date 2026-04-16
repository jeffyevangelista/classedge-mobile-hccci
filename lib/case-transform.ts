/**
 * Recursively converts all object keys from snake_case to camelCase.
 * Leaves primitives, arrays of primitives, Dates, and null/undefined untouched.
 */
export function snakeToCamel<T = unknown>(data: unknown): T {
  if (data === null || data === undefined) return data as T;
  if (typeof data !== "object") return data as T;
  if (data instanceof Date) return data as T;

  if (Array.isArray(data)) {
    return data.map((item) => snakeToCamel(item)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    result[camelKey] = snakeToCamel(value);
  }
  return result as T;
}

/**
 * Jest-only stand-in for @nestjs/config. The published package is ESM-only,
 * which jest's require-based transform cannot load; unit tests compile the
 * real code paths against this stub via jest moduleNameMapper.
 */
export class ConfigService<T = Record<string, string | number | undefined>> {
  constructor(private readonly store: T = Object.create(null)) {}

  get<K extends keyof T>(key: K, fallback?: T[K]): T[K] | undefined {
    const value = this.store[key];
    return value !== undefined ? value : fallback;
  }
}

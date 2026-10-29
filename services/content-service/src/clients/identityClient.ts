import { z } from 'zod';
import { AppError } from '../utils/errors';
const consentSchema = z.object({
  companionMemory: z.boolean(),
});
const resourceSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  region: z.string(),
  phone: z.string().nullable().optional(),
});
export type Resource = z.infer<typeof resourceSchema>;
export interface IdentityClient {
  reportDetail?(token: string, id: string): Promise<{ contentId: string | null; circleId: string }>;
  memberReport?(token: string, input: { targetId: string; circleId: string; contentId: string; reason: string }): Promise<{ id: string }>;
  consent(
    userId: string,
    fresh?: boolean,
  ): Promise<{ companionMemoryOptIn?: boolean }>;
  restrictions(
    circle: string,
    user: string,
  ): Promise<{ member: boolean; muted: boolean; banned: boolean }>;
  membership(circle: string, user: string): Promise<unknown>;
  resources(region: string): Promise<Resource[]>;
  invalidate(user: string): void;
  aliases?(userIds: string[]): Promise<Record<string, string>>;
  report?(input: {
    targetId: string;
    circleId: string;
    contentId: string;
    reason: 'HARASSMENT' | 'SPAM' | 'UNSAFE';
    source: 'AI';
  }): Promise<void>;
  exportData?(userId: string): Promise<unknown>;
}
export class HttpIdentityClient implements IdentityClient {
  async reportDetail(token: string, id: string) {
    const response = await this.fetcher(new URL('/reports/' + encodeURIComponent(id), this.base), {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new AppError(response.status >= 500 ? 503 : response.status, 'REPORT_ACCESS_DENIED', 'Report unavailable');
    return z.object({ contentId: z.string().nullable(), circleId: z.string() }).parse(await response.json());
  }
  async memberReport(token: string, input: { targetId: string; circleId: string; contentId: string; reason: string }): Promise<{ id: string }> {
    const response = await this.fetcher(new URL('/reports', this.base), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new AppError(response.status >= 500 ? 503 : response.status, 'REPORT_FAILED', 'Report could not be submitted');
    return z.object({ id: z.string().uuid() }).parse(await response.json());
  }
  private cache = new Map<string, { expires: number; value: unknown }>();
  private generation = 0;
  constructor(
    private base: string,
    private key: string,
    private fetcher: typeof fetch = fetch,
  ) {}
  invalidate(user: string) {
    this.generation++;
    for (const k of this.cache.keys())
      if (k.includes(encodeURIComponent(user))) this.cache.delete(k);
  }
  private async get(
    path: string,
    cached = false,
    fresh = false,
  ): Promise<unknown> {
    const hit = this.cache.get(path);
    if (cached && !fresh && hit && hit.expires > Date.now()) return hit.value;
    const generation = this.generation;
    const response = await this.fetcher(new URL(path, this.base), {
      headers: { 'X-Internal-Key': this.key },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok)
      throw new AppError(
        503,
        'IDENTITY_UNAVAILABLE',
        'Identity service unavailable',
      );
    const value: unknown = await response.json();
    if (cached && generation !== this.generation)
      return this.get(path, cached, true);
    if (cached) {
      if (this.cache.size >= 10000)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(path, { value, expires: Date.now() + 60000 });
    }
    return value;
  }
  async consent(
    user: string,
    fresh = false,
  ): Promise<{ companionMemoryOptIn: boolean }> {
    const path = '/internal/users/' + encodeURIComponent(user) + '/consent';
    const value = consentSchema.parse(await this.get(path, true, fresh));
    return {
      companionMemoryOptIn: value.companionMemory,
    };
  }
  async restrictions(circle: string, user: string) {
    return z
      .object({ member: z.boolean(), muted: z.boolean(), banned: z.boolean() })
      .parse(
        await this.get(
          '/internal/circles/' +
            encodeURIComponent(circle) +
            '/users/' +
            encodeURIComponent(user) +
            '/restrictions',
          true,
          true,
        ),
      );
  }
  async membership(circle: string, user: string) {
    return this.get(
      '/internal/circles/' +
        encodeURIComponent(circle) +
        '/users/' +
        encodeURIComponent(user) +
        '/membership',
      true,
      true,
    );
  }
  async resources(_region: string): Promise<Resource[]> {
    return [{ name: 'Find A Helpline', region: 'GLOBAL', url: 'https://findahelpline.com/' }];
  }
  private async post(path: string, body: unknown) {
    const response = await this.fetcher(new URL(path, this.base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': this.key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok)
      throw new AppError(
        503,
        'IDENTITY_UNAVAILABLE',
        'Identity service unavailable',
      );
    return response.json();
  }
  async aliases(userIds: string[]) {
    return z
      .record(z.string())
      .parse(await this.post('/internal/aliases', { userIds }));
  }
  async report(input: {
    targetId: string;
    circleId: string;
    contentId: string;
    reason: 'HARASSMENT' | 'SPAM' | 'UNSAFE';
    source: 'AI';
  }) {
    await this.post('/internal/reports', input);
  }
  async exportData(userId: string) {
    return this.get(
      '/internal/users/' + encodeURIComponent(userId) + '/export-data',
    );
  }
}

import { z } from 'zod';
export const crisisResultSchema = z.object({
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});
export interface AiClient {
  crisisCheck(
    text: string,
    token: string,
  ): Promise<z.infer<typeof crisisResultSchema>>;
  companionChat(input: unknown, token: string): Promise<unknown>;
  moderate(input: unknown, token: string): Promise<unknown>;
}
export class HttpAiClient implements AiClient {
  constructor(
    private base: string,
    private key: string,
    private fetcher: typeof fetch = fetch,
  ) {}
  private async post(
    path: string,
    input: unknown,
    token: string,
    timeout = 65000,
  ) {
    const response = await this.fetcher(new URL(path, this.base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': this.key,
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) throw new Error('AI unavailable');
    return response.json();
  }
  async crisisCheck(text: string, token: string) {
    return crisisResultSchema.parse(
      await this.post('/safety/crisis-check', { text }, token, 8000),
    );
  }
  companionChat(input: unknown, token: string) {
    return this.post('/companion/chat', input, token);
  }
  moderate(input: unknown, token: string) {
    return this.post('/moderate', input, token);
  }
}

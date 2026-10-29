import { AiClient, crisisResultSchema } from '../../clients/aiClient';
import { IdentityClient } from '../../clients/identityClient';
import { CrisisEvent } from './safety.model';
import { buildCrisisResponse } from './safety.controller';
import { withUserTransaction } from '../../utils/userTransaction';
export class CrisisService {
  constructor(
    private ai: AiClient,
    private identity: IdentityClient,
  ) {}
  async check(
    userId: string,
    text: string,
    token: string,
    region: string,
    source: 'journal' | 'companion' = 'journal',
  ) {
    let detected: boolean;
    try {
      const result = crisisResultSchema.parse(
        await this.ai.crisisCheck(text, token),
      );
      detected = result.riskLevel !== 'LOW';
    } catch {
      detected =
        /suicid|kill\s+myself|end\s+my\s+life|hurt\s+myself|self[ -]?harm|want\s+to\s+die|overdose/i.test(
          text.normalize('NFKC'),
        );
    }
    await withUserTransaction(userId, async (session) => {
      await CrisisEvent.create([{ userId, source, crisisDetected: detected }], {
        session,
      });
    });
    if (!detected) return null;
    return buildCrisisResponse(
      await this.identity.resources(region).catch(() => []),
    );
  }
}

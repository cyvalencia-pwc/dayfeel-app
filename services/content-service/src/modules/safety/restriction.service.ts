import { IdentityClient } from '../../clients/identityClient';
import { AppError } from '../../utils/errors';
export class RestrictionService {
  constructor(private identity: IdentityClient) {}
  async requirePosting(circle: string, user: string) {
    const r = await this.identity.restrictions(circle, user);
    if (!r.member || r.muted || r.banned)
      throw new AppError(403, 'RESTRICTED', 'Access denied');
  }
}

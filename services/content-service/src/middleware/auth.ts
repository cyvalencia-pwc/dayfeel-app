import { createRemoteJWKSet, jwtVerify } from 'jose';
import { RequestHandler } from 'express';
import { Config } from '../config/env';
import { AppError } from '../utils/errors';
export function jwtAuth(
  config: Pick<Config, 'JWKS_URL' | 'JWT_ISSUER' | 'JWT_AUDIENCE'>,
): RequestHandler {
  const verify = tokenVerifier(config);
  return async (req, _res, next) => {
    try {
      const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
      if (!match) throw new Error();
      const payload = await verify(match[1]);
      req.auth = {
        userId: payload.sub!,
        roles: Array.isArray(payload.roles)
          ? payload.roles.filter((r): r is string => typeof r === 'string')
          : [],
        token: match[1],
      };
      next();
    } catch {
      next(new AppError(401, 'UNAUTHORIZED', 'Valid authentication required'));
    }
  };
}
export function tokenVerifier(
  config: Pick<Config, 'JWKS_URL' | 'JWT_ISSUER' | 'JWT_AUDIENCE'>,
) {
  const keys = createRemoteJWKSet(new URL(config.JWKS_URL), {
    cacheMaxAge: 600000,
    cooldownDuration: 0,
    timeoutDuration: 2000,
  });
  return async (token: string) => {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    if (!payload.sub) throw new Error();
    return payload;
  };
}

import { Resource } from '../../clients/identityClient';
export function buildCrisisResponse(resources: Resource[]) {
  return {
    crisisDetected: true as const,
    message:
      'You deserve support. If you are in immediate danger, contact local emergency services or someone you trust. You can use the support resources below.',
    resources,
  };
}

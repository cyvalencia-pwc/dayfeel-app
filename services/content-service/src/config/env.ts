import 'dotenv/config';
import { z } from 'zod';
export const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8082),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
  IDENTITY_URL: z.string().url(),
  AI_URL: z.string().url(),
  INTERNAL_KEY: z.string().min(32),
  JWKS_URL: z.string().url(),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  KAFKA_BROKERS: z
    .string()
    .min(1)
    .transform((s) => s.split(',').map((v) => v.trim())),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CIRCLE_CATALOG_JSON: z.string().default('[]'),
  S3_BUCKET: z.string().default(''),
  AWS_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().url().optional(),
});
export type Config = z.infer<typeof envSchema>;
export const readConfig = () => envSchema.parse(process.env);

import { z } from 'zod';
export const regionSchema = z
  .string()
  .regex(/^[A-Z]{2,10}$/)
  .default('GLOBAL');

import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('3001'),
  PRIVATE_KEY: z.string(),
  ALCHEMY_API_KEY: z.string(),
  ETHERSCAN_API_KEY: z.string(),
  SECRET: z.string(),
  VOYAGE_API_KEY: z.string(),
  VOYAGE_API_URL: z.string(),
  VOYAGE_MODEL: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_API_KEY: z.string(),
});

export type EnvConfig = z.infer<typeof envSchema>;

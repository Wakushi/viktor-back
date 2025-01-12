import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('3001'),
  PRIVATE_KEY: z.string(),
  BASE_SEPOLIA_RPC_URL: z.string(),
  ALCHEMY_API_KEY: z.string(),
  SECRET: z.string(),
  VOYAGE_API_KEY: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_API_KEY: z.string(),
});

export type EnvConfig = z.infer<typeof envSchema>;

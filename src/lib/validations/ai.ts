// lib/validations/ai.ts
import { z } from 'zod';

// Ensure the schema is explicitly exported when defined
export const generateImageSchema = z.object({
  prompt: z.string()
    .min(3, 'Prompt too short')
    .max(500, 'Prompt too long')
    .regex(/^[a-zA-Z0-9\s,.-]+$/, 'Invalid characters'), // Prevent injection
  style: z.enum(['realistic', 'anime', 'abstract']),
});


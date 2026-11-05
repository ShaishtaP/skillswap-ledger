import { z } from 'zod';

// Shared input rules, used by several routes.
export const skillsField = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(8, 'At most 8 skills')
  .transform((skills) => [...new Set(skills)]);

export const minutesField = z.number().int('Use whole minutes').min(0);

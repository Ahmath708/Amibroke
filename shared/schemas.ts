import { z } from 'zod';

export const PlaceholderSchema = z.object({ __placeholder: z.literal(true) });

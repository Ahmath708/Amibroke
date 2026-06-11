// Per-user financial demographics + brackets — the schema-v2 `financial_context` table (moved off
// the slim `profiles`). The form's mappers (valuesFromContext / contextUpdateFromValues) keep the
// row shape in sync with the analyze `userContext` keys; `dob` is the raw birthday (ageBracket derived).
import { ContextValues, valuesFromContext, contextUpdateFromValues } from '@/components/FinancialContextForm';
import { TABLES } from './tables';
import { withClient } from './supabaseClient';

/** Read the user's saved financial context (returns {} if none / signed out). */
export async function getFinancialContext(userId: string): Promise<ContextValues> {
  return withClient('fetch financial context', {} as ContextValues, async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.financial_context).select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return valuesFromContext(data as Record<string, unknown> | null);
  });
}

/** Upsert the user's financial context (owner-private; 1:1 with the profile). */
export async function saveFinancialContext(userId: string, values: ContextValues): Promise<boolean> {
  return withClient('save financial context', false, async (client) => {
    const { error } = await (client as any)
      .from(TABLES.financial_context)
      .upsert({ user_id: userId, ...contextUpdateFromValues(values) }, { onConflict: 'user_id' });
    if (error) throw error;
    return true;
  });
}

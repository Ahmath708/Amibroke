import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { userId, analysisId } = await req.json();

    if (!userId) {
      return jsonResponse({ error: 'userId is required' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const query = (supabase as any).from('analyses').select('id, action_plan');

    if (analysisId) {
      query.eq('id', analysisId).single();
    } else {
      query.eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
    }

    const { data, error } = await query;

    if (error) {
      console.error('action-plan query error:', error);
      return jsonResponse({ error: 'Failed to fetch action plan' }, 500);
    }

    if (!data || !Array.isArray(data.action_plan)) {
      return jsonResponse({ error: 'No action plan found' }, 404);
    }

    return jsonResponse({
      analysisId: data.id,
      actionPlan: data.action_plan,
    });
  } catch (error) {
    console.error('action-plan error:', error);
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// src/pages/api/health-supabase.ts
// Temporary connectivity check. Delete once the migration is done.
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const GET: APIRoute = async () => {
  const { error } = await supabase.from('recipes').select('id').limit(1);

  if (error) {
    console.error('Supabase health check failed:', error);
    // Only reveal details in local dev; keep production responses generic.
    const detail = import.meta.env.DEV ? `: ${error.message}` : '';
    return new Response(`supabase error${detail}`, { status: 500 });
  }

  return new Response('ok', { status: 200 });
};
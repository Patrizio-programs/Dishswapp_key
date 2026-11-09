// src/lib/supabase.ts
// SERVER-ONLY Supabase client. Uses the service-role key, which bypasses RLS.
// Only import this from API routes (.ts) or the frontmatter of non-hydrated
// .astro pages. Never import it from a React island or any client script.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env locally and in Vercel Project Settings.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const RECIPE_IMAGE_BUCKET = 'recipe-images';

export type Recipe = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  ingredients: string[];
  instructions: string[];
  tags: string[];
  difficulty: 'none' | 'easy' | 'intermediate' | 'hard';
  status: 'pending' | 'live';
  author: string | null;
  submitted_by: string;
  image_url: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
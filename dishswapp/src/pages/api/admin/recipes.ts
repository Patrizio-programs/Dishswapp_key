import type { APIRoute } from 'astro';
import { isAdminUser } from '../../../lib/admin';
import { supabase } from '../../../lib/supabase';

function json(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const { isAuthenticated } = locals.auth();
  if (!isAuthenticated) return json('Sign in required.', 401);

  const user = await locals.currentUser();
  if (!isAdminUser(user?.id)) return json('Admin access required.', 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json('Invalid request body.', 400);
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const author = typeof body.author === 'string' ? body.author.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const status = body.status;
  const featuredMonthValue = body.featured_month;

  if (!id || !title || title.length > 100) return json('Provide a valid recipe ID and title (up to 100 characters).', 400);
  if (status !== 'pending' && status !== 'live') return json('Invalid recipe status.', 400);

  let featuredMonth: number | null = null;
  if (featuredMonthValue !== '' && featuredMonthValue != null) {
    const parsedMonth = Number(featuredMonthValue);
    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) return json('Choose a valid featured month.', 400);
    featuredMonth = parsedMonth;
  }
  if (status === 'pending' && featuredMonth !== null) return json('Only live recipes can be featured. Clear the month or publish the recipe.', 400);

  const parseLines = (value: unknown) => typeof value === 'string'
    ? value.split('\n').map((item) => item.trim()).filter(Boolean)
    : [];
  const parseTags = (value: unknown) => typeof value === 'string'
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const ingredients = parseLines(body.ingredients);
  const instructions = parseLines(body.instructions);
  const tags = parseTags(body.tags);
  const requestedDifficulty = body.difficulty;

  if (!ingredients.length || !instructions.length) return json('Ingredients and instructions are required.', 400);
  if (ingredients.length > 100 || instructions.length > 100 || tags.length > 20) return json('Too many recipe entries.', 400);
  const difficulty = (['none', 'easy', 'intermediate', 'hard'] as const)
    .find((value) => value === requestedDifficulty);
  if (!difficulty) return json('Invalid difficulty.', 400);

  const parseOptionalNumber = (value: unknown, field: string) => {
    if (value === '' || value == null) return null;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > 10000) throw new Error(`Invalid ${field}.`);
    return number;
  };

  let prepTime: number | null;
  let cookTime: number | null;
  let servings: number | null;
  try {
    prepTime = parseOptionalNumber(body.prep_time, 'prep time');
    cookTime = parseOptionalNumber(body.cook_time, 'cook time');
    servings = parseOptionalNumber(body.servings, 'servings');
  } catch (error) {
    return json(error instanceof Error ? error.message : 'Invalid numeric value.', 400);
  }

  const { data, error } = await supabase.from('recipes').update({
    title,
    description: description || null,
    author: author || null,
    notes: notes || null,
    ingredients,
    instructions,
    tags,
    difficulty,
    status,
    featured_month: featuredMonth,
    prep_time: prepTime,
    cook_time: cookTime,
    servings,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select('id').maybeSingle();

  if (error) {
    console.error('Admin recipe update failed:', error);
    if (error.code === '23505') return json('Another recipe is already assigned to that month.', 409);
    return json('Could not update the recipe.', 502);
  }
  if (!data) return json('Recipe not found.', 404);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

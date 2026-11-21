import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

function response(message: string, status: number) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain' } });
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { isAuthenticated } = locals.auth();
    if (!isAuthenticated) return response('Sign in to save recipes.', 401);
    const user = await locals.currentUser();
    if (!user) return response('Unable to verify your account.', 401);

    const form = await request.formData();
    const recipeId = String(form.get('recipe_id') ?? '').trim();
    const action = String(form.get('action') ?? '');
    const destination = String(form.get('destination') ?? 'dashboard');
    if (!recipeId || !['save', 'remove'].includes(action)) return response('Invalid saved recipe request.', 400);

    let slug: string | null = null;
    if (action === 'save' || destination === 'recipe') {
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes').select('slug').eq('id', recipeId).eq('status', 'live').maybeSingle();
      if (recipeError) {
        console.error('Could not verify recipe for saved list:', recipeError);
        return response('Could not save this recipe right now.', 502);
      }
      if (!recipe) return response('Recipe not found.', 404);
      slug = recipe.slug;
    }

    if (action === 'save') {
      const { error } = await supabase.from('saved_recipes').upsert(
        { user_id: user.id, recipe_id: recipeId },
        { onConflict: 'user_id,recipe_id', ignoreDuplicates: true },
      );
      if (error) {
        console.error('Could not save recipe:', error);
        return response('Could not save this recipe right now.', 502);
      }
    } else {
      const { error } = await supabase.from('saved_recipes').delete()
        .eq('user_id', user.id).eq('recipe_id', recipeId);
      if (error) {
        console.error('Could not remove saved recipe:', error);
        return response('Could not update your saved recipes right now.', 502);
      }
    }

    const redirectPath = destination === 'recipe' && slug
      ? `/recipes/${slug}/?saved=${action === 'save' ? '1' : '0'}`
      : destination === 'cookbook'
        ? `/cookbook?saved=${action === 'save' ? '1' : '0'}`
        : `/dashboard?saved=${action === 'save' ? '1' : '0'}`;
    return Response.redirect(new URL(redirectPath, request.url), 303);
  } catch (error) {
    console.error('Saved recipe request failed:', error);
    return response('Something went wrong.', 500);
  }
};

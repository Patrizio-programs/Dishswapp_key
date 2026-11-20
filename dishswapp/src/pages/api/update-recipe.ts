import type { APIRoute } from 'astro';
import { supabase, RECIPE_IMAGE_BUCKET } from '../../lib/supabase';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function response(message: string, status: number) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain' } });
}

function getImagePath(url: string | null) {
  if (!url) return null;
  const marker = `/${RECIPE_IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { isAuthenticated } = locals.auth();
    if (!isAuthenticated) return response('Sign in to edit your recipe.', 401);
    const user = await locals.currentUser();
    if (!user) return response('Unable to verify your account.', 401);

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) return response('Recipe not found.', 404);

    const { data: existing, error: lookupError } = await supabase
      .from('recipes').select('id, submitted_by, image_url')
      .eq('id', id).eq('submitted_by', user.id).maybeSingle();
    if (lookupError) {
      console.error('Recipe edit lookup failed:', lookupError);
      return response('Could not load the recipe.', 502);
    }
    if (!existing) return response('Recipe not found.', 404);

    const title = String(form.get('title') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const ingredients = String(form.get('ingredients') ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
    const instructions = String(form.get('instructions') ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
    const tags = String(form.get('tags') ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    const difficulty = String(form.get('difficulty') ?? 'none');
    const notes = String(form.get('notes') ?? '').trim();

    if (!title || title.length > 100) return response('Enter a recipe title up to 100 characters.', 400);
    if (description.length > 2000 || notes.length > 3000) return response('Description or notes are too long.', 400);
    if (!ingredients.length || !instructions.length) return response('Ingredients and instructions are required.', 400);
    if (ingredients.length > 100 || instructions.length > 100 || tags.length > 20) return response('Too many recipe entries.', 400);
    if (!['none', 'easy', 'intermediate', 'hard'].includes(difficulty)) return response('Invalid difficulty.', 400);

    const optionalNumber = (name: string) => {
      const value = String(form.get(name) ?? '').trim();
      if (!value) return null;
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 10000) throw new Error(`Invalid ${name}.`);
      return parsed;
    };

    let prepTime: number | null;
    let cookTime: number | null;
    let servings: number | null;
    try {
      prepTime = optionalNumber('prepTime');
      cookTime = optionalNumber('cookTime');
      servings = optionalNumber('servings');
    } catch (error) {
      return response(error instanceof Error ? error.message : 'Invalid number.', 400);
    }

    const image = form.get('image');
    let newImagePath: string | null = null;
    let imageUrl = existing.image_url;
    if (image instanceof File && image.size > 0) {
      if (image.size > MAX_IMAGE_SIZE) return response('Image must be 5 MB or smaller.', 400);
      const extension = IMAGE_TYPES[image.type];
      if (!extension) return response('Only JPG, PNG and WebP images are allowed.', 400);

      newImagePath = `${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(RECIPE_IMAGE_BUCKET).upload(
        newImagePath,
        Buffer.from(await image.arrayBuffer()),
        { contentType: image.type, upsert: false },
      );
      if (uploadError) {
        console.error('Recipe image replacement failed:', uploadError);
        return response('Could not upload the recipe image.', 502);
      }
      imageUrl = supabase.storage.from(RECIPE_IMAGE_BUCKET).getPublicUrl(newImagePath).data.publicUrl;
    }

    const { data: saved, error: updateError } = await supabase.from('recipes').update({
      title,
      description: description || null,
      ingredients,
      instructions,
      tags,
      difficulty,
      notes: notes || null,
      prep_time: prepTime,
      cook_time: cookTime,
      servings,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('submitted_by', user.id).select('id').maybeSingle();

    if (updateError || !saved) {
      if (newImagePath) await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([newImagePath]);
      if (updateError) console.error('Recipe update failed:', updateError);
      return response(updateError ? 'Could not save your changes.' : 'Recipe not found.', updateError ? 502 : 404);
    }

    if (newImagePath) {
      const previousImagePath = getImagePath(existing.image_url);
      if (previousImagePath) {
        const { error: removeError } = await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([previousImagePath]);
        if (removeError) console.error('Could not remove replaced recipe image:', removeError);
      }
    }

    return Response.redirect(new URL('/dashboard?updated=1', request.url), 303);
  } catch (error) {
    console.error('Recipe update error:', error);
    return response('Something went wrong while saving your recipe.', 500);
  }
};

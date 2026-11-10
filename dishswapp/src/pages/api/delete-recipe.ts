// src/pages/api/delete-recipe.ts
// Deletes ONE recipe owned by the signed-in user (row + stored image).
import type { APIRoute } from "astro";
import { supabase, RECIPE_IMAGE_BUCKET } from "../../lib/supabase";

function response(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

// image_url looks like  .../storage/v1/object/public/recipe-images/<id>.jpg
// -> return "<id>.jpg" (the path inside the bucket).
function imagePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${RECIPE_IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // ---- Auth -------------------------------------------------------------
    const { isAuthenticated } = locals.auth();
    if (!isAuthenticated) {
      return response("You must sign in to delete a recipe.", 401);
    }

    const user = await locals.currentUser();
    if (!user) {
      return response("Unable to verify your account.", 401);
    }

    // ---- Which recipe? ----------------------------------------------------
    const form = await request.formData();
    const id = String(form.get("id") || "").trim();
    if (!id) {
      return response("Missing recipe id.", 400);
    }

    // ---- Ownership check (the service-role key bypasses RLS, so this
    //      check is what stops people deleting each other's recipes) -------
    const { data: recipe, error: findError } = await supabase
      .from("recipes")
      .select("id, submitted_by, image_url")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      console.error("Delete lookup failed:", findError);
      return response("Could not look up the recipe.", 502);
    }

    // Same message for "doesn't exist" and "not yours" so ids can't be probed.
    if (!recipe || recipe.submitted_by !== user.id) {
      return response("Recipe not found.", 404);
    }

    // ---- Delete the row (filter on submitted_by again as a safety net) ----
    const { error: deleteError } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id)
      .eq("submitted_by", user.id);

    if (deleteError) {
      console.error("Delete failed:", deleteError);
      return response("Could not delete the recipe. Please try again.", 502);
    }

    // ---- Remove its image (non-fatal if this fails) ----------------------
    const imagePath = imagePathFromUrl(recipe.image_url);
    if (imagePath) {
      const { error: removeError } = await supabase.storage
        .from(RECIPE_IMAGE_BUCKET)
        .remove([imagePath]);
      if (removeError) console.error("Could not remove image:", removeError);
    }

    return Response.redirect(new URL("/dashboard", request.url), 303);
  } catch (error) {
    console.error("Recipe delete error:", error);
    return response("Something went wrong.", 500);
  }
};
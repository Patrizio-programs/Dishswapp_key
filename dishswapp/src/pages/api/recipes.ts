import type { APIRoute } from "astro";
import { supabase, RECIPE_IMAGE_BUCKET } from "../../lib/supabase";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_SLUG_ATTEMPTS = 100;

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Errors we want to show to the user as a 400.
class ValidationError extends Error {}

function response(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // ---- Auth (unchanged) -------------------------------------------------
    const { isAuthenticated } = locals.auth();

    if (!isAuthenticated) {
      return response("You must sign in to submit a recipe.", 401);
    }

    const user = await locals.currentUser();

    if (!user) {
      return response("Unable to verify your account.", 401);
    }

    // ---- Parse + validate (unchanged rules) -------------------------------
    const form = await request.formData();

    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const ingredientsText = String(form.get("ingredients") || "");
    const instructionsText = String(form.get("instructions") || "");
    const tagsText = String(form.get("tags") || "");
    const difficulty = String(form.get("difficulty") || "none");
    const notes = String(form.get("notes") || "").trim();

    if (!title || title.length > 100) {
      return response("Please provide a valid recipe title.", 400);
    }

    const ingredients = ingredientsText
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);

    const instructions = instructionsText
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);

    const tags = tagsText
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

    if (!ingredients.length || !instructions.length) {
      return response("Ingredients and instructions are required.", 400);
    }

    if (!["none", "easy", "intermediate", "hard"].includes(difficulty)) {
      return response("Invalid difficulty selection.", 400);
    }

    if (tags.length > 20 || ingredients.length > 100 || instructions.length > 100) {
      return response("Too many recipe entries.", 400);
    }

    function optionalNumber(name: string) {
      const value = String(form.get(name) || "").trim();

      if (!value) return null;

      const number = Number(value);

      if (!Number.isSafeInteger(number) || number < 1 || number > 10000) {
        throw new ValidationError(`Invalid ${name} value.`);
      }

      return number;
    }

    const prepTime = optionalNumber("prepTime");
    const cookTime = optionalNumber("cookTime");
    const servings = optionalNumber("servings");

    const baseSlug = slugify(title);

    if (!baseSlug) {
      return response("Please use a valid recipe title.", 400);
    }

    // Validate the image BEFORE writing anything, so a bad file never leaves
    // a half-saved recipe behind.
    const image = form.get("image");
    let upload: { file: File; extension: string } | null = null;

    if (image instanceof File && image.size > 0) {
      if (image.size > MAX_IMAGE_SIZE) {
        return response("Image must be 5 MB or smaller.", 400);
      }

      const extension = ALLOWED_IMAGE_TYPES[image.type];

      if (!extension) {
        return response("Only JPG, PNG and WebP images are allowed.", 400);
      }

      upload = { file: image, extension };
    }

    // ---- Author (unchanged) -----------------------------------------------
    const author =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "DishSwapp member";

    // ---- Image -> Supabase Storage ----------------------------------------
    // The id is generated here so the image path never depends on the slug
    // (renaming a recipe later won't orphan its image) and the row can be
    // inserted once, already carrying image_url.
    const id = crypto.randomUUID();
    let imagePath: string | null = null;
    let imageUrl: string | null = null;

    const removeImage = async () => {
      if (!imagePath) return;
      const { error } = await supabase.storage
        .from(RECIPE_IMAGE_BUCKET)
        .remove([imagePath]);
      if (error) console.error("Could not clean up image:", error);
    };

    if (upload) {
      imagePath = `${id}.${upload.extension}`;
      const bytes = Buffer.from(await upload.file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(RECIPE_IMAGE_BUCKET)
        .upload(imagePath, bytes, {
          contentType: upload.file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload failed:", uploadError);
        return response("Could not upload the recipe image.", 502);
      }

      imageUrl = supabase.storage
        .from(RECIPE_IMAGE_BUCKET)
        .getPublicUrl(imagePath).data.publicUrl;
    }

    // ---- Insert row; the UNIQUE(slug) constraint replaces the GitHub loop ---
    const row = {
      id,
      title,
      description: description || null,
      ingredients,
      instructions,
      tags,
      difficulty,
      status: "pending", // always pending on submit
      author,
      submitted_by: user.id,
      image_url: imageUrl,
      prep_time: prepTime,
      cook_time: cookTime,
      servings,
      notes: notes || null,
    };

    let saved = false;

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;

      const { error } = await supabase.from("recipes").insert({ ...row, slug });

      if (!error) {
        saved = true;
        break;
      }

      // 23505 = unique_violation (slug already taken) -> try the next suffix.
      if (error.code === "23505") continue;

      console.error("Supabase insert failed:", error);
      await removeImage();
      return response("Could not save the recipe. Please try again.", 502);
    }

    if (!saved) {
      await removeImage();
      return response("Could not create a unique recipe name.", 500);
    }

    return Response.redirect(new URL("/recipe-submitted", request.url), 303);
  } catch (error) {
    console.error("Recipe submission error:", error);

    if (error instanceof ValidationError) {
      return response(error.message, 400);
    }

    return response("Something went wrong.", 500);
  }
};
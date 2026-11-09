
import type { APIRoute } from "astro";

const OWNER = "Patrizio-programs";
const REPO = "Dishswapp_key";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const headers = () => ({
  Authorization: `Bearer ${import.meta.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
});

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

function yamlString(value: string) {
  return JSON.stringify(value);
}

function yamlArray(values: string[]) {
  return values.map(value => `  - ${yamlString(value)}`).join("\n");
}

async function githubRequest(path: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...headers(),
      ...options?.headers,
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Check authentication on the server
    const { isAuthenticated } = locals.auth();

    if (!isAuthenticated) {
      return response("You must sign in to submit a recipe.", 401);
    }

    const user = await locals.currentUser();

    if (!user) {
      return response("Unable to verify your account.", 401);
    }

    const token = import.meta.env.GITHUB_TOKEN;

    if (!token) {
      return response("GitHub configuration is missing.", 500);
    }

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

      if (!value) return undefined;

      const number = Number(value);

      if (!Number.isSafeInteger(number) || number < 1 || number > 10000) {
        throw new Error(`Invalid ${name} value.`);
      }

      return number;
    }

    const prepTime = optionalNumber("prepTime");
    const cookTime = optionalNumber("cookTime");
    const servings = optionalNumber("servings");

    // Get the repository's default branch
    const repoResponse = await githubRequest("");

    if (!repoResponse.ok) {
      return response("Could not access the GitHub repository.", 502);
    }

    const repoData = await repoResponse.json();
    const branch = repoData.default_branch;

    // Generate a unique recipe filename
    const baseSlug = slugify(title);

    if (!baseSlug) {
      return response("Please use a valid recipe title.", 400);
    }

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const check = await githubRequest(
        `/contents/dishswapp/src/content/recipes/${slug}.yaml?ref=${branch}`
      );

      if (check.status === 404) break;

      if (!check.ok) {
        return response("Could not check existing recipes.", 502);
      }

      counter++;
      slug = `${baseSlug}-${counter}`;

      if (counter > 100) {
        return response("Could not create a unique recipe name.", 500);
      }
    }

    // Build recipe data
    const author =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "DishSwapp member";

    const recipe: Record<string, unknown> = {
      title,
      ingredients,
      instructions,
      tags,
      difficulty,
      status: "pending",
      author,
    };

    if (description) recipe.description = description;
    if (notes) recipe.notes = notes;
    if (prepTime !== undefined) recipe.prepTime = prepTime;
    if (cookTime !== undefined) recipe.cookTime = cookTime;
    if (servings !== undefined) recipe.servings = servings;

    // Handle optional image upload
    const image = form.get("image");

    if (image instanceof File && image.size > 0) {
      if (image.size > MAX_IMAGE_SIZE) {
        return response("Image must be 5 MB or smaller.", 400);
      }

      const allowedTypes: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      const extension = allowedTypes[image.type];

      if (!extension) {
        return response("Only JPG, PNG and WebP images are allowed.", 400);
      }

      const bytes = Buffer.from(await image.arrayBuffer());

      const imagePath =
        `dishswapp/public/images/recipes/${slug}.${extension}`;

      const imageResponse = await githubRequest(
        `/contents/${imagePath}`,
        {
          method: "PUT",
          body: JSON.stringify({
            message: `Add recipe image: ${title}`,
            branch,
            content: bytes.toString("base64"),
          }),
        }
      );

      if (!imageResponse.ok) {
        return response("Could not upload the recipe image.", 502);
      }

      recipe.image = `/images/recipes/${slug}.${extension}`;
    }

    // Convert recipe data into YAML
    const yaml = [
      `title: ${yamlString(title)}`,
      "ingredients:",
      yamlArray(ingredients),
      "instructions:",
      yamlArray(instructions),
      "tags:",
      yamlArray(tags),
      `difficulty: ${yamlString(difficulty)}`,
      'status: "pending"',
      `author: ${yamlString(author)}`,
    ];

    if (description) yaml.push(`description: ${yamlString(description)}`);
    if (recipe.image) yaml.push(`image: ${yamlString(String(recipe.image))}`);
    if (prepTime !== undefined) yaml.push(`prepTime: ${prepTime}`);
    if (cookTime !== undefined) yaml.push(`cookTime: ${cookTime}`);
    if (servings !== undefined) yaml.push(`servings: ${servings}`);
    if (notes) yaml.push(`notes: ${yamlString(notes)}`);

    const recipeContent = Buffer.from(yaml.join("\n") + "\n").toString("base64");

    // Save recipe to GitHub
    const saveResponse = await githubRequest(
      `/contents/dishswapp/src/content/recipes/${slug}.yaml`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: `Submit recipe: ${title}`,
          branch,
          content: recipeContent,
        }),
      }
    );

    if (!saveResponse.ok) {
      return response("Could not save the recipe to GitHub.", 502);
    }

    return Response.redirect(
      new URL("/submit-recipe?success=1", request.url),
      303
    );

  } catch (error) {
    console.error("Recipe submission error:", error);

    return response(
      error instanceof Error ? error.message : "Something went wrong.",
      400
    );
  }
};

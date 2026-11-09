
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdoc}',
    base: './src/content/posts',
  }),
  schema: z.object({
    title: z.string(),
  }),
});

const recipes = defineCollection({
  loader: glob({
    pattern: '**/*.{yaml,yml}',
    base: './src/content/recipes',
  }),
  schema: z.object({
    title: z.string(),
    ingredients: z.array(z.string().min(1)).min(1),
    instructions: z.array(z.string().min(1)).min(1),

    tags: z.array(z.string()).optional(),
    difficulty: z.enum([
      'none',
      'easy',
      'intermediate',
      'hard',
    ]).optional(),

    description: z.string().optional(),
    author: z.string().optional(),
    image: z.string().optional(),
    prepTime: z.number().int().positive().optional(),
    cookTime: z.number().int().positive().optional(),
    servings: z.number().int().positive().optional(),
    notes: z.string().optional(),
  }),
});

export const collections = {
  posts,
  recipes,
};

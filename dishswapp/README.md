<p align="center">
  <img src="dishswapp/public/img/og-image.png" alt="DishSwapp: Collect, collaborate, cook." width="720" />
</p>

<h1 align="center">DishSwapp</h1>

<p align="center">
  <strong>Collect, collaborate, cook.</strong><br />
  An open-source community where home cooks discover, share and improve recipes from kitchens around the world.
</p>

<p align="center">
  <a href="#license"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-3D717C" /></a>
  <img alt="Built with Astro" src="https://img.shields.io/badge/built%20with-Astro-E07A3B" />
  <img alt="Database: Supabase" src="https://img.shields.io/badge/data-Supabase-3D717C" />
  <img alt="Auth: Clerk" src="https://img.shields.io/badge/auth-Clerk-F9B7A4" />
</p>

---

## What is DishSwapp?

Most recipe sites are a one-way street: you read, you cook, and if the recipe doesn't work out there's nothing you can do about it. DishSwapp is built around the idea that **cooking is better together**. Anyone can share a recipe, browse what the community has contributed, and (as the project grows) comment, improve and show off their own attempts.

## Features

- **Browse recipes** from the community, with a page for each recipe (ingredients, steps, timings, servings, difficulty, notes and a photo)
- **Explore by cuisine** (Italian, Mexican, Asian and more) using recipe tags
- **Share your own recipe** with a photo upload (JPG, PNG or WebP, up to 5 MB)
- **Personal dashboard** showing your live recipes, a count of those awaiting review, and a delete button for each recipe you own
- **Sign in with Clerk** so every recipe is tied to its author
- **Review before publishing**: new submissions start as `pending` and only appear on the site once set to `live`
- **Share-ready pages**: every page has its own title, description and Open Graph / Twitter card, and recipe pages include `schema.org` Recipe data for search engines
- **Blog posts** written in Markdoc through the Keystatic editor

## Tech stack

| Area | Tool |
|---|---|
| Framework | [Astro](https://astro.build) (server-rendered) with React islands |
| Hosting | [Vercel](https://vercel.com) via `@astrojs/vercel` |
| Authentication | [Clerk](https://clerk.com) (`@clerk/astro`) |
| Database and image storage | [Supabase](https://supabase.com) (Postgres + Storage) |
| Blog / content editing | [Keystatic](https://keystatic.com) + Markdoc |
| Styling | Bootstrap 5, Bootstrap Icons, custom brand tokens in `src/styles.css` |
| Fonts | Playfair Display, Inter, JetBrains Mono |

## Getting started

### Prerequisites

- A current LTS version of [Node.js](https://nodejs.org) (see the Astro docs for the minimum supported version)
- A free [Supabase](https://supabase.com) project
- A free [Clerk](https://clerk.com) application

### 1. Clone and install

```bash
git clone https://github.com/Patrizio-programs/Dishswapp_key.git
cd Dishswapp_key/dishswapp
npm install
```

### 2. Set up environment variables

Create a file called `.env` inside the `dishswapp` folder:

```bash
# Supabase (Project Settings → API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk (Dashboard → API Keys)
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

> **Keep `SUPABASE_SERVICE_ROLE_KEY` secret.** It bypasses Row Level Security, so it must only ever be used on the server (API routes and `.astro` frontmatter). `.env` is already in `.gitignore`; never commit it.

### 3. Set up Supabase

Run this in the Supabase **SQL editor**. It creates the `recipes` table the app expects:

```sql
create table public.recipes (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text,
  ingredients  text[] not null default '{}',
  instructions text[] not null default '{}',
  tags         text[] not null default '{}',
  difficulty   text not null default 'none'
               check (difficulty in ('none', 'easy', 'intermediate', 'hard')),
  status       text not null default 'pending'
               check (status in ('pending', 'live')),
  author       text,
  submitted_by text not null,          -- Clerk user ID
  image_url    text,
  prep_time    integer,
  cook_time    integer,
  servings     integer,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- All access goes through the server using the service-role key,
-- so lock the table down for everyone else.
alter table public.recipes enable row level security;
```

Then go to **Storage** and create a **public** bucket named `recipe-images`.

### 4. Run it

```bash
npm run dev
```

| URL | What you'll see |
|---|---|
| <http://localhost:4321> | Homepage |
| <http://localhost:4321/keystatic> | Keystatic admin UI (blog posts) |

To check that the database connection works, open `/api/health-supabase`. It should respond with `ok`.

## Publishing recipes

Submissions are saved with `status = 'pending'`. To approve one, open the `recipes` table in the Supabase dashboard and change its `status` to `live`. It then appears on `/recipes`, its cuisine page and its author's dashboard.

A built-in admin review screen is a good first contribution if you'd like to help.

## Project structure

```
dishswapp/
├── public/
│   ├── img/                 # Logos, icons, social share image, web manifest
│   └── favicon.svg / .ico
├── src/
│   ├── components/          # Navbar, Footer, Hero, RecipeCard, CuisineCard
│   ├── content/posts/       # Blog posts (Markdoc, edited via Keystatic)
│   ├── layouts/Layout.astro # <head>: SEO, share cards, icons, JSON-LD
│   ├── lib/supabase.ts      # Server-only Supabase client + Recipe type
│   ├── middleware.ts        # Clerk middleware
│   ├── pages/
│   │   ├── index.astro               # Home
│   │   ├── about.astro, donate.astro
│   │   ├── login.astro               # Clerk sign-in / sign-up
│   │   ├── dashboard.astro           # Your recipes (signed-in only)
│   │   ├── submit-recipe.astro       # Recipe form
│   │   ├── recipe-submitted.astro
│   │   ├── recipes/index.astro       # All live recipes
│   │   ├── recipes/[slug].astro      # One recipe
│   │   ├── cuisine/[cuisine].astro   # Recipes filtered by tag
│   │   ├── posts/[slug].astro        # Blog post
│   │   └── api/
│   │       ├── recipes.ts            # POST: submit a recipe
│   │       ├── delete-recipe.ts      # POST: delete your own recipe
│   │       └── health-supabase.ts    # GET: connectivity check
│   └── styles.css           # Brand tokens (--ds-*) and global styles
├── astro.config.mjs
└── keystatic.config.ts
```

## How it works

- **Submitting:** `POST /api/recipes` checks the user is signed in, validates the form, uploads the image to Supabase Storage, and inserts the row. If a slug is already taken it tries `-2`, `-3` and so on.
- **Deleting:** `POST /api/delete-recipe` checks the signed-in user is the recipe's `submitted_by` owner before removing the row and its image. Because the service-role key skips Row Level Security, **this ownership check is what protects other people's recipes**, so keep it in place if you change the route.
- **Pages:** public pages only query recipes with `status = 'live'`.

## Brand

| Colour | Hex | Used for |
|---|---|---|
| Deep teal | `#3D717C` | Structure, navigation, headings accents |
| Peachy pink | `#F9B7A4` | Accents and highlights |
| Spice | `#E07A3B` | The one primary call to action per page |
| Cream | `#FBF7F1` | Page background |
| Ink | `#2C2A28` | Text |

Logos and icons live in `public/img/`. The SVG wordmarks use Playfair Display, which only loads when the SVG is inlined in a page (not through an `<img>` tag), so the PNG wordmark is used in the navbar and footer.

## Deployment

The project is set up for [Vercel](https://vercel.com):

1. Import the repository and set the **Root Directory** to `dishswapp`.
2. Add the four environment variables from step 2 under **Project Settings → Environment Variables**.
3. Deploy.

Once you have a domain, add `site: 'https://your-domain.com'` to `astro.config.mjs` so canonical and share-card URLs use it.

## Contributing

Contributions are very welcome, whether that's a bug fix, a design tweak or a new feature.

1. Fork the repository and create a branch (`git checkout -b my-feature`).
2. Make your changes and check them with `npm run build`.
3. Open a pull request describing what you changed and why.

Ideas that would help:

- An admin screen for approving pending recipes
- Comments and "show us your attempt" photo uploads on recipes
- Editing a recipe after it has been submitted
- A sitemap and `robots.txt`
- Cuisine photos for the home page cards

Found a bug or have an idea? [Open an issue](https://github.com/Patrizio-programs/Dishswapp_key/issues).

## License

Released under the [MIT License](dishswapp/LICENSE).
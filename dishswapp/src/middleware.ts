import { clerkMiddleware } from "@clerk/astro/server";

export const onRequest = clerkMiddleware(); // This middleware is required to use Clerk with Astro
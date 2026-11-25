import { clerkMiddleware } from "@clerk/astro/server";

declare global {
  namespace App {
    interface Locals {
      isApp: boolean;
    }
  }
}

export const onRequest = clerkMiddleware((_auth, context, next) => {
  const userAgent = context.request.headers.get("user-agent") ?? "";

  const isApp = /;\s*wv\)/.test(userAgent);

  context.locals.isApp = isApp;

  return next();
});
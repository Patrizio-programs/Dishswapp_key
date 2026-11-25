import { clerkMiddleware } from "@clerk/astro/server";

export const onRequest = clerkMiddleware((context, next) => {
  const userAgent = context.request.headers.get("user-agent") || "";
  const isApp = userAgent.includes("; wv");

  // We can set a local variable or pass it via context.locals
  context.locals.isApp = isApp;

  return next();
});
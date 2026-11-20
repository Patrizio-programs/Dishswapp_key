/** Server-side admin allow-list. Configure with comma-separated Clerk user IDs. */
export function isAdminUser(userId: string | undefined): boolean {
  if (!userId) return false;

  const adminIds = (import.meta.env.CLERK_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id: string) => id.trim())
    .filter(Boolean);

  return adminIds.includes(userId);
}

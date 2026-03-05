import { getRestaurantBySlug, type Restaurant } from "./db";

/**
 * Resolve the tenant (restaurant) from a slug.
 * Returns null if no matching restaurant exists.
 *
 * Today: slug comes from the URL path (/r/[slug]/...).
 * Tomorrow: swap to subdomain extraction here — one line change.
 */
export async function resolveTenant(slug: string): Promise<Restaurant | null> {
  if (!slug) return null;
  return getRestaurantBySlug(slug);
}

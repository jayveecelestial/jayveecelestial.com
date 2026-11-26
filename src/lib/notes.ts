import { getCollection, type CollectionEntry } from 'astro:content';

/** Drafts show in dev and Vercel previews, never in production builds. */
export const showDrafts = (vercelEnv: string | undefined): boolean => vercelEnv !== 'production';

/** Published notes (plus drafts outside production), newest first. */
export async function listNotes(): Promise<CollectionEntry<'notes'>[]> {
  const all = await getCollection('notes', (n) => !n.data.draft || showDrafts(process.env.VERCEL_ENV));
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

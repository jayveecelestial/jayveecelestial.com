import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { listNotes } from '../lib/notes';

// Feed of published notes (drafts too, outside production). Empty until a note is published;
// pages only link to it when there is something in it.
export async function GET(context: APIContext) {
  const notes = await listNotes();
  return rss({
    title: 'Jayvee Celestial · Notes',
    description: 'Write-ups on DevOps and OpenShift work by Jayvee Celestial.',
    site: context.site ?? 'https://jayveecelestial.com',
    items: notes.map((n) => ({
      title: n.data.title,
      description: n.data.summary,
      pubDate: n.data.date,
      link: `/notes/${n.id}`,
    })),
    customData: '<language>en</language>',
    // Match the canonical URLs on the note pages (no trailing slash).
    trailingSlash: false,
  });
}

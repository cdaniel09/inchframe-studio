import type { MetadataRoute } from 'next';

// Public service pages only. Do not enumerate clients, projects, or applications.
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/studio-partners'].map((path) => ({
    url: `https://studio.inchframe.com${path}`,
  }));
}

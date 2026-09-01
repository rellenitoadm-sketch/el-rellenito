import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/ruta'],
    },
    sitemap: 'https://elrellenito.com/sitemap.xml',
  };
}

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.NEXT_PUBLIC_APP_ENV === 'production';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://proofline.ubuntuledger.org';

  if (!isProduction) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/receipt/', '/services/', '/simulator'],
      disallow: ['/console/', '/console/*', '/pwa', '/pwa/*', '/api/', '/api/*'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

import type { MetadataRoute } from 'next';
export const dynamic = 'force-dynamic';
const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.clearbot.org').replace(/\/$/, '');
const pages = [ '/', '/about.html', '/alligator.html', '/class-1.html', '/class-2.html', '/class-3.html', '/contact.html', '/deployment-models.html', '/blog.html', '/news.html', '/projects.html', '/services.html', '/service-bathymetric-survey.html', '/service-draft-survey.html', '/service-hyacinth-removal.html', '/service-solid-waste-recovery.html', '/project-falgu-river-gaya.html', '/project-hong-kong-oil-response.html', '/project-ilugin-river-philippines.html', '/project-jnpa-mumbai.html', '/project-lohagarh-fort-bharatpur.html', '/project-nonbah-river-meghalaya.html', '/project-putiya-kavin-chira-kerala.html', '/project-sentx-landfill-hong-kong.html', '/project-sino-group-hong-kong.html', '/project-umiam-lake-meghalaya.html', '/assessment' ];
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let blogs: { slug: string; updatedAt?: string; publishAt?: string }[] = [];
  try { const response = await fetch('http://127.0.0.1:3000/api/public/blogs', { cache: 'no-store' }); if (response.ok) blogs = (await response.json()).blogs || []; } catch { /* API may be unavailable during a build */ }
  return [
    ...pages.map(path => ({ url: `${base}${path === '/' ? '' : path}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: path === '/' ? 1 : 0.7 })),
    ...blogs.map(blog => ({ url: `${base}/blog/${encodeURIComponent(blog.slug)}`, lastModified: new Date(blog.updatedAt || blog.publishAt || Date.now()), changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}

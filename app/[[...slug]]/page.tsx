import type { Metadata } from 'next';
import fs from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import LegacyDocument from '@/components/LegacyDocument';

export const dynamic = 'force-dynamic';
const ROOT = path.join(process.cwd(), 'public', 'original');
const API = 'http://127.0.0.1:3000';

async function apiJson(route: string) {
  try { const response = await fetch(`${API}${route}`, { cache: 'no-store' }); if (!response.ok) return null; return await response.json(); }
  catch { return null; }
}
function pagePath(slug: string[] = []) { return slug.length ? `/${slug.join('/')}` : '/'; }

async function getPage(file: string) {
  const safe = path.basename(file);
  if (!safe.endsWith('.html')) return null;
  try {
    const html = await fs.readFile(path.join(ROOT, safe), 'utf8');
    const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
    const rawBody = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
    const styles = [...head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
    const links = [...head.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]).filter((href) => /^(https?:)?\/\//.test(href));
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => {
      const src = m[1].match(/src=["']([^"']+)["']/i)?.[1];
      const id = m[1].match(/id=["']([^"']+)["']/i)?.[1];
      const type = m[1].match(/type=["']([^"']+)["']/i)?.[1];
      return src ? { src, id, type } : { code: m[2], id, type };
    });
    const body = rawBody.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || 'Clear Robotics';
    const description = head.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1] || '';
    return { body, styles, links, scripts, title, description };
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const { slug = [] } = await params;
  const route = pagePath(slug);
  const seoResult = await apiJson(`/api/public/seo?path=${encodeURIComponent(route)}`);
  const seo = seoResult?.seo;
  let blog: any = null;
  if (slug.length >= 2 && slug[0] === 'blog') {
    const result = await apiJson(`/api/public/blog/${encodeURIComponent(slug.slice(1).join('/'))}`);
    blog = result?.blog || null;
  }
  const legacy = slug.length && slug[slug.length - 1].endsWith('.html') ? await getPage(slug[slug.length - 1]) : (!slug.length ? await getPage('index.html') : null);
  const title = seo?.title || blog?.seo?.title || blog?.title || legacy?.title || 'Clear Robotics | Cleaner Waterways for a Healthier Planet';
  const description = seo?.description || blog?.seo?.description || blog?.excerpt || legacy?.description || 'Unmanned electric and solar-powered waterway-cleanup vessels, aquatic weed collection and smart marine operations.';
  const canonical = seo?.canonical || undefined;
  const robotsValue = seo?.robots || 'index,follow';
  const noindex = robotsValue.toLowerCase().includes('noindex');
  const nofollow = robotsValue.toLowerCase().includes('nofollow');
  const ogTitle = seo?.ogTitle || blog?.seo?.title || title;
  const ogDescription = seo?.ogDescription || description;
  const ogImage = seo?.ogImage || blog?.featuredImage || undefined;
  return {
    title, description, keywords: seo?.keywords || blog?.seo?.keywords || undefined,
    alternates: canonical ? { canonical } : undefined,
    robots: { index: !noindex, follow: !nofollow },
    openGraph: { title: ogTitle, description: ogDescription, images: ogImage ? [ogImage] : undefined, type: 'website' },
  };
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (slug.length >= 2 && slug[0] === 'blog') {
    const result = await apiJson(`/api/public/blog/${encodeURIComponent(slug.slice(1).join('/'))}`);
    const blog = result?.blog;
    if (!blog) notFound();
    return <main className="cb-published-blog">
      <header className="cb-published-blog-header"><a href="/">CLEARBOT</a><a href="/blog.html">Insights &amp; articles</a></header>
      <article className="cb-published-blog-article">
        <div className="cb-published-blog-meta">{blog.category || 'Clearbot Insights'} · {blog.author || 'Clear Robotics'} · {blog.publishAt ? new Date(blog.publishAt).toLocaleDateString('en-GB') : ''}</div>
        <h1>{blog.title}</h1>
        {blog.excerpt && <p className="cb-published-blog-excerpt">{blog.excerpt}</p>}
        {blog.featuredImage && <img className="cb-published-blog-cover" src={blog.featuredImage} alt={blog.imageAlt || blog.title}/>}
        <div className="cb-published-blog-content" dangerouslySetInnerHTML={{ __html: blog.content || '' }}/>
        <a className="cb-published-blog-back" href="/blog.html">← Back to all insights</a>
      </article>
      <footer className="cb-published-blog-footer">© {new Date().getFullYear()} Clear Robotics · Cleaner Waterways for a Healthier Planet</footer>
    </main>;
  }
  const file = slug.length ? slug.join('/') : 'index.html';
  const page = await getPage(file);
  if (!page) { notFound(); throw new Error('Requested website page was not found.'); }
  return <LegacyDocument {...page}/>;
}

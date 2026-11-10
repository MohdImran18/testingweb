import fs from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import LegacyDocument from '@/components/LegacyDocument';

const ROOT = path.join(process.cwd(), 'public', 'original');
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
    return { body, styles, links, scripts, title };
  } catch { return null; }
}
export async function generateStaticParams() {
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.html') && f !== 'index.html');
  return [{ slug: [] }, ...files.map((file) => ({ slug: [file] }))];
}
export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const file = slug.length ? slug.join('/') : 'index.html';
  const page = await getPage(file);
  if (!page) notFound();
  return <LegacyDocument {...page} />;
}

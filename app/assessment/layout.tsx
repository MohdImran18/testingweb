import type { Metadata } from 'next';
import type { ReactNode } from 'react';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  let seo: any = null;
  try { const response = await fetch('http://127.0.0.1:3000/api/public/seo?path=%2Fassessment', { cache: 'no-store' }); if (response.ok) seo = (await response.json()).seo; } catch { /* API metadata may be unavailable during build */ }
  const title = seo?.title || 'Project Assessment | Clear Robotics';
  const description = seo?.description || 'Share your waterway project requirements with Clear Robotics and request a project assessment.';
  const robots = String(seo?.robots || 'index,follow').toLowerCase();
  return { title, description, keywords: seo?.keywords || undefined, alternates: seo?.canonical ? { canonical: seo.canonical } : undefined, robots: { index: !robots.includes('noindex'), follow: !robots.includes('nofollow') }, openGraph: { title: seo?.ogTitle || title, description: seo?.ogDescription || description, images: seo?.ogImage ? [seo.ogImage] : undefined } };
}
export default function AssessmentLayout({ children }: Readonly<{ children: ReactNode }>) { return children; }

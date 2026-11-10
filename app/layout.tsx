import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Clear Robotics | Cleaner Waterways for a Healthier Planet',
  description: 'Unmanned electric and solar-powered waterway-cleanup vessels, aquatic weed collection and smart marine operations.',
  icons: { icon: '/assets/clear-robotics-logo.png' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

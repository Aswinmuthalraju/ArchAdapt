import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'ArchAdapt AI — House plans that fit your plot and your family',
  description:
    'Describe your plot, your family and your climate. ArchAdapt AI drafts a checked floor plan and a matching 3D model, then reshapes both as you ask for changes.',
  keywords: [
    'house plan generator',
    'floor plan AI',
    'Kerala house plans',
    '3D house model',
    'plot planning',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Lets CSS hold intro states before hydration, so animated elements never flash. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="font-sans bg-ivory text-ink antialiased"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}

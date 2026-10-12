import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Todo Matrix | Hierarchical Tasks & 3D Sanctum',
  description:
    'A high-performance Todo List application with nested task hierarchies, real-time progress calculations, Supabase PostgreSQL RLS security, and an interactive 3D productivity sanctum.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}

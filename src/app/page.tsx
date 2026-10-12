import Link from 'next/link';
import {
  CheckSquare2,
  Boxes,
  ShieldCheck,
  Trophy,
  Sparkles,
  ArrowRight,
  GitBranch,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Navigation */}
      <header className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <CheckSquare2 className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Todo Matrix</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
          >
            <span>Launch App</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive 3D Experiences & Clean Architecture</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Master Your Focus in the{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Productivity Sanctum
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          A high-performance Todo application featuring nested task hierarchies up to 5 levels,
          authoritative SQL progress rollups, multi-tenant PostgreSQL RLS policies, and a live,
          reactive 3D productivity grove.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/auth"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold transition-all"
          >
            Sign In with Supabase
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 text-left w-full">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-4">
              <GitBranch className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Hierarchical Subtasks</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Nest tasks up to depth 5 with cycle prevention, project scope inheritance, and
              instant tree reordering.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 w-fit mb-4">
              <Boxes className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Interactive 3D Sanctum</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Real-time React Three Fiber productivity crystal with orbiting task nodes,
              particle burst celebrations, and 2D eco fallback.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">PostgreSQL RLS Security</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Strict multi-tenant data boundaries enforced by composite foreign keys and
              Supabase Row Level Security policies.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-slate-800/80 px-6 flex items-center justify-center text-xs text-slate-500">
        <span>Todo Matrix • Next.js App Router Architecture</span>
      </footer>
    </div>
  );
}

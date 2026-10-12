import React from 'react';
import { Sparkles, Activity } from 'lucide-react';
import type { TaskWithProgress } from '@/types/database';

export interface SceneFallbackProps {
  tasks: TaskWithProgress[];
  completionRate: number;
  level: number;
  reason?: string;
  onSelectTask?: (taskId: string) => void;
}

export function SceneFallback({
  tasks,
  completionRate,
  level,
  reason = '3D visualization is in eco/compatibility mode',
  onSelectTask,
}: SceneFallbackProps) {
  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'canceled');

  return (
    <div
      className="relative w-full h-[320px] md:h-[400px] rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 flex flex-col justify-between overflow-hidden shadow-inner text-white select-none"
      role="region"
      aria-label="Productivity Status Overview (Fallback View)"
    >
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold tracking-tight">Productivity Sanctum</h4>
            <p className="text-xs text-slate-400">{reason}</p>
          </div>
        </div>
        <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
          Level {level} Resonance
        </div>
      </div>

      {/* Center Aura Gauge */}
      <div className="relative z-10 flex flex-col items-center justify-center my-4">
        <div className="relative flex items-center justify-center w-36 h-36 rounded-full border-4 border-indigo-500/30 bg-slate-950/60 shadow-2xl backdrop-blur-md">
          <div
            className="absolute inset-0 rounded-full border-4 border-indigo-400 transition-all duration-700"
            style={{
              clipPath: `polygon(50% 50%, 50% 0%, ${completionRate >= 25 ? '100% 0%' : '50% 0%'}, ${
                completionRate >= 50 ? '100% 100%' : '50% 0%'
              }, ${completionRate >= 75 ? '0% 100%' : '50% 0%'}, ${
                completionRate >= 100 ? '0% 0%' : '50% 0%'
              })`,
            }}
          />
          <div className="text-center">
            <span className="text-3xl font-extrabold tracking-tight text-white">
              {Math.round(completionRate)}%
            </span>
            <span className="block text-[11px] uppercase tracking-wider text-indigo-300 font-medium">
              Completion
            </span>
          </div>
        </div>
      </div>

      {/* Task Quick Navigation Chips */}
      <div className="relative z-10">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2 font-medium">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span>Active Task Focus Nodes ({activeTasks.length})</span>
        </div>
        <div className="flex flex-wrap gap-2 max-h-16 overflow-y-auto pr-1">
          {activeTasks.length === 0 ? (
            <span className="text-xs text-slate-500 italic">All tasks clear! Great job.</span>
          ) : (
            activeTasks.slice(0, 6).map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask?.(task.id)}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600/50 border border-slate-700/60 text-xs text-slate-200 transition-colors truncate max-w-[140px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                title={task.title}
              >
                {task.title}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

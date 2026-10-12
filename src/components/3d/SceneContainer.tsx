'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';
import { SceneFallback } from './SceneFallback';
import { isWebGLAvailable, prefersReducedMotion } from './webgl-check';
import { Loader2, Eye, EyeOff, RotateCcw } from 'lucide-react';
import type { TaskWithProgress } from '@/types/database';

// Dynamically import the scene composition without SSR
const ProductivityGroveScene = dynamic(
  () => import('@/scenes/ProductivityGroveScene').then((mod) => mod.ProductivityGroveScene),
  { ssr: false }
);

export interface SceneContainerProps {
  tasks: TaskWithProgress[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  completionRate: number;
  level: number;
  burstTrigger: number;
}

export function SceneContainer({
  tasks,
  selectedTaskId,
  onSelectTask,
  completionRate,
  level,
  burstTrigger,
}: SceneContainerProps) {
  const [mounted, setMounted] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [is3DEnabled, setIs3DEnabled] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHasWebGL(isWebGLAvailable());
    setReducedMotion(prefersReducedMotion());
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[320px] md:h-[400px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Graceful fallback conditions
  if (!hasWebGL || reducedMotion || hasError || !is3DEnabled) {
    let reason = 'Eco mode active (2D View)';
    if (!hasWebGL) reason = 'WebGL is not supported on this device/browser';
    if (reducedMotion) reason = 'prefers-reduced-motion is active';
    if (hasError) reason = '3D visualization encountered a renderer error';

    return (
      <div className="relative">
        <SceneFallback
          tasks={tasks}
          completionRate={completionRate}
          level={level}
          reason={reason}
          onSelectTask={onSelectTask}
        />
        {hasWebGL && !reducedMotion && (
          <button
            type="button"
            onClick={() => {
              setHasError(false);
              setIs3DEnabled(true);
            }}
            className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Enable 3D
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-[320px] md:h-[400px] rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 border border-slate-800 overflow-hidden shadow-xl">
      {/* 3D Scene Controls Overlay */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIs3DEnabled(false)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-medium backdrop-blur-md transition-colors"
          title="Switch to 2D Eco Mode"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>2D Eco</span>
        </button>
      </div>

      {/* Floating Level & Progress Pill */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-2 bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-1.5 backdrop-blur-md">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-semibold text-slate-200">Level {level} Grove</span>
        <span className="text-xs text-indigo-400 font-bold">{Math.round(completionRate)}%</span>
      </div>

      {/* Hint overlay */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-none text-[11px] text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-md backdrop-blur-sm">
        Drag to rotate • Click nodes to focus
      </div>

      {/* 3D WebGL Canvas */}
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 4, 8], fov: 45 }}
          dpr={[1, 2]} // limit pixel ratio for performance
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onError={() => setHasError(true)}
        >
          <ProductivityGroveScene
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            completionRate={completionRate}
            level={level}
            burstTrigger={burstTrigger}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}

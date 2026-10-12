'use client';

import React, { useState } from 'react';
import type { GamificationState } from '@/types/todo';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal } from '@/components/ui/Modal';
import { Trophy, Zap, Award, Sparkles, CheckCircle } from 'lucide-react';

export interface GamificationBarProps {
  state: GamificationState;
}

export function GamificationBar({ state }: GamificationBarProps) {
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);

  const unlockedCount = state.achievements.filter((a) => a.isUnlocked).length;

  return (
    <>
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-r from-indigo-50/60 via-purple-50/30 to-white dark:from-slate-900/90 dark:via-indigo-950/30 dark:to-slate-900 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Level & XP Info */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-extrabold text-lg shadow-md shadow-indigo-500/20 shrink-0">
              <span>{state.level}</span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] text-slate-950">
                ★
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Level {state.level} Focused Achiever
                </h4>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                  {state.totalXp} XP
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {state.xpForNextLevel} XP needed for Level {state.level + 1}
              </p>
            </div>
          </div>

          {/* Achievements Trigger */}
          <button
            type="button"
            onClick={() => setShowAchievementsModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Achievements ({unlockedCount}/{state.achievements.length})</span>
          </button>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-3.5 flex items-center gap-2">
          <ProgressBar
            value={state.currentLevelProgress}
            size="sm"
            showLabel={false}
          />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {state.currentLevelProgress}%
          </span>
        </div>
      </div>

      {/* Achievements Detail Modal */}
      <Modal
        isOpen={showAchievementsModal}
        onClose={() => setShowAchievementsModal(false)}
        title="Productivity Achievements"
        description="Unlocked deterministically as you complete tasks and milestones."
      >
        <div className="space-y-3 mt-2">
          {state.achievements.map((ach) => (
            <div
              key={ach.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                ach.isUnlocked
                  ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-70'
              }`}
            >
              <div className="text-2xl shrink-0 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                {ach.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {ach.title}
                  </h5>
                  {ach.isUnlocked ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Unlocked
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">
                      In Progress ({ach.progressPercent}%)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {ach.description}
                </p>

                {!ach.isUnlocked && (
                  <div className="mt-2">
                    <ProgressBar value={ach.progressPercent} size="sm" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

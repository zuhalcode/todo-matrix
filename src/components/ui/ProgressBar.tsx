import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  size = 'md',
  showLabel = false,
  className,
  ...props
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, isNaN(value) ? 0 : value));

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const getBarColor = (val: number) => {
    if (val >= 100) return 'bg-emerald-500';
    if (val >= 60) return 'bg-indigo-500';
    if (val >= 30) return 'bg-blue-500';
    return 'bg-slate-400';
  };

  return (
    <div className={cn('w-full flex items-center gap-2', className)} {...props}>
      <div
        className={cn(
          'w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden transition-all',
          heights[size]
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${clampedValue}%`}
      >
        <div
          className={cn(
            'h-full transition-all duration-300 ease-out rounded-full',
            getBarColor(clampedValue)
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 min-w-[36px] text-right">
          {clampedValue}%
        </span>
      )}
    </div>
  );
}

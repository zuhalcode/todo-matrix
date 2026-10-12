'use client';

import React, { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import { ProductivityCrystal } from '@/components/3d/ProductivityCrystal';
import { TaskNode3D } from '@/components/3d/TaskNode3D';
import { CompletionBurst3D } from '@/components/3d/CompletionBurst3D';
import type { TaskWithProgress } from '@/types/database';

export interface ProductivityGroveSceneProps {
  tasks: TaskWithProgress[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  completionRate: number;
  level: number;
  burstTrigger: number;
}

export function ProductivityGroveScene({
  tasks,
  selectedTaskId,
  onSelectTask,
  completionRate,
  level,
  burstTrigger,
}: ProductivityGroveSceneProps) {
  // Only display active (non-completed and non-canceled) tasks as interactive 3D nodes
  const activeTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'completed' && t.status !== 'canceled').slice(0, 8);
  }, [tasks]);

  // Distribute active tasks evenly around the central crystal
  const taskPositions = useMemo(() => {
    const count = activeTasks.length;
    const radius = 3.6;
    return activeTasks.map((_, index) => {
      const angle = (index / Math.max(1, count)) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.sin(index * 1.5) * 0.4;
      return [x, y, z] as [number, number, number];
    });
  }, [activeTasks]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.7} color="#e0e7ff" />
      <directionalLight position={[6, 8, 4]} intensity={1.2} color="#ffffff" />
      <pointLight position={[0, 1.5, 0]} intensity={1.5} color="#818cf8" distance={8} />

      {/* Central Crystal */}
      <ProductivityCrystal progressPercentage={completionRate} level={level} />

      {/* Interactive 3D Task Nodes */}
      {activeTasks.map((task, idx) => (
        <TaskNode3D
          key={task.id}
          task={task}
          position={taskPositions[idx]}
          isSelected={task.id === selectedTaskId}
          onSelect={onSelectTask}
        />
      ))}

      {/* Completion Fireworks / Spark Burst */}
      <CompletionBurst3D triggerCount={burstTrigger} />

      {/* Camera Controls with Gentle Constraints */}
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minDistance={5}
        maxDistance={12}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
        dampingFactor={0.05}
        autoRotate={false}
      />
    </>
  );
}

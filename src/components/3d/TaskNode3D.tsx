'use client';

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import type { TaskWithProgress } from '@/types/database';

interface TaskNode3DProps {
  task: TaskWithProgress;
  position: [number, number, number];
  isSelected: boolean;
  onSelect: (taskId: string) => void;
}

export function TaskNode3D({ task, position, isSelected, onSelect }: TaskNode3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Priority-based node color
  const priorityColors = {
    low: '#10b981',      // Emerald
    medium: '#3b82f6',   // Blue
    high: '#f59e0b',     // Amber
    urgent: '#ef4444',   // Rose
  };
  const baseColor = priorityColors[task.priority] || '#3b82f6';

  // Float animation using sine wave offset
  const floatOffset = useRef(Math.random() * Math.PI * 2);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Rotation
      meshRef.current.rotation.y += delta * (hovered ? 1.5 : 0.6);
      meshRef.current.rotation.x += delta * 0.3;

      // Vertical float
      const elapsed = state.clock.getElapsedTime();
      meshRef.current.position.y =
        position[1] + Math.sin(elapsed * 1.5 + floatOffset.current) * 0.2;
    }
  });

  const nodeScale = isSelected ? 0.7 : hovered ? 0.65 : 0.5;

  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh
        ref={meshRef}
        scale={nodeScale}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(task.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <dodecahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={hovered || isSelected ? 0.8 : 0.3}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Accessible 3D floating tag when hovered or selected */}
      {(hovered || isSelected) && (
        <Html position={[0, 0.9, 0]} center distanceFactor={12}>
          <div className="pointer-events-none rounded-lg bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 text-xs text-white shadow-xl backdrop-blur-md whitespace-nowrap select-none flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{ backgroundColor: baseColor }}
            />
            <span className="font-semibold max-w-[120px] truncate">{task.title}</span>
            <span className="text-[10px] text-slate-400 capitalize">({task.priority})</span>
          </div>
        </Html>
      )}
    </group>
  );
}

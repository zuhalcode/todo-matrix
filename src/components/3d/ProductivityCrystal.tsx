'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';

interface ProductivityCrystalProps {
  progressPercentage: number;
  level: number;
}

export function ProductivityCrystal({ progressPercentage, level }: ProductivityCrystalProps) {
  const crystalRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Derive color based on level & progress:
  // Base blue -> purple -> gold as level increases
  const baseColors = [
    '#6366f1', // Level 1: Indigo
    '#8b5cf6', // Level 2: Purple
    '#ec4899', // Level 3: Pink
    '#f59e0b', // Level 4: Amber
    '#10b981', // Level 5+: Emerald
  ];
  const crystalColor = baseColors[Math.min(level - 1, baseColors.length - 1)];

  // Scale slightly based on progress percentage
  const scale = 1.0 + (progressPercentage / 100) * 0.35;

  useFrame((_, delta) => {
    if (crystalRef.current) {
      crystalRef.current.rotation.y += delta * 0.4;
      crystalRef.current.rotation.x += delta * 0.2;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 0.5;
      ringRef.current.rotation.x += delta * 0.15;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Central Faceted Crystal */}
      <mesh ref={crystalRef} scale={[scale, scale * 1.3, scale]}>
        <octahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial
          color={crystalColor}
          emissive={crystalColor}
          emissiveIntensity={0.35 + (progressPercentage / 100) * 0.4}
          roughness={0.2}
          metalness={0.7}
          wireframe={false}
        />
      </mesh>

      {/* Orbiting Energy Ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.2, 0.04, 16, 64]} />
        <meshStandardMaterial
          color="#a5b4fc"
          emissive="#6366f1"
          emissiveIntensity={0.6}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Floating Base Platform */}
      <mesh position={[0, -2.2, 0]}>
        <cylinderGeometry args={[2.8, 3.2, 0.4, 32]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.6}
          metalness={0.4}
        />
      </mesh>
    </group>
  );
}

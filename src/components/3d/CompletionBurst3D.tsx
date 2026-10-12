'use client';

import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CompletionBurst3DProps {
  triggerCount: number; // incremented whenever a task is completed
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  scale: number;
}

export function CompletionBurst3D({ triggerCount }: CompletionBurst3DProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lifeRef = useRef<number>(0);

  const colors = [
    new THREE.Color('#38bdf8'),
    new THREE.Color('#818cf8'),
    new THREE.Color('#fbbf24'),
    new THREE.Color('#34d399'),
    new THREE.Color('#f472b6'),
  ];

  // Spawn new particles on triggerCount change
  useEffect(() => {
    if (triggerCount <= 0) return;

    const count = 45;
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 2.0 + Math.random() * 3.5;

      const vx = speed * Math.sin(phi) * Math.cos(angle);
      const vy = (speed * 0.8 + Math.random() * 2.0) * Math.cos(phi);
      const vz = speed * Math.sin(phi) * Math.sin(angle);

      newParticles.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(vx, Math.abs(vy) + 1.0, vz),
        color: colors[Math.floor(Math.random() * colors.length)],
        scale: 0.15 + Math.random() * 0.15,
      });
    }

    particlesRef.current = newParticles;
    lifeRef.current = 1.6; // 1.6 seconds duration
  }, [triggerCount]);

  useFrame((_, delta) => {
    if (lifeRef.current <= 0 || !pointsRef.current) return;

    lifeRef.current -= delta;
    const geom = pointsRef.current.geometry;
    const positions = geom.attributes.position.array as Float32Array;

    particlesRef.current.forEach((p, idx) => {
      // Apply gravity and velocity
      p.velocity.y -= delta * 2.8;
      p.position.addScaledVector(p.velocity, delta);

      const baseIdx = idx * 3;
      positions[baseIdx] = p.position.x;
      positions[baseIdx + 1] = p.position.y;
      positions[baseIdx + 2] = p.position.z;
    });

    geom.attributes.position.needsUpdate = true;
  });

  const particleCount = 45;
  const initialPositions = new Float32Array(particleCount * 3);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={initialPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.16}
        color="#fef08a"
        transparent
        opacity={Math.max(0, lifeRef.current / 1.6)}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

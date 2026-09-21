import React, { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Stats,
  PointerLockControls,
} from '@react-three/drei';
import { BuildingRenderer } from './BuildingRenderer';
import { SelectionSystem } from './SelectionSystem';
import { useUIStore } from '../../store/uiStore';

// Suppress THREE.Clock deprecation warning emitted by R3F internal state initializer
if (typeof window !== 'undefined') {
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.Clock: This module has been deprecated')) {
      return;
    }
    origWarn(...args);
  };
}

const WalkthroughCameraControls: React.FC = () => {
  const { camera } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });

  useEffect(() => {
    // Position camera at comfortable eye-level height inside/near the house
    camera.position.set(3, 1.65, 3);

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = true;
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = false;
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [camera]);

  useFrame((_, delta) => {
    const speed = 7.0 * delta; // 7 meters per second
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0; // Lock movement on horizontal plane
    dir.normalize();

    const sideDir = new THREE.Vector3(-dir.z, 0, dir.x);

    if (moveState.current.forward) {
      camera.position.addScaledVector(dir, speed);
    }
    if (moveState.current.backward) {
      camera.position.addScaledVector(dir, -speed);
    }
    if (moveState.current.left) {
      camera.position.addScaledVector(sideDir, -speed);
    }
    if (moveState.current.right) {
      camera.position.addScaledVector(sideDir, speed);
    }
  });

  return <PointerLockControls />;
};

export const SceneCanvas: React.FC = () => {
  const { cameraMode, showStats, showGrid } = useUIStore();

  return (
    <div style={{ flexGrow: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [15, 15, 15], fov: 45 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFShadowMap;

          // Prevent WebGL context loss crashes
          const canvasEl = gl.domElement;
          const handleContextLost = (event: Event) => {
            event.preventDefault();
            console.warn('WebGL Context Lost — preventing crash and waiting for restore.');
          };
          const handleContextRestored = () => {
            console.log('WebGL Context Restored.');
          };

          canvasEl.addEventListener('webglcontextlost', handleContextLost, false);
          canvasEl.addEventListener('webglcontextrestored', handleContextRestored, false);
        }}
      >
        <color attach="background" args={['#0f1117']} />

        {/* ── Rich Multi-directional Lighting ── */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[15, 25, 12]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={200}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
        />
        <directionalLight position={[-15, 15, -12]} intensity={0.5} />
        <hemisphereLight args={['#818cf8', '#1e293b', 0.5]} />

        {/* ── Reference grid ───────────────────────────────────────── */}
        {showGrid && (
          <Grid
            args={[60, 60]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#2d3148"
            sectionSize={5}
            sectionColor="#4f46e5"
            sectionThickness={1.2}
            fadeDistance={60}
            position={[0, -0.01, 0]}
          />
        )}

        {/* ── Camera controls ───────────────────────────────────────── */}
        {cameraMode === 'orbit' && (
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.06}
            minDistance={2}
            maxDistance={120}
          />
        )}
        {cameraMode === 'topdown' && (
          <OrbitControls
            makeDefault
            target={[0, 0, 0]}
            enableRotate={false}
            minPolarAngle={0}
            maxPolarAngle={0.001}
          />
        )}
        {cameraMode === 'walkthrough' && <WalkthroughCameraControls />}

        {/* ── HUD overlays ──────────────────────────────────────────── */}
        <GizmoHelper alignment="bottom-right" margin={[88, 88]}>
          <GizmoViewport
            axisColors={['#ef4444', '#22c55e', '#3b82f6']}
            labelColor="white"
          />
        </GizmoHelper>

        {showStats && <Stats />}

        {/* ── Scene content ─────────────────────────────────────────── */}
        <Suspense fallback={null}>
          <BuildingRenderer />
          <SelectionSystem />
        </Suspense>
      </Canvas>
    </div>
  );
};

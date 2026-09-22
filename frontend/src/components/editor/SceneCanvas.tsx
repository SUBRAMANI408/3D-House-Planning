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
  const { camera, gl } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });
  const isLocked = useRef(false);

  useEffect(() => {
    // Start camera at eye-level near the building entrance
    camera.position.set(5, 1.65, -2);
    camera.lookAt(5, 1.65, 5);

    const onKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    moveState.current.forward  = true;  break;
        case 'KeyS': case 'ArrowDown':  moveState.current.backward = true;  break;
        case 'KeyA': case 'ArrowLeft':  moveState.current.left     = true;  break;
        case 'KeyD': case 'ArrowRight': moveState.current.right    = true;  break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    moveState.current.forward  = false; break;
        case 'KeyS': case 'ArrowDown':  moveState.current.backward = false; break;
        case 'KeyA': case 'ArrowLeft':  moveState.current.left     = false; break;
        case 'KeyD': case 'ArrowRight': moveState.current.right    = false; break;
      }
    };

    const onLockChange = () => {
      isLocked.current = document.pointerLockElement === gl.domElement;
    };

    // Use document so events fire even when pointer is locked inside the canvas
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onLockChange);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onLockChange);
      // Clear all movement on unmount
      moveState.current = { forward: false, backward: false, left: false, right: false };
    };
  }, [camera, gl]);

  useFrame((state, delta) => {
    const ms = moveState.current;
    if (!ms.forward && !ms.backward && !ms.left && !ms.right) return;

    const activeCam = state.camera;
    const speed = 5.0 * delta; // 5 m/s — comfortable walking pace
    const dir = new THREE.Vector3();
    activeCam.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    // Right vector = cross(dir, up)
    const right = new THREE.Vector3();
    right.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

    if (ms.forward)  activeCam.position.addScaledVector(dir,   speed);
    if (ms.backward) activeCam.position.addScaledVector(dir,  -speed);
    if (ms.right)    activeCam.position.addScaledVector(right, speed);
    if (ms.left)     activeCam.position.addScaledVector(right, -speed);

    // Keep camera at eye level — don't drift vertically
    activeCam.position.y = 1.65;
  });

  return (
    <PointerLockControls
      selector="#scene-canvas-container"
    />
  );
};

export const SceneCanvas: React.FC = () => {
  const { cameraMode, showStats, showGrid } = useUIStore();

  return (
    <div id="scene-canvas-container" style={{ flexGrow: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
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

import React, { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useBuildingStore } from '../../store/buildingStore';
import type { Building } from '../../schema/building.types';

export const SelectionSystem: React.FC = () => {
  const { scene, gl } = useThree();
  const { selectedObjectId, selectedObjectType, updateBuilding, selectObject } = useBuildingStore();
  const [selectedMesh, setSelectedMesh] = useState<THREE.Object3D | null>(null);
  const [transformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');

  useEffect(() => {
    if (!selectedObjectId) {
      setSelectedMesh(null);
      return;
    }
    let found = false;
    scene.traverse((child) => {
      if (child.name === selectedObjectId && !found) {
        setSelectedMesh(child);
        found = true;
      }
    });
    if (!found) setSelectedMesh(null);
  }, [selectedObjectId, scene]);

  // Deselect on background click
  useEffect(() => {
    const handlePointerDown = (_e: PointerEvent) => {
      // TransformControls handles stopPropagation; canvas onClick handles deselect
    };
    gl.domElement.addEventListener('pointerdown', handlePointerDown);
    return () => gl.domElement.removeEventListener('pointerdown', handlePointerDown);
  }, [gl, selectObject]);

  if (!selectedMesh || selectedObjectType !== 'furniture') return null;

  const handleTransformEnd = () => {
    if (!selectedMesh || !selectedObjectId) return;
    const newPos: [number, number, number] = [
      selectedMesh.position.x,
      selectedMesh.position.y,
      selectedMesh.position.z,
    ];
    const newRotY = selectedMesh.rotation.y;
    updateBuilding((b: Building): Building => ({
      ...b,
      floors: b.floors.map((floor) => ({
        ...floor,
        rooms: floor.rooms.map((room) => ({
          ...room,
          furniture: room.furniture.map((f) =>
            f.id === selectedObjectId
              ? { ...f, position: newPos, rotation: [0, newRotY, 0] as [number, number, number] }
              : f
          ),
        })),
      })),
    }));
  };

  return (
    <TransformControls
      object={selectedMesh}
      mode={transformMode}
      onMouseUp={handleTransformEnd}
    />
  );
};

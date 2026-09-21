import { create } from 'zustand';
import type { Building } from '../schema/building.types';

export interface ValidationError {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  objectId?: string;
  floorIndex?: number;
  suggestedFix?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
}

interface BuildingState {
  building: Building | null;
  activeFloorIndex: number;
  selectedObjectId: string | null;
  selectedObjectType: 'room' | 'wall' | 'door' | 'window' | 'furniture' | 'staircase' | null;
  undoStack: Building[];
  redoStack: Building[];
  isDirty: boolean;
  isSaving: boolean;
  validationResult: ValidationResult | null;

  setBuilding: (building: Building) => void;
  updateBuilding: (updater: (b: Building) => Building) => void;
  selectObject: (id: string | null, type: 'room' | 'wall' | 'door' | 'window' | 'furniture' | 'staircase' | null) => void;
  setActiveFloor: (index: number) => void;
  undo: () => void;
  redo: () => void;
  setValidationResult: (result: ValidationResult | null) => void;
  setIsSaving: (val: boolean) => void;
  markClean: () => void;
  toggleObjectVisibility: (objectId: string, objectType: string) => void;
  deleteSelectedObject: () => void;
}

const MAX_UNDO_STACK = 50;

export const useBuildingStore = create<BuildingState>((set) => ({
  building: null,
  activeFloorIndex: 0,
  selectedObjectId: null,
  selectedObjectType: null,
  undoStack: [],
  redoStack: [],
  isDirty: false,
  isSaving: false,
  validationResult: null,

  setBuilding: (building: Building) => set({
    building,
    undoStack: [],
    redoStack: [],
    isDirty: false
  }),

  updateBuilding: (updater: (b: Building) => Building) => set((state) => {
    if (!state.building) return state;
    const currentBuilding = state.building;
    const updatedBuilding = updater(currentBuilding);
    const newUndoStack = [...state.undoStack, currentBuilding].slice(-MAX_UNDO_STACK);
    
    return {
      building: updatedBuilding,
      undoStack: newUndoStack,
      redoStack: [],
      isDirty: true
    };
  }),

  selectObject: (id, type) => set({
    selectedObjectId: id,
    selectedObjectType: type
  }),

  setActiveFloor: (index) => set({
    activeFloorIndex: index
  }),

  undo: () => set((state) => {
    if (state.undoStack.length === 0 || !state.building) return state;
    
    const previousBuilding = state.undoStack[state.undoStack.length - 1];
    const newUndoStack = state.undoStack.slice(0, -1);
    const newRedoStack = [...state.redoStack, state.building];
    
    return {
      building: previousBuilding,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      isDirty: true
    };
  }),

  redo: () => set((state) => {
    if (state.redoStack.length === 0 || !state.building) return state;
    
    const nextBuilding = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);
    const newUndoStack = [...state.undoStack, state.building].slice(-MAX_UNDO_STACK);
    
    return {
      building: nextBuilding,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      isDirty: true
    };
  }),

  setValidationResult: (result) => set({
    validationResult: result
  }),

  setIsSaving: (val) => set({
    isSaving: val
  }),

  markClean: () => set({
    isDirty: false
  }),

  toggleObjectVisibility: (objectId, objectType) => set((state) => {
    if (!state.building) return state;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toggleVisibility = (obj: any) => {
      if (obj.id === objectId) {
        return { ...obj, visible: obj.visible !== undefined ? !obj.visible : false };
      }
      return obj;
    };

    const currentBuilding = state.building;
    const newBuilding = {
      ...currentBuilding,
      floors: currentBuilding.floors.map(floor => ({
        ...floor,
        rooms: floor.rooms.map(room => {
          if (objectType === 'room') return toggleVisibility(room);
          return {
            ...room,
            furniture: room.furniture.map(f => objectType === 'furniture' ? toggleVisibility(f) : f)
          };
        }),
        walls: floor.walls.map(wall => objectType === 'wall' ? toggleVisibility(wall) : wall),
        doors: floor.doors.map(door => objectType === 'door' ? toggleVisibility(door) : door),
        windows: floor.windows.map(window => objectType === 'window' ? toggleVisibility(window) : window),
        staircases: floor.staircases.map(staircase => objectType === 'staircase' ? toggleVisibility(staircase) : staircase)
      }))
    };

    const newUndoStack = [...state.undoStack, currentBuilding].slice(-MAX_UNDO_STACK);

    return {
      building: newBuilding as Building,
      undoStack: newUndoStack,
      redoStack: [],
      isDirty: true
    };
  }),

  deleteSelectedObject: () => set((state) => {
    const { building, selectedObjectId, selectedObjectType } = state;
    if (!building || !selectedObjectId || !selectedObjectType) return state;

    const newBuilding: Building = {
      ...building,
      floors: building.floors.map(floor => {
        if (selectedObjectType === 'room') {
          const deletedRoom = floor.rooms.find(r => r.id === selectedObjectId);
          const remainingRooms = floor.rooms.filter(r => r.id !== selectedObjectId)
            .map(r => ({
              ...r,
              connections: (r.connections || []).filter(c => c.toRoomId !== selectedObjectId)
            }));

          // Find walls referenced by remaining rooms
          const usedWallIds = new Set(remainingRooms.flatMap(r => r.wallIds || []));
          // Remove walls that belonged to deleted room and are no longer used by any room
          const remainingWalls = deletedRoom 
            ? floor.walls.filter(w => !deletedRoom.wallIds.includes(w.id) || usedWallIds.has(w.id))
            : floor.walls;

          const remainingWallIds = new Set(remainingWalls.map(w => w.id));
          const remainingDoors = floor.doors.filter(d => remainingWallIds.has(d.wallId));
          const remainingWindows = floor.windows.filter(w => remainingWallIds.has(w.wallId));

          return {
            ...floor,
            rooms: remainingRooms,
            walls: remainingWalls,
            doors: remainingDoors,
            windows: remainingWindows
          };
        } else if (selectedObjectType === 'wall') {
          const remainingWalls = floor.walls.filter(w => w.id !== selectedObjectId);
          const remainingDoors = floor.doors.filter(d => d.wallId !== selectedObjectId);
          const remainingWindows = floor.windows.filter(w => w.wallId !== selectedObjectId);
          const updatedRooms = floor.rooms.map(r => ({
            ...r,
            wallIds: (r.wallIds || []).filter(wId => wId !== selectedObjectId)
          }));

          return {
            ...floor,
            rooms: updatedRooms,
            walls: remainingWalls,
            doors: remainingDoors,
            windows: remainingWindows
          };
        } else if (selectedObjectType === 'door') {
          return { ...floor, doors: floor.doors.filter(d => d.id !== selectedObjectId) };
        } else if (selectedObjectType === 'window') {
          return { ...floor, windows: floor.windows.filter(w => w.id !== selectedObjectId) };
        } else if (selectedObjectType === 'furniture') {
          return {
            ...floor,
            rooms: floor.rooms.map(r => ({
              ...r,
              furniture: r.furniture.filter(f => f.id !== selectedObjectId)
            }))
          };
        } else if (selectedObjectType === 'staircase') {
          return { ...floor, staircases: floor.staircases.filter(s => s.id !== selectedObjectId) };
        }

        return floor;
      })
    };

    const newUndoStack = [...state.undoStack, building].slice(-MAX_UNDO_STACK);

    return {
      building: newBuilding,
      selectedObjectId: null,
      selectedObjectType: null,
      undoStack: newUndoStack,
      redoStack: [],
      isDirty: true
    };
  }),
}));

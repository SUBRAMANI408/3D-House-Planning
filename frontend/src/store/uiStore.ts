import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface UIState {
  cameraMode: 'orbit' | 'walkthrough' | 'topdown';
  showGrid: boolean;
  showStats: boolean;
  isValidationPanelOpen: boolean;
  isPropertiesPanelOpen: boolean;
  isLayerPanelOpen: boolean;
  activeModal: string | null;
  toasts: Toast[];
  isLoading: boolean;
  loadingMessage: string;
  layerVisibility: {
    walls: boolean;
    furniture: boolean;
    roof: boolean;
    windows: boolean;
    doors: boolean;
  };

  setCameraMode: (mode: 'orbit' | 'walkthrough' | 'topdown') => void;
  toggleGrid: () => void;
  toggleStats: () => void;
  openModal: (name: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setLoading: (isLoading: boolean, message?: string) => void;
  toggleLayer: (layer: keyof UIState['layerVisibility']) => void;
  toggleValidationPanel: () => void;
  togglePropertiesPanel: () => void;
  toggleLayerPanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  cameraMode: 'orbit',
  showGrid: true,
  showStats: false,
  isValidationPanelOpen: false,
  isPropertiesPanelOpen: false,
  isLayerPanelOpen: false,
  activeModal: null,
  toasts: [],
  isLoading: false,
  loadingMessage: '',
  layerVisibility: {
    walls: true,
    furniture: true,
    roof: true,
    windows: true,
    doors: true
  },

  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleStats: () => set((state) => ({ showStats: !state.showStats })),
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
  
  addToast: (toast) => set((state) => {
    const id = Math.random().toString(36).substring(2, 9);
    return { toasts: [...state.toasts, { ...toast, id }] };
  }),
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  })),
  
  setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),
  
  toggleLayer: (layer) => set((state) => ({
    layerVisibility: {
      ...state.layerVisibility,
      [layer]: !state.layerVisibility[layer]
    }
  })),

  toggleValidationPanel: () => set((state) => ({ isValidationPanelOpen: !state.isValidationPanelOpen })),
  togglePropertiesPanel: () => set((state) => ({ isPropertiesPanelOpen: !state.isPropertiesPanelOpen })),
  toggleLayerPanel: () => set((state) => ({ isLayerPanelOpen: !state.isLayerPanelOpen }))
}));

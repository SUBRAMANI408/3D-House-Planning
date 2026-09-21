import { create } from 'zustand';
import type { BuildingType } from '../schema/building.types';

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  buildingType: BuildingType;
  floorsCount: number;
  tags: string[];
  thumbnailUrl?: string;
  isPublic: boolean;
}

interface TemplateState {
  templates: TemplateSummary[];
  isLoading: boolean;
  error: string | null;
  filters: { type?: BuildingType; floors?: number; search?: string };

  setTemplates: (templates: TemplateSummary[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setFilter: <K extends keyof TemplateState['filters']>(key: K, value: TemplateState['filters'][K]) => void;
  clearFilters: () => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  isLoading: false,
  error: null,
  filters: {},

  setTemplates: (templates) => set({ templates }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  setFilter: (key, value) => set((state) => ({
    filters: {
      ...state.filters,
      [key]: value
    }
  })),

  clearFilters: () => set({ filters: {} })
}));

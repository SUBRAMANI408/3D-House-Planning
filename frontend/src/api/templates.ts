import { apiClient } from './client';
import type { Building } from '../schema/building.types';

export interface TemplateSummary { id: string; name: string; description: string; buildingType: string; floorsCount: number; tags: string[]; thumbnailUrl?: string; isPublic: boolean; }
export interface TemplateDetail extends TemplateSummary { buildingJson: Building; }
export interface TemplateFilters { type?: string; floors?: number; search?: string; skip?: number; limit?: number; }

export async function listTemplates(filters?: TemplateFilters): Promise<TemplateSummary[]> {
  const response = await apiClient.get<TemplateSummary[]>('/templates', { params: filters });
  return response.data;
}

export async function getTemplate(id: string): Promise<TemplateDetail> {
  const response = await apiClient.get<TemplateDetail>(`/templates/${id}`);
  return response.data;
}

export async function createTemplate(data: { projectId?: string; buildingJson?: Building; name: string; description?: string; tags?: string[]; isPublic?: boolean; }): Promise<TemplateSummary> {
  const response = await apiClient.post<TemplateSummary>('/templates', data);
  return response.data;
}

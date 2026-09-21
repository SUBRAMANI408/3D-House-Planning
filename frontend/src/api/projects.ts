import { apiClient } from './client';
import type { Building } from '../schema/building.types';
import type { ValidationResult } from '../store/buildingStore';

export interface ProjectSummary { id: string; name: string; buildingType: string; floorsCount: number; updatedAt: string; }
export interface ProjectDetail extends ProjectSummary { buildingJson: Building; version: number; }
export interface CreateProjectRequest { name: string; buildingJson?: Building; templateId?: string; }
export interface UpdateProjectRequest { name?: string; buildingJson?: Building; }

export async function listProjects(): Promise<ProjectSummary[]> {
  const response = await apiClient.get<ProjectSummary[]>('/projects');
  return response.data;
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const response = await apiClient.get<ProjectDetail>(`/projects/${id}`);
  return response.data;
}

export async function createProject(data: CreateProjectRequest): Promise<ProjectDetail> {
  const response = await apiClient.post<ProjectDetail>('/projects', data);
  return response.data;
}

export async function updateProject(id: string, data: UpdateProjectRequest): Promise<ProjectDetail> {
  const response = await apiClient.put<ProjectDetail>(`/projects/${id}`, data);
  return response.data;
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}

export async function validateProject(id: string): Promise<ValidationResult> {
  const response = await apiClient.post<ValidationResult>(`/projects/${id}/validate`);
  return response.data;
}

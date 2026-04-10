import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import type { HexData } from '@triplanetary/shared';

export interface MapSummary {
  id: string;
  name: string;
  version: string;
  isCanonical: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MapDetail extends MapSummary {
  data: HexData;
}

export function useMaps() {
  return useQuery<MapSummary[]>({
    queryKey: ['maps'],
    queryFn: () => apiRequest('/maps'),
  });
}

export function useMap(id: string | null) {
  return useQuery<MapDetail>({
    queryKey: ['maps', id],
    queryFn: () => apiRequest(`/maps/${id}`),
    enabled: id !== null,
  });
}

export function useCreateMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; version: string; data: HexData }) =>
      apiRequest<MapDetail>('/maps', { method: 'POST', body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maps'] }),
  });
}

export function useUpdateMap(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; version?: string; data?: HexData }) =>
      apiRequest<MapDetail>(`/maps/${id}`, { method: 'PUT', body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maps', id] }),
  });
}

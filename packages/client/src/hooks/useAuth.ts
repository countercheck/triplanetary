import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { AuthMeResponse } from '@triplanetary/shared';

export function useAuth() {
  return useQuery<AuthMeResponse, { status: number }>({
    queryKey: ['auth', 'me'],
    queryFn: () => apiClient.get<AuthMeResponse>('/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

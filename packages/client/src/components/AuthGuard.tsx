import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function AuthGuard({ children }: Props) {
  const { data, isLoading, error } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (error || !data) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

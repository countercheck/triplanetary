import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: ReactNode;
}

export function AdminGuard({ children }: Props) {
  const { data, isPending } = useAuth();
  if (isPending) return null;
  if (!data?.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

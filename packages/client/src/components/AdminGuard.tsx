import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: React.ReactNode;
}

export function AdminGuard({ children }: Props) {
  const { data, isPending } = useAuth();
  if (isPending) return null;
  if (!data?.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

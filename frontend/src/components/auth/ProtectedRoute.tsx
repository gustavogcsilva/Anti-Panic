import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-calm-50 px-6 text-center">
      <div className="h-12 w-12 animate-pulse rounded-full bg-calm-500/30 p-2">
        <div className="h-full w-full rounded-full bg-calm-600" />
      </div>
      <p className="mt-4 text-sm font-medium text-calm-800">
        Preparando seu espaço seguro...
      </p>
    </div>
  );
}

interface ProtectedRouteProps {
  children: ReactNode;
  requirePreferences?: boolean;
}

export function ProtectedRoute({
  children,
  requirePreferences = false,
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, hasPreferences } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requirePreferences && !hasPreferences) {
    return <Navigate to="/preferences" replace />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, hasPreferences } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to={hasPreferences ? '/' : '/preferences'} replace />;
  }

  return <>{children}</>;
}

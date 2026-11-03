import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { authService } from '../services/auth.service';

const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const isValid = await authService.verifyToken();
      setIsAuthenticated(isValid);
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white select-none">
        <div className="relative flex flex-col items-center">
          <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-2xl animate-pulse"></div>

          <div className="relative size-20 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/30 mb-6">
            <span className="material-symbols-outlined text-[42px] text-white">cloud</span>
            <div className="absolute -inset-2 border-2 border-transparent border-t-blue-400 border-r-blue-400 rounded-3xl animate-spin"></div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">FileCloud</h1>

          <div className="flex items-center gap-3 text-sm text-slate-400 mt-2">
            <div className="size-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading your workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

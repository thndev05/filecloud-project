import React, { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { userService, type UserStats } from '../services/user.service';
import { formatSize } from '../utils/format';
import { calculatePercentage } from '../utils/math';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await userService.getStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };
    loadStats();
  }, []);

  const storagePercentage = stats ? calculatePercentage(stats.usedStorage, stats.maxStorage) : 0;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      <aside className={`
        fixed left-0 top-0 z-50 flex flex-col w-64 h-screen bg-white dark:bg-[#101622] border-r border-gray-200 dark:border-[#232f48] transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo & Mobile Close Button */}
        <div className="flex items-center justify-between px-6 py-5">
          <Link to="/" onClick={onClose} className="flex items-center gap-3 hover:opacity-80 transition-opacity w-fit">
            <div className="size-10 flex items-center justify-center rounded-xl bg-primary text-white">
              <span className="material-symbols-outlined text-[28px]">cloud</span>
            </div>
            <h1 className="text-gray-900 dark:text-white text-xl font-bold tracking-tight">FileCloud</h1>
          </Link>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-3 mt-2 flex-1">
          <NavLink
            to="/"
            onClick={onClose}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            Dashboard
          </NavLink>
          <NavLink
            to="/files"
            onClick={onClose}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-[20px]">folder</span>
            My Files
          </NavLink>
          <NavLink
            to="/shared"
            onClick={onClose}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-[20px]">group</span>
            Shared with me
          </NavLink>
          <NavLink
            to="/trash"
            onClick={onClose}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
            Trash
          </NavLink>
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            Settings
          </NavLink>
        </nav>

        {/* Storage Widget */}
        <div className="p-4 m-3 mb-8 bg-gradient-to-br from-blue-50 to-white dark:from-[#1a2233] dark:to-[#1a2233] rounded-xl border border-blue-100 dark:border-[#232f48] shadow-sm dark:shadow-none transition-colors">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-gray-900 dark:text-white">Storage</span>
            <span className="text-xs font-semibold text-primary">{storagePercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-[#232f48] rounded-full h-2 mb-2 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-blue-500 h-2 rounded-full transition-all" style={{ width: `${storagePercentage}%` }}></div>
          </div>
          <p className="text-[10px] text-gray-600 dark:text-gray-400">
            {stats ? `${formatSize(stats.usedStorage)} of ${formatSize(stats.maxStorage)} used` : 'Loading...'}
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

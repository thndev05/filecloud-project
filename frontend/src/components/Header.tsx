import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarPlaceholder from './AvatarPlaceholder';
import { authService } from '../services/auth.service';
import { userService, type UserProfile } from '../services/user.service';

const Header: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const navigate = useNavigate();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await userService.getProfile();
        setProfile(data);
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };
    loadProfile();
  }, []);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-4 bg-white/80 dark:bg-[#101622]/80 backdrop-blur-md border-b border-gray-200 dark:border-[#232f48] transition-colors">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            type="text"
            className="block w-full p-2.5 pl-10 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-[#1a2233] border border-gray-200 dark:border-[#232f48] rounded-lg focus:ring-primary focus:border-primary placeholder-gray-400 dark:placeholder-gray-500 transition-all"
            placeholder="Search files and folders..."
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 ml-4">
        <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white dark:border-[#101622]"></span>
        </button>
        <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
          <span className="material-symbols-outlined">help</span>
        </button>

        {/* Avatar with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="cursor-pointer hover:scale-105 transition-transform"
          >
            <AvatarPlaceholder size="sm" avatarUrl={profile?.avatar} />
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1a2233] border border-gray-200 dark:border-[#232f48] rounded-xl shadow-lg overflow-hidden z-50">
              <div className="p-3 border-b border-gray-200 dark:border-[#232f48]">
                <p className="text-gray-900 dark:text-white font-semibold text-sm">{profile?.fullName || 'Loading...'}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{profile?.email || ''}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    navigate('/profile/edit');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#232f48] hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                  Edit Profile
                </button>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#232f48] hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                  Settings
                </button>
                <div className="border-t border-gray-200 dark:border-[#232f48] my-1"></div>
                <button
                  onClick={async () => {
                    setIsDropdownOpen(false);
                    await handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-[#232f48] hover:text-red-600 dark:hover:text-red-300 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

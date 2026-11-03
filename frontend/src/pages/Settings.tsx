import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import AvatarPlaceholder from '../components/AvatarPlaceholder';
import { userService, type UserProfile, type UserStats } from '../services/user.service';
import { formatSize } from '../utils/format';
import { calculatePercentage } from '../utils/math';
import { useTheme } from '../contexts/ThemeContext';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileData, statsData] = await Promise.all([
          userService.getProfile(),
          userService.getStats()
        ]);
        setProfile(profileData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const storagePercentage = stats ? calculatePercentage(stats.usedStorage, stats.maxStorage) : 0;

  return (
    <MainLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">Settings</h1>
          <p className="text-gray-500 dark:text-[#92a4c9] text-base font-normal leading-normal">Manage your account and preferences</p>
        </div>

        <div className="grid gap-6">
          {/* Profile Section */}
          <div className="bg-white dark:bg-[#1a2233] rounded-xl border border-gray-200 dark:border-[#232f48] p-6 transition-colors">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Profile</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                {profile?.avatar ? (
                  <img 
                    src={profile.avatar} 
                    alt={profile.fullName || 'User avatar'}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-300 dark:ring-[#232f48]"
                  />
                ) : (
                  <AvatarPlaceholder size="md" />
                )}
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white font-semibold">{loading ? 'Loading...' : profile?.fullName}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{profile?.email || ''}</p>
                </div>
                <button
                  onClick={() => navigate('/profile/edit')}
                  className="px-4 py-2 bg-gray-100 dark:bg-[#232f48] hover:bg-gray-200 dark:hover:bg-[#2d3a54] text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>

          {/* Storage Section */}
          <div className="bg-white dark:bg-[#1a2233] rounded-xl border border-gray-200 dark:border-[#232f48] p-6 transition-colors">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Storage</h3>
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Storage Used</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {loading ? 'Loading...' : `${formatSize(stats?.usedStorage || 0)} / ${formatSize(stats?.maxStorage || 0)}`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[#232f48] rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary to-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${storagePercentage}%` }}></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {storagePercentage}% used
                </p>
              </div>
              {/* <button className="w-fit px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors">
                Upgrade Storage
              </button> */}
            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white dark:bg-[#1a2233] rounded-xl border border-gray-200 dark:border-[#232f48] p-6 transition-colors">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Preferences</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Email Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive email updates about your files</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-[#232f48] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Dark Mode</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Use dark theme</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={theme === 'dark'}
                    onChange={toggleTheme}
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-[#232f48] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white dark:bg-[#1a2233] rounded-xl border border-gray-200 dark:border-[#232f48] p-6 transition-colors">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Security</h3>
            <div className="flex flex-col gap-3">
              <button className="flex items-center justify-between p-3 bg-gray-100 dark:bg-[#232f48] hover:bg-gray-200 dark:hover:bg-[#2d3a54] rounded-lg transition-colors">
                <span className="text-gray-900 dark:text-white text-sm font-medium">Change Password</span>
                <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">chevron_right</span>
              </button>
              <button className="flex items-center justify-between p-3 bg-gray-100 dark:bg-[#232f48] hover:bg-gray-200 dark:hover:bg-[#2d3a54] rounded-lg transition-colors">
                <span className="text-gray-900 dark:text-white text-sm font-medium">Two-Factor Authentication</span>
                <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;

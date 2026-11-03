import React from 'react';

interface AvatarPlaceholderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  avatarUrl?: string | null;
}

const AvatarPlaceholder: React.FC<AvatarPlaceholderProps> = ({ size = 'md', avatarUrl }) => {
  const sizeClasses = {
    sm: 'size-9',
    md: 'size-16',
    lg: 'size-24',
    xl: 'size-32',
  };

  const iconSizes = {
    sm: 'text-[36px]',
    md: 'text-[64px]',
    lg: 'text-[96px]',
    xl: 'text-[128px]',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-tr from-primary to-purple-500 p-[2px] shadow-sm`}>
      <div className="size-full rounded-full bg-gray-100 dark:bg-[#101622] flex items-center justify-center overflow-hidden transition-colors">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
        ) : (
          <span className={`material-symbols-outlined ${iconSizes[size]} text-gray-400 dark:text-gray-500`}>account_circle</span>
        )}
      </div>
    </div>
  );
};

export default AvatarPlaceholder;

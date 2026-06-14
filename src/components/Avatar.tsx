import React from 'react';

interface AvatarProps {
  name?: string;
  profileImage?: string | null;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, profileImage, className = 'w-8.5 h-8.5 text-xs' }) => {
  if (profileImage) {
    // Extract width/height classes to apply to the img tag cleanly, ensuring rounded-xl and object-cover are enforced.
    const dimensions = className
      .split(' ')
      .filter(c => c.startsWith('w-') || c.startsWith('h-') || c.startsWith('shrink-'))
      .join(' ');
      
    return (
      <img
        src={profileImage}
        className={`${dimensions} rounded-xl object-cover shrink-0`}
        alt=""
        onError={(e) => {
          // Fallback if image load fails
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  // Extract family name (성) or first letter
  const displayName = name ? name.trim() : '';
  const initial = displayName 
    ? (displayName.length >= 2 && displayName.charCodeAt(0) >= 0xac00 && displayName.charCodeAt(0) <= 0xd7a3
      ? displayName.charAt(0) // Korean family name (성)
      : displayName.charAt(0)) // English initial
    : '👤';

  // Seeded color palettes for harmonized aesthetics
  const colors = [
    'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
    'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
    'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400'
  ];

  // Deterministic color assignment based on name string hash
  const nameHash = displayName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const colorClass = colors[nameHash % colors.length];

  return (
    <div className={`${className} rounded-xl flex items-center justify-center font-extrabold select-none shrink-0 ${colorClass}`}>
      {initial}
    </div>
  );
};

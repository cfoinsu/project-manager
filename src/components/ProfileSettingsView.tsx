import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  User as UserIcon, 
  Lock, 
  Check 
} from 'lucide-react';

export const ProfileSettingsView: React.FC = () => {
  const { user, updateUserProfile, error: authError } = useAuthStore();

  // Profile states
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileImage, setProfileImage] = useState<string | null>(user?.profile_image || null);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const profileImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || '');
      setProfileEmail(user.email || '');
      setProfileImage(user.profile_image || null);
    }
  }, [user]);

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('프로필 이미지는 1MB 이하여야 합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfileImage(ev.target?.result as string || null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProfileImage = () => {
    setProfileImage(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      alert('이름을 입력해 주세요.');
      return;
    }
    if (newPassword && newPassword !== newPasswordConfirm) {
      alert('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      alert('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setProfileSaveLoading(true);
    const success = await updateUserProfile({
      name: profileName.trim(),
      phone: profilePhone.trim() || null,
      email: profileEmail.trim() || null,
      profile_image: profileImage,
      password: newPassword || null
    });
    setProfileSaveLoading(false);

    if (success) {
      setProfileSaveSuccess(true);
      setNewPassword('');
      setNewPasswordConfirm('');
      setTimeout(() => setProfileSaveSuccess(false), 2000);
    } else {
      alert('프로필 수정 중 오류가 발생했습니다: ' + (authError || '알 수 없는 오류'));
    }
  };

  return (
    <div className="w-full flex-1 overflow-y-auto pr-1 flex flex-col gap-8 text-left select-none animate-slide-up pb-10 max-w-3xl">
      
      {/* Header */}
      <div className="flex flex-col shrink-0 gap-1">
        <span className="text-xs font-bold text-toss-blue">My Profile & Account</span>
        <h1 className="text-3xl font-extrabold text-toss-gray-900 dark:text-slate-100 tracking-tight">개인 프로필 설정</h1>
      </div>

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-6 animate-scale-in">
        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col gap-6">
          
          {/* 프로필 이미지 업로더 */}
          <div className="flex items-center gap-5">
            <div
              className="w-20 h-20 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden cursor-pointer relative group"
              onClick={() => profileImageInputRef.current?.click()}
              title="프로필 사진 변경"
            >
              {profileImage ? (
                <img src={profileImage} alt="profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-10 h-10 text-slate-350" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold">
                변경
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-250">프로필 사진</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => profileImageInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-250/20 transition-all cursor-pointer"
                >
                  사진 선택
                </button>
                {profileImage && (
                  <button
                    type="button"
                    onClick={handleRemoveProfileImage}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-500 text-xs font-bold transition-all cursor-pointer"
                  >
                    삭제
                  </button>
                )}
              </div>
              <input
                ref={profileImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleProfileImageUpload}
              />
              <span className="text-[10px] text-slate-400">최대 1MB 크기의 이미지 (PNG/JPG/WEBP)</span>
            </div>
          </div>

          <hr className="border-t border-slate-100 dark:border-slate-800/80" />

          {/* 인적 사항 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-450 dark:text-slate-400">아이디</label>
              <input
                type="text"
                disabled
                value={user?.username || ''}
                className="toss-input bg-slate-50 dark:bg-slate-950/30 text-slate-400 cursor-not-allowed font-extrabold text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-450 dark:text-slate-400">역할 (권한)</label>
              <input
                type="text"
                disabled
                value={user?.role === 'admin' ? '최고 관리자' : user?.role === 'manager' ? '프로젝트 매니저' : '일반 개발원'}
                className="toss-input bg-slate-50 dark:bg-slate-950/30 text-slate-400 cursor-not-allowed font-extrabold text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-455 dark:text-slate-450">이름 *</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                className="toss-input text-xs font-bold"
                placeholder="본인의 이름을 입력하세요"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-455 dark:text-slate-450">연락처</label>
              <input
                type="text"
                value={profilePhone}
                onChange={e => setProfilePhone(e.target.value)}
                className="toss-input text-xs font-bold"
                placeholder="예: 010-1234-5678"
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-455 dark:text-slate-450">이메일 주소</label>
              <input
                type="email"
                value={profileEmail}
                onChange={e => setProfileEmail(e.target.value)}
                className="toss-input text-xs font-bold"
                placeholder="예: user@company.com"
              />
            </div>
          </div>

          <hr className="border-t border-slate-100 dark:border-slate-800/80" />

          {/* 비밀번호 변경 패널 */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-black text-toss-blue uppercase tracking-wider flex items-center gap-1.5 select-none">
              <Lock className="w-3.5 h-3.5" /> 비밀번호 변경
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-450 dark:text-slate-400">새 비밀번호 (변경할 경우만 입력)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="toss-input text-xs font-bold"
                  placeholder="최소 6자 이상 입력"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-450 dark:text-slate-400">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={e => setNewPasswordConfirm(e.target.value)}
                  className="toss-input text-xs font-bold"
                  placeholder="새 비밀번호 다시 입력"
                />
              </div>
            </div>
          </div>

        </div>

        {/* 저장 패널 */}
        <div className="flex items-center justify-between">
          {profileSaveSuccess && (
            <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
              <Check className="w-4 h-4 animate-bounce" /> 개인 정보가 성공적으로 업데이트되었습니다.
            </span>
          )}
          <button
            type="submit"
            disabled={profileSaveLoading}
            className="px-6 py-3 bg-toss-blue hover:bg-blue-600 text-white rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer ml-auto disabled:opacity-50"
          >
            {profileSaveLoading ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              '프로필 저장'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

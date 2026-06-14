import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useBrandStore } from '../store/brandStore';
import { KeyRound, User as UserIcon, AlertCircle, ArrowRight, Laptop, Activity } from 'lucide-react';
import * as api from '../utils/api';

export const LoginView: React.FC = () => {
  const { login, registerCurrentDevice, error, loading, clearError } = useAuthStore();
  const brand = useBrandStore();
  const [adminContact, setAdminContact] = useState<{ name: string; email?: string | null; phone?: string | null } | null>(null);

  useEffect(() => {
    const fetchAdmin = async () => {
      try {
        const isServer = useAuthStore.getState().serverMode;
        const admin = await api.getAdminContact(isServer);
        if (admin) {
          setAdminContact({
            name: admin.name,
            email: admin.email,
            phone: admin.phone
          });
        }
      } catch (e) {
        console.error('Failed to fetch admin contact info:', e);
      }
    };
    fetchAdmin();
  }, []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Device registration state
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [regSuccessMessage, setRegSuccessMessage] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    const result = await login(username, password);
    if (!result.success && result.status === 'device_registration_required' && result.userId) {
      setPendingUserId(result.userId);
      setShowDeviceModal(true);
    }
  };

  const handleDemoLogin = async (demoUser: string, demoPass: string) => {
    clearError();
    setUsername(demoUser);
    setPassword(demoPass);
    const result = await login(demoUser, demoPass);
    if (!result.success && result.status === 'device_registration_required' && result.userId) {
      setPendingUserId(result.userId);
      setShowDeviceModal(true);
    }
  };

  const handleRegisterDevice = async () => {
    if (!pendingUserId) return;
    setRegLoading(true);
    const success = await registerCurrentDevice(pendingUserId);
    setRegLoading(false);
    if (success) {
      setRegSuccessMessage('현재 기기(PC)가 성공적으로 계정에 등록되었습니다. 이제 등록된 기기로 다시 로그인을 완료하실 수 있습니다.');
    } else {
      alert('기기 등록에 실패했습니다. 관리자에게 문의하세요.');
    }
  };

  const closeDeviceModal = () => {
    setShowDeviceModal(false);
    setPendingUserId(null);
    setRegSuccessMessage(null);
    clearError();
  };

  return (
    <div className="cds--login-wrapper flex items-center justify-center min-h-screen bg-slate-900/10 dark:bg-slate-950/40">
      <div className="cds--card cds--login-card relative overflow-hidden">
        
        {/* Brand Header */}
        <div className="cds--login-brand-header">
          <div
            className="cds--login-brand-logo overflow-hidden flex items-center justify-center"
            style={{ background: brand.logoDataUrl ? 'transparent' : `linear-gradient(135deg, ${brand.primaryColor}30, ${brand.primaryColor}15)` }}
          >
            {brand.logoDataUrl ? (
              <img src={brand.logoDataUrl} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <Activity className="w-8 h-8" style={{ color: brand.primaryColor }} />
            )}
          </div>
          <div>
            <h1 className="cds--login-brand-title">{brand.companyName}</h1>
            <p className="cds--login-brand-subtitle">{brand.slogan}</p>
          </div>
        </div>

        <h2 className="cds--login-title">로그인</h2>
        <p className="cds--login-subtitle">시스템을 이용하려면 계정으로 로그인해 주세요.</p>

        {error && (
          <div className="cds--login-error-container">
            <AlertCircle className="cds--login-error-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="cds--login-form">
          <div className="cds--form-group">
            <label className="cds--form-label">아이디 (또는 이메일)</label>
            <div className="cds--input-container">
              <UserIcon className="cds--input-icon" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearError();
                }}
                placeholder="아이디 또는 이메일 입력"
                className="cds--text-input cds--login-input"
              />
            </div>
          </div>

          <div className="cds--form-group">
            <label className="cds--form-label">비밀번호</label>
            <div className="cds--input-container">
              <KeyRound className="cds--input-icon" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                placeholder="비밀번호 입력"
                className="cds--text-input cds--login-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cds--btn cds--btn-primary cds--login-submit-btn cursor-pointer"
          >
            {loading ? (
              <span className="cds--loading-spinner"></span>
            ) : (
              <>
                <span>로그인하기</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Password Lost Guide */}
        <div className="text-center text-[11px] text-toss-gray-400 dark:text-slate-500 font-semibold mt-4.5 mb-1.5 select-none leading-relaxed flex flex-col gap-0.5">
          <span>🔒 비밀번호 분실 시 최고 관리 담당자에게 문의하여 초기화하시기 바랍니다.</span>
          {adminContact ? (
            <span className="text-[10px] text-toss-blue dark:text-sky-455 mt-0.5">
              [최고 관리 담당자: {adminContact.name} ({adminContact.email || '이메일 없음'}) {adminContact.phone ? '/ 연락처: ' + adminContact.phone : ''}]
            </span>
          ) : (
            <span className="text-[10px] text-toss-gray-455 dark:text-slate-500 mt-0.5">
              [최고 관리 담당자: 대표 관리자 (admin@atlas.com / 010-0000-0000)]
            </span>
          )}
        </div>

        {/* Demo Fast Login Buttons */}
        <div className="cds--demo-container">
          <p className="cds--demo-title">빠른 계정 선택 (데모 테스트용)</p>
          <div className="cds--demo-grid">
            <button
              type="button"
              onClick={() => handleDemoLogin('admin', 'admin123')}
              className="cds--demo-btn text-center cursor-pointer"
            >
              <span className="text-xs font-black text-toss-blue">Admin</span>
              <span className="text-xs text-toss-gray-455 dark:text-slate-400 font-semibold truncate w-full">최고 관리자</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('manager', 'manager123')}
              className="cds--demo-btn text-center cursor-pointer"
            >
              <span className="text-xs font-black text-toss-blue">Manager</span>
              <span className="text-xs text-toss-gray-455 dark:text-slate-400 font-semibold truncate w-full">매니저</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('member', 'member123')}
              className="cds--demo-btn text-center cursor-pointer"
            >
              <span className="text-xs font-black text-toss-blue">Member</span>
              <span className="text-xs text-toss-gray-455 dark:text-slate-400 font-semibold truncate w-full">개발원</span>
            </button>
          </div>
        </div>

      </div>

      {/* Device Registration Consent Modal */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-toss-gray-200/40 dark:border-slate-800 rounded-3xl p-6.5 max-w-md w-full shadow-toss-lg text-left select-none animate-scale-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-toss-blue/10 flex items-center justify-center">
                <Laptop className="w-5.5 h-5.5 text-toss-blue animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-100">기기 등록 및 보안 동의</h3>
                <p className="text-[10px] text-toss-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Device Authentication</p>
              </div>
            </div>

            {!regSuccessMessage ? (
              <>
                <p className="text-xs font-semibold text-toss-gray-600 dark:text-slate-300 leading-relaxed mb-6">
                  Project Atlas 보안 지침에 따라 최초 로그인 시 <strong>현재 사용 중인 PC 기기</strong>가 계정에 고유 등록됩니다.<br />
                  이후 등록되지 않은 다른 기기에서의 접근은 자동으로 차단됩니다.<br /><br />
                  현재 기기 고유 식별자 해시를 생성하여 계정에 등록하시겠습니까?
                </p>

                <div className="flex items-center gap-2.5 justify-end">
                  <button
                    onClick={closeDeviceModal}
                    className="px-4.5 py-2.5 bg-toss-gray-105 hover:bg-toss-gray-150 dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold text-toss-gray-650 dark:text-slate-350 rounded-xl cursor-pointer transition-all"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleRegisterDevice}
                    disabled={regLoading}
                    className="px-5 py-2.5 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    {regLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <span>동의 및 PC 등록</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/50 rounded-2xl p-4.5 mb-6">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 leading-relaxed">
                    {regSuccessMessage}
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={closeDeviceModal}
                    className="px-6 py-2.5 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-xl cursor-pointer transition-all"
                  >
                    확인
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ForcePasswordChangeView: React.FC = () => {
  const { changePassword, error, loading, clearError } = useAuthStore();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError(null);

    if (newPassword.length < 6) {
      setValidationError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('입력한 두 비밀번호가 일치하지 않습니다.');
      return;
    }

    const ok = await changePassword(newPassword);
    if (ok) {
      setSuccess(true);
    }
  };

  return (
    <div className="cds--login-wrapper flex items-center justify-center min-h-screen bg-slate-900/20 dark:bg-slate-950/60 backdrop-blur-md">
      <div className="cds--card cds--login-card relative overflow-hidden max-w-md w-full">
        
        {/* Brand Header */}
        <div className="cds--login-brand-header">
          <div className="cds--login-brand-logo">
            <span className="cds--login-brand-logo-text">P</span>
          </div>
          <div>
            <h1 className="cds--login-brand-title">Project Atlas</h1>
            <p className="cds--login-brand-subtitle">Security Policy</p>
          </div>
        </div>

        <h2 className="cds--login-title">비밀번호 변경 의무화</h2>
        <p className="cds--login-subtitle">
          보안 정책에 따라 임시 비밀번호 또는 최초 생성 계정은 서비스 이용을 위해 반드시 비밀번호를 재설정해야 합니다.
        </p>

        {(error || validationError) && (
          <div className="cds--login-error-container">
            <AlertCircle className="cds--login-error-icon" />
            <span>{validationError || error}</span>
          </div>
        )}

        {success ? (
          <div className="text-center py-6 select-none">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-100 mb-2">변경 완료</h3>
            <p className="text-xs text-toss-gray-500 dark:text-slate-400 font-semibold mb-6">
              비밀번호가 성공적으로 업데이트되었습니다. 이제 시스템 사용이 시작됩니다.
            </p>
            <button
              onClick={() => {
                // Relies on authStore update which forces React rerender due to user.force_password_change update.
                window.location.reload();
              }}
              className="w-full py-3 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-2xl cursor-pointer transition-all"
            >
              시스템 시작하기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="cds--login-form">
            <div className="cds--form-group">
              <label className="cds--form-label">새로운 비밀번호</label>
              <div className="cds--input-container">
                <KeyRound className="cds--input-icon" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="새 비밀번호 입력 (최소 6자)"
                  className="cds--text-input cds--login-input"
                />
              </div>
            </div>

            <div className="cds--form-group">
              <label className="cds--form-label">비밀번호 확인</label>
              <div className="cds--input-container">
                <KeyRound className="cds--input-icon" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="새 비밀번호 다시 입력"
                  className="cds--text-input cds--login-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="cds--btn cds--btn-primary cds--login-submit-btn cursor-pointer mt-4"
            >
              {loading ? (
                <span className="cds--loading-spinner"></span>
              ) : (
                <span>비밀번호 설정 및 완료</span>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

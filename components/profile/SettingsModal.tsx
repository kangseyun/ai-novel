'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  LogOut,
  CreditCard,
  FileText,
  Shield,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    // 로그아웃 로직
    localStorage.clear();
    window.location.href = '/';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex justify-center"
      >
        <div className="w-full max-w-[430px] min-h-screen relative bg-black">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-black border-b border-white/10">
            <div className="flex items-center justify-between px-4 py-3">
              <button onClick={onClose} className="p-1">
                <X className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-medium">설정</h1>
              <div className="w-8" />
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-6 space-y-6">
            {/* 결제 섹션 */}
            <div>
              <p className="text-xs text-white/40 mb-2 px-1">결제</p>
              <div className="bg-white/5 rounded-xl overflow-hidden">
                <SettingItem
                  icon={<CreditCard className="w-5 h-5 text-white/60" />}
                  label="충전 & 구독 관리"
                  onClick={() => window.location.href = '/shop'}
                />
              </div>
            </div>

            {/* 약관 섹션 */}
            <div>
              <p className="text-xs text-white/40 mb-2 px-1">약관</p>
              <div className="bg-white/5 rounded-xl overflow-hidden">
                <SettingItem
                  icon={<FileText className="w-5 h-5 text-white/60" />}
                  label="이용약관"
                  onClick={() => window.open('/terms', '_blank')}
                />
                <div className="h-px bg-white/5" />
                <SettingItem
                  icon={<Shield className="w-5 h-5 text-white/60" />}
                  label="개인정보 처리방침"
                  onClick={() => window.open('/privacy', '_blank')}
                />
              </div>
            </div>

            {/* 계정 섹션 */}
            <div>
              <p className="text-xs text-white/40 mb-2 px-1">계정</p>
              <div className="bg-white/5 rounded-xl overflow-hidden">
                <SettingItem
                  icon={<LogOut className="w-5 h-5 text-red-400" />}
                  label="로그아웃"
                  labelColor="text-red-400"
                  onClick={() => setShowLogoutConfirm(true)}
                  hideArrow
                />
              </div>
            </div>

            {/* 버전 정보 */}
            <div className="text-center pt-8">
              <p className="text-xs text-white/20">Lumina Fiction v1.0.0</p>
            </div>
          </div>
        </div>

        {/* 로그아웃 확인 모달 */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center px-6"
              onClick={() => setShowLogoutConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-[300px] bg-zinc-900 rounded-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 text-center">
                  <h3 className="text-lg font-medium text-white mb-2">로그아웃</h3>
                  <p className="text-sm text-white/50">정말 로그아웃 하시겠어요?</p>
                </div>
                <div className="flex border-t border-white/10">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-3 text-white/70 font-medium border-r border-white/10"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-3 text-red-400 font-medium"
                  >
                    로그아웃
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

function SettingItem({
  icon,
  label,
  labelColor = 'text-white',
  subLabel,
  onClick,
  hideArrow = false,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  subLabel?: React.ReactNode;
  onClick: () => void;
  hideArrow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition"
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className={`text-sm ${labelColor}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {subLabel}
        {!hideArrow && <ChevronRight className="w-4 h-4 text-white/30" />}
      </div>
    </button>
  );
}

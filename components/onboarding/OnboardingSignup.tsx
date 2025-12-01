'use client';

import { motion } from 'framer-motion';

interface OnboardingSignupProps {
  affectionGained: number;
  onSignup: () => void;
  personaName?: string;
  personaImage?: string;
  personaColor?: string;
}

export default function OnboardingSignup({
  affectionGained,
  onSignup,
  personaName = 'Jun',
  personaImage,
  personaColor = '#8B5CF6',
}: OnboardingSignupProps) {
  return (
    <div className="h-[100dvh] bg-black flex flex-col overflow-hidden">
      {/* Content */}
      <div className="flex-1 flex flex-col justify-center p-6 min-h-0">
        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <p className="text-2xl text-white font-medium mb-3">
            "{personaName}의 이야기가<br />계속됩니다"
          </p>
          <p className="text-white/40 text-sm">
            로그인하고 대화를 이어가세요
          </p>
        </motion.div>

        {/* Google Login Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <button
            onClick={onSignup}
            className="w-full py-4 bg-white text-black rounded-xl font-medium flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google로 계속하기
          </button>

          <button
            onClick={onSignup}
            className="w-full py-4 bg-white/10 text-white rounded-xl font-medium"
          >
            Apple로 계속하기
          </button>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="p-6 pb-8 shrink-0"
      >
        <p className="text-center text-xs text-white/30">
          계속하면 이용약관 및 개인정보처리방침에 동의합니다
        </p>
      </motion.div>
    </div>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  Wifi, 
  Battery, 
  Signal, 
  Terminal, 
  Lock, 
  X, 
  Image as ImageIcon,
  ShieldAlert,
  Phone,
  Globe,
  MessageSquare,
  Music,
  AlertTriangle,
  Settings,
  LogOut,
  Bell,
  Cpu,
  ChevronRight
} from 'lucide-react';
import { useTranslations, useLocale, useSetLocale, Locale } from '@/lib/i18n';

export default function HomeScreenSimulation() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <HomeScreenContent />
    </Suspense>
  );
}

function HomeScreenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeApp, setActiveApp] = useState<'phantom' | 'photos' | 'settings' | null>(null);
  const [isGalleryUnlocked, setIsGalleryUnlocked] = useState(false);
  const [glitchMessage, setGlitchMessage] = useState<string | null>(null);
  
  // Settings Logic
  const tr = useTranslations();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [pushEnabled, setPushEnabled] = useState(false);

  // 외부(프로필 페이지)에서 설정 앱 실행 요청 감지
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'open_settings') {
      setTimeout(() => {
        setActiveApp('settings');
      }, 500);
    }
  }, [searchParams]);

  const handlePhantomClick = () => {
    setActiveApp('phantom');
    setTimeout(() => {
      router.push('/');
    }, 1500);
  };

  const handlePhotosClick = () => {
    setActiveApp('photos');
    setTimeout(() => {
      setIsGalleryUnlocked(true);
    }, 1500);
  };

  const handleSettingsClick = () => {
    setActiveApp('settings');
  };

  const handleDummyAppClick = (appName: string) => {
    const messages = [
      "SYSTEM ERROR: ACCESS DENIED",
      "ENCRYPTED FILE SYSTEM",
      "MONITORING ACTIVE...",
      "DON'T LOOK HERE."
    ];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
    setGlitchMessage(`${appName}: ${randomMsg}`);
    
    setTimeout(() => {
      setGlitchMessage(null);
    }, 2000);
  };

  const closeApp = () => {
    setActiveApp(null);
    setIsGalleryUnlocked(false);
    if (searchParams.get('action') === 'open_settings') {
      router.replace('/test/home-screen');
    }
  };

  // Settings Actions
  const toggleLanguage = () => {
    setLocale(locale === 'ko' ? 'en' : 'ko');
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-black flex justify-center items-center overflow-hidden">
      <div className="w-full max-w-[430px] h-[100dvh] relative bg-cover bg-center overflow-hidden font-mono"
           style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop")' }}>
        
        {/* Status Bar */}
        <div className="absolute top-0 w-full px-6 py-3 flex justify-between items-center text-white z-20">
          <span className="text-xs font-semibold tracking-wider">09:41_AM</span>
          <div className="flex items-center gap-2">
            <Signal className="w-3 h-3 text-green-500" />
            <span className="text-[10px] text-green-500">SECURE</span>
            <Battery className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Glitch Overlay Message */}
        <AnimatePresence>
          {glitchMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-20 left-0 right-0 z-30 flex justify-center px-6"
            >
              <div className="bg-red-900/80 border border-red-500 text-red-200 text-xs font-mono py-2 px-4 rounded shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center gap-2 backdrop-blur-sm">
                <AlertTriangle className="w-4 h-4 animate-pulse" />
                {glitchMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* App Grid */}
        <div className="pt-24 px-6 grid grid-cols-4 gap-x-4 gap-y-8">
          
          {/* Phantom App */}
          <div className="flex flex-col items-center gap-2">
            <motion.button
              onClick={handlePhantomClick}
              whileTap={{ scale: 0.9 }}
              layoutId="phantom-icon"
              className="w-[60px] h-[60px] rounded-lg bg-black border border-red-500/50 flex items-center justify-center relative overflow-hidden shadow-[0_0_10px_rgba(239,68,68,0.2)] group"
            >
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
              <Terminal className="w-8 h-8 text-red-500 relative z-10 group-hover:text-red-400 transition-colors" />
            </motion.button>
            <span className="text-[10px] text-red-500/70 font-mono tracking-wider">PHANTOM</span>
          </div>

          {/* Photos App */}
          <div className="flex flex-col items-center gap-2">
            <motion.button
              onClick={handlePhotosClick}
              whileTap={{ scale: 0.9 }}
              layoutId="photos-icon"
              className="w-[60px] h-[60px] rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center relative overflow-hidden shadow-lg"
            >
              <ImageIcon className="w-7 h-7 text-white/50 relative z-10" />
            </motion.button>
            <span className="text-[10px] text-white/50 font-mono tracking-wider">MEDIA</span>
          </div>

          {/* Settings App */}
          <div className="flex flex-col items-center gap-2">
            <motion.button
              onClick={handleSettingsClick}
              whileTap={{ scale: 0.9 }}
              layoutId="settings-icon"
              className="w-[60px] h-[60px] rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center relative overflow-hidden shadow-lg"
            >
              <Settings className="w-7 h-7 text-white/50 relative z-10" />
            </motion.button>
            <span className="text-[10px] text-white/50 font-mono tracking-wider">CONFIG</span>
          </div>

        </div>

        {/* Dock */}
        <div className="absolute bottom-8 left-4 right-4 h-20 bg-black/60 border-t border-white/10 backdrop-blur-md flex items-center justify-around px-4">
          <DockIcon 
            icon={<Phone className="w-6 h-6 text-green-500/70" />} 
            onClick={() => handleDummyAppClick("VOICE_COMM")} 
          />
          <DockIcon 
            icon={<Globe className="w-6 h-6 text-blue-500/70" />} 
            onClick={() => handleDummyAppClick("NET_ACCESS")} 
          />
          <DockIcon 
            icon={<MessageSquare className="w-6 h-6 text-yellow-500/70" />} 
            onClick={() => handleDummyAppClick("MSG_Log")} 
          />
          <DockIcon 
            icon={<Music className="w-6 h-6 text-pink-500/70" />} 
            onClick={() => handleDummyAppClick("AUDIO_OUT")} 
          />
        </div>

        {/* Phantom Opening Animation */}
        <AnimatePresence>
          {activeApp === 'phantom' && (
            <motion.div
              layoutId="phantom-icon"
              className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono"
              initial={{ borderRadius: 14 }}
              animate={{ borderRadius: 0, scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="text-red-500 animate-pulse text-sm mb-4">[ SYSTEM BOOT ]</div>
              <Terminal className="w-16 h-16 text-red-500 mb-6" />
              <div className="text-white text-xs space-y-1 text-center opacity-70">
                <p>&gt; ESTABLISHING CONNECTION...</p>
                <p>&gt; BYPASSING FIREWALL...</p>
                <p className="text-green-500">&gt; ACCESS GRANTED</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Opening Animation (Custom OS Style) */}
        <AnimatePresence>
          {activeApp === 'settings' && (
            <motion.div
              layoutId="settings-icon"
              className="absolute inset-0 z-50 bg-[#0A0A0A] text-white flex flex-col font-mono"
              initial={{ borderRadius: 14 }}
              animate={{ borderRadius: 0, scale: 1, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9, borderRadius: 20 }}
              transition={{ duration: 0.4 }}
            >
              {/* Custom Header */}
              <div className="pt-12 pb-4 px-6 border-b border-white/10 flex justify-between items-center bg-black/50 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-bold tracking-widest text-green-500">SYSTEM_CONFIG</span>
                </div>
                <button onClick={closeApp} className="p-1 hover:bg-white/10 rounded transition">
                  <X className="w-5 h-5 text-white/50" />
                </button>
              </div>

              {/* Settings Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                
                {/* User Info Block */}
                <div className="border border-white/10 bg-white/5 p-4 relative">
                  <div className="absolute -top-2 left-2 px-1 bg-[#0A0A0A] text-[10px] text-white/40">USER_ID</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">AGENT_89X</div>
                      <div className="text-[10px] text-white/40 mt-1">LEVEL 3 ACCESS GRANTED</div>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]" />
                  </div>
                </div>

                {/* Settings Group 1 */}
                <div className="space-y-4">
                  <div className="text-[10px] text-white/30 tracking-widest border-b border-white/5 pb-1">GENERAL_SETTINGS</div>
                  
                  <SettingsRow 
                    icon={<Globe className="w-4 h-4 text-blue-400" />} 
                    label="LANGUAGE_PACK" 
                    value={locale === 'ko' ? 'KOREAN' : 'ENGLISH'}
                    onClick={toggleLanguage}
                  />
                  
                  <SettingsRow 
                    icon={<Bell className="w-4 h-4 text-yellow-400" />} 
                    label="NOTIFICATIONS" 
                    value={pushEnabled ? 'ON' : 'OFF'}
                    onClick={() => setPushEnabled(!pushEnabled)}
                  />
                </div>

                {/* Settings Group 2 */}
                <div className="space-y-4">
                  <div className="text-[10px] text-white/30 tracking-widest border-b border-white/5 pb-1">SECURITY_PROTOCOL</div>
                  
                  <SettingsRow 
                    icon={<Lock className="w-4 h-4 text-green-400" />} 
                    label="ENCRYPTION" 
                    value="AES-256"
                  />
                  
                  <SettingsRow 
                    icon={<ShieldAlert className="w-4 h-4 text-red-400" />} 
                    label="FIREWALL_STATUS" 
                    value="ACTIVE"
                  />
                </div>

                {/* Footer Actions */}
                <div className="pt-8">
                  <button 
                    onClick={handleLogout}
                    className="w-full border border-red-500/50 bg-red-500/10 text-red-400 py-3 text-xs tracking-widest hover:bg-red-500/20 transition flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    [ TERMINATE_SESSION ]
                  </button>
                  <div className="text-center mt-4 text-[10px] text-white/20">
                    PHANTOM_OS v4.2.0 (BUILD 2025)
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Photos Opening Animation (Not implemented details for brevity, reused from before) */}
        <AnimatePresence>
          {activeApp === 'photos' && (
            <motion.div
              layoutId="photos-icon"
              className="absolute inset-0 z-50 bg-black flex flex-col"
              initial={{ borderRadius: 14 }}
              animate={{ borderRadius: 0, scale: 1, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9, borderRadius: 20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="absolute top-12 right-6 z-50">
                <button onClick={closeApp} className="p-2 bg-black/50 rounded-full text-white backdrop-blur-sm">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-6"
                >
                  <Lock className="w-16 h-16 text-white mb-2" />
                  <div className="text-white text-xl font-medium tracking-wide">ENCRYPTED</div>
                  <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

function DockIcon({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="w-12 h-12 flex items-center justify-center text-white/70 hover:text-white transition relative"
    >
      {icon}
      <div className="absolute -bottom-2 w-1 h-1 bg-white/20 rounded-full" />
    </motion.button>
  );
}

function SettingsRow({ icon, label, value, onClick }: { icon: React.ReactNode, label: string, value: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between p-3 border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition cursor-pointer ${!onClick && 'cursor-default'}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-xs text-white/80">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-green-500 font-bold">{value}</span>
        {onClick && <ChevronRight className="w-3 h-3 text-white/30" />}
      </div>
    </div>
  );
}

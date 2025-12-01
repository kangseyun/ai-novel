'use client';

import { useState } from 'react';

// Logo History - 새 로고를 추가할 때마다 여기에 append
const logoHistory = [
  {
    id: 1,
    name: 'Luminovel v1 - Terminal Hack',
    description: '터미널/CLI 스타일. 모노스페이스 폰트와 커서 깜빡임 효과',
    date: '2025-12-01',
    component: Logo1,
  },
];

// Favicon/Icon History
const iconHistory = [
  {
    id: 1,
    name: 'Icon v1 - Glitch L',
    description: '글리치 효과의 L',
    component: Icon1,
  },
];

// ==================== FAVICON/ICON COMPONENTS ====================

// Icon 1: Glitch L
function Icon1({ size = 64, variant = 'dark' }: { size?: number; variant?: 'dark' | 'light' }) {
  const bgColor = variant === 'dark' ? '#0a0a0a' : '#f8fafc';
  const textColor = variant === 'dark' ? 'white' : '#1a1a2e';

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <rect x="2" y="2" width="60" height="60" rx="8" fill={bgColor}/>

      {/* Glitch layers */}
      {/* Red layer */}
      <text x="18" y="46" fontFamily="'Courier New', monospace" fontSize="40" fontWeight="900" fill="#ef4444" opacity="0.7">
        L
        <animate attributeName="x" values="18;16;18;20;18" dur="0.3s" repeatCount="indefinite"/>
      </text>

      {/* Cyan layer */}
      <text x="22" y="44" fontFamily="'Courier New', monospace" fontSize="40" fontWeight="900" fill="#06b6d4" opacity="0.7">
        L
        <animate attributeName="x" values="22;24;22;20;22" dur="0.25s" repeatCount="indefinite"/>
      </text>

      {/* Main L */}
      <text x="20" y="45" fontFamily="'Courier New', monospace" fontSize="40" fontWeight="900" fill={textColor}>
        L
      </text>

      {/* Glitch line */}
      <rect x="0" y="30" width="64" height="2" fill="#10b981" opacity="0.5">
        <animate attributeName="y" values="30;35;25;40;30" dur="0.2s" repeatCount="indefinite"/>
      </rect>
    </svg>
  );
}

// ==================== LOGO COMPONENTS ====================

// Logo 1: Terminal Hack Style
function Logo1({ size = 'large', variant = 'dark' }: { size?: 'small' | 'medium' | 'large'; variant?: 'dark' | 'light' }) {
  const sizes = {
    small: { width: 160, height: 40 },
    medium: { width: 240, height: 55 },
    large: { width: 320, height: 70 },
  };

  const s = sizes[size];
  const textColor = variant === 'dark' ? 'white' : '#1a1a2e';

  return (
    <svg width={s.width} height={s.height} viewBox="0 0 320 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Terminal prompt */}
      <text x="10" y="45" fontFamily="'Courier New', monospace" fontSize="26" fontWeight="400" fill="#10b981">
        $
      </text>
      <text x="30" y="45" fontFamily="'Courier New', monospace" fontSize="26" fontWeight="400" fill="#10b981" opacity="0.6">
        _
      </text>

      {/* Main text - luminovel.ai 붙여서 */}
      <text x="55" y="45" fontFamily="'Courier New', monospace" fontSize="26" fontWeight="400" fill={textColor} letterSpacing="0">
        luminovel<tspan fill="#10b981" fontWeight="700">.ai</tspan>
      </text>

      {/* Blinking cursor */}
      <rect x="275" y="25" width="12" height="26" fill="#10b981">
        <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
      </rect>
    </svg>
  );
}

export default function LogoTestPage() {
  const [selectedLogo, setSelectedLogo] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Luminovel.ai Logo Lab</h1>
          <p className="text-white/60">로고 디자인 히스토리 및 테스트 페이지</p>
          <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <p className="text-sm text-white/40">
              총 <span className="text-purple-400 font-bold">{logoHistory.length}</span>개의 로고 버전 |
              마지막 업데이트: <span className="text-purple-400">{logoHistory[logoHistory.length - 1]?.date}</span>
            </p>
          </div>
        </div>

        {/* Logo Grid */}
        <div className="space-y-8">
          {logoHistory.map((logo, index) => (
            <div
              key={logo.id}
              className={`p-8 rounded-2xl border transition-all cursor-pointer ${
                selectedLogo === logo.id
                  ? 'bg-purple-500/10 border-purple-500/50'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
              onClick={() => setSelectedLogo(selectedLogo === logo.id ? null : logo.id)}
            >
              {/* Logo Info */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs text-white/40 font-mono">#{String(index + 1).padStart(3, '0')}</span>
                  <h3 className="text-xl font-semibold mt-1">{logo.name}</h3>
                  <p className="text-white/50 text-sm mt-1">{logo.description}</p>
                </div>
                <span className="text-xs text-white/30 font-mono">{logo.date}</span>
              </div>

              {/* Logo Display - Dark Background */}
              <div className="mb-6">
                <p className="text-xs text-white/40 mb-2">Dark Background</p>
                <div className="bg-[#0F172A] p-8 rounded-xl flex items-center justify-center">
                  <logo.component size="large" variant="dark" />
                </div>
              </div>

              {/* Logo Display - Light Background */}
              <div className="mb-6">
                <p className="text-xs text-white/40 mb-2">Light Background</p>
                <div className="bg-white p-8 rounded-xl flex items-center justify-center">
                  <logo.component size="large" variant="light" />
                </div>
              </div>

              {/* Size Variations */}
              <div>
                <p className="text-xs text-white/40 mb-2">Size Variations</p>
                <div className="bg-[#0F172A] p-6 rounded-xl flex items-center gap-8 flex-wrap">
                  <div className="text-center">
                    <logo.component size="small" variant="dark" />
                    <p className="text-xs text-white/30 mt-2">Small</p>
                  </div>
                  <div className="text-center">
                    <logo.component size="medium" variant="dark" />
                    <p className="text-xs text-white/30 mt-2">Medium</p>
                  </div>
                  <div className="text-center">
                    <logo.component size="large" variant="dark" />
                    <p className="text-xs text-white/30 mt-2">Large</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Icons/Favicon Section */}
        <div className="mt-16">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Favicon & App Icons</h2>
            <p className="text-white/60">파비콘 및 앱 아이콘 디자인</p>
            <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
              <p className="text-sm text-white/40">
                총 <span className="text-green-400 font-bold">{iconHistory.length}</span>개의 아이콘 버전 |
                사이즈: 16px, 32px, 64px, 128px, 256px, 512px
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {iconHistory.map((icon) => (
              <div
                key={icon.id}
                className="p-6 rounded-2xl border bg-white/5 border-white/10 hover:border-white/20 transition-all"
              >
                <h3 className="text-lg font-semibold mb-1">{icon.name}</h3>
                <p className="text-white/50 text-sm mb-4">{icon.description}</p>

                {/* Dark Background Icons */}
                <div className="mb-4">
                  <p className="text-xs text-white/40 mb-2">Dark Background</p>
                  <div className="bg-[#0F172A] p-4 rounded-xl flex items-center gap-4 flex-wrap">
                    <icon.component size={16} variant="dark" />
                    <icon.component size={32} variant="dark" />
                    <icon.component size={48} variant="dark" />
                    <icon.component size={64} variant="dark" />
                  </div>
                </div>

                {/* Light Background Icons */}
                <div>
                  <p className="text-xs text-white/40 mb-2">Light Background</p>
                  <div className="bg-white p-4 rounded-xl flex items-center gap-4 flex-wrap">
                    <icon.component size={16} variant="light" />
                    <icon.component size={32} variant="light" />
                    <icon.component size={48} variant="light" />
                    <icon.component size={64} variant="light" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Large Preview */}
          <div className="mt-8 p-8 rounded-2xl border bg-white/5 border-white/10">
            <h3 className="text-xl font-semibold mb-4">Large Preview (512px)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {iconHistory.map((icon) => (
                <div key={icon.id} className="text-center">
                  <div className="bg-[#0F172A] p-4 rounded-xl mb-2 flex items-center justify-center">
                    <icon.component size={80} variant="dark" />
                  </div>
                  <p className="text-xs text-white/40">v{icon.id}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-white/40 text-sm">
            Luminovel.ai - AI Interactive Chat Novel Platform
          </p>
        </div>
      </div>
    </div>
  );
}

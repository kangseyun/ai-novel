'use client';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'dark' | 'light';
  className?: string;
}

// Terminal Hack Style Logo
export function Logo({ size = 'medium', variant = 'dark', className = '' }: LogoProps) {
  const sizes = {
    small: { width: 160, height: 40 },
    medium: { width: 240, height: 55 },
    large: { width: 320, height: 70 },
  };

  const s = sizes[size];
  const textColor = variant === 'dark' ? 'white' : '#1a1a2e';

  return (
    <svg
      width={s.width}
      height={s.height}
      viewBox="0 0 320 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Terminal prompt */}
      <text x="10" y="45" fontFamily="'Courier New', monospace" fontSize="26" fontWeight="400" fill="#10b981">
        $
      </text>
      <text x="30" y="45" fontFamily="'Courier New', monospace" fontSize="26" fontWeight="400" fill="#10b981" opacity="0.6">
        _
      </text>

      {/* Main text - luminovel.ai */}
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

interface LogoIconProps {
  size?: number;
  variant?: 'dark' | 'light';
  className?: string;
}

// Glitch L Icon
export function LogoIcon({ size = 32, variant = 'dark', className = '' }: LogoIconProps) {
  const bgColor = variant === 'dark' ? '#0a0a0a' : '#f8fafc';
  const textColor = variant === 'dark' ? 'white' : '#1a1a2e';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
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

// Simple text logo without effects (for places where animation might be distracting)
export function LogoText({ variant = 'dark', className = '' }: { variant?: 'dark' | 'light'; className?: string }) {
  const textColor = variant === 'dark' ? 'text-white' : 'text-slate-900';

  return (
    <span className={`font-mono font-medium ${textColor} ${className}`}>
      <span className="text-emerald-500">$_</span>
      luminovel<span className="text-emerald-500 font-bold">.ai</span>
    </span>
  );
}

export default Logo;

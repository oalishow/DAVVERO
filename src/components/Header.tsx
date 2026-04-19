import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import { APP_VERSION } from '../lib/constants';

export default function Header() {
  // Versão SVG robusta integrada para garantir que o logo apareça sempre com alta qualidade
  const ShieldLogo = () => (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-32 h-32 sm:w-40 sm:h-40 filter drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">
        {/* Asas de Proteção ao fundo */}
        <path 
          d="M30,100 Q10,70 50,60 Q70,55 90,70 Q110,55 130,60 Q170,70 150,100 Q170,130 130,140 Q110,145 90,130 Q70,145 50,140 Q10,130 30,100" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          className="text-sky-500/30"
        />
        <path 
          d="M40,100 Q20,80 60,70 Q80,65 95,80 Q110,65 130,70 Q170,80 150,100" 
          fill="currentColor" 
          className="text-sky-500/20"
        />
        
        {/* Escudo Principal */}
        <path 
          d="M100,40 L160,65 C160,110 145,145 100,175 C55,145 40,110 40,65 L100,40 Z" 
          fill="url(#shieldGradient)"
          stroke="#38bdf8"
          strokeWidth="2"
        />
        
        {/* Marca de Verificação (Check) */}
        <path 
          d="M75,110 L95,130 L135,90" 
          fill="none" 
          stroke="white" 
          strokeWidth="12" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="drop-shadow-sm"
        />
        
        {/* Gradientes e Filtros */}
        <defs>
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
      </svg>
      {/* Texto Estilizado dentro da composição */}
      <div className="absolute -bottom-2 font-black text-xs tracking-[0.2em] text-white bg-sky-600 px-3 py-1 rounded-full shadow-lg">
        VERIFY ID
      </div>
    </div>
  );

  return (
    <div className="text-center relative">
      <div className="absolute top-0 right-0 py-1 px-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 no-print">
        v{APP_VERSION}
      </div>
      <div className="flex justify-center mb-6 no-print min-h-[140px] items-center relative">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ 
            scale: 1, 
            opacity: 1, 
            y: [0, -10, 0],
          }}
          transition={{
            y: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            },
            scale: { duration: 0.8 },
            opacity: { duration: 0.8 }
          }}
          whileHover={{ scale: 1.05 }}
          className="relative z-10"
        >
          {/* Brilho de Fundo Pulsante */}
          <div className="absolute inset-x-0 -inset-y-8 bg-sky-400/20 dark:bg-sky-400/30 blur-3xl rounded-full scale-125 animate-pulse-slow pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-center">
            <ShieldLogo />
          </div>
        </motion.div>
      </div>
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-teal-500 to-emerald-600 dark:from-sky-400 dark:via-teal-300 dark:to-emerald-400 animated-slide-in-up tracking-tight mb-2 print:text-sky-600 print:text-2xl">
        Verify-ID
      </h1>
      <p className="text-slate-500 dark:text-slate-400 font-light text-xs sm:text-sm md:text-base animated-fade-in">
        Verificador de carteirinha FAJOPA e SPSCJ
      </p>
    </div>
  );
}

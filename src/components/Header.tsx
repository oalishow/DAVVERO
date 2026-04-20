import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import { APP_VERSION } from '../lib/constants';

export default function Header() {
  // Versão SVG robusta integrada para garantir que o logo apareça sempre com alta qualidade
  const ScannerLogo = () => (
    <div className="relative flex flex-col items-center justify-center w-32 h-32 sm:w-40 sm:h-40 bg-slate-50 dark:bg-slate-800/80 rounded-3xl shadow-[inset_0_4px_20px_rgba(0,0,0,0.05)] border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden">
       {/* Shield background subtle glow */}
       <div className="absolute inset-0 bg-blue-400/5 dark:bg-blue-400/10"></div>
       
       <svg viewBox="0 0 100 100" className="w-[65%] h-[65%] z-10 text-blue-600 dark:text-sky-400 drop-shadow-sm">
          {/* Shield Outline */}
          <path d="M50,5 L90,20 C90,60 75,85 50,95 C25,85 10,60 10,20 L50,5 Z" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinejoin="round" />
          
          {/* Mortarboard / Academic Cap */}
          <path d="M50,32 L82,46 L50,60 L18,46 Z" fill="currentColor" />
          <path d="M30,52 L30,65 C40,75 60,75 70,65 L70,52 L50,60 Z" fill="currentColor" opacity="0.85" />
          
          {/* Tassel */}
          <path d="M50,45 L78,55 L78,70" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="78" cy="72" r="2.5" fill="currentColor"/>
       </svg>
       
       {/* Scanning line animation */}
       <motion.div 
         className="absolute top-0 left-0 w-full h-[3px] bg-sky-400 blur-[0.5px] opacity-80 z-20 shadow-[0_0_12px_2px_rgba(56,189,248,0.7)]"
         animate={{ y: [-10, 170, -10] }}
         transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
       />
       <motion.div 
         className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-transparent to-sky-400/20 z-0"
         animate={{ y: [-100, 160, -100] }}
         transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
       />

      <div className="absolute bottom-2 font-black text-[9px] tracking-[0.15em] text-blue-900 dark:text-sky-100 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md px-2.5 py-0.5 rounded shadow-sm border border-white/40 dark:border-slate-600/50 z-30">
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
            <ScannerLogo />
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

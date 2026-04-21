import { useState, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import { Moon, Sun, Shield, User, Lock, Loader2 } from 'lucide-react';
import { loginAnon } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import ErrorBoundary from './components/ErrorBoundary';

const Verifier = lazy(() => import('./components/Verifier'));
const Admin = lazy(() => import('./components/Admin'));
const StudentPortal = lazy(() => import('./components/StudentPortal'));

export default function App() {
  const [activeTab, setActiveTab] = useState<'verifier' | 'admin' | 'student'>('verifier');
  const [targetVerifyCode, setTargetVerifyCode] = useState<string | null>(null);

  const handleGlobalVerify = (code: string) => {
    setTargetVerifyCode(code);
    setActiveTab('verifier');
  };

  useEffect(() => {
    // Expose global trigger for deep components
    (window as any).triggerVerification = handleGlobalVerify;
  }, []);

  useEffect(() => {
    // Determine initial theme based strictly on system preference
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Clear any previous manual overrides to ensure transparency
    localStorage.removeItem('theme');
    
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Initial load
    applyTheme(systemPrefersDark.matches);

    // Listener for system changes
    const themeListener = (e: MediaQueryListEvent) => {
      applyTheme(e.matches);
    };

    systemPrefersDark.addEventListener('change', themeListener);

    // Liberações Iniciais (Firebase login anonimo necessário para acessar dados base)
    loginAnon();

    return () => systemPrefersDark.removeEventListener('change', themeListener);
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-0 sm:p-4 print:block print:p-0">
      <div className="w-full max-w-3xl glass-panel rounded-none sm:rounded-3xl p-3 sm:p-5 md:p-10 animated-fade-in relative overflow-hidden print:max-w-none print:p-0 print:shadow-none print:bg-white print:dark:bg-white min-h-[100dvh] sm:min-h-0 print:min-h-0 print:border-none print:block">
        {/* Glows Decorativos de Fundo */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-sky-300 dark:bg-sky-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none print:hidden" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-300 dark:bg-emerald-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none print:hidden" />

        <div className="relative z-10 space-y-6 sm:space-y-8 print:space-y-4">
          <Header />

          <div className="grid grid-cols-3 bg-slate-200/50 dark:bg-slate-900/60 rounded-xl p-1 shadow-inner border border-slate-200/50 dark:border-slate-700/50 no-print print:hidden gap-1">
            <button 
              onClick={() => setActiveTab('student')}
              className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${activeTab === 'student' ? 'bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <User className="w-4 h-4 mb-0.5" />
              Minha ID
            </button>
            <button 
              onClick={() => setActiveTab('verifier')}
              className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${activeTab === 'verifier' ? 'bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <Shield className="w-4 h-4 mb-0.5" />
              Verificar
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${activeTab === 'admin' ? 'bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <Lock className="w-4 h-4 mb-0.5" />
              Gestão
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: activeTab === 'student' ? -20 : activeTab === 'admin' ? 20 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeTab === 'student' ? 20 : activeTab === 'admin' ? -20 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorBoundary>
                <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-sky-500 w-8 h-8" /></div>}>
                  {activeTab === 'verifier' && (
                    <Verifier 
                      externalCode={targetVerifyCode} 
                      onExternalVerified={() => setTargetVerifyCode(null)} 
                    />
                  )}
                  {activeTab === 'admin' && <Admin />}
                  {activeTab === 'student' && <StudentPortal />}
                </Suspense>
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
          
          <Footer />
        </div>
      </div>
    </div>
  );
}

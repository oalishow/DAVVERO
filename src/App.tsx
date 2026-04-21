import { useState, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import { Moon, Sun, Shield, User, Lock, Loader2, Sparkles, RefreshCw, X } from 'lucide-react';
import { loginAnon } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import ErrorBoundary from './components/ErrorBoundary';
import DynamicPWA from './components/DynamicPWA';
import NotificationObserver from './components/NotificationObserver';
import { useSettings } from './context/SettingsContext';
import { APP_VERSION, CHANGELOG } from './lib/constants';

const Verifier = lazy(() => import('./components/Verifier'));
const Admin = lazy(() => import('./components/Admin'));
const StudentPortal = lazy(() => import('./components/StudentPortal'));

export default function App() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'verifier' | 'admin' | 'student'>('verifier');
  const [targetVerifyCode, setTargetVerifyCode] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    // Monitorar atualizações via nuvem
    if (settings?.version && settings.version !== APP_VERSION) {
      // Verificar se essa versão específica da nuvem já foi ignorada ou aplicada nesta sessão
      const lastSeenCloudVersion = localStorage.getItem('last_seen_cloud_version');
      if (lastSeenCloudVersion !== settings.version) {
        setShowUpdateModal(true);
      }
    }
  }, [settings?.version]);

  const handleGlobalVerify = (code: string) => {
    setTargetVerifyCode(code);
    setActiveTab('verifier');
  };

  const handleUpdateClick = () => {
    setUpdateStatus('success');
    if (settings?.version) {
      localStorage.setItem('last_seen_cloud_version', settings.version);
    }
    localStorage.setItem('app_version', APP_VERSION);
    
    // Pequeno delay para mostrar que foi aplicado
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handleCloseUpdate = () => {
    if (settings?.version) {
      localStorage.setItem('last_seen_cloud_version', settings.version);
    }
    setShowUpdateModal(false);
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

    // Update check
    const storedVersion = localStorage.getItem('app_version');
    if (storedVersion && storedVersion !== APP_VERSION) {
      setShowUpdateModal(true);
    }
    localStorage.setItem('app_version', APP_VERSION);

    return () => systemPrefersDark.removeEventListener('change', themeListener);
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-0 sm:p-4 print:block print:p-0">
      <DynamicPWA />
      <NotificationObserver />
      <div className="w-full max-w-3xl glass-panel rounded-none sm:rounded-3xl p-3 sm:p-5 md:p-10 animated-fade-in relative overflow-hidden print:max-w-none print:p-0 print:shadow-none print:bg-white print:dark:bg-white min-h-[100dvh] sm:min-h-0 print:min-h-0 print:border-none print:block">
        {/* Glows Decorativos de Fundo */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-sky-300 dark:bg-sky-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none print:hidden" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-300 dark:bg-emerald-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none print:hidden" />

        <AnimatePresence>
          {showUpdateModal && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md no-print"
            >
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl p-6 border border-sky-100 dark:border-sky-500/20 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={handleCloseUpdate} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
                
                <div className="w-16 h-16 bg-sky-100 dark:bg-sky-500/20 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Sparkles className="w-8 h-8" />
                </div>
                
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                  {updateStatus === 'success' ? 'Perfeito!' : 'Novidades Chegaram!'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 uppercase tracking-widest font-black">Versão {APP_VERSION}</p>
                
                {updateStatus === 'success' ? (
                  <div className="py-10 animate-bounce">
                    <p className="text-sky-600 dark:text-sky-400 font-bold text-sm">Atualizações aplicadas com sucesso!</p>
                    <p className="text-[10px] text-slate-400 mt-2">Reiniciando o sistema...</p>
                  </div>
                ) : (
                  <>
                    <div className="text-left space-y-2 mb-8">
                      {CHANGELOG.map((item, i) => (
                        <div key={i} className="flex gap-2 items-start group">
                          <div className="w-1 h-1 rounded-full bg-sky-500 mt-1.5 shrink-0 group-hover:scale-150 transition-transform" />
                          <span className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 font-medium">{item}</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={handleUpdateClick}
                      className="w-full py-3 bg-sky-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 hover:bg-sky-500 transition-all active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Atualizar Agora
                    </button>
                  </>
                )}
                
                <p className="text-[9px] text-slate-400 mt-4 font-bold uppercase tracking-tighter">O sistema foi modificado para melhor atendê-lo.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

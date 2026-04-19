import { useState, useEffect } from 'react';
import Header from './components/Header';
import Verifier from './components/Verifier';
import Admin from './components/Admin';
import Footer from './components/Footer';
import { Moon, Sun } from 'lucide-react';
import { loginAnon } from './lib/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<'verifier' | 'admin'>('verifier');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check initial theme
    const isDark = localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setTheme(isDark ? 'dark' : 'light');
    if (isDark) document.documentElement.classList.add('dark');

    // Liberações Iniciais (Firebase login anonimo necessário para acessar dados base)
    loginAnon();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 print:block print:p-0">
      <button 
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2.5 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm backdrop-blur-sm z-[100] transition-colors no-print"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-3xl glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 animated-fade-in relative overflow-hidden print:max-w-none print:p-2 print:shadow-none print:bg-white print:dark:bg-white">
        {/* Glows Decorativos de Fundo */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-sky-300 dark:bg-sky-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-300 dark:bg-emerald-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none" />

        <div className="relative z-10 space-y-6 sm:space-y-8">
          <Header />

          <div className="flex bg-slate-200/50 dark:bg-slate-900/60 rounded-xl p-1 shadow-inner border border-slate-200/50 dark:border-slate-700/50 no-print">
            <button 
              onClick={() => setActiveTab('verifier')}
              className={`w-1/2 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'verifier' ? 'bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              Verificar Identidade
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`w-1/2 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'admin' ? 'bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              Área Administrativa
            </button>
          </div>

          {activeTab === 'verifier' ? <Verifier /> : <Admin />}
          
          <Footer />
        </div>
      </div>
    </div>
  );
}

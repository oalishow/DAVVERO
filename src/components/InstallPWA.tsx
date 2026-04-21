import { useState, useEffect } from 'react';
import { Download, Info, Share } from 'lucide-react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other');

  useEffect(() => {
    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  if (platform === 'ios' && !window.matchMedia('(display-mode: standalone)').matches) {
    return (
      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-4 rounded-2xl mt-6 no-print">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-sky-100 dark:bg-sky-800 rounded-lg text-sky-600 dark:text-sky-300">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-sky-900 dark:text-sky-100 mb-1">Instalar no iPhone</h3>
            <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed">
              Para instalar o <strong>Vero ID</strong>, toque no ícone de <span className="inline-block"><Share className="w-4 h-4 mx-0.5 inline" /></span> <strong>Compartilhar</strong> do seu Safari e selecione <strong>"Adicionar à Tela de Início"</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!showInstallBtn) return null;

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4 rounded-2xl mt-6 no-print">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg text-emerald-600 dark:text-emerald-300">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Instalar Aplicativo</h3>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-semibold">Vero ID native web app</p>
          </div>
        </div>
        <button 
          onClick={handleInstallClick}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20"
        >
          Instalar Agora
        </button>
      </div>
    </div>
  );
}

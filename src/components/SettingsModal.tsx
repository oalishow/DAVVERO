import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ShieldAlert, Mail, Link, UserCircle } from 'lucide-react';
import { PASSWORD_STORAGE_KEY, URL_STORAGE_KEY, EMAIL_SETTINGS_KEY, DEFAULT_ADMIN_PASSWORD, DEFAULT_PUBLIC_URL, DIRECTOR_NAME_KEY, DEFAULT_DIRECTOR_NAME } from '../lib/constants';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [status, setStatus] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  useEffect(() => {
    setUrl(localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_PUBLIC_URL);
    setDirectorName(localStorage.getItem(DIRECTOR_NAME_KEY) || DEFAULT_DIRECTOR_NAME);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleSaveGeneral = () => {
    if (url) localStorage.setItem(URL_STORAGE_KEY, url);
    localStorage.setItem(DIRECTOR_NAME_KEY, directorName);
    showStatus('Configurações gerais atualizadas com sucesso!', 'success');
  };

  const handleSavePassword = () => {
    const current = localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
    if (password !== current) {
      showStatus('A senha atual está incorreta.', 'error');
      return;
    }
    if (newPassword.length < 4) {
      showStatus('A nova senha precisa ter mais caracteres.', 'error');
      return;
    }
    localStorage.setItem(PASSWORD_STORAGE_KEY, newPassword);
    setPassword(''); setNewPassword('');
    showStatus('Palavra-passe alterada!', 'success');
  };

  const showStatus = (msg: string, type: 'success'|'error') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 3000);
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] p-6 w-full max-w-md animated-scale-in">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60">
          <h2 className="text-xl font-bold text-sky-600 dark:text-sky-400">Configurações Gerais</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {status && (
          <div className={`mb-4 p-3 text-center rounded-xl text-sm font-medium ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {status.msg}
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-200">
              <Link className="w-4 h-4" /> Configurações Gerais
            </h3>
            <div className="space-y-3">
               <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">URL de Acesso</label>
                  <input type="text" value={url} onChange={e=>setUrl(e.target.value)} className="input-modern w-full rounded-xl py-2 px-3 text-sm" placeholder="Ex: https://verify-id.app" />
               </div>
               <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nome do Diretor Geral (Verso da Carteirinha)</label>
                  <div className="relative">
                     <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input type="text" value={directorName} onChange={e=>setDirectorName(e.target.value.toUpperCase())} className="input-modern w-full rounded-xl py-2 pl-9 pr-3 text-sm font-semibold" placeholder="Ex: PROF. DR. FULANO DE TAL" />
                  </div>
               </div>
               <button onClick={handleSaveGeneral} className="btn-modern w-full py-2 bg-slate-700 hover:bg-sky-600 text-white rounded-lg text-sm font-medium mt-2">Salvar Configurações</button>
            </div>
          </div>

          <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-200 dark:border-rose-500/20">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="w-4 h-4" /> Segurança de Acesso
            </h3>
            <div className="space-y-3">
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha Atual" className="input-modern w-full rounded-xl py-2 px-3 text-sm" />
              <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Nova Senha" className="input-modern w-full rounded-xl py-2 px-3 text-sm" />
              <button onClick={handleSavePassword} className="btn-modern w-full py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium">Alterar Credenciais</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ShieldAlert, Mail, Link, UserCircle, Palette, Upload, Trash2 } from 'lucide-react';
import { 
  PASSWORD_STORAGE_KEY, 
  URL_STORAGE_KEY, 
  DIRECTOR_NAME_KEY, 
  DEFAULT_ADMIN_PASSWORD, 
  DEFAULT_PUBLIC_URL, 
  DEFAULT_DIRECTOR_NAME,
  INSTITUTION_LOGO_KEY,
  INSTITUTION_NAME_KEY,
  INSTITUTION_COLOR_KEY,
  DIRECTOR_SIGNATURE_KEY
} from '../lib/constants';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [instName, setInstName] = useState('');
  const [instColor, setInstColor] = useState('#0ea5e9');
  const [instLogo, setInstLogo] = useState<string | null>(null);
  const [instSignature, setInstSignature] = useState<string | null>(null);
  
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [status, setStatus] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_PUBLIC_URL);
    setDirectorName(localStorage.getItem(DIRECTOR_NAME_KEY) || DEFAULT_DIRECTOR_NAME);
    setInstName(localStorage.getItem(INSTITUTION_NAME_KEY) || 'FAJOPA');
    setInstColor(localStorage.getItem(INSTITUTION_COLOR_KEY) || '#0ea5e9');
    setInstLogo(localStorage.getItem(INSTITUTION_LOGO_KEY));
    setInstSignature(localStorage.getItem(DIRECTOR_SIGNATURE_KEY));
    
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleSaveGeneral = () => {
    if (url) localStorage.setItem(URL_STORAGE_KEY, url);
    localStorage.setItem(DIRECTOR_NAME_KEY, directorName);
    localStorage.setItem(INSTITUTION_NAME_KEY, instName);
    localStorage.setItem(INSTITUTION_COLOR_KEY, instColor);
    
    if (instLogo) {
      localStorage.setItem(INSTITUTION_LOGO_KEY, instLogo);
    } else {
      localStorage.removeItem(INSTITUTION_LOGO_KEY);
    }

    if (instSignature) {
      localStorage.setItem(DIRECTOR_SIGNATURE_KEY, instSignature);
    } else {
      localStorage.removeItem(DIRECTOR_SIGNATURE_KEY);
    }
    
    showStatus('Configurações aplicadas com sucesso!', 'success');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 500 * 1024) {
      showStatus('Logo muito grande. Máximo 500KB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setInstLogo(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 300 * 1024) {
      showStatus('Assinatura muito grande. Máximo 300KB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setInstSignature(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
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

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {/* Identidade Visual */}
          <div className="bg-sky-50/50 dark:bg-sky-900/10 p-5 rounded-2xl border border-sky-100 dark:border-sky-500/20">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-sky-800 dark:text-sky-300 uppercase tracking-widest text-[10px]">
              <Palette className="w-4 h-4" /> Identidade Visual da Instituição
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-3 text-center">Logo da Instituição (Banner/Card)</label>
                
                {instLogo ? (
                  <div className="relative group">
                    <img src={instLogo} alt="Logo Inst" className="h-16 w-auto object-contain mb-2 rounded shadow-sm" />
                    <button 
                      onClick={() => setInstLogo(null)}
                      className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => logoInputRef.current?.click()}
                    className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-200 dark:border-slate-600 mb-2"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                )}
                <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                <p className="text-[9px] text-slate-400 mt-1">Recomendado: PNG Transparente</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Abreviado</label>
                   <input type="text" value={instName} onChange={e=>setInstName(e.target.value.toUpperCase())} className="input-modern w-full rounded-xl py-2 px-3 text-xs font-bold" placeholder="Ex: FAJOPA" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cor Primária</label>
                   <div className="flex gap-2">
                     <input type="color" value={instColor} onChange={e=>setInstColor(e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer p-0" />
                     <input type="text" value={instColor} onChange={e=>setInstColor(e.target.value)} className="input-modern flex-1 rounded-xl py-1 px-3 text-[10px] uppercase font-mono" />
                   </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px]">
              <Link className="w-4 h-4" /> Configurações de Texto
            </h3>
            <div className="space-y-3">
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">URL de Acesso</label>
                  <input type="text" value={url} onChange={e=>setUrl(e.target.value)} className="input-modern w-full rounded-xl py-2 px-3 text-sm" placeholder="Ex: https://vero-id.app" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Diretor Geral (Assinante Card)</label>
                  <div className="relative">
                     <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input type="text" value={directorName} onChange={e=>setDirectorName(e.target.value.toUpperCase())} className="input-modern w-full rounded-xl py-2 pl-9 pr-3 text-sm font-semibold" placeholder="Ex: PROF. DR. FULANO DE TAL" />
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 text-center">Assinatura do Diretor (PNG)</label>
                  
                  {instSignature ? (
                    <div className="relative group">
                      <img src={instSignature} alt="Assinatura" className="h-10 w-auto object-contain mb-1 bg-white p-1 rounded" />
                      <button 
                        onClick={() => setInstSignature(null)}
                        className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => signatureInputRef.current?.click()}
                      className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-200 dark:border-slate-600"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  )}
                  <input type="file" ref={signatureInputRef} onChange={handleSignatureUpload} accept="image/png" className="hidden" />
                  <p className="text-[8px] text-slate-400 mt-1">Fundo transparente recomendado</p>
               </div>
            </div>
          </div>
          
          <button onClick={handleSaveGeneral} className="btn-modern w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all">
            Salvar Todas as Configurações
          </button>

          <div className="bg-rose-50 dark:bg-rose-900/10 p-5 rounded-2xl border border-rose-200 dark:border-rose-500/20 mt-4">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-rose-700 dark:text-rose-300 uppercase tracking-widest text-[10px]">
              <ShieldAlert className="w-4 h-4" /> Segurança do Painel
            </h3>
            <div className="space-y-3">
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha Atual" className="input-modern w-full rounded-xl py-2 px-3 text-sm" />
              <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Nova Senha" className="input-modern w-full rounded-xl py-2 px-3 text-sm" />
              <button onClick={handleSavePassword} className="btn-modern w-full py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-medium">Alterar Credenciais</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useState } from 'react';
import { Printer } from 'lucide-react';
import type { Member } from '../types';
import { QRCodeCanvas } from 'qrcode.react';
import { URL_STORAGE_KEY, DEFAULT_PUBLIC_URL } from '../lib/constants';

interface VerificationResultProps {
  member: Member | null;
  status: 'VALID' | 'INACTIVE' | 'EXPIRED' | 'NOT_FOUND';
  onReset: () => void;
}

export default function VerificationResult({ member, status, onReset }: VerificationResultProps) {
  const [exporting, setExporting] = useState(false);
  const now = new Date();
  const timestampStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;
  
  const baseUrl = localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_PUBLIC_URL;
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  let themeClass, titleText, subtitleText, descHtml, dotColor, badgeText;

  switch(status) {
    case 'VALID':
      themeClass = 'emerald';
      titleText = 'Identidade Validada';
      subtitleText = 'Documento Estudantil Digital';
      descHtml = 'Acesso Concedido. Membro da comunidade devidamente matriculado.';
      dotColor = 'bg-emerald-500 animate-pulse';
      badgeText = 'Ativo';
      break;
    case 'INACTIVE':
      themeClass = 'amber';
      titleText = 'Acesso Suspenso';
      subtitleText = 'Identidade Desativada';
      descHtml = 'A identidade deste membro encontra-se inativa ou suspensa. O acesso físico e os benefícios associados estão temporariamente indisponíveis.';
      dotColor = 'bg-amber-500';
      badgeText = 'Desativado / Suspenso';
      break;
    case 'EXPIRED':
      themeClass = 'rose';
      titleText = 'Identidade Expirada';
      subtitleText = 'Acesso Negado';
      descHtml = 'A validade deste documento terminou na data referida. Por favor, regularize a sua situação institucional.';
      dotColor = 'bg-rose-500';
      badgeText = 'Expirado';
      break;
    default:
      themeClass = 'rose';
      titleText = 'Registo Não Encontrado';
      subtitleText = 'Acesso Negado';
      descHtml = 'O código lido não consta na base de dados oficial. Poderá ter sido invalidado, excluído ou nunca existiu.';
      dotColor = 'bg-rose-500';
      badgeText = 'Não Encontrado';
      break;
  }

  const safeName = member?.name || 'Desconhecido';
  const safeCode = member?.alphaCode || 'N/A';
  const safeDate = member?.validityDate ? new Date(member.validityDate + 'T23:59:59').toLocaleDateString('pt-BR') : 'N/D';

  const avatarUrl = member?.photoUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2364748b"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>';

  const handleExport = async () => {
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const card = document.getElementById('validation-card-capture');
      if (!card) return;

      const isDarkMode = document.documentElement.classList.contains('dark');
      
      const url = await toPng(card, {
        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
        pixelRatio: 2,
        style: {
          // Fixes an issue where animations or transforms might clip the canvas during capture
          transform: 'none',
          animation: 'none'
        }
      });

      const prefix = status === 'VALID' ? 'Validacao' : 'Recusa';
      const fileName = `VerifyID_${prefix}_${safeName.replace(/\s+/g, '_')}.png`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch(err) {
      console.error('Export erro:', err);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full mt-6 animated-fade-in flex flex-col items-center">
      <div 
        id="validation-card-capture"
        className={`result-card w-full max-w-sm ${status === 'VALID' ? 'animate-success-pop' : 'animate-error-wobble'} bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-2 p-6 sm:p-8 rounded-[2rem] text-center relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] print:shadow-none print:bg-white print:text-black print:border-slate-300 ${
          status === 'VALID' ? 'border-emerald-100 dark:border-emerald-500/50 shadow-emerald-500/10' : 
          status === 'INACTIVE' ? 'border-amber-100 dark:border-amber-500/50 shadow-amber-500/10' : 
          'border-rose-100 dark:border-rose-500/50 shadow-rose-500/10'
        }`}
      >
        <div className="mx-auto w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 overflow-hidden mb-4 relative z-10 bg-slate-50 shadow-inner">
          <img src={avatarUrl} crossOrigin="anonymous" alt="Foto" className={`w-full h-full object-cover ${status !== 'VALID' && 'grayscale'}`} />
        </div>

        <h2 className={`text-lg sm:text-xl font-black mb-1 uppercase tracking-widest ${status === 'VALID' ? 'text-emerald-600 dark:text-emerald-400' : status === 'INACTIVE' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {titleText}
        </h2>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-5 ${status === 'VALID' ? 'text-emerald-500' : status === 'INACTIVE' ? 'text-amber-500' : 'text-rose-500'}`}>
          {subtitleText}
        </p>

        <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 text-left">
          <div className="text-center">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 font-semibold">{status === 'NOT_FOUND' ? 'Tentativa de Acesso' : 'Nome Completo'}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white leading-tight">{safeName}</p>
              {member?.ra && <p className="text-[10px] font-medium text-slate-500 mt-1">RA: {member.ra}</p>}
              
              {member?.roles && member.roles.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {member.roles.map(r => <span key={r} className="px-2 py-0.5 bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 rounded text-[9px] uppercase border border-sky-200">{r}</span>)}
                </div>
              )}
              {member?.course && (
                <div className="mt-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Curso Matriculado</p>
                  <p className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase mt-0.5">{member.course}</p>
                </div>
              )}
          </div>
          
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
              <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Status</p>
                  <p className={`text-xs font-bold flex items-center gap-1 ${status === 'VALID' ? 'text-emerald-600' : status === 'INACTIVE' ? 'text-amber-600' : 'text-rose-600'}`}>
                      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span> {badgeText}
                  </p>
                  {status !== 'NOT_FOUND' && <p className="text-[10px] text-slate-500 mt-1">{status === 'EXPIRED' ? 'Venceu a:' : 'Vence a:'} <span className="text-slate-700 dark:text-slate-300 font-medium">{safeDate}</span></p>}
              </div>
              <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Cód. Uso</p>
                  <p className="text-xs font-mono text-slate-700 dark:text-slate-200 flex flex-col">
                      <span>{safeCode}</span>
                      {member && <span className="text-[8px] text-sky-600 dark:text-sky-400 mt-1 font-sans font-semibold">Ensino Superior<br/> FAJOPA</span>}
                  </p>
              </div>
          </div>
        </div>

        <div className={`mt-4 p-3 rounded-2xl border text-left ${
          status === 'VALID' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-500/30' : 
          status === 'INACTIVE' ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-500/30' : 
          'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-500/30'
        }`}>
          <p className="text-[10px] uppercase tracking-widest mb-1 font-semibold opacity-70">Detalhes</p>
          <p className="text-xs font-medium leading-relaxed">{descHtml}</p>
          {status === 'VALID' && <span className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-2 block"><strong>Garantia Legal:</strong> Assegura o benefício da meia-entrada, Lei Federal n° 12.933/2013.</span>}
        </div>
        
        <div className="mt-4 inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
           <span className="text-slate-600 dark:text-slate-400 text-[10px] font-mono">Processado em: <strong className="text-slate-800 dark:text-slate-200">{timestampStr}</strong></span>
        </div>

        {member?.alphaCode && (
          <div className="mt-4 flex justify-center bg-white p-2 rounded-xl w-fit mx-auto border-2 border-slate-200 shadow-sm">
            <QRCodeCanvas value={`${cleanBaseUrl}?verify=${member.alphaCode}`} size={80} level="M" />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-5 w-full max-w-sm no-print">
        <button onClick={onReset} className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors">
          Nova Consulta
        </button>
        <div className="flex gap-2 flex-1">
          <button onClick={handlePrint} className="p-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors" title="Imprimir">
            <Printer className="w-5 h-5" />
          </button>
          <button onClick={handleExport} disabled={exporting} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white transition-colors ${
            status === 'VALID' ? 'bg-emerald-600 hover:bg-emerald-500' : 
            status === 'INACTIVE' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
          }`}>
            {exporting ? 'A exportar...' : 'Baixar Imagem'}
          </button>
        </div>
      </div>
    </div>
  );
}

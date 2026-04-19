import { useState } from 'react';
import { Mail, FileText, ExternalLink } from 'lucide-react';
import { APP_VERSION } from '../lib/constants';
import ChangelogModal from './ChangelogModal';

export default function Footer() {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <footer className="text-center text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-300 dark:border-slate-700/60 space-y-4 animated-fade-in no-print">
      <div className="bg-white/80 dark:bg-slate-900/50 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 inline-block text-left w-full max-w-2xl mx-auto shadow-sm dark:shadow-inner">
        <p className="leading-relaxed">
          Trabalho de Conclusão de Curso do aluno{' '}
          <a href="https://www.instagram.com/oalison.rodrigues" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 transition-colors font-medium">
            Alison Fernando Rodrigues dos Santos
          </a>, orientação:{' '}
          <a href="https://www.instagram.com/danilonobresant/" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 transition-colors font-medium">
            Prof. Pe. Dr. Danilo Nobre
          </a>.
        </p>
        <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-200 dark:border-slate-700/50">
          <p className="italic text-slate-600 dark:text-slate-300 font-medium text-[9px] sm:text-xs">
            "E O VERBO SE FEZ I.A.? DA REFLEXÃO TEOLÓGICA E COMUNICATIVA AO DESENVOLVIMENTO DE SOLUÇÕES PASTORAIS COM INTELIGÊNCIA ARTIFICIAL"
          </p>
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-2 sm:gap-3">
        <a href="https://drive.google.com/file/d/14uPBeHCT5aP1ACPLlPpIjfD5J1iLQfyD/view?usp=drive_link" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-4 sm:px-5 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 hover:text-sky-800 dark:hover:text-sky-300 border border-sky-200 dark:border-sky-500/30 rounded-full font-medium transition-all duration-200 group text-[10px] sm:text-xs shadow-sm">
          <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-y-0.5 transition-transform" />
          Ler Monografia (PDF)
        </a>
      </div>

      <div className="pt-3 sm:pt-4 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 text-slate-500 border-t border-slate-300 dark:border-slate-800/80">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-mono text-[9px] sm:text-[10px] bg-slate-200 dark:bg-slate-800 py-1 px-2 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            v{APP_VERSION}
          </span>
          <button 
            onClick={() => setShowChangelog(true)}
            className="text-[10px] sm:text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 underline underline-offset-2 transition-colors"
          >
            Novidades
          </button>
        </div>
        <a href="mailto:oalison.rodrigues@gmail.com" className="flex items-center gap-1.5 hover:text-sky-600 dark:hover:text-sky-400 transition-colors border-b border-transparent hover:border-sky-600 dark:hover:border-sky-400 pb-0.5 text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">
          <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Reportar erro
        </a>
      </div>

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </footer>
  );
}

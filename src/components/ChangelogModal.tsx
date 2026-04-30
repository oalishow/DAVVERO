import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';

interface ChangelogModalProps {
  onClose: () => void;
}

export default function ChangelogModal({ onClose }: ChangelogModalProps) {
  const versions = [
    {
      version: 'v5.2.0',
      title: 'Modo Offline e Melhorias Visuais',
      changes: [
        'Trabalho Offline: Suporte a operação offline via Service Worker (PWA).',
        'UI: Animação suave de transição no login de administrador.'
      ],
      current: true,
    },
    {
      version: 'v5.1.0',
      title: 'Liturgia, Eventos e Usabilidade',
      changes: [
        'Liturgia: Inclusão da Bíblia de Jerusalém, Catecismo da Igreja Católica, Direito Canônico e Calendário Litúrgico.',
        'Eventos: Organização em sub-abas (Acadêmico e Seminários) e nova funcionalidade de exportação de eventos para o calendário (.ics).',
        'Segurança e UX: PIN persistente por sessão no Portal do Aluno.'
      ],
      current: false,
    },
    {
      version: 'v5.0.0',
      title: 'Refatoração Profunda e Otimização',
      changes: [
        'Recuperação de senha: \'Esqueci minha senha\' agora disponível para o painel administrativo através de reset por e-mail.',
        'Otimização de Banco de Dados e Real-time aprimorado, suportando com alta estabilidade +200 alunos em simultâneo.',
        'Segurança: Regras do painel atualizadas e testes reforçados.'
      ],
      current: false,
    },
    {
      version: 'v4.8.0',
      title: 'Performance e Experiência',
      changes: [
        'Animações de Carregamento responsiva ao vincular conta.',
        'Privacidade Aprimorada: Exibição focada nas funcionalidades de baixar PDF e nova consulta ao acessar sua carteirinha.',
        'Otimização: Maior fluidez de acesso ao painel do aluno.'
      ],
      current: false,
    },
    {
      version: 'v4.7.1',
      title: 'Segurança e LGPD',
      changes: [
        'Privacidade: Implementação de máscara de PII para proteção de CPFs e informações sensíveis no sistema.',
        'Segurança: Regras do painel reescritas de ponta a ponta garantindo acesso unicamente para administradores.'
      ],
      current: false
    }
  ];

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[200] overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 md:p-8 w-full max-w-md animated-scale-in my-auto max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-700/60 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-sky-600 dark:text-sky-400 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Histórico de Atualizações
          </h2>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600 p-1.5 sm:p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-grow">
          {versions.map((v, i) => (
            <div key={v.version} className={`relative pl-4 border-l-2 ${i === 0 ? 'border-sky-500' : 'border-slate-300 dark:border-slate-600'}`}>
              <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${i === 0 ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]' : 'bg-slate-400'}`}></div>
              <span className={`text-[10px] font-bold tracking-widest uppercase ${i === 0 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'}`}>
                {v.version} {v.current && '(Atual)'}
              </span>
              <h4 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 mt-1">{v.title}</h4>
              <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1.5 list-disc pl-4">
                {v.changes.map((change, idx) => (
                  <li key={idx}>{change}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

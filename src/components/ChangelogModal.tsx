import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';

interface ChangelogModalProps {
  onClose: () => void;
}

export default function ChangelogModal({ onClose }: ChangelogModalProps) {
  const versions = [
    {
      version: 'v3.0.0',
      title: 'A Maior Integração até Agora',
      changes: [
        'Sincronização de Tema: O sistema agora segue automaticamente as definições do seu telemóvel (Claro/Escuro).',
        'Tags Personalizadas: Liberdade para criar novos Vínculos Institucionais e Cursos diretamente no cadastro.',
        'Memória Persistente: Novas tags e cursos são salvos automaticamente para uso em futuros cadastros.',
        'Dashboard Interativo: Status do painel agora são atalhos clicáveis para facilitar a gestão.',
        'Contador de Alertas: Novo badge de solicitações com indicador numérico e animação de atenção.',
        'Correções iOS/Safari: Otimização total do scanner QR e animações de carta para iPhones.'
      ],
      current: true
    },
    {
      version: 'v2.8.0',
      title: 'Relatórios & Impressão',
      changes: [
        'Novo sistema de relatórios em modo tabela para impressão profissional.',
        'Otimização de layout para economia de tinta e papel.',
        'Ajustes finos na gestão de membros e exportação inteligente.'
      ]
    },
    {
      version: 'v2.5.1',
      title: 'Reversão de Autenticação',
      changes: [
        'Login Simplificado: O acesso ao painel de administração voltou a exigir apenas a palavra-passe para maior agilidade.'
      ]
    },
    {
      version: 'v2.5.0',
      title: 'Modo Claro (Light Mode)',
      changes: [
        'Interface Adaptável: O sistema foi totalmente adaptado para suportar o Modo Claro, garantindo leitura otimizada em ambientes iluminados.',
        'Alternância Inteligente: Botão de tema que guarda a preferência do utilizador no dispositivo.'
      ]
    },
    {
      version: 'v2.4.0',
      title: 'Segurança Reforçada',
      changes: [
        'Login com E-mail: A segurança administrativa foi reforçada em versões anteriores.',
        'Gestão de Credenciais: Painel dedicado para troca de senhas e configurações de segurança.'
      ]
    },
    {
      version: 'v2.0.0',
      title: 'Solicitações Públicas',
      changes: [
        'Central de Solicitações: Membros podem solicitar novos documentos ou sugerir edições que passam por aprovação administrativa.',
        'Notificações EmailJS: Integração para alertas em tempo real para a secretaria.'
      ]
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

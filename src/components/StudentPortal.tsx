import { useState, useEffect } from 'react';
import { User, CreditCard, QrCode, LogOut, Loader2, ShieldCheck, Lock, KeyRound, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';
import VerificationResult from './VerificationResult';
import Modal from './Modal';

const STUDENT_BOND_KEY = 'davveroId_student_identity';
const STUDENT_FALLBACK_PIN = 'student_fallback_pin';

interface StudentPortalProps {
  overrideCode?: string | null;
  onOverrideConsumed?: () => void;
}

export default function StudentPortal({ overrideCode, onOverrideConsumed }: StudentPortalProps) {
  const [bondedId, setBondedId] = useState<string | null>(localStorage.getItem(STUDENT_BOND_KEY));
  const [member, setMember] = useState<Member | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkMode, setLinkMode] = useState(false);
  const [alphaCode, setAlphaCode] = useState('');

  // Modal States
  const [modalUnlinkOpen, setModalUnlinkOpen] = useState(false);
  const [modalHelpOpen, setModalHelpOpen] = useState(false);
  const [modalPinReset, setModalPinReset] = useState(false);

  // Fallback PIN state
  const [pinMode, setPinMode] = useState<'create' | 'verify' | 'none'>('none');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [resetCodeStr, setResetCodeStr] = useState('');

  const [trackMode, setTrackMode] = useState(false);
  const [trackRa, setTrackRa] = useState('');
  const [trackStatusResult, setTrackStatusResult] = useState<{status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'NOT_FOUND' | 'INACTIVE', msg: string, name?: string} | null>(null);

  useEffect(() => {
    if (bondedId && !member) {
      loadBondedMember(bondedId);
    }
  }, []);

  useEffect(() => {
    if (overrideCode && overrideCode !== member?.alphaCode) {
      loadBondedMember(overrideCode, true);
    }
  }, [overrideCode]);

  // Lock automatically when user leaves the page or hides the app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsUnlocked(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const loadBondedMember = async (id: string, isOverride = false) => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where('alphaCode', '==', id),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setMember(snapshot.docs[0].data() as Member);
        if (isOverride) {
           setIsOverrideMode(true);
           setBondedId(id);
           setIsUnlocked(true);
           onOverrideConsumed?.();
        } else {
           setIsUnlocked(false); // Make them click the Unlock or enter PIN
        }
      } else {
        setError("Identidade vinculada não encontrada.");
        if (!isOverride) {
          localStorage.removeItem(STUDENT_BOND_KEY);
          setBondedId(null);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar sua identidade.");
    } finally {
      setIsLoading(false);
    }
  };

  const linkIdentity = async () => {
    if (!alphaCode.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where('alphaCode', '==', alphaCode.toUpperCase()),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as Member;
        setMember(data);
        setBondedId(data.alphaCode || null);
        localStorage.setItem(STUDENT_BOND_KEY, data.alphaCode || '');
        setLinkMode(false);
        setPinMode('create');
      } else {
        setError("Código não encontrado na base de dados.");
      }
    } catch (err) {
      setError("Erro ao vincular identidade.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrackRequest = async () => {
    if (!trackRa.trim()) return;
    setIsLoading(true);
    setError(null);
    setTrackStatusResult(null);
    try {
      const q = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where('ra', '==', trackRa.trim())
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setTrackStatusResult({ status: 'NOT_FOUND', msg: 'Nenhum pedido encontrado para este RA/CPF.' });
      } else {
        // Find if any is not deleted, or take the last deleted if all are
        const docs = snapshot.docs.map(d => d.data());
        const activeDoc = docs.find(d => !d.deletedAt) || docs[0];
        
        let statusText = '';
        let statusObj: 'APPROVED' | 'PENDING' | 'REJECTED' | 'INACTIVE' = 'PENDING';
        
        const now = new Date();
        // Check validity date format (YYYY-MM-DD)
        const validityDate = activeDoc.validityDate ? new Date(`${activeDoc.validityDate}T23:59:59`) : null;
        const isExpired = validityDate && validityDate < now;
        
        if (activeDoc.deletedAt) {
          statusObj = 'REJECTED';
          statusText = 'Seu pedido foi reprovado ou as informações eram inválidas.';
        } else if (activeDoc.isApproved === false) {
          statusObj = 'PENDING';
          statusText = 'Seu pedido está em análise. Fique de olho no seu dispositivo ou retorno da secretaria.';
        } else if (activeDoc.isActive === false || isExpired) {
          statusObj = 'INACTIVE';
          statusText = 'Sua carteirinha encontra-se vencida ou desativada no sistema. Por favor, procure a secretaria ou o seminário para regularização.';
        } else {
          statusObj = 'APPROVED';
          statusText = 'Seu pedido foi aprovado! Você já pode vincular sua carteirinha usando o código de segurança recebido via E-mail.';
        }

        setTrackStatusResult({ status: statusObj, msg: statusText, name: activeDoc.name });
      }
    } catch (err) {
      setError("Erro ao buscar status do pedido.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = () => {
    if (pinMode === 'create') {
      if (pinInput.length === 4) {
        if (!pinConfirm) {
          setPinConfirm(pinInput);
          setPinInput('');
          setError('Confirme o PIN');
        } else if (pinInput === pinConfirm) {
          localStorage.setItem(STUDENT_FALLBACK_PIN, pinInput);
          setIsUnlocked(true);
          setPinMode('none');
          setError(null);
        } else {
          setError('Os PINs não coincidem');
          setPinInput('');
          setPinConfirm('');
        }
      } else {
        setError('O PIN deve ter 4 dígitos');
      }
    } else if (pinMode === 'verify') {
      const savedPin = localStorage.getItem(STUDENT_FALLBACK_PIN);
      if (pinInput === savedPin) {
        setIsUnlocked(true);
        setPinMode('none');
        setError(null);
        setPinInput('');
      } else {
        setError('PIN Incorreto');
        setPinInput('');
      }
    }
  };

  const handleUnlockScreen = () => {
     const hasPin = localStorage.getItem(STUDENT_FALLBACK_PIN);
     if (hasPin) {
       setPinMode('verify');
     } else {
       setPinMode('create');
     }
  };

  const handlePinResetAttempt = () => {
     if (!member || !member.alphaCode) return;
     if (resetCodeStr.toUpperCase() === member.alphaCode.toUpperCase()) {
         // Reset pin
         localStorage.removeItem(STUDENT_FALLBACK_PIN);
         setPinMode('create');
         setPinInput('');
         setPinConfirm('');
         setModalPinReset(false);
         setResetCodeStr('');
         setError('Crie uma nova senha de 4 dígitos.');
     } else {
         setError('Código incorreto.');
     }
  };

  const confirmUnlink = () => {
    if (isOverrideMode) return;
    localStorage.removeItem(STUDENT_BOND_KEY);
    localStorage.removeItem(STUDENT_FALLBACK_PIN);
    setBondedId(null);
    setMember(null);
    setIsUnlocked(false);
    setModalUnlinkOpen(false);
    setPinMode('none');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Acedendo aos seus dados...</p>
      </div>
    );
  }

  if (bondedId && member) {
    if (!isUnlocked) {
      if (pinMode !== 'none') {
        const title = pinMode === 'create' ? (!pinConfirm ? 'Criar Senha/PIN (4 dígitos)' : 'Confirme a Senha') : 'Digite sua Senha/PIN';
        return (
          <div className="flex flex-col items-center py-20 px-4 text-center space-y-6 animate-fade-in max-w-[320px] sm:max-w-sm mx-auto h-full">
            <Modal
               isOpen={modalPinReset}
               onClose={() => setModalPinReset(false)}
               title="Esqueci minha senha"
               confirmLabel="Redefinir Senha"
               onConfirm={handlePinResetAttempt}
            >
               <p className="mb-4">Para redefinir sua senha, informe seu código de uso (presente na sua aprovação de cadastro ou verso da carteirinha em PDF):</p>
               <input 
                  type="text" 
                  placeholder="Seu código de uso" 
                  autoCapitalize="characters"
                  value={resetCodeStr}
                  onChange={(e) => setResetCodeStr(e.target.value.toUpperCase())}
                  className="input-modern w-full rounded-xl py-3 px-4 text-center font-bold tracking-widest text-lg"
               />
            </Modal>

            <Lock className="w-12 h-12 text-sky-500" />
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">{title}</h2>
            <input 
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              className="text-center text-4xl tracking-[1em] font-black w-full py-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none text-slate-900 dark:text-white placeholder-slate-300 ml-[0.5em]"
              placeholder="••••"
            />
            {error && <p className="text-xs text-rose-500 font-bold uppercase">{error}</p>}
            <button 
              onClick={handlePinSubmit}
              className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold shadow-xl shadow-sky-600/20 transition-all active:scale-95"
            >
              Confirmar
            </button>
            <div className="flex flex-col gap-2 mt-4 w-full">
               {pinMode === 'verify' && (
                 <button onClick={() => { setModalPinReset(true); setError(null); }} className="text-xs text-slate-500 hover:text-sky-600 font-bold w-full p-2">Esqueci minha senha</button>
               )}
               <button onClick={() => { setPinMode('none'); setModalUnlinkOpen(true); }} className="text-xs text-rose-400 hover:text-rose-600 font-bold w-full p-2">Cancelar e Remover Conta</button>
            </div>
          </div>
        );
      }

      return (
        <>
          <Modal 
            isOpen={modalUnlinkOpen} 
            onClose={() => setModalUnlinkOpen(false)} 
            title="Remover Vínculo"
            confirmLabel="Sim, Remover"
            confirmVariant="danger"
            onConfirm={confirmUnlink}
          >
            Deseja remover sua identidade institucional deste dispositivo? Você precisará do código de segurança para vincular novamente.
          </Modal>

          <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-8 animate-fade-in relative max-w-[320px] sm:max-w-sm mx-auto h-full min-h-[60vh]">
             <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] rounded-3xl -z-10" />
             <div className="w-24 h-24 bg-sky-100 dark:bg-sky-500/10 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-inner">
                <Lock className="w-12 h-12" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Acesso Bloqueado</h2>
                <p className="text-sm text-slate-500 mt-2 font-medium">Use sua senha para desbloquear a sua carteirinha.</p>
             </div>
             <button 
               onClick={handleUnlockScreen}
               className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
             >
                <KeyRound className="w-5 h-5" /> 
                {localStorage.getItem(STUDENT_FALLBACK_PIN) ? 'Digitar Senha / PIN' : 'Criar Senha de Acesso'}
             </button>
             {error && <p className="text-[10px] text-rose-500 font-bold uppercase">{error}</p>}
             <button onClick={() => setModalUnlinkOpen(true)} className="text-xs text-rose-400 hover:text-rose-600 font-bold transition-colors">Desvincular Carteirinha</button>
          </div>
        </>
      );
    }

    return (
      <>
        <Modal 
          isOpen={modalUnlinkOpen} 
          onClose={() => setModalUnlinkOpen(false)} 
          title="Sair do Portal"
          confirmLabel="Sim, Sair"
          confirmVariant="danger"
          onConfirm={confirmUnlink}
        >
          Deseja desvincular sua carteirinha deste dispositivo? Esta ação encerrará sua sessão segura.
        </Modal>

        <div className="w-full flex flex-col items-center animate-fade-in no-print mt-10 max-w-sm sm:max-w-[600px] mx-auto">
           <div className="w-full flex justify-between items-center mb-6 px-2">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                 <ShieldCheck className="w-3 h-3" /> Acesso Seguro Ativo
              </span>
              <div className="flex gap-1">
                {!isOverrideMode && (
                  <>
                    <button 
                      onClick={() => setIsUnlocked(false)} 
                      className="p-2 text-slate-400 hover:text-sky-500 transition-colors" 
                      title="Bloquear Proteção"
                    >
                       <Lock className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setModalUnlinkOpen(true)} 
                      className="p-2 text-slate-400 hover:text-rose-500 transition-colors" 
                      title="Sair / Desvincular"
                    >
                       <LogOut className="w-5 h-5" />
                    </button>
                  </>
                )}
                {isOverrideMode && (
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center bg-amber-500/10 px-2 py-1 rounded-full">
                     MODO VISUALIZAÇÃO
                  </span>
                )}
              </div>
           </div>
           <VerificationResult 
             member={member} 
             status={member.isActive ? 'VALID' : 'INACTIVE'} 
             onReset={() => {}} 
             isMyID={true}
           />
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col items-center py-8 space-y-8 w-full max-w-2xl mx-auto">
       <Modal 
         isOpen={modalHelpOpen} 
         onClose={() => setModalHelpOpen(false)} 
         title="Instruções de Vínculo"
         onConfirm={() => {
           setLinkMode(true);
           setModalHelpOpen(false);
         }}
       >
         Para vincular sua Identidade Institucional a este dispositivo, digite o seu código único recebido da secretaria ou leia o seu QR code validado.
       </Modal>

      {!linkMode ? (
        <div className="flex flex-col items-center w-full max-w-[320px] sm:max-w-sm mx-auto space-y-4 pt-10">
          <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex justify-center items-center mb-4">
             <User className="w-12 h-12 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter text-center leading-tight">
            Identidade Estudantil
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center px-4 leading-relaxed">
            Mantenha sua carteirinha salva de forma segura e offline no seu próprio celular.
          </p>

          <div className="pt-8 w-full flex flex-col gap-3">
             <button
               onClick={() => setLinkMode(true)}
               className="w-full btn-modern py-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold tracking-wide shadow-lg flex items-center justify-center gap-3 active:scale-95"
             >
               <CreditCard className="w-5 h-5" /> Vincular Identidade
             </button>
             <button
               onClick={() => { setTrackMode(true); setLinkMode(true); }}
               className="w-full btn-modern py-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold tracking-wide shadow-sm flex items-center justify-center gap-3 active:scale-95 transition-all"
             >
               <Clock className="w-5 h-5 text-slate-400" /> Acompanhar Pedido
             </button>
             <button
               onClick={() => setModalHelpOpen(true)}
               className="w-full py-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold flex items-center justify-center gap-2 active:scale-95 mt-2"
             >
                Como funciona?
             </button>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {trackMode ? (
            <motion.div 
              key="track"
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-[320px] sm:max-w-sm mx-auto flex flex-col items-center bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-2xl"
            >
              <Clock className="w-12 h-12 text-slate-400 mb-6" />
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">Acompanhar Pedido</h3>
              <p className="text-xs text-slate-500 text-center mb-6">Digite o seu RA ou CPF (apenas números) para verificar o status da sua solicitação.</p>
              
              <input
                type="text"
                autoCapitalize="characters"
                placeholder="Ex: 123456789"
                value={trackRa}
                onChange={(e) => setTrackRa(e.target.value.toUpperCase())}
                className="text-center text-xl tracking-widest font-bold w-full py-4 px-6 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white uppercase focus:border-sky-500 transition-colors"
              />
              
              {error && <p className="text-xs font-bold text-rose-500 uppercase mt-4 mb-2 text-center">{error}</p>}

              {trackStatusResult && (
                 <div className={`mt-6 w-full p-4 rounded-xl border-2 text-center flex flex-col items-center justify-center ${trackStatusResult.status === 'APPROVED' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : trackStatusResult.status === 'REJECTED' || trackStatusResult.status === 'INACTIVE' ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/10' : trackStatusResult.status === 'NOT_FOUND' ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50' : 'border-amber-500 bg-amber-50 dark:bg-amber-900/10'}`}>
                    <h4 className={`text-sm font-black uppercase mb-1 ${trackStatusResult.status === 'APPROVED' ? 'text-emerald-700 dark:text-emerald-400' : trackStatusResult.status === 'REJECTED' || trackStatusResult.status === 'INACTIVE' ? 'text-rose-700 dark:text-rose-400' : trackStatusResult.status === 'NOT_FOUND' ? 'text-slate-600 dark:text-slate-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {trackStatusResult.status === 'APPROVED' ? 'Aprovado' : trackStatusResult.status === 'REJECTED' ? 'Reprovado / Removido' : trackStatusResult.status === 'INACTIVE' ? 'Desativada / Vencida' : trackStatusResult.status === 'NOT_FOUND' ? 'Não Encontrado' : 'Em Análise'}
                    </h4>
                    {trackStatusResult.name && <p className="text-xs font-bold text-slate-800 dark:text-white mb-2">{trackStatusResult.name}</p>}
                    <p className={`text-[10px] leading-tight ${trackStatusResult.status === 'APPROVED' ? 'text-emerald-600 dark:text-emerald-500' : trackStatusResult.status === 'REJECTED' || trackStatusResult.status === 'INACTIVE' ? 'text-rose-600 dark:text-rose-500' : trackStatusResult.status === 'NOT_FOUND' ? 'text-slate-500' : 'text-amber-600 dark:text-amber-500'}`}>
                        {trackStatusResult.msg}
                    </p>
                 </div>
              )}

              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={() => { setLinkMode(false); setTrackMode(false); setTrackStatusResult(null); setError(null); }}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleTrackRequest}
                  className="flex-1 py-3 text-sm font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-xl shadow-lg transition-colors flex items-center justify-center"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white shadow-sm" /> : 'Consultar'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="link"
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-[320px] sm:max-w-sm mx-auto flex flex-col items-center bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-2xl"
            >
              <QrCode className="w-12 h-12 text-slate-400 mb-6" />
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">Código de Uso</h3>
              <p className="text-xs text-slate-500 text-center mb-6">Digite o seu código alfanumérico para carregar seus dados no dispositivo.</p>
              
              <input
                type="text"
                autoCapitalize="characters"
                placeholder="Ex: XXXX-YYYY"
                value={alphaCode}
                onChange={(e) => setAlphaCode(e.target.value.toUpperCase())}
                className="text-center text-xl tracking-widest font-bold w-full py-4 px-6 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white uppercase focus:border-sky-500 transition-colors"
              />
              
              {error && <p className="text-xs font-bold text-rose-500 uppercase mt-4 mb-2">{error}</p>}

              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={() => setLinkMode(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={linkIdentity}
                  className="flex-1 py-3 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-lg transition-colors flex items-center justify-center"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Buscar'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

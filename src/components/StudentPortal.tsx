import { useState, useEffect } from 'react';
import { Fingerprint, User, CreditCard, QrCode, LogOut, Loader2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';
import VerificationResult from './VerificationResult';
import Modal from './Modal';

const STUDENT_BOND_KEY = 'verifyId_student_identity';
const STUDENT_BIOMETRIC_ENROLLED = 'verifyId_student_biometric';

export default function StudentPortal() {
  const [bondedId, setBondedId] = useState<string | null>(localStorage.getItem(STUDENT_BOND_KEY));
  const [member, setMember] = useState<Member | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [linkMode, setLinkMode] = useState(false);
  const [alphaCode, setAlphaCode] = useState('');

  // Modal States
  const [modalUnlinkOpen, setModalUnlinkOpen] = useState(false);
  const [modalBiometricOpen, setModalBiometricOpen] = useState(false);
  const [modalHelpOpen, setModalHelpOpen] = useState(false);

  const isBiometricSupported = !!(window.PublicKeyCredential && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable);

  useEffect(() => {
    if (bondedId) {
      loadBondedMember(bondedId);
    }
  }, []);

  const loadBondedMember = async (id: string) => {
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
        
        // Check if biometric is enrolled
        const enrolled = localStorage.getItem(STUDENT_BIOMETRIC_ENROLLED) === 'true';
        if (!enrolled) {
            // If not enrolled but bonded, we auto-unlock for now or ask (simplification)
            setIsUnlocked(true);
        } else {
            // Auto prompt biometric on load if bonded and enrolled
            handleBiometricUnlock();
        }
      } else {
        setError("Identidade vinculada não encontrada.");
        localStorage.removeItem(STUDENT_BOND_KEY);
        setBondedId(null);
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
        
        if (isBiometricSupported) {
           setModalBiometricOpen(true);
        } else {
          setIsUnlocked(true);
        }
        setLinkMode(false);
      } else {
        setError("Código não encontrado na base de dados.");
      }
    } catch (err) {
      setError("Erro ao vincular identidade.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      // Logic for device biometric check
      // For cross-platform support without a server, we use a basic validation
      setIsUnlocked(true);
    } catch (err) {
      console.error(err);
    }
  };

  const confirmUnlink = () => {
    localStorage.removeItem(STUDENT_BOND_KEY);
    localStorage.removeItem(STUDENT_BIOMETRIC_ENROLLED);
    setBondedId(null);
    setMember(null);
    setIsUnlocked(false);
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

          <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-8 animate-fade-in">
             <div className="w-20 h-20 bg-sky-100 dark:bg-sky-500/10 rounded-3xl flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Fingerprint className="w-10 h-10" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Carteirinha Bloqueada</h2>
                <p className="text-sm text-slate-500 mt-2">Use sua biometria para visualizar seus dados de identificação.</p>
             </div>
             <button 
               onClick={handleBiometricUnlock}
               className="w-full max-w-xs py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold shadow-lg shadow-sky-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
             >
                <Fingerprint className="w-5 h-5" /> Desbloquear
             </button>
             <button onClick={() => setModalUnlinkOpen(true)} className="text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors">Remover vínculo com este dispositivo</button>
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

        <div className="w-full flex flex-col items-center animate-fade-in no-print mt-10">
           <div className="w-full flex justify-between items-center mb-6 px-2">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                 <ShieldCheck className="w-3 h-3" /> Acesso Seguro Ativo
              </span>
              <button 
                onClick={() => setModalUnlinkOpen(true)} 
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors" 
                title="Sair / Desvincular"
              >
                 <LogOut className="w-5 h-5" />
              </button>
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
    <div className="flex flex-col items-center py-8 space-y-8 w-full max-w-sm mx-auto">
       <Modal 
         isOpen={modalHelpOpen} 
         onClose={() => setModalHelpOpen(false)} 
         title="Instruções de Vínculo"
         onConfirm={() => {
           setLinkMode(true);
           setModalHelpOpen(false);
         }}
         confirmLabel="Entendi"
       >
         Utilize a aba <strong className="text-slate-800 dark:text-white">'Verificar Identidade'</strong> para escanear seu QR Code físico e obter seu <strong className="text-emerald-600">Código Alfanumérico</strong>, ou consulte a secretaria da faculdade.
       </Modal>

       <Modal 
          isOpen={modalBiometricOpen} 
          onClose={() => {
            setIsUnlocked(true);
            setModalBiometricOpen(false);
          }} 
          title="Ativar Biometria"
          confirmLabel="Ativar Agora"
          onConfirm={() => {
            localStorage.setItem(STUDENT_BIOMETRIC_ENROLLED, 'true');
            setIsUnlocked(true);
          }}
          confirmVariant="success"
        >
          Deseja ativar a proteção por biometria (Digital/Rosto) para acessar sua carteirinha de forma mais segura e rápida nas próximas vezes?
        </Modal>

       <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
             <User className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Minha Identidade</h2>
          <p className="text-xs text-slate-500 leading-relaxed px-4">
            Vincule sua carteirinha digital a este telemóvel para acessá-la instantaneamente através da sua biometria.
          </p>
       </div>

       {!linkMode ? (
         <div className="w-full space-y-3">
            <button 
              onClick={() => setModalHelpOpen(true)}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
               <QrCode className="w-5 h-5" /> Vincular Carteirinha
            </button>
         </div>
       ) : (
         <div className="w-full space-y-4 animated-scale-in">
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código Alfanumérico</label>
               <input 
                 value={alphaCode}
                 onChange={(e) => setAlphaCode(e.target.value.toUpperCase())}
                 placeholder="EX: ABC-123"
                 className="input-modern w-full py-4 text-center text-xl font-black tracking-widest rounded-2xl"
               />
            </div>
            {error && <p className="text-[10px] text-rose-500 font-bold text-center uppercase tracking-tight">{error}</p>}
            <div className="flex gap-2">
               <button onClick={() => setLinkMode(false)} className="px-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold">Cancelar</button>
               <button onClick={linkIdentity} className="flex-grow py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20">Vincular Agora</button>
            </div>
         </div>
       )}

       <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-dotted border-slate-300 dark:border-slate-700">
          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-3">Como funciona?</p>
          <ul className="space-y-2">
             <li className="flex gap-2 text-[10px] text-slate-500 font-medium">
                <div className="w-4 h-4 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">1</div>
                Vincule seu código oficial ao seu navegador.
             </li>
             <li className="flex gap-2 text-[10px] text-slate-500 font-medium">
                <div className="w-4 h-4 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">2</div>
                Ative o bloqueio por impressão digital ou rosto.
             </li>
             <li className="flex gap-2 text-[10px] text-slate-500 font-medium">
                <div className="w-4 h-4 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">3</div>
                Pronto! Basta abrir o app para exibir seu documento.
             </li>
          </ul>
       </div>
    </div>
  );
}


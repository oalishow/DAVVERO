import { useState, useEffect } from "react";
import {
  User,
  CreditCard,
  QrCode,
  LogOut,
  Loader2,
  ShieldCheck,
  Lock,
  KeyRound,
  Clock,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { toCanvas } from "html-to-image";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, appId, enrollStudent } from "../lib/firebase";
import type { Member, Event, Attendance } from "../types";
import VerificationResult from "./VerificationResult";
import Modal from "./Modal";
import { ASSETS_DOC_PATH } from "../lib/constants";
import { CertificateRenderer } from "./CertificateRenderer";

const AsyncCertificateRenderer = ({ event, member }: { event: Event, member: Member }) => {
  const [template, setTemplate] = useState(event.certificateTemplate);

  useEffect(() => {
    let isMounted = true;
    if (!template) return;

    const needsAssets = template.hasCustomBg || template.hasFajopaSignature || template.hasRectorSignature;
    if (!needsAssets) return;

    const fetchAssets = async () => {
      try {
        const snap = await getDoc(doc(db, ASSETS_DOC_PATH(appId, `cert_assets_${event.id}`)));
        if (!isMounted) return;
        
        if (snap.exists() && snap.data().data) {
          const assets = snap.data().data;
          setTemplate(prev => prev ? {
            ...prev,
            ...(assets.backgroundImageUrl && { backgroundImageUrl: assets.backgroundImageUrl }),
            ...(assets.fajopaDirectorSignatureUrl && { fajopaDirectorSignatureUrl: assets.fajopaDirectorSignatureUrl }),
            ...(assets.seminarRectorSignatureUrl && { seminarRectorSignatureUrl: assets.seminarRectorSignatureUrl }),
          } : prev);
        } else if ((template as any).hasCustomBg) { // Fallback to old bg doc
          const oldBgSnap = await getDoc(doc(db, ASSETS_DOC_PATH(appId, `cert_bg_${event.id}`)));
          if (!isMounted) return;
          if (oldBgSnap.exists() && oldBgSnap.data().data) {
             setTemplate(prev => prev ? { ...prev, backgroundImageUrl: oldBgSnap.data().data } : prev);
          }
        }
      } catch (err) {
        console.error("Failed to load cert assets for portal", err);
      }
    };
    fetchAssets();
    return () => { isMounted = false; };
  }, [event.id]);

  if (!template) return null;
  return <CertificateRenderer event={event} template={template} member={member} />;
};

const STUDENT_BOND_KEY = "davveroId_student_identity";
const STUDENT_TRACK_KEY = "davveroId_student_track_ra";
const STUDENT_FALLBACK_PIN = "student_fallback_pin";

interface StudentPortalProps {
  overrideCode?: string | null;
  onOverrideConsumed?: () => void;
}

export default function StudentPortal({
  overrideCode,
  onOverrideConsumed,
}: StudentPortalProps) {
  const [bondedId, setBondedId] = useState<string | null>(
    localStorage.getItem(STUDENT_BOND_KEY),
  );
  const [member, setMember] = useState<Member | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkMode, setLinkMode] = useState(false);
  const [alphaCode, setAlphaCode] = useState("");
  const [isProcessingAnimation, setIsProcessingAnimation] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal States
  const [modalUnlinkOpen, setModalUnlinkOpen] = useState(false);
  const [modalHelpOpen, setModalHelpOpen] = useState(false);
  const [modalPinReset, setModalPinReset] = useState(false);
  const [modalDNEOpen, setModalDNEOpen] = useState(false);

  // Fallback PIN state
  const [pinMode, setPinMode] = useState<"create" | "verify" | "none">("none");
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [resetCodeStr, setResetCodeStr] = useState("");

  const [trackMode, setTrackMode] = useState(false);
  const [trackRa, setTrackRa] = useState("");
  const [trackStatusResult, setTrackStatusResult] = useState<{
    status: "APPROVED" | "PENDING" | "REJECTED" | "NOT_FOUND" | "INACTIVE";
    msg: string;
    name?: string;
  } | null>(null);

  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [myAttendances, setMyAttendances] = useState<Attendance[]>([]);
  const [isEnrollingInProgress, setIsEnrollingInProgress] = useState<
    string | null
  >(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (member) {
      const unsubEvents = onSnapshot(
        doc(db, `artifacts/${appId}/public/data/students`, "_events_global"),
        (docSnap) => {
          if (docSnap.exists()) {
            let evts = (docSnap.data().list || []) as Event[];
            evts = evts.filter(e => e.status !== "deleted");
            const now = new Date().getTime();
            evts.sort((a, b) => {
              const timeA = new Date(a.startDate).getTime();
              const timeB = new Date(b.startDate).getTime();
              const aIsFuture = timeA >= now;
              const bIsFuture = timeB >= now;
              if (aIsFuture && bIsFuture) return timeA - timeB;
              if (!aIsFuture && !bIsFuture) return timeB - timeA;
              return aIsFuture ? -1 : 1;
            });
            setAllEvents(evts);
            setAvailableEvents(evts.filter((e) => e.status === "aberto"));
          }
        },
      );

      const unsubAttendances = onSnapshot(
        doc(
          db,
          `artifacts/${appId}/public/data/students`,
          "_attendances_global",
        ),
        (docSnap) => {
          if (docSnap.exists()) {
            const list = (docSnap.data().list || []) as Attendance[];
            setMyAttendances(list.filter((a) => a.studentId === member.id));
          }
        },
      );

      return () => {
        unsubEvents();
        unsubAttendances();
      };
    }
  }, [member]);

  const handleEnroll = async (eventId: string) => {
    if (!member) {
      alert("Ação Necessária: Por favor, vincule sua carteirinha ou faça login no portal 'MINHA ID' para se inscrever neste evento.");
      return;
    }
    setIsEnrollingInProgress(eventId);
    try {
      await enrollStudent({
        eventId,
        studentId: member.id,
        status: "inscrito",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
      alert("Erro ao realizar inscrição.");
    } finally {
      setIsEnrollingInProgress(null);
    }
  };

  const handleDownloadCertificate = async (event: Event) => {
    if (!member) return;
    setIsDownloading(true);

    try {
      // Find the node
      const node = document.getElementById(`cert-node-${event.id}`);
      if (!node) {
        throw new Error("Certificado não encontrado no DOM.");
      }

      // Ensure images are loaded. We can wait a bit or use a more robust way.
      // html-to-image handles most cases better than html2canvas.
      
      const canvas = await toCanvas(node, {
        pixelRatio: 2,
        skipFonts: false,
        cacheBust: true,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);

      const fileName = `Certificado_${member.name.replace(/\s+/g, "_")}_${event.title.replace(/\s+/g, "_")}.pdf`;
      
      // Save the file
      pdf.save(fileName);

      // On mobile devices, offer to open the certificate as well
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        setTimeout(() => {
          if (confirm("Certificado descarregado! Deseja tentar abrir o arquivo para visualização imediata?")) {
            const blob = pdf.output('blob');
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
          }
        }, 1000);
      }
    } catch (e: any) {
      console.error("Download Error:", e);
      alert(`Erro ao descarregar: ${e.message || "Falha na geração do arquivo"}`);
    } finally {
      setIsDownloading(false);
    }
  };

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
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const loadBondedMember = async (id: string, isOverride = false) => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where("alphaCode", "==", id),
        limit(1),
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setMember({ ...doc.data(), id: doc.id } as Member);
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
    setIsProcessingAnimation(true);
    setError(null);

    // Wait for 3 seconds of animation as requested
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      let q;
      const cleanInput = alphaCode.trim();
      const onlyNumbers = cleanInput.replace(/\D/g, "");
      const isCPF = /^\d{11}$/.test(onlyNumbers);

      if (isCPF) {
        q = query(
          collection(db, `artifacts/${appId}/public/data/students`),
          where("cpf", "==", onlyNumbers),
          limit(1),
        );
      } else {
        q = query(
          collection(db, `artifacts/${appId}/public/data/students`),
          where("alphaCode", "==", cleanInput.toUpperCase()),
          limit(1),
        );
      }

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data() as Member;
        const memberData = { ...data, id: doc.id };
        setMember(memberData);
        setBondedId(memberData.alphaCode || null);
        localStorage.setItem(STUDENT_BOND_KEY, memberData.alphaCode || "");
        setLinkMode(false);
        setPinMode("create");
      } else {
        setError(isCPF ? "CPF não encontrado na base de dados." : "Código não encontrado na base de dados.");
      }
    } catch (err) {
      setError("Erro ao vincular identidade.");
    } finally {
      setIsLoading(false);
      setIsProcessingAnimation(false);
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
        where("ra", "==", trackRa.trim()),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setTrackStatusResult({
          status: "NOT_FOUND",
          msg: "Nenhum pedido encontrado para este RA/CPF.",
        });
      } else {
        // Find if any is not deleted, or take the last deleted if all are
        const docs = snapshot.docs.map((d) => d.data());
        const activeDoc = docs.find((d) => !d.deletedAt) || docs[0];

        let statusText = "";
        let statusObj: "APPROVED" | "PENDING" | "REJECTED" | "INACTIVE" =
          "PENDING";

        const now = new Date();
        // Check validity date format (YYYY-MM-DD)
        const validityDate = activeDoc.validityDate
          ? new Date(`${activeDoc.validityDate}T23:59:59`)
          : null;
        const isExpired = validityDate && validityDate < now;

        if (activeDoc.deletedAt) {
          statusObj = "REJECTED";
          statusText =
            "Seu pedido foi reprovado ou as informações eram inválidas.";
        } else if (activeDoc.isApproved === false) {
          statusObj = "PENDING";
          statusText =
            "Seu pedido está em análise. Fique de olho no seu dispositivo ou retorno da secretaria.";
        } else if (activeDoc.isActive === false || isExpired) {
          statusObj = "INACTIVE";
          statusText =
            "Sua carteirinha encontra-se vencida ou desativada no sistema. Por favor, procure a secretaria ou o seminário para regularização.";
        } else {
          statusObj = "APPROVED";
          statusText =
            "Seu pedido foi aprovado! Você já pode vincular sua carteirinha usando o código de segurança recebido via E-mail.";
        }

        setTrackStatusResult({
          status: statusObj,
          msg: statusText,
          name: activeDoc.name,
        });
        // Enable background notifications for this track request
        localStorage.setItem(STUDENT_TRACK_KEY, trackRa.trim());
      }
    } catch (err) {
      setError("Erro ao buscar status do pedido.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    if (pinMode === "create") {
      if (pinInput.length === 4) {
        if (!pinConfirm) {
          setPinConfirm(pinInput);
          setPinInput("");
          setError("Confirme o PIN");
        } else if (pinInput === pinConfirm) {
          localStorage.setItem(STUDENT_FALLBACK_PIN, pinInput);
          setIsGenerating(true);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          setIsUnlocked(true);
          setIsGenerating(false);
          setPinMode("none");
          setError(null);
        } else {
          setError("Os PINs não coincidem");
          setPinInput("");
          setPinConfirm("");
        }
      } else {
        setError("O PIN deve ter 4 dígitos");
      }
    } else if (pinMode === "verify") {
      const savedPin = localStorage.getItem(STUDENT_FALLBACK_PIN);
      if (pinInput === savedPin) {
        setIsGenerating(true);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        setIsUnlocked(true);
        setIsGenerating(false);
        setPinMode("none");
        setError(null);
        setPinInput("");
      } else {
        setError("PIN Incorreto");
        setPinInput("");
      }
    }
  };

  const handleUnlockScreen = () => {
    const hasPin = localStorage.getItem(STUDENT_FALLBACK_PIN);
    if (hasPin) {
      setPinMode("verify");
    } else {
      setPinMode("create");
    }
  };

  const handlePinResetAttempt = () => {
    if (!member || !member.alphaCode) return;
    if (resetCodeStr.toUpperCase() === member.alphaCode.toUpperCase()) {
      // Reset pin
      localStorage.removeItem(STUDENT_FALLBACK_PIN);
      setPinMode("create");
      setPinInput("");
      setPinConfirm("");
      setModalPinReset(false);
      setResetCodeStr("");
      setError("Crie uma nova senha de 4 dígitos.");
    } else {
      setError("Código incorreto.");
    }
  };

  const confirmUnlink = () => {
    if (isOverrideMode) return;
    localStorage.removeItem(STUDENT_BOND_KEY);
    localStorage.removeItem(STUDENT_FALLBACK_PIN);
    localStorage.removeItem("davveroId_student_identity"); // clear the specific key requested if its different
    setBondedId(null);
    setMember(null);
    setIsUnlocked(false);
    setModalUnlinkOpen(false);
    setPinMode("none");
    if (onOverrideConsumed) onOverrideConsumed();
    window.location.reload();
  };

  if (isLoading && !isProcessingAnimation && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">
          Acedendo aos seus dados...
        </p>
      </div>
    );
  }

  if (bondedId && member) {
    if (!isUnlocked) {
      if (pinMode !== "none") {
        if (isGenerating) {
          return (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-8 animate-in fade-in duration-500">
              <div className="relative">
                <motion.div
                  className="w-24 h-24 rounded-3xl border-4 border-slate-100 border-t-indigo-500 animate-spin"
                  style={{ borderRadius: "2rem" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CreditCard className="w-10 h-10 text-indigo-500 animate-pulse" />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                  Gerando Documento
                </h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                  Criptografando dados e<br />
                  aplicando selo de autenticidade
                </p>
              </div>
              <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, ease: "linear" }}
                />
              </div>
            </div>
          );
        }

        const title =
          pinMode === "create"
            ? !pinConfirm
              ? "Criar Senha/PIN (4 dígitos)"
              : "Confirme a Senha"
            : "Digite sua Senha/PIN";
        return (
          <div className="flex flex-col items-center py-20 px-4 text-center space-y-6 animate-fade-in max-w-[320px] sm:max-w-sm mx-auto h-full">
            <Modal
              isOpen={modalPinReset}
              onClose={() => setModalPinReset(false)}
              title="Esqueci minha senha"
              confirmLabel="Redefinir Senha"
              onConfirm={handlePinResetAttempt}
            >
              <p className="mb-4">
                Para redefinir sua senha, informe seu código de uso (presente na
                sua aprovação de cadastro ou verso da carteirinha em PDF):
              </p>
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
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
              {title}
            </h2>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              className="text-center text-4xl tracking-[1em] font-black w-full py-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none text-slate-900 dark:text-white placeholder-slate-300 ml-[0.5em]"
              placeholder="••••"
            />
            {error && (
              <p className="text-xs text-rose-500 font-bold uppercase">
                {error}
              </p>
            )}
            <button
              onClick={handlePinSubmit}
              className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold shadow-xl shadow-sky-600/20 transition-all active:scale-95"
            >
              Confirmar
            </button>
            <div className="flex flex-col gap-2 mt-4 w-full">
              {pinMode === "verify" && (
                <button
                  onClick={() => {
                    setModalPinReset(true);
                    setError(null);
                  }}
                  className="text-xs text-slate-500 hover:text-sky-600 font-bold w-full p-2"
                >
                  Esqueci minha senha
                </button>
              )}
              <button
                onClick={() => {
                  setPinMode("none");
                  setModalUnlinkOpen(true);
                }}
                className="text-xs text-rose-400 hover:text-rose-600 font-bold w-full p-2"
              >
                Cancelar e Remover Conta
              </button>
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
            Deseja remover sua identidade institucional deste dispositivo? Você
            precisará do código de segurança para vincular novamente.
          </Modal>

          <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-8 animate-fade-in relative max-w-[320px] sm:max-w-sm mx-auto h-full min-h-[60vh]">
            <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] rounded-3xl -z-10" />
            <div className="w-24 h-24 bg-sky-100 dark:bg-sky-500/10 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-inner">
              <Lock className="w-12 h-12" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                Acesso Bloqueado
              </h2>
              <p className="text-sm text-slate-500 mt-2 font-medium">
                Use sua senha para desbloquear a sua carteirinha.
              </p>
            </div>
            <button
              onClick={handleUnlockScreen}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-5 h-5" />
              {localStorage.getItem(STUDENT_FALLBACK_PIN)
                ? "Digitar Senha / PIN"
                : "Criar Senha de Acesso"}
            </button>
            {error && (
              <p className="text-[10px] text-rose-500 font-bold uppercase">
                {error}
              </p>
            )}
            <button
              onClick={() => setModalUnlinkOpen(true)}
              className="text-xs text-rose-400 hover:text-rose-600 font-bold transition-colors"
            >
              Desvincular Carteirinha
            </button>
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
          Deseja desvincular sua carteirinha deste dispositivo? Esta ação
          encerrará sua sessão segura.
        </Modal>

        {/* Hidden nodes for Certificate rendering - using visibility hidden instead of massive offset if possible, 
            but absolute off-screen is safer for capture tools */}
        <div className="absolute top-[-10000px] left-[-10000px] pointer-events-none" aria-hidden="true">
          {allEvents
            .filter(e => e.certificateTemplate)
            .map((e) => (
              <div key={e.id} id={`cert-node-${e.id}`} className="bg-white">
                <AsyncCertificateRenderer event={e} member={member} />
              </div>
            ))}
        </div>

        <div className="w-full flex flex-col items-center animate-fade-in mt-10 max-w-sm sm:max-w-[600px] mx-auto">
          <div className="w-full flex justify-between items-center mb-6 px-2 no-print print:hidden">
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
            status={member.isActive ? "VALID" : "INACTIVE"}
            onReset={() => {}}
            isMyID={true}
          />

          {/* SEÇÃO: BAIXAR CERTIFICADOS */}
          <div className="mt-8 w-full no-print print:hidden">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> 
              Baixar Certificados
            </h3>
            
            {allEvents.filter(
              (e) =>
                (e.status === "encerrado" || e.status === "aberto") &&
                e.certificateTemplate?.isApproved === true &&
                myAttendances.find(
                  (a) =>
                    a.eventId === e.id &&
                    (a.status === "presente" ||
                      a.status === "apto_para_certificado"),
                ),
            ).length > 0 ? (
              <div className="space-y-3">
                {allEvents
                  .filter(
                    (e) =>
                      (e.status === "encerrado" || e.status === "aberto") &&
                      e.certificateTemplate?.isApproved === true &&
                      myAttendances.find(
                        (a) =>
                          a.eventId === e.id &&
                          (a.status === "presente" ||
                            a.status === "apto_para_certificado"),
                      ),
                  )
                  .map((event) => {
                    const startStr = new Date(
                      event.startDate,
                    ).toLocaleDateString("pt-BR");
                    const endStr = event.endDate
                      ? new Date(event.endDate).toLocaleDateString("pt-BR")
                      : startStr;
                    const periodText =
                      startStr === endStr
                        ? startStr
                        : `${startStr} a ${endStr}`;
                    const formatText =
                      event.format === "online" ? "Online" : "Presencial";

                    return (
                      <div
                        key={event.id}
                        className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-left shadow-sm"
                      >
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                          {event.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mb-3">
                          {event.hours ? `${event.hours} horas • ` : ""}{formatText} • {periodText}
                        </p>
                        <button
                          onClick={() => handleDownloadCertificate(event)}
                          className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
                        >
                          {isDownloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <ExternalLink className="w-3.5 h-3.5" />
                              Descarregar Certificado
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/30 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">
                  Nenhum certificado disponível
                </p>
                <p className="text-xs text-slate-500 px-4">
                  Seus certificados aparecerão aqui assim que sua participação for confirmada em eventos encerrados ou liberados.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 w-full px-4 py-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700/50 text-center no-print print:hidden">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-3 leading-tight">
              Validade Nacional
            </h3>
            <p className="text-[10px] text-slate-500 mb-4 px-4 leading-relaxed font-medium">
              O DAVVERO-ID é seu documento institucional. Para eventos nacionais
              que exijam o padrão ITI com certificação ICP-Brasil, você pode
              solicitar o DNE oficial.
            </p>
            <button
              onClick={() => setModalDNEOpen(true)}
              className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              Solicitar Documento Nacional (DNE - Padrão ITI)
            </button>
          </div>
        </div>

        <Modal
          isOpen={modalDNEOpen}
          onClose={() => setModalDNEOpen(false)}
          title="Transparência: Documento Nacional"
          confirmLabel="Prosseguir para UNE"
          onConfirm={() => {
            window.open("https://www.documentodoestudante.com.br/", "_blank");
            setModalDNEOpen(false);
          }}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              O <strong>DAVVERO-ID</strong> é seu documento institucional
              gratuito.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Para eventos de grande porte em nível nacional que exijam
              certificação digital <strong>ICP-Brasil</strong>, você pode
              solicitar a emissão física por uma entidade parceira como a UNE.
            </p>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <p className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase tracking-widest mb-1">
                Nota Legal
              </p>
              <p className="text-[10px] text-blue-600 dark:text-blue-500 leading-tight">
                Você será redirecionado para o site oficial do Documento do
                Estudante (Padrão ITI).
              </p>
            </div>
          </div>
        </Modal>
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
        Para vincular sua Identidade Institucional a este dispositivo, digite o
        seu código único recebido da secretaria ou leia o seu QR code validado.
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
            Mantenha sua carteirinha salva de forma segura e offline no seu
            próprio celular.
          </p>

          <div className="pt-8 w-full flex flex-col gap-3">
            <button
              onClick={() => setLinkMode(true)}
              className="w-full btn-modern py-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold tracking-wide shadow-lg flex items-center justify-center gap-3 active:scale-95"
            >
              <CreditCard className="w-5 h-5" /> Vincular Identidade
            </button>
            <button
              onClick={() => {
                setTrackMode(true);
                setLinkMode(true);
              }}
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
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">
                Acompanhar Pedido
              </h3>
              <p className="text-xs text-slate-500 text-center mb-6">
                Digite o seu RA ou CPF (apenas números) para verificar o status
                da sua solicitação.
              </p>

              <input
                type="text"
                autoCapitalize="characters"
                placeholder="Ex: 123456789"
                value={trackRa}
                onChange={(e) => setTrackRa(e.target.value.toUpperCase())}
                className="text-center text-xl tracking-widest font-bold w-full py-4 px-6 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white uppercase focus:border-sky-500 transition-colors"
              />

              {error && (
                <p className="text-xs font-bold text-rose-500 uppercase mt-4 mb-2 text-center">
                  {error}
                </p>
              )}

              {trackStatusResult && (
                <div
                  className={`mt-6 w-full p-4 rounded-xl border-2 text-center flex flex-col items-center justify-center ${trackStatusResult.status === "APPROVED" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10" : trackStatusResult.status === "REJECTED" || trackStatusResult.status === "INACTIVE" ? "border-rose-500 bg-rose-50 dark:bg-rose-900/10" : trackStatusResult.status === "NOT_FOUND" ? "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50" : "border-amber-500 bg-amber-50 dark:bg-amber-900/10"}`}
                >
                  <h4
                    className={`text-sm font-black uppercase mb-1 ${trackStatusResult.status === "APPROVED" ? "text-emerald-700 dark:text-emerald-400" : trackStatusResult.status === "REJECTED" || trackStatusResult.status === "INACTIVE" ? "text-rose-700 dark:text-rose-400" : trackStatusResult.status === "NOT_FOUND" ? "text-slate-600 dark:text-slate-400" : "text-amber-700 dark:text-amber-400"}`}
                  >
                    {trackStatusResult.status === "APPROVED"
                      ? "Aprovado"
                      : trackStatusResult.status === "REJECTED"
                        ? "Reprovado / Removido"
                        : trackStatusResult.status === "INACTIVE"
                          ? "Desativada / Vencida"
                          : trackStatusResult.status === "NOT_FOUND"
                            ? "Não Encontrado"
                            : "Em Análise"}
                  </h4>
                  {trackStatusResult.name && (
                    <p className="text-xs font-bold text-slate-800 dark:text-white mb-2">
                      {trackStatusResult.name}
                    </p>
                  )}
                  <p
                    className={`text-[10px] leading-tight ${trackStatusResult.status === "APPROVED" ? "text-emerald-600 dark:text-emerald-500" : trackStatusResult.status === "REJECTED" || trackStatusResult.status === "INACTIVE" ? "text-rose-600 dark:text-rose-500" : trackStatusResult.status === "NOT_FOUND" ? "text-slate-500" : "text-amber-600 dark:text-amber-500"}`}
                  >
                    {trackStatusResult.msg}
                  </p>
                </div>
              )}

              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={() => {
                    setLinkMode(false);
                    setTrackMode(false);
                    setTrackStatusResult(null);
                    setError(null);
                  }}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleTrackRequest}
                  className="flex-1 py-3 text-sm font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-xl shadow-lg transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white shadow-sm" />
                  ) : (
                    "Consultar"
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="link"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-[320px] sm:max-w-sm mx-auto flex flex-col items-center bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-2xl relative overflow-hidden"
            >
              {isProcessingAnimation ? (
                <div className="py-12 flex flex-col items-center space-y-8 animate-in fade-in duration-500">
                  <div className="relative w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner">
                    <QrCode className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                    <motion.div
                      className="absolute left-0 right-0 h-1 bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.8)] z-10"
                      initial={{ top: "0%" }}
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    <div className="absolute inset-0 bg-sky-500/5 animate-pulse" />
                  </div>
                  <div className="space-y-2 text-center">
                    <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-widest">
                      Validando Código...
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                      Sincronizando com a base institucional
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <QrCode className="w-12 h-12 text-slate-400 mb-6" />
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">
                    Código de Uso ou CPF
                  </h3>
                  <p className="text-xs text-slate-500 text-center mb-6">
                    Digite o seu código alfanumérico ou os 11 dígitos numéricos do seu CPF para carregar seus dados no dispositivo.
                  </p>

                  <input
                    type="text"
                    autoCapitalize="characters"
                    placeholder="Ex: XXXX-YYYY ou CPF"
                    value={alphaCode}
                    onChange={(e) => setAlphaCode(e.target.value.toUpperCase())}
                    className="text-center text-xl tracking-widest font-bold w-full py-4 px-6 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white uppercase focus:border-sky-500 transition-colors"
                  />

                  {error && (
                    <p className="text-xs font-bold text-rose-500 uppercase mt-4 mb-2">
                      {error}
                    </p>
                  )}

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
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        "Buscar"
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

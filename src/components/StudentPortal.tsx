import { useState, useEffect, memo } from "react";
import {
  User,
  CreditCard,
  QrCode,
  LogOut,
  Loader2,
  ShieldCheck,
  CheckCircle,
  History,
  Lock,
  KeyRound,
  Clock,
  ExternalLink,
  Download,
  Video,
  GraduationCap,
  CalendarHeart,
  BookHeart,
  HeartHandshake
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
  updateDoc,
} from "firebase/firestore";
import { db, appId, enrollStudent } from "../lib/firebase";
import type { Member, Event, Attendance } from "../types";
import VerificationResult from "./VerificationResult";
import Modal from "./Modal";
import AppointmentsPanel from "./AppointmentsPanel";
import EventsPage from "./EventsPage";
import { ASSETS_DOC_PATH } from "../lib/constants";
import { CertificateRenderer } from "./CertificateRenderer";
import { useDialog } from "../context/DialogContext";

const AsyncCertificateRenderer = memo(
  ({
    event,
    member,
    isOrganizer,
  }: {
    event: Event;
    member: Member;
    isOrganizer?: boolean;
  }) => {
    const [template, setTemplate] = useState(event.certificateTemplate);

    useEffect(() => {
      let isMounted = true;
      if (!template) return;

      const needsAssets =
        template.hasCustomBg ||
        template.hasFajopaSignature ||
        template.hasRectorSignature;
      if (!needsAssets) return;

      const fetchAssets = async () => {
        try {
          const assetDocId = isOrganizer
            ? `cert_assets_org_${event.id}`
            : `cert_assets_${event.id}`;
          const snap = await getDoc(
            doc(db, ASSETS_DOC_PATH(appId, assetDocId)),
          );
          if (!isMounted) return;

          if (snap.exists() && snap.data().data) {
            const assets = snap.data().data;
            setTemplate((prev) =>
              prev
                ? {
                    ...prev,
                    ...(assets.backgroundImageUrl && {
                      backgroundImageUrl: assets.backgroundImageUrl,
                    }),
                    ...(assets.fajopaDirectorSignatureUrl && {
                      fajopaDirectorSignatureUrl:
                        assets.fajopaDirectorSignatureUrl,
                    }),
                    ...(assets.seminarRectorSignatureUrl && {
                      seminarRectorSignatureUrl:
                        assets.seminarRectorSignatureUrl,
                    }),
                  }
                : prev,
            );
          } else if ((template as any).hasCustomBg && !isOrganizer) {
            // Fallback to old bg doc
            const oldBgSnap = await getDoc(
              doc(db, ASSETS_DOC_PATH(appId, `cert_bg_${event.id}`)),
            );
            if (!isMounted) return;
            if (oldBgSnap.exists() && oldBgSnap.data().data) {
              setTemplate((prev) =>
                prev
                  ? { ...prev, backgroundImageUrl: oldBgSnap.data().data }
                  : prev,
              );
            }
          }
        } catch (err) {
          console.error("Failed to load cert assets for portal", err);
        }
      };
      fetchAssets();
      return () => {
        isMounted = false;
      };
    }, [event.id, isOrganizer]);

    if (!template) return null;
    return (
      <CertificateRenderer
        event={event}
        template={template}
        member={member}
        isOrganizer={isOrganizer}
      />
    );
  },
);

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
  const { showAlert, showConfirm } = useDialog();
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
  const [isPrePinAnimation, setIsPrePinAnimation] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"id" | "events" | "certificates" | "academic" | "appointments" | "seminary_events" | "liturgy">(
    "id",
  );
  const [eventsSubTab, setEventsSubTab] = useState<"upcoming" | "past">(
    "upcoming",
  );

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
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [seminaryAvailableEvents, setSeminaryAvailableEvents] = useState<Event[]>([]);
  const [seminaryPastEvents, setSeminaryPastEvents] = useState<Event[]>([]);
  const [myAttendances, setMyAttendances] = useState<Attendance[]>([]);
  const [isEnrollingInProgress, setIsEnrollingInProgress] = useState<
    string | null
  >(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let unsubEvents: any;
    let unsubAttendances: any;
    if (member) {
      const qEvents = query(collection(db, `artifacts/${appId}/public/data/events`));
      unsubEvents = onSnapshot(qEvents, (snap) => {
        let evts = snap.docs.map(d => d.data() as Event);
        evts = evts.filter((e) => e.status !== "deleted");
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
        setAvailableEvents(evts.filter((e) => e.status === "aberto" && !e.isSeminary));
        setPastEvents(evts.filter((e) => e.status === "encerrado" && !e.isSeminary));
        setSeminaryAvailableEvents(evts.filter((e) => e.status === "aberto" && e.isSeminary && (!e.seminaryId || e.seminaryId === member.seminary)));
        setSeminaryPastEvents(evts.filter((e) => e.status === "encerrado" && e.isSeminary && (!e.seminaryId || e.seminaryId === member.seminary)));
      });

      const qAttendances = query(collection(db, `artifacts/${appId}/public/data/attendances`));
      unsubAttendances = onSnapshot(qAttendances, (snap) => {
        const list = snap.docs.map(d => d.data() as Attendance);
        setMyAttendances(list.filter((a) => a.studentId === member.id));
      });

      return () => {
        if (unsubEvents) unsubEvents();
        if (unsubAttendances) unsubAttendances();
      };
    }
  }, [member]);

  const handleEnroll = async (eventId: string) => {
    if (!member) {
      showAlert(
        "Ação Necessária: Por favor, vincule sua carteirinha ou faça login no portal 'MINHA ID' para se inscrever neste evento.",
        { type: 'warning' }
      );
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
      showAlert("Erro ao realizar inscrição.", { type: 'error' });
    } finally {
      setIsEnrollingInProgress(null);
    }
  };

  const handleDownloadCertificate = async (
    event: Event,
    type: "participant" | "organizer",
  ) => {
    if (!member) return;
    setIsDownloading(true);

    try {
      // Find the node
      const node = document.getElementById(
        `cert-node-${type === "participant" ? "part" : "org"}-${event.id}`,
      );
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

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      pdf.addImage(imgData, "JPEG", 0, 0, 297, 210);

      const fileName = `Certificado_${member.name.replace(/\s+/g, "_")}_${event.title.replace(/\s+/g, "_")}.pdf`;

      // Save the file
      pdf.save(fileName);

      // On mobile devices, offer to open the certificate as well
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );

      if (isMobile) {
        setTimeout(async () => {
          if (
            await showConfirm(
              "Certificado descarregado! Deseja tentar abrir o arquivo para visualização imediata?",
              { type: 'success' }
            )
          ) {
            const blob = pdf.output("blob");
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, "_blank");
          }
        }, 1000);
      }
    } catch (e: any) {
      console.error("Download Error:", e);
      showAlert(
        `Erro ao descarregar: ${e.message || "Falha na geração do arquivo"}`,
        { type: 'error' }
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const [isUploadingCert, setIsUploadingCert] = useState(false);

  const handleUploadExternalCertificate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !member) return;

    if (file.size > 2 * 1024 * 1024) {
      await showConfirm("O arquivo é muito grande. O limite é 2MB.", { type: 'error' });
      return;
    }

    setIsUploadingCert(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        const newCert = {
          id: 'ext_cert_' + Date.now(),
          title: file.name.slice(0, 50),
          fileUrl: base64,
          uploadedAt: new Date().toISOString()
        };

        const memberRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);
        const updatedCerts = [...(member.externalCertificates || []), newCert];
        
        await updateDoc(memberRef, {
          externalCertificates: updatedCerts
        });
        
        await showConfirm("Certificado anexado com sucesso!", { type: 'success' });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Erro ao anexar certificado:", error);
      await showConfirm("Ocorreu um erro ao anexar o certificado.", { type: 'error' });
    } finally {
      setIsUploadingCert(false);
      e.target.value = '';
    }
  };

  const handleDeleteExternalCertificate = async (certId: string) => {
    if (!member) return;
    
    if (await showConfirm("Tem certeza de que deseja excluir este certificado anexado?", { type: 'warning' })) {
      try {
        const memberRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);
        const updatedCerts = (member.externalCertificates || []).filter(c => c.id !== certId);
        
        await updateDoc(memberRef, {
          externalCertificates: updatedCerts
        });
      } catch (error) {
        console.error("Erro ao excluir certificado:", error);
        await showConfirm("Ocorreu um erro ao excluir o certificado.", { type: 'error' });
      }
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

  // Automatically lock when user leaves page, ONLY if they have a PIN
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && localStorage.getItem(STUDENT_FALLBACK_PIN)) {
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
          // If the user has a PIN, require them to unlock, else automatically stay unlocked
          if (localStorage.getItem(STUDENT_FALLBACK_PIN)) {
            setIsUnlocked(false);
          } else {
            setIsUnlocked(true);
          }
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
      const cleanInput = alphaCode.trim();
      const onlyNumbers = cleanInput.replace(/\D/g, "");
      const isCPF = /^\d{11}$/.test(onlyNumbers);

      let foundMember = null;
      let usedField = "";

      if (isCPF) {
        const formattedCPF = onlyNumbers.replace(
          /(\d{3})(\d{3})(\d{3})(\d{2})/,
          "$1.$2.$3-$4",
        );

        // Try searching in CPF and RA fields concurrently for faster lookup
        const qCpf = query(
          collection(db, `artifacts/${appId}/public/data/students`),
          where("cpf", "in", [onlyNumbers, formattedCPF]),
        );
        const qRa = query(
          collection(db, `artifacts/${appId}/public/data/students`),
          where("ra", "in", [onlyNumbers, formattedCPF]),
        );

        const [snapCpf, snapRa] = await Promise.all([
          getDocs(qCpf),
          getDocs(qRa),
        ]);

        if (!snapCpf.empty) {
          // find active / non-deleted first
          const docs = snapCpf.docs;
          const active = docs.find((d) => !d.data().deletedAt) || docs[0];
          foundMember = { id: active.id, ...active.data() };
        } else if (!snapRa.empty) {
          const docs = snapRa.docs;
          const active = docs.find((d) => !d.data().deletedAt) || docs[0];
          foundMember = { id: active.id, ...active.data() };
        }
      } else {
        const qAlpha = query(
          collection(db, `artifacts/${appId}/public/data/students`),
          where("alphaCode", "==", cleanInput.toUpperCase()),
        );
        const snapAlpha = await getDocs(qAlpha);
        if (!snapAlpha.empty) {
          const docs = snapAlpha.docs;
          const active = docs.find((d) => !d.data().deletedAt) || docs[0];
          foundMember = { id: active.id, ...active.data() };
        }
      }

      if (foundMember) {
        setMember(foundMember as Member);
        setBondedId(foundMember.alphaCode || null);

        setIsLoading(false); // Make sure the Acessando dados loading screen disappears

        // Start PrePinAnimation with slower progression bar
        setLinkMode(false);
        setPinMode("create");
        setIsPrePinAnimation(true);
        // We will manage the loading bar in the UI during this 3000ms delay
        await new Promise((resolve) => setTimeout(resolve, 3000));
        setIsPrePinAnimation(false);

        localStorage.setItem(STUDENT_BOND_KEY, foundMember.alphaCode || "");
      } else {
        setError(
          isCPF
            ? "Identificação não encontrada. Verifique se o CPF ou RA estão corretos."
            : "Código não encontrado na base de dados.",
        );
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

  if (isLoading && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="relative w-full max-w-[240px]">
          <div className="absolute -inset-4 bg-sky-500/20 dark:bg-sky-500/10 rounded-[2rem] blur-xl animate-pulse z-0" />
          <div className="relative bg-white dark:bg-slate-900 border-2 border-sky-100 dark:border-sky-900/40 rounded-3xl p-6 shadow-xl shadow-sky-500/10 z-10 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                  Acessando seus dados
                </h3>
              </div>
              <div className="space-y-2">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: 1.0,
                      ease: "easeInOut",
                      repeat: Infinity,
                    }}
                    className="h-full bg-sky-500 relative"
                  >
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse" />
                  </motion.div>
                </div>
                <p className="text-[10px] sm:text-xs font-bold text-sky-600 dark:text-sky-400 tracking-wider leading-relaxed">
                  Carregando...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (bondedId && member) {
    if (!isUnlocked) {
      if (pinMode !== "none") {
        if (isPrePinAnimation && member) {
          return (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="relative w-full max-w-[240px]">
                <div className="absolute -inset-4 bg-emerald-500/20 dark:bg-emerald-500/10 rounded-[2rem] blur-xl animate-pulse z-0" />
                <div className="relative bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-emerald-900/40 rounded-3xl p-6 shadow-xl shadow-emerald-500/10 z-10 space-y-6">
                  <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                    <User className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <motion.h3
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter"
                      >
                        Identidade Localizada
                      </motion.h3>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-sm text-slate-700 dark:text-slate-300 font-bold uppercase tracking-widest leading-tight"
                      >
                        {member.name.split(" ")[0]}
                      </motion.p>
                    </div>

                    <div className="space-y-2">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                          className="h-full bg-emerald-500 relative"
                        >
                          <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse" />
                        </motion.div>
                      </div>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider leading-relaxed"
                      >
                        Preparando ambiente seguro e{" "}
                        <br className="hidden sm:block" /> aplicando camadas de
                        segurança...
                      </motion.p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

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
        <div
          className="absolute top-[-10000px] left-[-10000px] pointer-events-none"
          aria-hidden="true"
        >
          {allEvents.map((e) => {
            const hasPart = Boolean(e.certificateTemplate);
            const hasOrg = Boolean(e.organizationCertificateTemplate);
            return (
              <div key={e.id} className="contents">
                {hasPart && (
                  <div id={`cert-node-part-${e.id}`} className="bg-white">
                    <AsyncCertificateRenderer
                      event={{
                        ...e,
                        certificateTemplate: e.certificateTemplate,
                      }}
                      member={member}
                    />
                  </div>
                )}
                {hasOrg && (
                  <div id={`cert-node-org-${e.id}`} className="bg-white">
                    <AsyncCertificateRenderer
                      event={{
                        ...e,
                        certificateTemplate: e.organizationCertificateTemplate,
                      }}
                      member={member}
                      isOrganizer={true}
                    />
                  </div>
                )}
              </div>
            );
          })}
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
            onReset={() => {
              localStorage.removeItem(STUDENT_BOND_KEY);
              localStorage.removeItem(STUDENT_FALLBACK_PIN);
              setMember(null);
              setBondedId(null);
              setIsUnlocked(false);
              setPinMode("none");
            }}
            isMyID={true}
          />

          {/* TAB NAVIGATION */}
          <div className="w-full mt-8 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl flex flex-wrap gap-1 no-print print:hidden">
            <button
              onClick={() => setActiveTab("id")}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === "id"
                  ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Minha ID
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === "events"
                  ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <QrCode className="w-4 h-4" />
              Eventos
            </button>
            <button
              onClick={() => setActiveTab("certificates")}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === "certificates"
                  ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Certificados
            </button>
            <button
              onClick={() => setActiveTab("academic")}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === "academic"
                  ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">Acadêmico</span>
              <span className="sm:hidden">Acad.</span>
            </button>

            {(member?.roles?.some(r => ["SEMINARISTA", "PADRE", "REITOR", "VICE-REITOR", "PSICÓLOGA", "DIRETOR ESPIRITUAL", "DIRETORA ESPIRITUAL"].includes(r.toUpperCase()))) && (
              <>
                <button
                  onClick={() => setActiveTab("appointments")}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === "appointments"
                      ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <HeartHandshake className="w-4 h-4" />
                  Atendimento
                </button>
                <button
                  onClick={() => setActiveTab("seminary_events")}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === "seminary_events"
                      ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <CalendarHeart className="w-4 h-4" />
                  Seminário
                </button>
              </>
            )}
          </div>

          <div className="w-full mt-6">
            {activeTab === "id" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="px-4 py-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
                    Esta é a sua Identidade Estudantil oficial. Use o QR Code
                    acima para validar sua presença em eventos e garantir seu
                    acesso aos benefícios estudantis.
                  </p>
                </div>

                <div className="px-4 py-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700/50 text-center no-print print:hidden">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-3 leading-tight">
                    Validade Nacional
                  </h3>
                  <p className="text-[10px] text-slate-500 mb-4 px-4 leading-relaxed font-medium">
                    O DAVVERO-ID é seu documento institucional. Para eventos
                    nacionais que exijam o padrão ITI com certificação
                    ICP-Brasil, você pode solicitar o DNE oficial.
                  </p>
                  <button
                    onClick={() => setModalDNEOpen(true)}
                    className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                  >
                    Solicitar Documento Nacional (DNE)
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "events" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* SUB-TABS for Events */}
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/30 rounded-2xl mb-6">
                  <button
                    onClick={() => setEventsSubTab("upcoming")}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      eventsSubTab === "upcoming"
                        ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Próximos
                  </button>
                  <button
                    onClick={() => setEventsSubTab("past")}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      eventsSubTab === "past"
                        ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Histórico
                  </button>
                </div>

                {eventsSubTab === "upcoming" ? (
                  <>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-sky-500" /> Próximos
                        Eventos
                      </h3>
                    </div>

                    {availableEvents.length > 0 ? (
                      <div className="space-y-4">
                        {availableEvents.map((event) => {
                          const isEnrolled = myAttendances.some(
                            (a) => a.eventId === event.id,
                          );
                          return (
                            <div
                              key={event.id}
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <span
                                  className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                                    event.format === "presencial"
                                      ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                                      : event.format === "hibrido"
                                      ? "bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-400"
                                      : "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400"
                                  }`}
                                >
                                  {event.format === "presencial"
                                    ? "Presencial"
                                    : event.format === "hibrido"
                                    ? "Híbrido"
                                    : "Online"}
                                </span>
                                {isEnrolled && (
                                  <span className="text-[9px] font-black uppercase px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> Inscrito
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1 leading-tight">
                                {event.title}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                                {event.description}
                              </p>

                              <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight mb-4">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" />
                                  {new Date(event.startDate).toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </div>
                                {event.hours && (
                                  <div className="flex items-center gap-1.5">
                                    <LogOut className="w-3.5 h-3.5 rotate-180" />
                                    {event.hours}H
                                  </div>
                                )}
                              </div>
                              {!isEnrolled ? (
                                <button
                                  onClick={() => handleEnroll(event.id)}
                                  disabled={isEnrollingInProgress === event.id}
                                  className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                                >
                                  {isEnrollingInProgress === event.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    "Inscrever-se Agora"
                                  )}
                                </button>
                              ) : (
                                <div className="w-full py-3 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-500 rounded-2xl font-bold border border-emerald-100 dark:border-emerald-900/30 text-center text-xs">
                                  Inscrição confirmada
                                </div>
                              )}

                              {/* Event Links Section */}
                              {(event.schedulePdfUrl || event.link || event.locationOrLink) && (
                                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 text-xs font-bold uppercase mt-5 pt-4 border-t border-slate-200 dark:border-slate-700/80">
                                  {event.schedulePdfUrl && (
                                    <>
                                      <a
                                        href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center sm:justify-start gap-2 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                                      >
                                        <Download className="w-4 h-4" /> Baixar conteúdo
                                      </a>
                                      <a
                                        href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                                      >
                                        <ExternalLink className="w-4 h-4" /> Abrir Link Conteúdo
                                      </a>
                                    </>
                                  )}
                                  {(event.link || (event.locationOrLink && (event.locationOrLink.startsWith("http") || event.locationOrLink.startsWith("www.")))) && (
                                    <a
                                      href={event.link ? (event.link.startsWith("http") ? event.link : `https://${event.link}`) : (event.locationOrLink?.startsWith("http") ? event.locationOrLink : `https://${event.locationOrLink}`)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center sm:justify-start gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                                    >
                                      <Video className="w-4 h-4" /> {event.format === "presencial" ? "Acessar Conteúdo (Formulário)" : "Acessar Link do Evento"}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                          Nenhum evento aberto
                        </p>
                        <p className="text-xs text-slate-500">
                          No momento não há inscrições abertas para novos
                          eventos.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-500" /> Eventos
                        Encerrados
                      </h3>
                    </div>

                    {pastEvents.filter((e) =>
                      myAttendances.some((a) => a.eventId === e.id),
                    ).length > 0 ? (
                      <div className="space-y-4">
                        {pastEvents
                          .filter((e) =>
                            myAttendances.some((a) => a.eventId === e.id),
                          )
                          .map((event) => (
                            <div
                              key={event.id}
                              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-3xl p-5 shadow-sm"
                            >
                              <h4 className="font-bold text-slate-700 dark:text-white text-sm mb-1 leading-tight">
                                {event.title}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 uppercase font-bold">
                                {new Date(event.startDate).toLocaleDateString(
                                  "pt-BR",
                                )}{" "}
                                •{" "}
                                {event.format === "presencial"
                                  ? "Presencial"
                                  : event.format === "hibrido"
                                  ? "Híbrido"
                                  : "Online"}
                              </p>
                              <div className="flex items-center gap-2">
                                {myAttendances.find(
                                  (a) => a.eventId === event.id,
                                )?.status === "presente" ||
                                myAttendances.find(
                                  (a) => a.eventId === event.id,
                                )?.status === "apto_para_certificado" ? (
                                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-500 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Presença
                                    Confirmada
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 font-medium">
                                    <LogOut className="w-3 h-3" /> Evento
                                    Finalizado
                                  </span>
                                )}
                              </div>
                              {/* Event Links Section */}
                              {(event.schedulePdfUrl || event.link || event.locationOrLink) && (
                                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 text-xs font-bold uppercase mt-5 pt-4 border-t border-slate-200 dark:border-slate-700/80">
                                  {event.schedulePdfUrl && (
                                    <>
                                      <a
                                        href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center sm:justify-start gap-2 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                                      >
                                        <Download className="w-4 h-4" /> Baixar conteúdo
                                      </a>
                                      <a
                                        href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                                      >
                                        <ExternalLink className="w-4 h-4" /> Abrir Link Conteúdo
                                      </a>
                                    </>
                                  )}
                                  {(event.link || (event.locationOrLink && (event.locationOrLink.startsWith("http") || event.locationOrLink.startsWith("www.")))) && (
                                    <a
                                      href={event.link ? (event.link.startsWith("http") ? event.link : `https://${event.link}`) : (event.locationOrLink?.startsWith("http") ? event.locationOrLink : `https://${event.locationOrLink}`)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center sm:justify-start gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                                    >
                                      <Video className="w-4 h-4" /> {event.format === "presencial" ? "Acessar Conteúdo (Formulário)" : "Acessar Link do Evento"}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                          Sem histórico
                        </p>
                        <p className="text-xs text-slate-500">
                          Você ainda não participou ou não possui histórico em
                          eventos encerrados.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === "certificates" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> Meus
                    Certificados
                  </h3>
                </div>

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
                      .filter((e) => {
                        if (e.status !== "encerrado" && e.status !== "aberto")
                          return false;
                        const attendance = myAttendances.find(
                          (a) => a.eventId === e.id,
                        );
                        if (!attendance) return false;

                        const hasPartCert =
                          e.certificateTemplate?.isApproved === true &&
                          (attendance.status === "presente" ||
                            attendance.status === "apto_para_certificado");
                        const hasOrgCert =
                          e.organizationCertificateTemplate?.isApproved ===
                            true && attendance.isOrganizer === true;

                        return hasPartCert || hasOrgCert;
                      })
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
                          event.format === "online" ? "Online" : event.format === "hibrido" ? "Híbrido" : "Presencial";

                        const attendance = myAttendances.find(
                          (a) => a.eventId === event.id,
                        );
                        const hasPartCert =
                          event.certificateTemplate?.isApproved === true &&
                          (attendance?.status === "presente" ||
                            attendance?.status === "apto_para_certificado");
                        const hasOrgCert =
                          event.organizationCertificateTemplate?.isApproved ===
                            true && attendance?.isOrganizer === true;

                        return (
                          <div
                            key={event.id}
                            className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 text-left shadow-sm flex flex-col gap-2"
                          >
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight mb-2">
                              {event.title}
                            </h4>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span className="text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-500">
                                {formatText}
                              </span>
                              <span className="text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-500">
                                {periodText}
                              </span>
                            </div>

                            {hasPartCert && (
                              <button
                                onClick={() =>
                                  handleDownloadCertificate(
                                    event,
                                    "participant",
                                  )
                                }
                                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                              >
                                {isDownloading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <ExternalLink className="w-4 h-4" />
                                    Participação
                                  </>
                                )}
                              </button>
                            )}

                            {hasOrgCert && (
                              <button
                                onClick={() =>
                                  handleDownloadCertificate(event, "organizer")
                                }
                                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                              >
                                {isDownloading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <ExternalLink className="w-4 h-4" />
                                    Organização
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                      Nenhum certificado disponível
                    </p>
                    <p className="text-xs text-slate-500">
                      Os certificados aparecem aqui após a confirmação da sua
                      participação em eventos.
                    </p>
                  </div>
                )}

                {/* External Certificates */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                       Certificados Anexados
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {(member?.externalCertificates && member.externalCertificates.length > 0) ? (
                      <div className="space-y-3">
                        {member.externalCertificates.map(cert => (
                          <div key={cert.id} className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                            <div className="flex-1 min-w-0 pr-4">
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate mb-1">{cert.title}</h4>
                              <p className="text-[9px] text-slate-500 uppercase">{formatDateTime(cert.uploadedAt)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-sky-600 bg-sky-50 rounded-xl hover:bg-sky-100 transition-colors">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button onClick={() => handleDeleteExternalCertificate(cert.id)} className="p-2 text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors">
                                <LogOut className="w-4 h-4" /> {/* Or Trash2 if imported, but LogOut is available */}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/30 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Nenhum certificado anexado</p>
                      </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-dashed border-sky-300 dark:border-sky-700 text-center">
                       <label className="cursor-pointer text-xs font-bold text-sky-600 dark:text-sky-400 flex flex-col items-center justify-center gap-2 hover:text-sky-500 transition-colors py-2">
                         {isUploadingCert ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
                         <span>{isUploadingCert ? "Anexando..." : "Anexar Novo Certificado (Máx 2MB)"}</span>
                         <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleUploadExternalCertificate} disabled={isUploadingCert} />
                       </label>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {activeTab === "academic" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center">
                    <GraduationCap className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                  </div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                    Portal Acadêmico
                  </p>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                    Sistema Sophia
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Estamos criando uma integração direta com o Sistema Acadêmico Sophia para futuras versões. Enquanto a integração não está pronta, você pode acessar o portal externo clicando no botão abaixo.
                  </p>
                  <div className="pt-4 flex flex-col items-center gap-3">
                    <a
                      href="https://portal.sophia.com.br/SophiA_107/Acesso.aspx?escola=9087"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-md transition-all active:scale-95"
                    >
                      Acessar Portal Sophia
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                      Integração Nativa em Breve
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "appointments" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <AppointmentsPanel member={member} />
              </motion.div>
            )}

            {activeTab === "seminary_events" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <EventsPage renderSeminary={true} />
              </motion.div>
            )}
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
              <QrCode className="w-12 h-12 text-slate-400 mb-6" />
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">
                Código de Uso ou CPF
              </h3>
              <p className="text-xs text-slate-500 text-center mb-6">
                Digite o seu código alfanumérico ou os 11 dígitos numéricos do
                seu CPF para carregar seus dados no dispositivo.
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
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

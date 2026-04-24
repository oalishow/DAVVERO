import { useState, useEffect } from "react";
import { Camera, XCircle, Search, ScanLine } from "lucide-react";
import { collection, query, getDocs } from "firebase/firestore";
import {
  db,
  appId,
  updateAttendanceStatus,
  enrollStudent,
  auth,
} from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { Member, Event, Attendance } from "../types";
import VerificationResult from "./VerificationResult";
import PublicRequestModal from "./PublicRequestModal";
import SuggestEditModal from "./SuggestEditModal";

import { motion, AnimatePresence } from "motion/react";

interface VerifierProps {
  externalCode?: string | null;
  onExternalVerified?: () => void;
}

export default function Verifier({
  externalCode,
  onExternalVerified,
}: VerifierProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [codeInput, setCodeInput] = useState("");

  const [membersCache, setMembersCache] = useState<Member[]>([]);
  const [eventsCache, setEventsCache] = useState<Event[]>([]);
  const [attendancesCache, setAttendancesCache] = useState<Attendance[]>([]);
  const [verifyMode, setVerifyMode] = useState<"STANDARD" | "EVENT">(
    "STANDARD",
  );
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [pendingCheckins, setPendingCheckins] = useState<
    { attendanceId: string }[]
  >([]);
  const [validationResult, setValidationResult] = useState<{
    member: Member | null;
    status:
      | "VALID"
      | "INACTIVE"
      | "EXPIRED"
      | "NOT_FOUND"
      | "NOT_ENROLLED"
      | "ALREADY_PRESENT";
  } | null>(null);

  const [showPublicReq, setShowPublicReq] = useState(false);
  const [showSuggestEdit, setShowSuggestEdit] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [initialVerifyChecked, setInitialVerifyChecked] = useState(false);
  const [lastScannedDebug, setLastScannedDebug] = useState("");
  const [isAdminLogged, setIsAdminLogged] = useState(false);

  useEffect(() => {
    const checkAdmin = () => {
      const isMasterLogged =
        sessionStorage.getItem("adminMasterLogged") === "true";
      if (isMasterLogged) {
        setIsAdminLogged(true);
      }
    };
    checkAdmin();

    const unsub = onAuthStateChanged(auth, (user) => {
      const isMasterLogged =
        sessionStorage.getItem("adminMasterLogged") === "true";
      if ((user && !user.isAnonymous) || isMasterLogged) {
        setIsAdminLogged(true);
      } else {
        setIsAdminLogged(false);
        setVerifyMode("STANDARD");
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (cacheLoaded && externalCode) {
      runVerification(externalCode, false);
      if (onExternalVerified) onExternalVerified();
    }
  }, [cacheLoaded, externalCode]);

  // Initialize pending checkins
  useEffect(() => {
    const pending = localStorage.getItem("davveroId_pending_checkins");
    if (pending) {
      setPendingCheckins(JSON.parse(pending));
    }

    const handleOnline = async () => {
      const pendingJson = localStorage.getItem("davveroId_pending_checkins");
      if (!pendingJson) return;
      const p = JSON.parse(pendingJson) as { attendanceId: string }[];
      if (p.length === 0) return;

      let successes = 0;
      for (const ci of p) {
        try {
          await updateAttendanceStatus(ci.attendanceId, "presente");
          successes++;
        } catch (e) {
          console.error("Sync error:", e);
        }
      }
      if (successes > 0) {
        const remaining = p.slice(successes);
        localStorage.setItem(
          "davveroId_pending_checkins",
          JSON.stringify(remaining),
        );
        setPendingCheckins(remaining);
        alert(
          `${successes} check-in(s) sincronizado(s) com sucesso com o servidor.`,
        );
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  useEffect(() => {
    // Populate cache for "offline fallback" strategy
    const loadCache = async (retries = 3) => {
      try {
        const q = query(
          collection(db, `artifacts/${appId}/public/data/students`),
        );
        const snapshot = await getDocs(q);
        const allDocs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as any,
        );

        const eventsDoc = allDocs.find((d: any) => d.id === "_events_global");
        const attendancesDoc = allDocs.find(
          (d: any) => d.id === "_attendances_global",
        );
        const mList = allDocs.filter(
          (d: any) => !d.id.startsWith("_"),
        ) as Member[];

        const eList = eventsDoc?.list || [];
        const aList = attendancesDoc?.list || [];

        setMembersCache(mList);
        setEventsCache(eList);
        setAttendancesCache(aList);

        localStorage.setItem(
          "davveroId_offline_members",
          JSON.stringify(mList),
        );
        localStorage.setItem("davveroId_offline_events", JSON.stringify(eList));
        localStorage.setItem(
          "davveroId_offline_attendances",
          JSON.stringify(aList),
        );

        setCacheLoaded(true);
      } catch (e) {
        console.error("Cache load error", e);
        if (retries > 0) {
          console.log(`Retrying cache load in 3s... (${retries} left)`);
          setTimeout(() => loadCache(retries - 1), 3000);
        } else {
          const mCache = localStorage.getItem("davveroId_offline_members");
          if (mCache) setMembersCache(JSON.parse(mCache));
          const eCache = localStorage.getItem("davveroId_offline_events");
          if (eCache) setEventsCache(JSON.parse(eCache));
          const aCache = localStorage.getItem("davveroId_offline_attendances");
          if (aCache) setAttendancesCache(JSON.parse(aCache));
          setCacheLoaded(true); // Stop loading spinner even if failed to allow manual entry
        }
      }
    };
    loadCache();
  }, []);

  useEffect(() => {
    if (cacheLoaded && !initialVerifyChecked) {
      const params = new URLSearchParams(window.location.search);
      const verifyCode = params.get("verify");

      // Ignore URL parsing for verification if the query params are only internal system params
      const hasOnlyInternalParams = Array.from(params.keys()).every(
        (k) => k === "v" || k === "install",
      );
      const hasIgnorableSearch =
        params.toString().length === 0 || hasOnlyInternalParams;

      if (verifyCode) {
        runVerification(verifyCode, false, window.location.href);
      } else if (
        !hasIgnorableSearch ||
        (window.location.pathname.length > 1 &&
          window.location.pathname !== "/index.html")
      ) {
        // Fallback for native camera opening legacy URL formats redirected to this domain
        runVerification(window.location.href, false, window.location.href);
      }
      setInitialVerifyChecked(true);
    }
  }, [cacheLoaded, initialVerifyChecked, membersCache]);

  const startScanner = async () => {
    setIsScanning(true);
    setValidationResult(null);
  };

  useEffect(() => {
    let isActive = true;
    // We use any here since we avoid importing the type explicitly to save bundle size, but any works
    let ht5Qrcode: any = null;
    if (isScanning) {
      // Give more time for React to render and the DOM to settle on mobile
      const timer = setTimeout(() => {
        import("html5-qrcode").then(({ Html5Qrcode }) => {
          if (!isActive) return;

          // Avoid experimental BarCodeDetector which can be unstable on Safari/PWA
          ht5Qrcode = new Html5Qrcode("reader", { verbose: false });

          const config = {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const minEdgePercentage = 0.75;
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
              return { width: qrboxSize, height: qrboxSize };
            },
            aspectRatio: 1.0,
            disableFlip: false,
            // Adding videoConstraints explicitly for Safari
            videoConstraints: {
              facingMode: "environment",
            },
          };

          ht5Qrcode
            .start(
              { facingMode: "environment" },
              config,
              (decodedText: string) => {
                console.log("Scanner: Detected code:", decodedText);
                // Process the result immediately for responsiveness
                let memberId = decodedText;
                try {
                  console.log("Scanner: Attempting parsing...");
                  // More robust URL parameter extraction
                  if (decodedText.includes("verify=")) {
                    const parts = decodedText.split("verify=");
                    if (parts.length > 1) {
                      memberId = parts[1].split("&")[0].split("#")[0];
                    }
                  } else if (decodedText.startsWith("http")) {
                    const url = new URL(decodedText);
                    memberId = url.searchParams.get("verify") || decodedText;
                  }
                  console.log("Scanner: Extracted ID:", memberId);
                } catch (e) {
                  console.error("Scanner: Parsing error:", e);
                  // Fallback to raw text if parsing fails
                  memberId = decodedText;
                }

                // Immediately stop UI feedback and trigger verification
                setIsScanning(false);
                runVerification(memberId, false, decodedText);

                // Stop camera as cleanup
                ht5Qrcode
                  ?.stop()
                  .catch((e: any) =>
                    console.error("Scanner: Error stopping camera:", e),
                  );
              },
              (errorMessage: string) => {
                // Usually we do silent failure for scanning, but for debugging we can log
                // console.log("Scanner: Scan error (common):", errorMessage);
              },
            )
            .catch((err: any) => {
              console.error("Scanner: Camera start error:", err);
              // Inform user on serious failure
              if (
                err?.toString().includes("NotAllowedError") ||
                err?.toString().includes("Permission")
              ) {
                alert(
                  "Por favor, permita o acesso à câmera nas configurações do seu navegador para escanear.",
                );
              } else {
                alert(
                  "Não foi possível acessar a câmera. Certifique-se de que não está sendo usada por outro app.",
                );
              }
              setIsScanning(false);
            });
        });
      }, 500);

      return () => {
        isActive = false;
        clearTimeout(timer);
        if (ht5Qrcode) {
          try {
            if (ht5Qrcode.isScanning) {
              ht5Qrcode.stop().catch(() => {});
            }
          } catch (e) {}
        }
      };
    }
  }, [isScanning]);

  const handleVerifyManual = () => {
    if (!codeInput) return;
    runVerification(codeInput.toUpperCase(), true);
  };

  const runVerification = async (
    idOrCode: string,
    isAlphaCode: boolean,
    rawScannedText?: string,
  ) => {
    setIsProcessing(true);
    setSuccessMsg("");

    // Using a shorter delay for better responsiveness
    setTimeout(async () => {
      const targetId = idOrCode.toUpperCase().trim();
      const rawTextUpper = (rawScannedText || idOrCode).toUpperCase().trim();

      const foundMember = membersCache.find((m) => {
        if (m.deletedAt || m.isApproved === false) return false;
        const alphaUpper = m.alphaCode?.toUpperCase().trim();
        const raUpper = m.ra?.toUpperCase().trim();
        const legacyUpper = m.legacyQrCode?.toUpperCase().trim();

        // Remove all whitespace/symbols for aggressive matching
        const sanitize = (str?: string) =>
          (str || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
        const rawSanitized = sanitize(rawScannedText || idOrCode);
        const legacySanitized = sanitize(m.legacyQrCode);

        let legacyExtractedId = legacyUpper;
        if (m.legacyQrCode) {
          try {
            if (m.legacyQrCode.includes("verify=")) {
              const parts = m.legacyQrCode.split("verify=");
              if (parts.length > 1) {
                legacyExtractedId = parts[1]
                  .split("&")[0]
                  .split("#")[0]
                  .toUpperCase()
                  .trim();
              }
            } else if (m.legacyQrCode.startsWith("http")) {
              const lUrl = new URL(m.legacyQrCode);
              const v = lUrl.searchParams.get("verify");
              if (v) legacyExtractedId = v.toUpperCase().trim();
            }
          } catch (_) {}
        }

        if (isAlphaCode) return alphaUpper === targetId || raUpper === targetId;

        // Multi-level matching strategy
        return (
          m.id === targetId ||
          m.legacyId === targetId ||
          alphaUpper === targetId ||
          raUpper === targetId ||
          (legacyExtractedId && legacyExtractedId === targetId) ||
          (legacyUpper && rawTextUpper === legacyUpper) ||
          (legacyUpper && legacyUpper.includes(targetId)) ||
          (legacyUpper && rawTextUpper.includes(legacyUpper)) ||
          (targetId.length > 4 &&
            legacyUpper &&
            legacyUpper.includes(targetId)) ||
          (rawTextUpper.length > 4 &&
            legacyUpper &&
            rawTextUpper.includes(legacyUpper)) ||
          (legacySanitized.length > 4 &&
            rawSanitized.includes(legacySanitized)) ||
          (legacySanitized.length > 4 && legacySanitized === rawSanitized)
        );
      });

      if (!foundMember) {
        setValidationResult({ member: null, status: "NOT_FOUND" });
        setIsProcessing(false);
        return;
      }

      if (verifyMode === "EVENT") {
        if (!selectedEventId) {
          alert("Selecione um evento para fazer o check-in.");
          setIsProcessing(false);
          return;
        }

        const attendance = attendancesCache.find(
          (a) =>
            a.studentId === foundMember.id && a.eventId === selectedEventId,
        );

        if (!attendance) {
          setValidationResult({ member: foundMember, status: "NOT_ENROLLED" });
          setIsProcessing(false);
          return;
        }

        if (attendance.status === "presente") {
          setValidationResult({
            member: foundMember,
            status: "ALREADY_PRESENT",
          });
          setIsProcessing(false);
          return;
        }

        try {
          // Attempt online update
          updateAttendanceStatus(attendance.id, "presente").catch(() => {});
          setSuccessMsg("Check-in realizado com sucesso!");
        } catch (e) {
          // Ignored here, we just save to pending
        }

        // Always save offline logic for reliability and immediate feedback
        const savedPendingText = localStorage.getItem(
          "davveroId_pending_checkins",
        );
        const pList = savedPendingText ? JSON.parse(savedPendingText) : [];
        if (!pList.find((p: any) => p.attendanceId === attendance.id)) {
          pList.push({ attendanceId: attendance.id });
          localStorage.setItem(
            "davveroId_pending_checkins",
            JSON.stringify(pList),
          );
          setPendingCheckins(pList);
        }

        if (!navigator.onLine) {
          setSuccessMsg("Check-in salvo OFFLINE. Será enviado ao reconectar.");
        }

        const updatedAttendances = attendancesCache.map((a) =>
          a.id === attendance.id ? { ...a, status: "presente" as const } : a,
        );
        setAttendancesCache(updatedAttendances);
        localStorage.setItem(
          "davveroId_offline_attendances",
          JSON.stringify(updatedAttendances),
        );

        setValidationResult({ member: foundMember, status: "VALID" });
        setIsProcessing(false);
        return;
      }

      if (foundMember.isActive === false) {
        setValidationResult({ member: foundMember, status: "INACTIVE" });
        setIsProcessing(false);
        return;
      }

      if (!foundMember.validityDate) {
        setValidationResult({ member: foundMember, status: "EXPIRED" });
        setIsProcessing(false);
        return;
      }

      const isValid =
        new Date(foundMember.validityDate + "T23:59:59") >= new Date();
      setValidationResult({
        member: foundMember,
        status: isValid ? "VALID" : "EXPIRED",
      });
      setIsProcessing(false);
    }, 600); // Reduced delay from 1500 to 600ms
  };

  if (isProcessing) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 animated-fade-in relative overflow-hidden">
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Radar Ring 1 */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 border-2 border-sky-400/30 rounded-full"
          />
          {/* Radar Ring 2 */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.5], opacity: [0.5, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 1,
            }}
            className="absolute inset-0 border-2 border-emerald-400/30 rounded-full"
          />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border-t-4 border-l-4 border-sky-500 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-8 border-b-4 border-r-4 border-emerald-500 rounded-full"
          />

          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <ScanLine className="w-10 h-10 text-sky-600 dark:text-sky-400" />
            {/* Scanning Beam */}
            <motion.div
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 w-full h-[2px] bg-sky-400 shadow-[0_0_10px_#38bdf8] z-20 opacity-70"
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mt-8 relative"
        >
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-sm font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest"
          >
            A consultar base de dados...
          </motion.p>
          <p className="text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-[0.2em]">
            Verificando Assinatura Digital
          </p>

          {/* Subtle glow underneath */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-8 bg-sky-400/10 blur-3xl rounded-full"></div>
        </motion.div>
      </div>
    );
  }

  if (validationResult) {
    return (
      <div className="w-full flex flex-col items-center pt-1 pb-4 px-2">
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-xl border border-emerald-200">
            {successMsg}
          </div>
        )}
        <VerificationResult
          member={validationResult.member}
          status={validationResult.status}
          onReset={() => {
            setValidationResult(null);
            setCodeInput("");
            setSuccessMsg("");
          }}
          onEnrollAndCheckIn={async () => {
            if (!validationResult.member || !selectedEventId) return;
            try {
              setIsProcessing(true);
              await enrollStudent({
                eventId: selectedEventId,
                studentId: validationResult.member.id,
                status: "presente",
                enrolledAt: new Date().toISOString(),
              });
              // Add to cache to prevent second time
              setAttendancesCache((prev) => [
                ...prev,
                {
                  id: "att_local_" + Date.now(),
                  eventId: selectedEventId,
                  studentId: validationResult.member!.id,
                  status: "presente",
                  enrolledAt: new Date().toISOString(),
                },
              ]);
              setSuccessMsg("Inscrição e check-in realizados com sucesso!");
              setValidationResult({
                member: validationResult.member,
                status: "ALREADY_PRESENT",
              });
            } catch (e: any) {
              alert("Erro ao realizar inscrição: " + e.message);
            } finally {
              setIsProcessing(false);
            }
          }}
        />
        {validationResult.member && validationResult.status !== "NOT_FOUND" && (
          <div className="mt-4 w-full max-w-sm px-1 no-print">
            <button
              onClick={() => setShowSuggestEdit(true)}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              Sugerir Alteração / Correção
            </button>
          </div>
        )}

        {showSuggestEdit && validationResult.member && (
          <SuggestEditModal
            member={validationResult.member}
            onClose={() => setShowSuggestEdit(false)}
            onSubmitSuccess={() => {
              setShowSuggestEdit(false);
              setSuccessMsg("Sugestão enviada com sucesso! Em análise.");
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-4 flex flex-col items-center space-y-6">
      {successMsg && (
        <div className="w-full max-w-sm p-3 bg-emerald-50 text-emerald-600 text-center text-sm font-medium rounded-xl border border-emerald-200">
          {successMsg}
        </div>
      )}

      <div className="w-full text-center">
        {/* Verify Mode Selector */}
        {!isScanning && isAdminLogged && (
          <div className="w-full max-w-sm mx-auto flex gap-2 no-print p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 shadow-inner border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setVerifyMode("STANDARD")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${verifyMode === "STANDARD" ? "bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"}`}
            >
              Padrão
            </button>
            <button
              onClick={() => setVerifyMode("EVENT")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${verifyMode === "EVENT" ? "bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"}`}
            >
              Check-in Evento
            </button>
          </div>
        )}

        {verifyMode === "EVENT" && !isScanning && isAdminLogged && (
          <div className="w-full max-w-sm mx-auto mb-4 text-left">
            <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
              Selecione o Evento
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-xl py-2.5 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">-- Escolha um evento --</option>
              {eventsCache
                .filter((e) => e.status === "aberto")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
            </select>
          </div>
        )}

        {!isScanning ? (
          <button
            onClick={startScanner}
            className="btn-modern w-full md:w-3/4 mx-auto flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl shadow-lg shadow-sky-600/30 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-sky-500 via-teal-400 to-sky-500 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Camera className="w-5 h-5" />
            Escanear QR Code
          </button>
        ) : (
          <button
            onClick={() => setIsScanning(false)}
            className="btn-modern w-full md:w-3/4 mx-auto flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-rose-500 border border-rose-300 hover:bg-rose-500 hover:text-white transition-colors dark:bg-rose-500/10 dark:border-rose-500/30"
          >
            <XCircle className="w-5 h-5" />
            Cancelar Escaneamento
          </button>
        )}
      </div>

      <div
        id="reader"
        className={`w-full max-w-sm rounded-xl overflow-hidden shadow-2xl border-2 border-sky-400 dark:border-sky-500/30 aspect-square bg-black ${!isScanning && "hidden"}`}
      ></div>
      {isScanning && lastScannedDebug && (
        <div className="mt-2 text-[10px] text-yellow-600 bg-yellow-50 p-2 rounded max-w-xs break-all">
          Debug (Last Read): {lastScannedDebug}
        </div>
      )}

      {isScanning && (
        <div className="flex flex-col items-center">
          <p className="mt-2 text-[10px] text-slate-500 font-medium animate-pulse text-center">
            Dica: Aproxime ou afaste a câmera para focar no código.
          </p>
          {lastScannedDebug && (
            <div className="mt-2 text-[10px] text-yellow-600 bg-yellow-50 p-2 rounded max-w-xs break-all">
              Debug (Last Read): {lastScannedDebug}
            </div>
          )}
        </div>
      )}

      {/* Main Form Area */}
      <div className="w-full max-w-md space-y-4">
        <div className="relative flex items-center py-2 w-full max-w-md">
          <div className="flex-grow border-t border-slate-300 dark:border-slate-700/80"></div>
          <span className="mx-4 text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-widest">
            Ou valide manualmente
          </span>
          <div className="flex-grow border-t border-slate-300 dark:border-slate-700/80"></div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/40 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
          <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
            Código de Identificação ou RA
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyManual()}
              placeholder="EX: A1B2C3 OU 123456"
              className="input-modern flex-grow rounded-xl py-2.5 px-4 text-center font-mono tracking-widest uppercase text-sm sm:text-lg"
            />
            <button
              onClick={handleVerifyManual}
              className="btn-modern py-2.5 px-6 rounded-xl text-white font-bold bg-slate-800 hover:bg-sky-600 flex items-center justify-center gap-2 shadow-lg shadow-slate-800/20 dark:shadow-none transition-all"
            >
              <Search className="w-4 h-4" /> Verificar
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowPublicReq(true)}
          className="w-full btn-modern py-3.5 rounded-xl border border-sky-300 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sm font-semibold transition-all"
        >
          Primeiro Acesso? Solicitar Identidade Digital
        </button>
      </div>

      {showPublicReq && (
        <PublicRequestModal
          onClose={() => setShowPublicReq(false)}
          onSubmitSuccess={() => {
            setShowPublicReq(false);
            setSuccessMsg("Solicitação enviada com sucesso! Aguarde analise.");
            setTimeout(() => setSuccessMsg(""), 4000);
          }}
        />
      )}

      <div className="mt-8 text-center text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 max-w-sm px-4 space-y-4">
        <div>
          <p className="font-bold mb-1 uppercase tracking-widest">
            Proteção de Dados (LGPD)
          </p>
          <p className="leading-relaxed">
            Os dados processados por este sistema são estritamente para fins de
            validação institucional, em total conformidade com a Lei Geral de
            Proteção de Dados (Lei nº 13.709/2018). Todos os dados processados
            via QR Code trafegam de forma segura e não partilhada.
          </p>
        </div>
        <div>
          <p className="font-bold mb-1 uppercase tracking-widest text-sky-600 dark:text-sky-400">
            Garantia de Meia-Entrada
          </p>
          <p className="leading-relaxed italic text-[10px] sm:text-xs">
            Documento de identificação estudantil. Apresenta os dados requeridos
            pela Lei 12.933/2013 para comprovação de matrícula, sendo sua
            aceitação sujeita aos critérios dos organizadores de eventos.
          </p>
        </div>
      </div>
    </div>
  );
}

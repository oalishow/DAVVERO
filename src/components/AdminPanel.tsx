import { useState, useEffect } from "react";
import {
  Settings,
  UserPlus,
  Database,
  Trash2,
  Bell,
  Printer,
  Loader2,
  Users,
  UserCheck,
  UserX,
  Clock,
  Image as ImageIcon,
  Mail,
  LogOut,
  Share2,
  Check,
} from "lucide-react";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  query,
  getDocs,
  onSnapshot,
  where,
  Timestamp,
} from "firebase/firestore";
import { db, appId, auth, registerVisitor } from "../lib/firebase";
import { signOut } from "firebase/auth";
import type { Member } from "../types";
import { useSettings } from "../context/SettingsContext";
import { APP_VERSION } from "../lib/constants";
import MemberList from "./MemberList";
import SettingsModal from "./SettingsModal";
import RecycleBinModal from "./RecycleBinModal";
import BackupModal from "./BackupModal";
import AdminRequestsModal from "./AdminRequestsModal";
import ImageCropperModal from "./ImageCropperModal";
import PrintReportModal from "./PrintReportModal";
import EventManagement from "./EventManagement";
import EventsRecycleBin from "./EventsRecycleBin";
import { Calendar } from "lucide-react";

export default function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const { settings, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<"members" | "events" | "events_trash">("members");
  const [name, setName] = useState("");
  const [ra, setRa] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const getDefaultValidity = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  };
  const [validity, setValidity] = useState(getDefaultValidity());
  const [roles, setRoles] = useState<string[]>([]);
  const [course, setCourse] = useState("");
  const [diocese, setDiocese] = useState("");
  
  const [visitorName, setVisitorName] = useState("");
  const [visitorCpf, setVisitorCpf] = useState("");

  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const [status, setStatus] = useState<{
    msg: string;
    type: "success" | "error" | "loading";
  } | null>(null);
  const [showList, setShowList] = useState(false);
  const [listFilterStatus, setListFilterStatus] = useState<
    "all" | "active" | "inactive" | "visitor"
  >("all");
  const [showSettings, setShowSettings] = useState(false);
  const [showBin, setShowBin] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showPrintReport, setShowPrintReport] = useState(false);

  const [stats, setStats] = useState({
    totalActive: 0,
    totalInactive: 0,
    totalPending: 0,
    totalTrash: 0,
  });
  const [newRole, setNewRole] = useState("");

  const customRoles = settings.customRoles;
  const customCourses = settings.customCourses;
  const customDioceses = settings.customDioceses;

  const baseRoles = [
    "ALUNO(A)",
    "PROFESSOR(A)",
    "COLABORADOR(A)",
    "SEMINARISTA",
    "PADRE",
    "DIÁCONO",
    "BISPO",
  ];
  const availableRoles = [...baseRoles, ...customRoles];

  const [newCourse, setNewCourse] = useState("");
  const baseCourses = [
    "FILOSOFIA",
    "FILOSOFIA EAD",
    "TEOLOGIA",
    "TEOLOGIA EAD",
  ];
  const availableCourses = [...baseCourses, ...customCourses];

  const [newDiocese, setNewDiocese] = useState("");
  const baseDioceses = [
    "MARÍLIA",
    "ASSIS",
    "LINS",
    "BAURU",
    "OURINHOS",
    "PRESIDENTE PRUDENTE",
    "ARAÇATUBA",
    "BOTUCATU",
  ];
  const availableDioceses = [...baseDioceses, ...customDioceses];

  const toggleRole = (role: string) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleAddRole = async () => {
    if (
      newRole.trim() &&
      !availableRoles.includes(newRole.trim().toUpperCase())
    ) {
      const formatted = newRole.trim().toUpperCase();
      await updateSettings({ customRoles: [...customRoles, formatted] });
      setRoles((prev) => [...prev, formatted]);
      setNewRole("");
    }
  };

  const handleAddCourse = async () => {
    if (
      newCourse.trim() &&
      !availableCourses.includes(newCourse.trim().toUpperCase())
    ) {
      const formatted = newCourse.trim().toUpperCase();
      await updateSettings({ customCourses: [...customCourses, formatted] });
      setCourse(formatted);
      setNewCourse("");
    }
  };

  const handleAddDiocese = async () => {
    if (
      newDiocese.trim() &&
      !availableDioceses.includes(newDiocese.trim().toUpperCase())
    ) {
      const formatted = newDiocese.trim().toUpperCase();
      await updateSettings({ customDioceses: [...customDioceses, formatted] });
      setDiocese(formatted);
      setNewDiocese("");
    }
  };

  const loadDashboardStats = (members: Member[]) => {
    const todayObj = new Date();
    const todayStr =
      todayObj.getFullYear() +
      "-" +
      String(todayObj.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(todayObj.getDate()).padStart(2, "0");

    let active = 0;
    let inactive = 0;
    let pending = 0;
    let trash = 0;
    let expiredCountThisSession = 0;

    for (const m of members) {
      if (!m.alphaCode) {
        if (m.isApproved === false || m.pendingChanges || m.hasPendingAction)
          pending++;
        continue;
      }

      // Auto-expiration Logic
      const isExpired = m.validityDate && m.validityDate < todayStr;
      if (isExpired && m.isActive && m.isApproved && !m.deletedAt) {
        updateDoc(doc(db, `artifacts/${appId}/public/data/students`, m.id), {
          isActive: false,
          isApproved: false,
          hasPendingAction: true,
        }).catch(console.error);
        expiredCountThisSession++;
        pending++;
        continue;
      }

      if (m.deletedAt) {
        trash++;
      } else if (
        m.isApproved === false ||
        m.pendingChanges ||
        m.hasPendingAction
      ) {
        pending++;
      } else if (m.isActive === false) {
        inactive++;
      } else {
        active++;
      }
    }

    if (expiredCountThisSession > 0) {
      setStatus({
        msg: `${expiredCountThisSession} carteirinha(s) recém-vencida(s) movida(s) para Pendentes.`,
        type: "error",
      });
      setTimeout(() => setStatus(null), 6000);
    }

    setStats({
      totalActive: active,
      totalInactive: inactive,
      totalPending: pending,
      totalTrash: trash,
    });
  };

  useEffect(() => {
    if (settings.version !== APP_VERSION) {
      updateSettings({ version: APP_VERSION }).catch(console.error);
    }

    const q = query(collection(db, `artifacts/${appId}/public/data/students`));
    const unsub = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Member,
      );
      loadDashboardStats(members);
    });

    return () => unsub();
  }, [settings.version]);

  const handleLogoutAdmin = async () => {
    sessionStorage.removeItem("adminMasterLogged");
    await signOut(auth);
    onLogout();
  };

  const handleRegister = async () => {
    if (
      !name ||
      !validity ||
      !ra ||
      !course ||
      !diocese ||
      !birthdate ||
      roles.length === 0
    ) {
      setStatus({
        msg: "Preencha todos os campos obrigatórios (*).",
        type: "error",
      });
      setTimeout(() => setStatus(null), 4000);
      return;
    }

    setStatus({ msg: "A processar registo...", type: "loading" });

    try {
      const formattedRa = ra.trim();
      const membersRef = collection(
        db,
        `artifacts/${appId}/public/data/students`,
      );

      const qRa = query(membersRef, where("ra", "==", formattedRa));
      const raSnapshot = await getDocs(qRa);
      // Fazer check localmente para ignorar docs deletados, apesar que RAs únicos não deveriam duplicar nem com os deletados
      const existingActive = raSnapshot.docs.find(
        (doc) => !doc.data().deletedAt,
      );

      if (existingActive) {
        setStatus({
          msg: `Este RA (${formattedRa}) já está cadastrado no sistema. Não é possível cadastrar duplicatas.`,
          type: "error",
        });
        setTimeout(() => setStatus(null), 5000);
        return;
      }

      const alphaCode = Array(6)
        .fill(0)
        .map(
          () =>
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[
              Math.floor(Math.random() * 36)
            ],
        )
        .join("");

      await addDoc(membersRef, {
        name: name.trim(),
        ra: formattedRa,
        cpf: cpf ? cpf.replace(/\D/g, "") : "",
        rg: rg.trim() || "",
        birthdate,
        validityDate: validity,
        alphaCode,
        photoUrl: photoBase64,
        roles,
        course,
        diocese,
        isActive: true,
        isApproved: true,
        createdAt: new Date().toISOString(),
      });

      setStatus({ msg: "Identidade criada com sucesso!", type: "success" });
      setName("");
      setRa("");
      setCpf("");
      setRg("");
      setBirthdate("");
      setValidity("");
      setCourse("");
      setDiocese("");
      setRoles([]);
      setPhotoBase64(null);
      setTimeout(() => setStatus(null), 4000);
    } catch (error) {
      console.error(error);
      setStatus({
        msg: "Falha no registo. Verifique a conexão.",
        type: "error",
      });
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const handleRegisterVisitorAction = async () => {
    if (!visitorName.trim() || !visitorCpf.trim()) {
      setStatus({ msg: "Preencha Nome e CPF do visitante.", type: "error" });
      setTimeout(() => setStatus(null), 4000);
      return;
    }
    const cleanCPF = visitorCpf.replace(/\D/g, "");
    if (cleanCPF.length !== 11) {
      setStatus({ msg: "CPF deve conter 11 dígitos.", type: "error" });
      setTimeout(() => setStatus(null), 4000);
      return;
    }

    setStatus({ msg: "Cadastrando visitante...", type: "loading" });
    try {
      const visitor = await registerVisitor(visitorName.trim(), cleanCPF);
      setStatus({ msg: `Visitante cadastrado com sucesso! Posição/Código: ${visitor.alphaCode}`, type: "success" });
      setVisitorName("");
      setVisitorCpf("");
      // keep success string up for a while so they read the code
      setTimeout(() => setStatus(null), 10000); 
    } catch (e: any) {
      console.error(e);
      setStatus({ msg: e.message || "Erro ao cadastrar visitante.", type: "error" });
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handlePrint = () => {
    setShowPrintReport(true);
  };

  return (
    <div className="animated-fade-in">
      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onCropComplete={(croppedBase64) => {
            setPhotoBase64(croppedBase64);
            setCropImageSrc(null);
          }}
        />
      )}

      <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-slate-700/60 pb-3 sm:pb-4 no-print gap-2">
        <div className="flex flex-col">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-200">
            Painel de Gestão
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${auth.currentUser && !auth.currentUser.isAnonymous ? "bg-emerald-500" : "bg-amber-500"}`}
            ></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              {auth.currentUser && !auth.currentUser.isAnonymous
                ? `Logado como: ${auth.currentUser.email}`
                : "Acesso via Senha Mestre"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 sm:p-2 text-sky-600 dark:text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all"
            title="Configurações"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={handleLogoutAdmin}
            className="py-1.5 px-3 sm:py-2 sm:px-4 border border-slate-300 dark:border-slate-600/60 rounded-lg text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:text-rose-500 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700/60 no-print overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab("members")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-sm transition-colors ${
            activeTab === "members"
              ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400"
              : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          }`}
        >
          <Users className="w-4 h-4" />
          Membros & Cadastros
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-sm transition-colors ${
            activeTab === "events"
              ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400"
              : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Eventos e Presenças (BETA)
        </button>
        <button
          onClick={() => setActiveTab("events_trash")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-sm transition-colors ${
            activeTab === "events_trash"
              ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400"
              : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          }`}
        >
          <Trash2 className="w-4 h-4" />
          Lixeira de Eventos
        </button>
      </div>

      {activeTab === "events" ? (
        <EventManagement />
      ) : activeTab === "events_trash" ? (
        <EventsRecycleBin />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 no-print">
            <button
              onClick={() => {
                setListFilterStatus("active");
                setShowList(true);
              }}
              className="bg-white dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-center shadow-sm hover:border-sky-500/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <UserCheck className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-200 group-hover:text-sky-600 transition-colors">
                {stats.totalActive}
              </p>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Ativos
              </p>
            </button>
            <button
              onClick={() => setShowRequests(true)}
              className="bg-white dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-center shadow-sm hover:border-sky-500/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 relative group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
                {stats.totalPending > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
                )}
                {stats.totalPending > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
                )}
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-200 group-hover:text-sky-600 transition-colors">
                {stats.totalPending}
              </p>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Pendentes
              </p>
            </button>
            <button
              onClick={() => {
                setListFilterStatus("inactive");
                setShowList(true);
              }}
              className="bg-white dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-center shadow-sm hover:border-sky-500/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <UserX className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-200 group-hover:text-sky-600 transition-colors">
                {stats.totalInactive}
              </p>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Inativos
              </p>
            </button>
            <button
              onClick={() => setShowBin(true)}
              className="bg-white dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-center shadow-sm hover:border-sky-500/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Trash2 className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-200 group-hover:text-sky-600 transition-colors">
                {stats.totalTrash}
              </p>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Na Lixeira
              </p>
            </button>
          </div>

          <div className="space-y-4 sm:space-y-5 bg-white dark:bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 no-print">
            <h3 className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              Registo Direto de Membro
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="input-modern w-full rounded-xl py-2.5 px-3"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  RA / Matrícula *
                </label>
                <input
                  type="text"
                  value={ra}
                  onChange={(e) => setRa(e.target.value)}
                  placeholder="Ex: 123456"
                  className="input-modern w-full rounded-xl py-2.5 px-3"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="input-modern w-full rounded-xl py-2.5 px-3"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  RG
                </label>
                <input
                  type="text"
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  placeholder="00.000.000-0"
                  className="input-modern w-full rounded-xl py-2.5 px-3"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  className="input-modern w-full rounded-xl py-2.5 px-3 text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Data de Validade *
                </label>
                <input
                  type="date"
                  value={validity}
                  onChange={(e) => setValidity(e.target.value)}
                  className="input-modern w-full rounded-xl py-2.5 px-3 uppercase text-sm"
                />
              </div>

              <div className="md:col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700/50 mt-1">
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">
                  Vínculo Institucional *
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {availableRoles.map((role) => (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${roles.includes(role) ? "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/50" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700"}`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="Nova Tag (ex: MONITOR)"
                    className="input-modern flex-1 rounded-xl py-2 px-3 text-xs"
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), handleAddRole())
                    }
                  />
                  <button
                    onClick={handleAddRole}
                    className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors"
                  >
                    Adicionar Tag
                  </button>
                </div>
              </div>

              <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700/50 pt-3 mt-1">
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Curso Académico *
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="input-modern flex-1 rounded-xl py-2.5 px-3 text-sm"
                  >
                    <option value="">Selecione o Curso</option>
                    {availableCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={newCourse}
                      onChange={(e) => setNewCourse(e.target.value)}
                      placeholder="Novo Curso"
                      className="input-modern flex-1 rounded-xl py-2 px-3 text-xs"
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), handleAddCourse())
                      }
                    />
                    <button
                      onClick={handleAddCourse}
                      className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors whitespace-nowrap"
                    >
                      Add Curso
                    </button>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700/50 pt-3 mt-1">
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Diocese de Origem *
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={diocese}
                    onChange={(e) => setDiocese(e.target.value)}
                    className="input-modern flex-1 rounded-xl py-2.5 px-3 text-sm"
                  >
                    <option value="">Selecione a Diocese</option>
                    {availableDioceses.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={newDiocese}
                      onChange={(e) => setNewDiocese(e.target.value)}
                      placeholder="Nova Diocese"
                      className="input-modern flex-1 rounded-xl py-2 px-3 text-xs"
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), handleAddDiocese())
                      }
                    />
                    <button
                      onClick={handleAddDiocese}
                      className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors whitespace-nowrap"
                    >
                      Add Diocese
                    </button>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700/50 pt-3 mt-1">
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Fotografia do Membro (Opcional)
                </label>
                <div className="flex items-center gap-4">
                  {photoBase64 && (
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-300 dark:border-slate-600 shadow-sm flex-shrink-0">
                      <img
                        src={photoBase64}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2 px-4 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors text-sm font-medium dark:bg-sky-900/20 dark:border-sky-600/50 dark:text-sky-400">
                    <ImageIcon className="w-4 h-4" />
                    {photoBase64
                      ? "Alterar Fotografia"
                      : "Escolher e Recortar Fotografia"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setCropImageSrc(URL.createObjectURL(file));
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={handleRegister}
              disabled={status?.type === "loading"}
              className="btn-modern w-full flex items-center justify-center py-3.5 px-4 rounded-xl shadow-lg shadow-sky-600/20 text-sm font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500"
            >
              {status?.type === "loading" && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Criar Registo Direto & Gerar QR Code
            </button>
          </div>

          <div className="space-y-4 sm:space-y-5 bg-emerald-50 dark:bg-emerald-900/10 p-4 sm:p-6 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 no-print mt-6">
            <h3 className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Cadastro Rápido de Visitante
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Nome do Visitante *
                </label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Ex: Maria Souza"
                  className="input-modern w-full rounded-xl py-2.5 px-3"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  CPF *
                </label>
                <input
                  type="text"
                  value={visitorCpf}
                  onChange={(e) => setVisitorCpf(e.target.value)}
                  placeholder="Apenas números ou formatado"
                  className="input-modern w-full rounded-xl py-2.5 px-3"
                />
              </div>
            </div>

            <button
              onClick={handleRegisterVisitorAction}
              disabled={status?.type === "loading"}
              className="btn-modern w-full flex items-center justify-center py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500"
            >
              {status?.type === "loading" && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Cadastrar Visitante
            </button>
          </div>

          {status && status.type !== "loading" && (
            <div
              className={`mt-4 p-3 rounded-xl text-center text-sm font-medium border ${status.type === "success" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}
            >
              {status.msg}
            </div>
          )}

          {/* Toolbar & List */}
          <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-slate-200 dark:border-slate-700/60">
            <div className="no-print">
              <h3 className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                Gestão & Base de Dados
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-3 mb-4">
                <button
                  onClick={() => setShowList(!showList)}
                  className={`btn-modern py-2.5 px-3 rounded-xl border shadow-sm text-xs sm:text-sm font-medium transition-colors ${showList ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white border-transparent" : "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600/50 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
                >
                  Exibir Lista
                </button>

                <button
                  onClick={handlePrint}
                  className="btn-modern flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 text-xs sm:text-sm font-medium dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-500/30"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>

                <button
                  onClick={() => setShowBackup(true)}
                  className="btn-modern flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs sm:text-sm font-medium dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-500/30"
                >
                  <Database className="w-4 h-4" /> Backups
                </button>

                <button
                  onClick={() => setShowBin(true)}
                  className="btn-modern flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs sm:text-sm font-medium dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-500/30"
                >
                  <Trash2 className="w-4 h-4" /> Lixeira
                </button>

                <button
                  onClick={() => setShowRequests(true)}
                  className={`btn-modern flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border font-medium transition-all text-xs sm:text-sm relative ${stats.totalPending > 0 ? "bg-amber-500 border-amber-600 text-slate-900 shadow-md animate-pulse-gentle" : "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-500/30"}`}
                >
                  <Bell className="w-4 h-4" />
                  Solicitações
                  {stats.totalPending > 0 && (
                    <span className="absolute -top-2 -right-1 bg-rose-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-lg border-2 border-white dark:border-slate-800 animate-bounce">
                      {stats.totalPending}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {showList && <MemberList initialFilterStatus={listFilterStatus} />}

            <div className="bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-200 dark:border-sky-500/20 p-4 rounded-2xl mb-4 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-500/30">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-sky-200">
                    Link de Instalação Inteligente
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Envie este link para que os membros instalem o app
                    automaticamente.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const url = new URL(window.location.origin);
                  url.searchParams.set("install", "true");
                  navigator.clipboard.writeText(url.toString());
                  setStatus({
                    msg: "Link de instalação copiado!",
                    type: "success",
                  });
                  setTimeout(() => setStatus(null), 3000);
                }}
                className="bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm border border-sky-100 dark:border-sky-500/30 hover:bg-sky-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 group"
              >
                {status?.msg === "Link de instalação copiado!" ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
                Copiar Link de Convite
              </button>
            </div>
          </div>
        </>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showBin && <RecycleBinModal onClose={() => setShowBin(false)} />}
      {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}
      {showRequests && (
        <AdminRequestsModal onClose={() => setShowRequests(false)} />
      )}
      {showPrintReport && (
        <PrintReportModal onClose={() => setShowPrintReport(false)} />
      )}
    </div>
  );
}

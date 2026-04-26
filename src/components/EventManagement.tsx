import { useState, useEffect } from "react";
import {
  Calendar,
  Users,
  Clock,
  FileText,
  CheckCircle,
  Edit,
  Search,
  Award,
  Image as ImageIcon,
   Trash2,
  User,
  Download,
  ExternalLink,
} from "lucide-react";
import ImageCropperModal from "./ImageCropperModal";
import {
  collection,
  addDoc,
  query,
  getDocs,
  onSnapshot,
  orderBy,
  doc,
} from "firebase/firestore";
import {
  db,
  appId,
  createEvent,
  updateEventStatus,
  updateEvent,
  closeEvent,
  deleteEvent,
  createNotification,
} from "../lib/firebase";
import type { Event, Attendance } from "../types";
import EventAttendeesModal from "./EventAttendeesModal";
import CertificateEditor from "./CertificateEditor";
import Modal from "./Modal";
import { useDialog } from "../context/DialogContext";

export default function EventManagement() {
  const { showAlert } = useDialog();
  const [events, setEvents] = useState<Event[]>([]);
  const [attendancesCount, setAttendancesCount] = useState<
    Record<string, number>
  >({});

  const [filterStatus, setFilterStatus] = useState<
    "todos" | "aberto" | "encerrado"
  >("todos");

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "primary" | "danger" | "success";
    onConfirm: () => void;
  } | null>(null);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showAttendeesEvent, setShowAttendeesEvent] = useState<Event | null>(
    null,
  );
  const [showCertificateEditor, setShowCertificateEditor] =
    useState<{ event: Event, type: "participant" | "organizer" } | null>(null);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState<"online" | "presencial" | "hibrido">("presencial");
  const [locationOrLink, setLocationOrLink] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [hours, setHours] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [schedulePdfUrl, setSchedulePdfUrl] = useState("");
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [statusMsg, setStatusMsg] = useState<{
    msg: string;
    type: "success" | "error" | "loading";
  } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, `artifacts/${appId}/public/data/students`, "_events_global"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const evts = (data.list || []) as Event[];
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
          setEvents(evts);
        } else {
          setEvents([]);
        }
      },
    );

    const unsubAttendances = onSnapshot(
      doc(db, `artifacts/${appId}/public/data/students`, "_attendances_global"),
      (docSnap) => {
        const counts: Record<string, number> = {};
        if (docSnap.exists()) {
          const list = (docSnap.data().list || []) as Attendance[];
          list.forEach((a) => {
            counts[a.eventId] = (counts[a.eventId] || 0) + 1;
          });
        }
        setAttendancesCount(counts);
      },
    );

    return () => {
      unsub();
      unsubAttendances();
    };
  }, []);

  const handleEditClick = (event: Event) => {
    setEditingEventId(event.id);
    setTitle(event.title);
    setStartDate(event.startDate);
    setEndDate(event.endDate || "");
    setFormat(event.format || "presencial");
    setLocationOrLink(event.locationOrLink || "");
    setDescription(event.description);
    setImageUrl(event.imageUrl || "");
    setHours(event.hours ? event.hours.toString() : "");
    setMaxParticipants(event.maxParticipants.toString());
    setSpeaker(event.speaker || "");
    setSchedulePdfUrl(event.schedulePdfUrl || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingEventId(null);
    setTitle("");
    setStartDate("");
    setEndDate("");
    setFormat("presencial");
    setLocationOrLink("");
    setDescription("");
    setImageUrl("");
    setHours("");
    setMaxParticipants("");
    setSpeaker("");
    setSchedulePdfUrl("");
  };

  const handleSaveEvent = async () => {
    if (
      !title ||
      !startDate ||
      !endDate ||
      !description ||
      !maxParticipants ||
      !locationOrLink
    ) {
      setStatusMsg({ msg: "Preencha todos os campos.", type: "error" });
      setTimeout(() => setStatusMsg(null), 4000);
      return;
    }

    setStatusMsg({
      msg: editingEventId ? "A salvar alterações..." : "Criando evento...",
      type: "loading",
    });

    try {
      const payload: any = {
        title,
        startDate,
        endDate,
        format,
        locationOrLink,
        description,
        imageUrl,
        maxParticipants: Number(maxParticipants),
        speaker,
        schedulePdfUrl,
      };
      if (hours) {
        payload.hours = Number(hours);
      } else {
        payload.hours = null;
      }

      if (editingEventId) {
        await updateEvent(editingEventId, payload);
        setStatusMsg({
          msg: "Evento atualizado com sucesso!",
          type: "success",
        });
      } else {
        const newEventId = await createEvent({ ...payload, status: "aberto" });
        
        // Notify all users about the new event
        await createNotification({
          recipientId: "todos",
          title: "Novo Evento Disponível",
          message: `Um novo evento foi criado: ${title}. Confira as inscrições!`,
          type: "evento"
        }).catch(console.error);

        setStatusMsg({ msg: "Evento criado com sucesso!", type: "success" });
      }

      handleCancelEdit();
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err) {
      console.error(err);
      setStatusMsg({ msg: "Erro ao salvar evento.", type: "error" });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {showAttendeesEvent && (
        <EventAttendeesModal
          event={showAttendeesEvent}
          onClose={() => setShowAttendeesEvent(null)}
        />
      )}
      {showCertificateEditor && (
        <CertificateEditor
          event={showCertificateEditor.event}
          type={showCertificateEditor.type}
          onClose={() => setShowCertificateEditor(null)}
          onSaved={(updatedEvent) => {
            setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
            setShowCertificateEditor(null);
          }}
        />
      )}
      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onCropComplete={(croppedBase64) => {
            setImageUrl(croppedBase64);
            setCropImageSrc(null);
          }}
          aspect={16 / 9}
          cropShape="rect"
        />
      )}

      <div className="bg-white dark:bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50">
        <h3 className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          {editingEventId ? (
            <>
              <Edit className="w-5 h-5 text-sky-600 dark:text-sky-400" /> Editar
              Evento
            </>
          ) : (
            <>
              <Calendar className="w-5 h-5 text-sky-600 dark:text-sky-400" />{" "}
              Novo Evento
            </>
          )}
        </h3>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs sm:text-sm font-medium ${
              statusMsg.type === "error"
                ? "bg-rose-50 text-rose-600 border border-rose-100"
                : statusMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : "bg-sky-50 text-sky-600 border border-sky-100"
            }`}
          >
            {statusMsg.msg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
              placeholder="Ex: Semana Teológica"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Data e Hora (Início)
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500 text-slate-700 dark:text-slate-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Data e Hora (Fim)
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500 text-slate-700 dark:text-slate-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Formato
            </label>
            <select
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as "online" | "presencial" | "hibrido")
              }
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
            >
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
              <option value="hibrido">Híbrido</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              {format === 'presencial' ? 'Local ou Link do Conteúdo (Ex: Formulário)' : format === 'hibrido' ? 'Local e Link do Evento/Conteúdo' : 'Link do Evento (Ex: Zoom, Meet)'}
            </label>
            <input
              type="text"
              value={locationOrLink}
              onChange={(e) => setLocationOrLink(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
              placeholder="Auditório / Zoom link..."
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Descrição
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
              placeholder="Breve descrição do evento..."
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Imagem do Evento (URL ou Enviar Foto)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
                placeholder="https://... ou data:image/png;base64,..."
              />
              <label className="cursor-pointer flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm shrink-0">
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar Foto</span>
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
            {imageUrl && imageUrl.startsWith("data:image") && (
              <div className="mt-2 text-[10px] text-emerald-600 font-bold uppercase pl-1">
                ✓ Imagem carregada com sucesso
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Palestrante (Opcional)
            </label>
            <input
              type="text"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
              placeholder="Ex: Pe. João"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Link do conteúdo (Ex: Google Drive) (Opcional)
            </label>
            <input
              type="text"
              value={schedulePdfUrl}
              onChange={(e) => setSchedulePdfUrl(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
              placeholder="https://drive.google.com/..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Carga Horária (h)
            </label>
            <input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
              placeholder="Ex: 10"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              Vagas
            </label>
            <input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500"
              placeholder="Ex: 50"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={handleSaveEvent}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 sm:py-2.5 px-6 rounded-xl transition-colors"
          >
            {editingEventId ? "Salvar Alterações" : "Criar Evento"}
          </button>
          {editingEventId && (
            <button
              onClick={handleCancelEdit}
              className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 sm:py-2.5 px-6 rounded-xl transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Eventos Criados{" "}
            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold ml-1">
              BETA
            </span>
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full sm:w-auto">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar evento..."
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg self-start sm:self-auto w-full sm:w-auto">
              <button
                onClick={() => setFilterStatus("todos")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterStatus === "todos" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800"}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterStatus("aberto")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterStatus === "aberto" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800"}`}
              >
                Abertos / Próximos
              </button>
              <button
                onClick={() => setFilterStatus("encerrado")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterStatus === "encerrado" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800"}`}
              >
                Concluídos
              </button>
            </div>
          </div>
        </div>

        {events.filter((e) => {
          const searchLower = eventSearchQuery.toLowerCase();
          const matchesSearch = e.title.toLowerCase().includes(searchLower) || e.description.toLowerCase().includes(searchLower);
          const matchesFilter = (filterStatus === "todos" && e.status !== "deleted") || e.status === filterStatus;
          return matchesFilter && matchesSearch;
        }).length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
            Nenhum evento encontrado.
          </p>
        ) : (
          <div className="space-y-3">
            {events
              .filter((e) => {
                const searchLower = eventSearchQuery.toLowerCase();
                const matchesSearch = e.title.toLowerCase().includes(searchLower) || e.description.toLowerCase().includes(searchLower);
                const matchesFilter = (filterStatus === "todos" && e.status !== "deleted") || e.status === filterStatus;
                return matchesFilter && matchesSearch;
              })
              .map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-1 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">
                        {event.title}
                      </h4>
                      {event.status === "aberto" ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                          Aberto
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                          Encerrado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 whitespace-pre-wrap">
                      {event.description.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part, i) => {
                        if (part.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/)) {
                          const href = part.startsWith("http") ? part : `https://${part}`;
                          // For a line-clamp element, rendering a link is totally fine.
                          return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-600 hover:underline inline-flex">{part}</a>;
                        }
                        return part;
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-100 dark:border-sky-500/20">
                        <Clock className="w-3 h-3" />{" "}
                        {new Date(event.startDate).toLocaleString("pt-BR")}
                      </span>
                      {event.hours ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-500/20">
                          <FileText className="w-3 h-3" /> {event.hours}h
                        </span>
                      ) : null}
                      {event.locationOrLink && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-600 bg-pink-50 dark:bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-100 dark:border-pink-500/20">
                          {(event.locationOrLink.startsWith("http") || event.locationOrLink.startsWith("www.")) ? (
                            <a href={event.locationOrLink.startsWith("http") ? event.locationOrLink : `https://${event.locationOrLink}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                              Link <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="truncate max-w-[100px]">{event.locationOrLink}</span>
                          )}
                        </span>
                      )}
                      {event.speaker && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-500/20">
                          <User className="w-3 h-3" /> {event.speaker}
                        </span>
                      )}
                      {event.schedulePdfUrl && (
                        <>
                          <a href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 transition-colors">
                            <ExternalLink className="w-3 h-3" /> Abrir Link
                          </a>
                          <a href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-100 dark:border-sky-500/20 hover:bg-sky-100 transition-colors">
                            <Download className="w-3 h-3" /> Baixar
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2 sm:py-3 rounded-xl w-full sm:w-auto">
                    <div className="text-center flex-1 sm:flex-none">
                      <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                        <Users className="w-3 h-3" /> Inscritos
                      </p>
                      <p className="font-black text-slate-700 dark:text-slate-200 text-sm mt-0.5">
                        {attendancesCount[event.id] || 0} /{" "}
                        {event.maxParticipants}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:flex flex-wrap bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1 w-full sm:w-auto mt-2 sm:mt-0">
                      <button
                        onClick={() => setShowAttendeesEvent(event)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-md transition-colors"
                      >
                        <Search className="w-3.5 h-3.5 shrink-0" />{" "}
                        <span className="truncate">Inscritos</span>
                      </button>
                      <button
                        onClick={() => setShowCertificateEditor({ event, type: "participant" })}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 hover:bg-white dark:hover:bg-slate-700 text-xs font-bold rounded-md transition-colors ${
                          event.certificateTemplate?.isApproved 
                            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" 
                            : "text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        <Award className="w-3.5 h-3.5 shrink-0" />{" "}
                        <span className="truncate">Certificado</span>
                        {event.certificateTemplate?.isApproved && (
                          <CheckCircle className="w-3 h-3 text-emerald-500 ml-1" />
                        )}
                      </button>
                      <button
                        onClick={() => setShowCertificateEditor({ event, type: "organizer" })}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 hover:bg-white dark:hover:bg-slate-700 text-xs font-bold rounded-md transition-colors ${
                          event.organizationCertificateTemplate?.isApproved 
                            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" 
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                        title="Certificado de Organização"
                      >
                        <Award className="w-3.5 h-3.5 shrink-0" />{" "}
                        <span className="truncate">Cert. Org.</span>
                        {event.organizationCertificateTemplate?.isApproved && (
                          <CheckCircle className="w-3 h-3 text-emerald-500 ml-1" />
                        )}
                      </button>
                      {(event.status === "aberto" || event.status === "encerrado") && (
                        <button
                          onClick={() => handleEditClick(event)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 hover:bg-white dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 text-xs font-bold rounded-md transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5 shrink-0" />{" "}
                          <span className="truncate">Editar</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: "Excluir Evento",
                            message:
                              "Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.",
                            variant: "danger",
                            onConfirm: () => {
                              deleteEvent(event.id)
                                .catch((e) => showAlert(e.message, { type: 'error' }));
                            },
                          });
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />{" "}
                        <span className="truncate">Excluir</span>
                      </button>
                    </div>

                    {event.status === "aberto" && (
                      <button
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: "Encerrar Evento",
                            message:
                              "Encerrar evento? Os alunos presentes receberão certificados.",
                            variant: "primary",
                            onConfirm: () => {
                              closeEvent(event.id).catch((e) =>
                                showAlert(e.message, { type: 'error' }),
                              );
                            },
                          });
                        }}
                        className="w-full sm:w-auto whitespace-nowrap px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-lg transition-colors border border-emerald-200 dark:border-emerald-500/30"
                      >
                        Encerrar e Liberar Certificados
                      </button>
                    )}

                    {event.status === "encerrado" && (
                      <button
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: "Reabrir Evento",
                            message:
                              "Deseja reabrir este evento? Ele voltará a aceitar inscrições.",
                            variant: "primary",
                            onConfirm: () => {
                              updateEventStatus(event.id, "aberto").catch((e) =>
                                showAlert(e.message, { type: 'error' }),
                              );
                            },
                          });
                        }}
                        className="w-full sm:w-auto whitespace-nowrap px-3 py-1.5 bg-sky-100 hover:bg-sky-200 dark:bg-sky-500/20 dark:hover:bg-sky-500/30 text-sky-700 dark:text-sky-400 text-xs font-bold rounded-lg transition-colors border border-sky-200 dark:border-sky-500/30"
                      >
                        Reabrir Evento
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!confirmModal?.isOpen}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.title || ""}
        confirmLabel="Confirmar"
        confirmVariant={confirmModal?.variant || "primary"}
        onConfirm={confirmModal?.onConfirm}
      >
        <p className="text-slate-600 dark:text-slate-400">
          {confirmModal?.message}
        </p>
      </Modal>
    </div>
  );
}

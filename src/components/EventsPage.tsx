import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Calendar,
  CalendarPlus,
  Clock,
  MapPin,
  Video,
  UserCheck,
  Users,
  Ban,
  User,
  Download,
  ExternalLink,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
} from "firebase/firestore";
import {
  db,
  appId,
  enrollStudent,
  unsubscribeFromEvent,
} from "../lib/firebase";
import type { Event, Attendance, Member } from "../types";
import PublicAttendeesModal from "./PublicAttendeesModal";
import Modal from "./Modal";
import { useDialog } from "../context/DialogContext";

export default function EventsPage({ onNavigateToStudent, renderSeminary = false }: { onNavigateToStudent?: () => void, renderSeminary?: boolean }) {
  const { showAlert } = useDialog();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventTypeTab, setEventTypeTab] = useState<"general" | "seminary">(renderSeminary ? "seminary" : "general");
  const [subTab, setSubTab] = useState<"upcoming" | "past">("upcoming");
  const [myAttendances, setMyAttendances] = useState<Attendance[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [isEnrollingInProgress, setIsEnrollingInProgress] = useState<
    string | null
  >(null);
  const [viewPublicAttendeesEvent, setViewPublicAttendeesEvent] =
    useState<Event | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [showLoginWarning, setShowLoginWarning] = useState(false);

  useEffect(() => {
    // Load student if logged in
    const bondedId = localStorage.getItem("davveroId_student_identity");
    if (bondedId) {
      const fetchStudent = async () => {
        try {
          const q = query(
            collection(db, `artifacts/${appId}/public/data/students`),
            where("alphaCode", "==", bondedId),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setMember({
              id: snap.docs[0].id,
              ...snap.docs[0].data(),
            } as Member);
          }
        } catch (e) {
          console.error("Failed to load student", e);
        }
      };
      fetchStudent();
    }
  }, []);

  useEffect(() => {
    const qEvents = query(collection(db, `artifacts/${appId}/public/data/events`));
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      let evts = snap.docs.map(d => d.data() as Event);
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
      setEvents(evts);
    });

    return () => unsubEvents();
  }, []);

  const filteredEvents = events.filter((e) => {
    if (eventTypeTab === "seminary") {
      if (!e.isSeminary) return false;
      if (e.seminaryId && e.seminaryId !== member?.seminary) return false;
      return true;
    } else {
      return !e.isSeminary;
    }
  });

  useEffect(() => {
    if (!member) return;

    const qAttendances = query(collection(db, `artifacts/${appId}/public/data/attendances`));
    const unsubAttendances = onSnapshot(qAttendances, (snap) => {
      const atts = snap.docs.map(d => d.data() as Attendance);
      setMyAttendances(
        atts.filter((a: Attendance) => a.studentId === member.id),
      );
    });

    return () => unsubAttendances();
  }, [member]);

  const handleEnroll = async (eventId: string) => {
    if (!member) {
      setShowLoginWarning(true);
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
      showAlert("Inscrição realizada com sucesso!", { type: 'success' });
    } catch (err: any) {
      console.error(err);
      if (err.message === "LIMITE_EXCEDIDO") {
        showAlert("Desculpe, a lotação para este evento está esgotada.", { type: 'warning' });
      } else if (err.message === "INSCRICOES_PAUSADAS") {
        showAlert("Desculpe, as inscrições para este evento estão pausadas.", { type: 'warning' });
      } else if (err.message === "INSCRICOES_ENCERRADAS") {
        showAlert("Desculpe, as inscrições para este evento já foram encerradas (prazo expirou).", { type: 'warning' });
      } else if (err.message === "EVENTO_FECHADO") {
        showAlert("Desculpe, este evento já está fechado ou encerrado.", { type: 'warning' });
      } else if (err.message === "EVENTO_EXCLUIDO") {
        showAlert("Desculpe, este evento não existe mais.", { type: 'error' });
      } else {
        showAlert("Erro ao realizar inscrição.", { type: 'error' });
      }
    } finally {
      setIsEnrollingInProgress(null);
    }
  };

  const handleUnenroll = async (eventId: string, studentId: string) => {
    setConfirmModal({
      isOpen: true,
      message:
        "Tem a certeza que deseja cancelar a sua inscrição neste evento?",
      onConfirm: async () => {
        try {
          await unsubscribeFromEvent(eventId, studentId);
          showAlert("Inscrição cancelada com sucesso.", { type: 'success' });
        } catch (err) {
          console.error(err);
          showAlert("Erro ao cancelar inscrição.", { type: 'error' });
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aberto":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400";
      case "encerrado":
        return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400";
      default:
        return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400";
    }
  };

  const exportToCalendar = (event: Event) => {
    const formatDate = (dateUnparsed: string) => {
      const d = new Date(dateUnparsed);
      // Create ICS format: YYYYMMDDTHHmmssZ
      return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    let locationStr = event.locationOrLink || event.location || "";
    if (locationStr && !locationStr.startsWith("http")) {
      locationStr = `LOCATION:${locationStr}\n`;
    } else {
      locationStr = "";
    }

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Fajopa//Eventos//PT
BEGIN:VEVENT
UID:${event.id}@fajopa.com
DTSTAMP:${formatDate(new Date().toISOString())}
DTSTART:${formatDate(event.startDate)}
DTEND:${formatDate(event.endDate)}
SUMMARY:${event.title}
DESCRIPTION:${event.description.replace(/\n/g, "\\n")}
${locationStr}END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${event.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className={`${renderSeminary ? 'bg-amber-600 dark:bg-amber-700 border-amber-500 dark:border-amber-600' : 'bg-sky-600 dark:bg-sky-700 border-sky-500 dark:border-sky-600'} rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border`}>
        {viewPublicAttendeesEvent && (
          <PublicAttendeesModal
            event={viewPublicAttendeesEvent}
            onClose={() => setViewPublicAttendeesEvent(null)}
          />
        )}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-2">
            {renderSeminary ? "Eventos do Seminário" : "Painel de Eventos"}
          </h2>
          <p className={`${renderSeminary ? 'text-amber-100' : 'text-sky-100'} font-medium text-sm sm:text-base max-w-md mx-auto`}>
            {renderSeminary ? "Explore e inscreva-se nos retiros, formações exclusivas e demais eventos." : "Explore e inscreva-se nos próximos eventos acadêmicos e do seminário."}
          </p>
        </div>
      </div>

      {!renderSeminary && (
        <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl mb-2 shadow-inner no-print border border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={() => setEventTypeTab("general")}
            className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${
              eventTypeTab === "general"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-md transform scale-[1.02]"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
            }`}
          >
            Acadêmico
          </button>
          <button
            onClick={() => setEventTypeTab("seminary")}
            className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${
              eventTypeTab === "seminary"
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-md transform scale-[1.02]"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
            }`}
          >
            SEMINÁRIO
          </button>
        </div>
      )}

      {eventTypeTab === "seminary" && !renderSeminary && !member && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 p-6 rounded-2xl text-center mb-4">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3">
            Eventos do Seminário são exclusivos para seminaristas
          </p>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-500 mb-4">
            Você precisa vincular sua identidade na aba MINHA ID para visualizar e se inscrever.
          </p>
          <button 
            onClick={() => {
              if (onNavigateToStudent) onNavigateToStudent();
            }}
            className="px-4 py-2 bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold uppercase hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
          >
            Ir para Minha ID
          </button>
        </div>
      )}

      {!(eventTypeTab === "seminary" && !renderSeminary && !member) && (
        <>
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl mb-6 shadow-inner no-print border border-slate-200/50 dark:border-slate-700/50">
        <button
          onClick={() => setSubTab("upcoming")}
          className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${
            subTab === "upcoming"
              ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-md transform scale-[1.02]"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
          }`}
        >
          Eventos Próximos
        </button>
        <button
          onClick={() => setSubTab("past")}
          className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${
            subTab === "past"
              ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-md transform scale-[1.02]"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
          }`}
        >
          Eventos Encerrados
        </button>
      </div>

      <div className="space-y-4">
        {filteredEvents.filter(e => subTab === "upcoming" ? e.status !== "encerrado" : e.status === "encerrado").length === 0 ? (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl text-center border border-slate-200 dark:border-slate-700">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Nenhum evento {subTab === "upcoming" ? "disponível" : "encerrado"} no momento.
            </p>
          </div>
        ) : (
          filteredEvents
            .filter(e => subTab === "upcoming" ? e.status !== "encerrado" : e.status === "encerrado")
            .map((event) => {
            const isOnline = event.format === "online";
            const enrolled = myAttendances.find(
              (a) =>
                a.eventId === event.id && a.status !== ("cancelado" as any),
            );
            const isOpen = event.status === "aberto" && event.status !== "deleted";
            const isPastDeadline = event.registrationDeadline
              ? new Date() > new Date(event.registrationDeadline)
              : false;
            const isPaused = event.isRegistrationPaused === true;
            const isDeleted = event.status === "deleted";
            
            const canEnroll = isOpen && !isPastDeadline && !isPaused && !isDeleted;

            let cannotEnrollReason = "";
            if (isDeleted) cannotEnrollReason = "Evento Excluído";
            else if (isPaused) cannotEnrollReason = "Inscrições Pausadas";
            else if (isPastDeadline) cannotEnrollReason = "Inscrições Encerradas";
            else if (!isOpen) cannotEnrollReason = "Evento Fechado";

            return (
              <div
                key={event.id}
                className="bg-white dark:bg-slate-800/80 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-sky-300 dark:hover:border-sky-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row gap-5">
                  {/* Left Column - Dates */}
                  <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-1 shrink-0 w-full sm:w-32 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-700/50 pb-4 sm:pb-0 sm:pr-4">
                    <div className="text-center sm:text-left">
                      <p className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400">
                        Início
                      </p>
                      <p className="text-lg font-black text-slate-800 dark:text-slate-200 leading-tight">
                        {new Date(event.startDate)
                          .toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })
                          .replace(".", "")}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        {new Date(event.startDate).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {event.endDate && (
                      <>
                        <div className="hidden sm:block h-3 w-px bg-slate-200 dark:bg-slate-700 my-1 ml-1" />
                        <div className="hidden sm:block text-slate-300 dark:text-slate-600 rotate-90 sm:rotate-0 self-center">
                          |
                        </div>
                        <div className="text-center sm:text-left pt-2 sm:pt-0">
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Término
                          </p>
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-tight">
                            {new Date(event.endDate)
                              .toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                              })
                              .replace(".", "")}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(event.endDate).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Center Column - Details */}
                  <div className="flex-1">
                    {event.imageUrl && (
                      <div className="mb-4 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700/50 aspect-video w-full max-w-sm">
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getStatusColor(event.status)}`}
                      >
                        {event.status}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {event.format === "online" ? (
                          <Video className="w-3 h-3" />
                        ) : event.format === "hibrido" ? (
                          <Video className="w-3 h-3" />
                        ) : (
                          <MapPin className="w-3 h-3" />
                        )}
                        {event.format === "hibrido" ? "Híbrido" : event.format}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">
                      {event.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-3 whitespace-pre-wrap">
                      {event.description.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part, i) => {
                        if (part.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/)) {
                          const href = part.startsWith("http") ? part : `https://${part}`;
                          return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-600 hover:underline">{part}</a>;
                        }
                        return part;
                      })}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 inline-flex px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {event.hours ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />{" "}
                          {event.hours}h
                        </span>
                      ) : null}
                      {(event.location || event.locationOrLink) && (
                        <span
                          className="flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-[200px]"
                          title={event.location || event.locationOrLink}
                        >
                          <MapPin className="w-3.5 h-3.5 text-sky-500" />{" "}
                          {(event.location || event.locationOrLink)?.startsWith("http") || (event.location || event.locationOrLink)?.startsWith("www.") ? (
                            <span className="truncate">Link do Evento</span>
                          ) : (
                            <span className="truncate">{event.location || event.locationOrLink}</span>
                          )}
                        </span>
                      )}
                      {event.speaker && (
                        <span
                          className="flex items-center gap-1.5"
                          title={event.speaker}
                        >
                          <User className="w-3.5 h-3.5 text-indigo-500" />{" "}
                          {event.speaker}
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
                              <Download className="w-4 h-4" /> Baixar Material
                            </a>
                            <a
                              href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              <ExternalLink className="w-4 h-4" /> Abrir Link Material
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
                    
                    {/* Botão de Adicionar ao Calendário */}
                    <button
                      onClick={() => exportToCalendar(event)}
                      className="mt-3 flex items-center justify-center sm:justify-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm w-max"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" /> Adicionar ao Calendário
                    </button>
                  </div>

                  {/* Right Column - Action */}
                  <div className="sm:w-32 flex flex-col justify-end pt-4 sm:pt-0 mt-2 sm:mt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50">
                    <button
                      onClick={() => setViewPublicAttendeesEvent(event)}
                      className="w-full py-1.5 mb-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" /> Ver Inscritos
                    </button>
                    {enrolled ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col items-center justify-center p-3 sm:px-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-center">
                          <UserCheck className="w-5 h-5 text-emerald-500 mb-1" />
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">
                            {enrolled.status === "presente" || enrolled.status === "apto_para_certificado" ? "Participou" : "Inscrito"}
                          </span>
                        </div>
                        {isOpen && !isDeleted && (
                          <button
                            onClick={() => handleUnenroll(event.id, member.id)}
                            className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1 border border-rose-200 dark:border-rose-500/20"
                          >
                            <Ban className="w-3 h-3" /> Cancelar
                          </button>
                        )}
                      </div>
                    ) : canEnroll ? (
                      <button
                        onClick={() => handleEnroll(event.id)}
                        disabled={isEnrollingInProgress === event.id}
                        className={`w-full h-full min-h-[44px] sm:min-h-0 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center cursor-pointer ${
                          isEnrollingInProgress === event.id
                            ? "bg-slate-400 opacity-70 cursor-not-allowed scale-100"
                            : "bg-sky-600 hover:bg-sky-500 hover:scale-105 active:scale-95 hover:shadow-md"
                        }`}
                      >
                        {isEnrollingInProgress === event.id
                          ? "Aguarde..."
                          : "Inscrever-me"}
                      </button>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-3 sm:px-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center h-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-balance leading-tight">
                          {cannotEnrollReason || "Encerrado"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      )}
      <Modal
        isOpen={!!confirmModal?.isOpen}
        onClose={() => setConfirmModal(null)}
        title="Cancelar Inscrição"
        confirmLabel="Confirmar"
        confirmVariant="danger"
        onConfirm={confirmModal?.onConfirm}
      >
        <p className="text-slate-600 dark:text-slate-400">
          {confirmModal?.message}
        </p>
      </Modal>

      <Modal
        isOpen={showLoginWarning}
        onClose={() => setShowLoginWarning(false)}
        title="Ação Necessária"
        confirmLabel="Ir para MINHA ID"
        onConfirm={() => {
          setShowLoginWarning(false);
          if (onNavigateToStudent) {
            onNavigateToStudent();
          }
        }}
      >
        <p className="text-slate-600 dark:text-slate-400 py-4 font-medium text-center">
          Para se inscrever em eventos, você precisa vincular sua identidade na aba <strong>MINHA ID</strong> primeiro.
        </p>
      </Modal>
    </div>
  );
}

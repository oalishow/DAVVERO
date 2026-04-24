import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  UserCheck,
  Users,
  Ban,
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

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
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
    const unsubEvents = onSnapshot(
      doc(db, `artifacts/${appId}/public/data/students`, "_events_global"),
      (docSnap) => {
        if (docSnap.exists()) {
          const evts = (docSnap.data().list || []) as Event[];
          evts.sort(
            (a, b) =>
              new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
          );
          setEvents(evts);
        }
      },
    );

    return () => unsubEvents();
  }, []);

  useEffect(() => {
    if (!member) return;

    const unsubAttendances = onSnapshot(
      doc(db, `artifacts/${appId}/public/data/students`, "_attendances_global"),
      (docSnap) => {
        if (docSnap.exists() && member) {
          const atts = (docSnap.data().list || []) as Attendance[];
          setMyAttendances(
            atts.filter((a: Attendance) => a.studentId === member.id),
          );
        }
      },
    );

    return () => unsubAttendances();
  }, [member]);

  const handleEnroll = async (eventId: string) => {
    if (!member) {
      alert(
        "Por favor, aceda a área 'Minha ID' com seu código e valide o seu acesso primeiro.",
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
      alert("Inscrição realizada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao realizar inscrição.");
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
          alert("Inscrição cancelada com sucesso.");
        } catch (err) {
          console.error(err);
          alert("Erro ao cancelar inscrição.");
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

  return (
    <div className="space-y-6">
      <div className="bg-sky-600 dark:bg-sky-700 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-sky-500 dark:border-sky-600">
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
            Painel de Eventos
          </h2>
          <p className="text-sky-100 font-medium text-sm sm:text-base max-w-md mx-auto">
            Explore e inscreva-se nos próximos eventos formativos acadêmicos.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl text-center border border-slate-200 dark:border-slate-700">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Nenhum evento disponível no momento.
            </p>
          </div>
        ) : (
          events.map((event) => {
            const isOnline = event.format === "online";
            const enrolled = myAttendances.find(
              (a) =>
                a.eventId === event.id && a.status !== ("cancelado" as any),
            );
            const isOpen = event.status === "aberto";

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
                        {isOnline ? (
                          <Video className="w-3 h-3" />
                        ) : (
                          <MapPin className="w-3 h-3" />
                        )}
                        {event.format}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">
                      {event.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-3">
                      {event.description}
                    </p>

                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 inline-flex px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />{" "}
                        {event.hours}h
                      </span>
                      {event.locationOrLink && (
                        <span
                          className="flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-[200px]"
                          title={event.locationOrLink}
                        >
                          <MapPin className="w-3.5 h-3.5 text-sky-500" />{" "}
                          {event.locationOrLink}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Action */}
                  <div className="sm:w-32 flex flex-col justify-end pt-4 sm:pt-0 mt-2 sm:mt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50">
                    <button
                      onClick={() => setViewPublicAttendeesEvent(event)}
                      className="w-full py-1.5 mb-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" /> Ver Inscritos
                    </button>
                    {isOpen ? (
                      enrolled ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col items-center justify-center p-3 sm:px-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-center">
                            <UserCheck className="w-5 h-5 text-emerald-500 mb-1" />
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">
                              Inscrito
                            </span>
                          </div>
                          <button
                            onClick={() => handleUnenroll(event.id, member.id)}
                            className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1 border border-rose-200 dark:border-rose-500/20"
                          >
                            <Ban className="w-3 h-3" /> Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEnroll(event.id)}
                          disabled={isEnrollingInProgress === event.id}
                          className="w-full h-full min-h-[44px] sm:min-h-0 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow-md flex items-center justify-center cursor-pointer"
                        >
                          {isEnrollingInProgress === event.id
                            ? "Aguarde..."
                            : "Inscrever-me"}
                        </button>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center p-3 sm:px-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center h-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {enrolled
                            ? enrolled.status === "presente" ||
                              enrolled.status === "apto_para_certificado"
                              ? "Participou"
                              : "Finalizado"
                            : "Encerrado"}
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
    </div>
  );
}

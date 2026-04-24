import React, { useState, useEffect } from "react";
import { X, Search, CheckCircle, Clock, Trash2 } from "lucide-react";
import type { Event, Attendance, Member } from "../types";
import { db, appId, unsubscribeFromEvent } from "../lib/firebase";
import { doc, getDoc, collection, getDocs, query } from "firebase/firestore";
import Modal from "./Modal";

interface EventAttendeesModalProps {
  event: Event;
  onClose: () => void;
}

export default function EventAttendeesModal({
  event,
  onClose,
}: EventAttendeesModalProps) {
  const [attendees, setAttendees] = useState<
    (Attendance & { member?: Member })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const attendancesDoc = await getDoc(
        doc(
          db,
          `artifacts/${appId}/public/data/students`,
          "_attendances_global",
        ),
      );
      const allAttendances = attendancesDoc.exists()
        ? attendancesDoc.data().list || ([] as Attendance[])
        : [];
      const eventAttendances = allAttendances.filter(
        (a: Attendance) =>
          a.eventId === event.id && a.status !== ("cancelado" as any),
      );

      const membersSnap = await getDocs(
        query(collection(db, `artifacts/${appId}/public/data/students`)),
      );
      const membersDict: Record<string, Member> = {};
      membersSnap.docs.forEach((d) => {
        if (!d.id.startsWith("_")) {
          membersDict[d.id] = { id: d.id, ...d.data() } as Member;
        }
      });

      const enriched = eventAttendances.map((a: Attendance) => ({
        ...a,
        member: membersDict[a.studentId],
      }));

      setAttendees(enriched);
    } catch (err) {
      console.error("Failed to load attendees", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [event.id]);

  const handleRemove = async (eventId: string, studentId: string) => {
    setConfirmModal({
      isOpen: true,
      message: "Tem a certeza que deseja remover esta inscrição?",
      onConfirm: async () => {
        try {
          await unsubscribeFromEvent(eventId, studentId);
          loadData(); // Reload data to reflect change
        } catch (err) {
          alert("Erro ao remover inscrição.");
        }
      },
    });
  };

  const handlePrint = () => {
    const printContent = document.getElementById("print-area")?.innerHTML;
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Lista de Presença</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid black; padding: 8px; text-align: left; }
              th { background-color: #f3f4f6; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .uppercase { text-transform: uppercase; }
              .tracking-widest { letter-spacing: 0.1em; }
              .border-black { border-color: black; }
              .border-b-2 { border-bottom-width: 2px; }
              .border-dashed { border-style: dashed; border-color: black; opacity: 0.5; height: 30px; border-bottom-width: 1px; }
              .mb-6 { margin-bottom: 24px; }
              .mt-2 { margin-top: 8px; }
              .mt-8 { margin-top: 32px; }
              .pb-2 { padding-bottom: 8px; }
              .text-xl { font-size: 20px; }
              .text-sm { font-size: 14px; }
              .text-xs { font-size: 12px; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      // Allow images or styles to load briefly before printing
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const filteredAttendees = attendees.filter((a) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.member?.name.toLowerCase().includes(term) ||
      a.member?.ra?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm px-4 print:static print:bg-transparent print:p-0">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[90vh] print:hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">
              Inscritos
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {event.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome ou RA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500 text-slate-700 dark:text-slate-200"
            />
          </div>
          <button
            onClick={handlePrint}
            className="print:hidden ml-4 flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Imprimir Lista de Check-in
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/30 dark:bg-slate-900/30">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent animate-spin"></div>
            </div>
          ) : filteredAttendees.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8 font-medium">
              Nenhum inscrito encontrado.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredAttendees.map((a) => (
                <div
                  key={a.id}
                  className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-3"
                >
                  <div className="flex items-center gap-3">
                    {a.member?.photoUrl ? (
                      <img
                        src={a.member.photoUrl}
                        alt={a.member?.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xl font-bold">
                        {a.member?.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">
                        {a.member?.name || "Aluno Excluído"}
                      </h4>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 flex flex-wrap gap-x-2 gap-y-1">
                        {a.member?.ra && <span>RA: {a.member.ra}</span>}
                        {a.member?.alphaCode && (
                          <span>ID: {a.member.alphaCode}</span>
                        )}
                        {a.member?.course && (
                          <span>
                            <span className="text-slate-300 dark:text-slate-600 px-1">
                              •
                            </span>
                            {a.member.course}
                          </span>
                        )}
                        {a.member?.roles && a.member.roles.length > 0 && (
                          <span>
                            <span className="text-slate-300 dark:text-slate-600 px-1">
                              •
                            </span>
                            {a.member.roles.join(", ")}
                          </span>
                        )}
                        {a.member?.diocese && (
                          <span>
                            <span className="text-slate-300 dark:text-slate-600 px-1">
                              •
                            </span>
                            Diocese: {a.member.diocese}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0">
                    {a.status === "presente" ||
                    a.status === "apto_para_certificado" ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                          <CheckCircle className="w-3.5 h-3.5" /> Presente
                        </span>
                        <button
                          onClick={() => handleRemove(event.id, a.studentId)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20"
                          title="Remover inscrição/presença"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-600">
                          <Clock className="w-3.5 h-3.5" /> Inscrito
                        </span>
                        <button
                          onClick={() => handleRemove(event.id, a.studentId)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20"
                          title="Remover inscrição"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- ÁREA DE IMPRESSÃO (Oculta na tela, Visível apenas na impressora) --- */}
      <div
        id="print-area"
        className="hidden w-full text-black bg-white"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        <div className="text-center mb-6">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-black pb-2">
            Lista Oficial de Presença
          </h2>
          <p className="text-sm font-bold mt-2 uppercase">{event?.title}</p>
          <p className="text-xs mt-1">
            Data de Início:{" "}
            {event?.startDate
              ? new Date(event.startDate).toLocaleDateString("pt-BR")
              : "N/D"}
          </p>
        </div>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 w-8 text-center">#</th>
              <th className="border border-black p-2 text-left">
                NOME DO INSCRITO
              </th>
              <th className="border border-black p-2 w-24 text-center">R.A.</th>
              <th className="border border-black p-2 text-left">
                VÍNCULO / DIOCESE
              </th>
              <th className="border border-black p-2 w-48 text-center">
                ASSINATURA DO ALUNO
              </th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((sub, idx) => (
              <tr key={sub.id || idx}>
                <td className="border border-black p-2 text-center font-bold">
                  {idx + 1}
                </td>
                <td className="border border-black p-2 uppercase font-semibold">
                  {sub.member?.name}
                </td>
                <td className="border border-black p-2 text-center">
                  {sub.member?.ra || "-"}
                </td>
                <td className="border border-black p-2 text-[10px] uppercase">
                  {sub.member?.roles?.join(", ")}{" "}
                  {sub.member?.diocese ? ` • ${sub.member?.diocese}` : ""}
                </td>
                <td className="border border-black p-2 align-bottom">
                  <div className="w-full h-8 border-b border-black border-dashed opacity-50"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 pt-4 border-t border-black text-center text-[10px] uppercase tracking-widest">
          Documento Gerado pelo DAVVERO-ID • Faculdade João Paulo II (FAJOPA)
        </div>
      </div>

      <Modal
        isOpen={!!confirmModal?.isOpen}
        onClose={() => setConfirmModal(null)}
        title="Remover Inscrição"
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

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy, deleteDoc } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { useDialog } from "../context/DialogContext";
import { Member, Appointment, Availability } from "../types";
import { Clock, Calendar as CalendarIcon, User, Plus, CheckCircle, Trash2, HeartHandshake, ShieldCheck } from "lucide-react";

interface AppointmentsPanelProps {
  member: Member;
}

export default function AppointmentsPanel({ member }: AppointmentsPanelProps) {
  const { showAlert, showConfirm } = useDialog();
  const [loading, setLoading] = useState(true);
  
  const isProfessional = member.roles?.some(r => ["REITOR", "VICE-REITOR", "PSICÓLOGA", "PSICÓLOGO", "DIRETOR ESPIRITUAL", "DIRETORA ESPIRITUAL", "PADRE"].includes(r.toUpperCase()));
  
  // Professional State
  const [myAvailabilities, setMyAvailabilities] = useState<Availability[]>([]);
  const [appointmentsAsProf, setAppointmentsAsProf] = useState<Appointment[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newLocation, setNewLocation] = useState("");

  // Student State
  const [professionals, setProfessionals] = useState<Member[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<Availability[]>([]);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [students, setStudents] = useState<Record<string, Member>>({});

  useEffect(() => {
    loadData();
  }, [member.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isProfessional) {
        // Load professional's availabilities
        const availQ = query(
          collection(db, `artifacts/${appId}/public/data/availabilities`),
          where("professionalId", "==", member.id)
        );
        const availSnap = await getDocs(availQ);
        const avails = availSnap.docs.map(d => ({ id: d.id, ...d.data() } as Availability));
        setMyAvailabilities(avails.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)));

        // Load professional's appointments
        const apptQ = query(
          collection(db, `artifacts/${appId}/public/data/appointments`),
          where("professionalId", "==", member.id)
        );
        const apptSnap = await getDocs(apptQ);
        const appts = apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
        setAppointmentsAsProf(appts.sort((a, b) => b.date.localeCompare(a.date)));
        
        // Fetch student details for appointments
        const studentIds = [...new Set(appts.map(a => a.memberId))];
        if (studentIds.length > 0) {
          const studentQ = query(collection(db, `artifacts/${appId}/public/data/students`), where("id", "in", studentIds.slice(0, 10)));
          const studentSnap = await getDocs(studentQ);
          const studMap: Record<string, Member> = {};
          studentSnap.forEach(doc => { studMap[doc.id] = doc.data() as Member; });
          setStudents(studMap);
        }

      } else {
        // Load student's appointments
        const myApptQ = query(
          collection(db, `artifacts/${appId}/public/data/appointments`),
          where("memberId", "==", member.id)
        );
        const myApptSnap = await getDocs(myApptQ);
        const myAppts = myApptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
        setMyAppointments(myAppts.sort((a, b) => b.date.localeCompare(a.date)));

        // Load all professionals
        const profsQ = query(collection(db, `artifacts/${appId}/public/data/students`));
        const profsSnap = await getDocs(profsQ);
        const profList = profsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Member))
          .filter(m => m.roles?.some(r => ["REITOR", "VICE-REITOR", "PSICÓLOGA", "PSICÓLOGO", "DIRETOR ESPIRITUAL", "DIRETORA ESPIRITUAL", "PADRE"].includes(r.toUpperCase())));
        setProfessionals(profList);
      }
    } catch (err) {
      console.error(err);
      showAlert("Erro ao carregar dados.", { type: "error" });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedProfessional) {
      loadAvailableSlots(selectedProfessional);
    } else {
      setAvailableSlots([]);
    }
  }, [selectedProfessional]);

  const loadAvailableSlots = async (profId: string) => {
    try {
      const qAvail = query(
        collection(db, `artifacts/${appId}/public/data/availabilities`),
        where("professionalId", "==", profId),
        where("status", "==", "LIVRE")
      );
      const snap = await getDocs(qAvail);
      const slots = snap.docs.map(d => ({ id: d.id, ...d.data() } as Availability));
      // Filtra datas passadas no frontend basic
      const now = new Date().toISOString().split('T')[0];
      setAvailableSlots(slots.filter(s => s.date >= now).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newStartTime || !newEndTime) return;
    try {
      const newAvail: Omit<Availability, "id"> = {
        professionalId: member.id,
        professionalName: member.name,
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        status: "LIVRE",
        location: newLocation,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, `artifacts/${appId}/public/data/availabilities`), newAvail);
      showAlert("Horário disponibilizado com sucesso!", { type: "success" });
      setNewDate(""); setNewStartTime(""); setNewEndTime(""); setNewLocation("");
      loadData();
    } catch (err) {
      console.error(err);
      showAlert("Erro ao adicionar horário", { type: "error" });
    }
  };

  const handleDeleteAvailability = async (id: string, status: string) => {
    if (status === "OCUPADO") {
      showAlert("Não é possível remover um horário já ocupado. Cancele o agendamento primeiro.", { type: "warning" });
      return;
    }
    const confirmed = await showConfirm("Remover este horário?", { type: "danger" });
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/availabilities`, id));
      loadData();
    } catch (err) {
      console.error(err);
      showAlert("Erro ao remover horário", { type: "error" });
    }
  };

  const handleBookAppointment = async (avail: Availability) => {
    const confirmed = await showConfirm(`Confirmar agendamento com ${avail.professionalName} no dia ${new Date(avail.date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${avail.startTime}?`);
    if (!confirmed) return;
    
    try {
      // Create Appointment
      const newAppt: Omit<Appointment, "id"> = {
        availabilityId: avail.id,
        memberId: member.id,
        professionalId: avail.professionalId,
        date: avail.date,
        startTime: avail.startTime,
        status: "CONFIRMADO",
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, `artifacts/${appId}/public/data/appointments`), newAppt);
      
      // Update Availability status
      const availRef = doc(db, `artifacts/${appId}/public/data/availabilities`, avail.id);
      await updateDoc(availRef, { status: "OCUPADO" });
      
      showAlert("Agendamento confirmado!", { type: "success" });
      loadData();
      if (selectedProfessional) loadAvailableSlots(selectedProfessional);
    } catch (err) {
      console.error(err);
      showAlert("Erro ao confirmar agendamento.", { type: "error" });
    }
  };

  const handleCancelAppointment = async (apptId: string, availId: string) => {
    const confirmed = await showConfirm("Deseja realmente cancelar este agendamento?", { type: "danger" });
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/appointments`, apptId), {
        status: "CANCELADO"
      });
      await updateDoc(doc(db, `artifacts/${appId}/public/data/availabilities`, availId), {
        status: "LIVRE"
      });
      showAlert("Agendamento cancelado.", { type: "success" });
      loadData();
    } catch (err) {
       console.error(err);
       showAlert("Erro ao cancelar.", { type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-purple-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PROFESSIONAL VIEW */}
      {isProfessional && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 sm:p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-purple-500" />
              Disponibilizar Horários
            </h3>
            <form onSubmit={handleAddAvailability} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Data</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Início</label>
                <input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Fim</label>
                <input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Local (Opcional)</label>
                <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Ex: Sala 2" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
              </div>
              <div className="sm:col-span-2 md:col-span-4 pt-2">
                <button type="submit" className="flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-bold px-4 py-2 text-sm rounded-xl transition-colors w-full sm:w-auto">
                  <Plus className="w-4 h-4" /> Adicionar Horário
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* My Availabilities List */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Meus Horários</span>
                <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 py-0.5 px-2 rounded-full text-[10px]">{myAvailabilities.length}</span>
              </h4>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {myAvailabilities.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">Nenhum horário cadastrado.</p>
                ) : (
                  myAvailabilities.map(avail => (
                    <div key={avail.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CalendarIcon className="w-3.5 h-3.5 text-purple-500" />
                          <span className="text-xs font-bold text-slate-800 dark:text-white">
                            {new Date(avail.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${avail.status === 'LIVRE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {avail.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {avail.startTime} - {avail.endTime}
                          {avail.location && ` • ${avail.location}`}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteAvailability(avail.id, avail.status)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Remover Horário">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Agendamentos do Profissional */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Meus Atendimentos</span>
                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 py-0.5 px-2 rounded-full text-[10px]">{appointmentsAsProf.length}</span>
              </h4>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {appointmentsAsProf.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">Nenhum atendimento agendado.</p>
                ) : (
                  appointmentsAsProf.map(appt => {
                    const student = students[appt.memberId];
                    return (
                      <div key={appt.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${appt.status === 'CONFIRMADO' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <div className="flex justify-between items-start mb-2 pl-2">
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR')} às {appt.startTime}
                            </p>
                            <h5 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-sky-500" />
                              {student ? student.name : "Aluno não encontrado"}
                            </h5>
                            {student?.course && <p className="text-[10px] text-slate-500 mt-0.5">{student.course}</p>}
                          </div>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${appt.status === 'CONFIRMADO' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {appt.status}
                          </span>
                        </div>
                        {appt.status === 'CONFIRMADO' && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end pl-2">
                            <button onClick={() => handleCancelAppointment(appt.id, appt.availabilityId)} className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline">
                              Cancelar Consulta
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT VIEW */}
      {!isProfessional && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 sm:p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 mb-4">
              <HeartHandshake className="w-5 h-5 text-purple-500" />
              Agendar Atendimento
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1 mb-1 block">Selecione o Profissional</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {professionals.map(prof => (
                    <button
                      key={prof.id}
                      onClick={() => setSelectedProfessional(prof.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selectedProfessional === prof.id 
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-sm' 
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <p className="font-bold text-xs line-clamp-1">{prof.name}</p>
                      <p className="text-[10px] opacity-70 mt-0.5 uppercase">{prof.roles?.filter(r => r !== "ALUNO(A)" && r !== "COLABORADOR(A)").join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedProfessional && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1 mb-2 block">Horários Disponíveis</label>
                  {availableSlots.length === 0 ? (
                    <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-center">Nenhum horário disponível para este profissional no momento.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {availableSlots.map(slot => (
                        <button
                          key={slot.id}
                          onClick={() => handleBookAppointment(slot)}
                          className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all group"
                        >
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                            {new Date(slot.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                            {slot.startTime}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Meus Atendimentos</span>
            </h4>
            <div className="space-y-3">
              {myAppointments.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Você ainda não tem agendamentos.</p>
              ) : (
                myAppointments.map(appt => {
                  const prof = professionals.find(p => p.id === appt.professionalId);
                  return (
                    <div key={appt.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                      <div className={`absolute top-0 left-0 w-1 h-full ${appt.status === 'CONFIRMADO' ? 'bg-purple-500' : 'bg-red-500'}`} />
                      <div className="flex justify-between items-start mb-2 pl-2">
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR')} às {appt.startTime}
                          </p>
                          <h5 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                            {prof ? prof.name : "Profissional"}
                          </h5>
                          {prof && <p className="text-[10px] text-slate-500 mt-0.5">{prof.roles?.filter(r => r !== "ALUNO(A)" && r !== "COLABORADOR(A)").join(', ')}</p>}
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${appt.status === 'CONFIRMADO' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {appt.status}
                        </span>
                      </div>
                      {appt.status === 'CONFIRMADO' && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end pl-2">
                          <button onClick={() => handleCancelAppointment(appt.id, appt.availabilityId)} className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline">
                            Cancelar Agendamento
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { Users, Calendar, Activity, Loader2, TrendingUp, UserCheck, Shield } from "lucide-react";
import { motion } from "motion/react";

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function DashboardPanel() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalMembers: number;
    activeMembers: number;
    totalAppointments: number;
    totalEvents: number;
    peakUsageDate: string;
    peakUsageCount: number;
    rolesDistribution: { name: string; value: number }[];
    seminaryDistribution: { name: string; value: number }[];
    recentActivity: { date: string; membersAdded: number; events: number; appointments: number }[];
  } | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch all members
        const studentsQuery = query(collection(db, `artifacts/${appId}/public/data/students`));
        const studentsSnapshot = await getDocs(studentsQuery);
        
        // Fetch appointments
        const appointmentsQuery = query(collection(db, `artifacts/${appId}/public/data/appointments`));
        const appointmentsSnapshot = await getDocs(appointmentsQuery);

        // Fetch events
        const eventsQuery = query(collection(db, `artifacts/${appId}/public/data/events`));
        const eventsSnapshot = await getDocs(eventsQuery);

        let total = 0;
        let active = 0;
        const roleCounts: Record<string, number> = {};
        const seminaryCounts: Record<string, number> = {};
        const dateCounts: Record<string, { members: number; events: number; appointments: number }> = {};

        const trackDate = (dateStr: string, type: 'members' | 'events' | 'appointments') => {
            if (dateStr === 'Desconhecido') return;
            if (!dateCounts[dateStr]) {
                dateCounts[dateStr] = { members: 0, events: 0, appointments: 0 };
            }
            dateCounts[dateStr][type]++;
        };

        studentsSnapshot.forEach((doc) => {
          const data = doc.data();
          // Filter out trash/deleted
          if (data.isTrash) return;

          total++;
          if (data.isActive) active++;

          // Roles
          if (data.roles && Array.isArray(data.roles)) {
            data.roles.forEach((r: string) => {
              roleCounts[r] = (roleCounts[r] || 0) + 1;
            });
          }

          // Seminary
          if (data.seminary) {
            seminaryCounts[data.seminary] = (seminaryCounts[data.seminary] || 0) + 1;
          }

          // Dates
          let dateAdded = 'Desconhecido';
          if (data.createdAt) {
            try {
              if (data.createdAt?.toDate && typeof data.createdAt.toDate === 'function') {
                dateAdded = data.createdAt.toDate().toISOString().split('T')[0];
              } else if (data.createdAt?.seconds) {
                dateAdded = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
              } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                dateAdded = new Date(data.createdAt).toISOString().split('T')[0];
              }
            } catch (err) {}
          }
          trackDate(dateAdded, 'members');
        });

        // Appts
        let totalAppts = 0;
        appointmentsSnapshot.forEach((doc) => {
            totalAppts++;
            const data = doc.data();
            let d = 'Desconhecido';
             if (data.createdAt) {
                try {
                  if (data.createdAt?.toDate && typeof data.createdAt.toDate === 'function') {
                    d = data.createdAt.toDate().toISOString().split('T')[0];
                  } else if (data.createdAt?.seconds) {
                    d = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
                  } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                    d = new Date(data.createdAt).toISOString().split('T')[0];
                  }
                } catch (err) {}
            }
            trackDate(d, 'appointments');
        });

        // Events
        let totalEvts = 0;
        eventsSnapshot.forEach((doc) => {
            totalEvts++;
            const data = doc.data();
            let d = 'Desconhecido';
            if (data.createdAt) {
                try {
                  if (data.createdAt?.toDate && typeof data.createdAt.toDate === 'function') {
                    d = data.createdAt.toDate().toISOString().split('T')[0];
                  } else if (data.createdAt?.seconds) {
                    d = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
                  } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                    d = new Date(data.createdAt).toISOString().split('T')[0];
                  }
                } catch (err) {}
            }
            trackDate(d, 'events');
        });

        // Format for charts
        const rolesDistribution = Object.entries(roleCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        const seminaryDistribution = Object.entries(seminaryCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        const recentActivity = Object.entries(dateCounts)
          .map(([date, counts]) => ({ date, membersAdded: counts.members, events: counts.events, appointments: counts.appointments }))
          .sort((a, b) => a.date.localeCompare(b.date));

        let peakDate = 'N/A';
        let peakVal = 0;
        recentActivity.forEach(day => {
            const sum = day.appointments + day.events + day.membersAdded;
            if (sum > peakVal) {
                peakVal = sum;
                peakDate = day.date;
            }
        });

        setStats({
          totalMembers: total,
          activeMembers: active,
          totalAppointments: totalAppts,
          totalEvents: totalEvts,
          peakUsageDate: peakDate,
          peakUsageCount: peakVal,
          rolesDistribution,
          seminaryDistribution,
          recentActivity: recentActivity.slice(-14) // Limit to last 14 days
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Carregando dados analíticos...</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 p-2.5 rounded-xl">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Dashboard Analítico</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Métricas e acompanhamento do uso do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-600 dark:text-slate-300 text-sm">Total de Cadastros</h3>
            <Users className="w-5 h-5 text-sky-500" />
          </div>
          <p className="text-4xl font-black text-slate-800 dark:text-white">{stats.totalMembers}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-600 dark:text-slate-300 text-sm">Membros Ativos</h3>
            <UserCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-4xl font-black text-slate-800 dark:text-white">{stats.activeMembers}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
            {stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}% de taxa de ativação
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-600 dark:text-slate-300 text-sm">Crescimento Recente</h3>
            <TrendingUp className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-4xl font-black text-slate-800 dark:text-white">
            {stats.recentActivity.reduce((acc, curr) => acc + curr.membersAdded, 0)}
          </p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-medium">
            Últimos 14 dias
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-600 dark:text-slate-300 text-sm">Quantidade de Eventos</h3>
            <Calendar className="w-5 h-5 text-fuchsia-500" />
          </div>
          <p className="text-4xl font-black text-slate-800 dark:text-white">{stats.totalEvents}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-600 dark:text-slate-300 text-sm">Total de Atendimentos</h3>
            <Activity className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-4xl font-black text-slate-800 dark:text-white">{stats.totalAppointments}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-600 dark:text-slate-300 text-sm">Pico de Atividade</h3>
            <Activity className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-4xl font-black text-slate-800 dark:text-white">{stats.peakUsageDate !== 'N/A' ? new Date(stats.peakUsageDate).toLocaleDateString('pt-BR') : '--'}</p>
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-medium">
            {stats.peakUsageCount} interações nesse dia
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Cargo */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-sky-500" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Distribuição por Cargo</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.rolesDistribution.slice(0, 8)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" name="Quantidade" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Distribuição por Seminário */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Seminário / Local</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.seminaryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                    return percent > 0.05 ? (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    ) : null;
                  }}
                >
                  {stats.seminaryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        
        {/* Atividade de Registro Recente */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm col-span-1 lg:col-span-2"
        >
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Evolução de Uso (Últimos dias)</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.recentActivity} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" dataKey="membersAdded" name="Cadastros" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="events" name="Eventos" stroke="#d946ef" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="appointments" name="Atendimentos" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

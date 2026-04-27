import React, { useState } from "react";
import { Send, Sparkles, AlertCircle, RefreshCw, Wand2, X } from "lucide-react";
import { createNotification } from "../lib/firebase";
import { useDialog } from "../context/DialogContext";
import { GoogleGenAI, Type } from "@google/genai";

const NOTIFICATION_TEMPLATES = [
  {
    label: "Nova Atualização",
    title: "Novidades Chegaram! 🚀",
    message: "Uma nova atualização está disponível! Atualize a página e confira as melhorias preparadas especialmente para você.",
    type: "sistema",
  },
  {
    label: "Aviso de Evento",
    title: "Lembrete: Nosso Evento",
    message: "Atenção: Nosso próximo encontro já tem data e hora! Verifique os detalhes na aba 'Eventos' e confirme sua presença.",
    type: "evento",
  },
  {
    label: "Recesso/Feriado",
    title: "Aviso de Recesso 🏖️",
    message: "Informamos que entraremos em recesso nos próximos dias. Organize-se e aproveite o descanso merecido!",
    type: "sistema",
  },
  {
    label: "Prazo de Inscrição",
    title: "Últimos dias para inscrição! ⏳",
    message: "Não fique de fora! O prazo para as inscrições está se encerrando em breve. Acesse o sistema e garanta sua vaga.",
    type: "inscricao",
  },
  {
    label: "Certificados Prontos",
    title: "Certificados Disponíveis 🎓",
    message: "Boas notícias: seus certificados de participação já estão disponíveis para emissão no painel.",
    type: "certificado",
  },
  {
    label: "Boas-vindas",
    title: "Bem-vindo ao Novo Semestre! 🎉",
    message: "Estamos felizes em tê-lo conosco! Explore as novidades do portal e tenha um excelente semestre de estudos.",
    type: "sistema",
  },
];

export default function NotificationsManager() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<any>("sistema");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [promptAi, setPromptAi] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);
  
  const { showAlert } = useDialog();

  const handleSendNotification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showAlert("Preencha todos os campos.", { type: "error" });
      return;
    }

    setSending(true);
    try {
      await createNotification({
        recipientId: "todos", // Special recipient ID to target all members
        title,
        message,
        type,
      });
      showAlert("Notificação enviada a todos os alunos com sucesso!", { type: "success" });
      setTitle("");
      setMessage("");
    } catch (err: any) {
      console.error("Erro ao enviar notificação:", err);
      showAlert("Falha ao enviar notificação: " + err.message, { type: "error" });
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (tmpl: typeof NOTIFICATION_TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setMessage(tmpl.message);
    setType(tmpl.type);
  };

  const generateAI = async () => {
    if (!promptAi.trim()) {
      showAlert("Por favor, digite o que você deseja avisar ou comunicar.", { type: "warning" });
      return;
    }

    setGenerating(true);
    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) throw new Error("A chave GEMINI_API_KEY não foi configurada.");

      const ai = new GoogleGenAI({ apiKey: gKey });
      const prompt = `Você é um excelente comunicador responsável por avisos para alunos de um instituto de teologia.
Escreva um título curto (até 50 caracteres, podendo ter um emoji no final) e uma mensagem clara, objetiva e engajadora (até 250 caracteres) para a seguinte ideia de notificação:

IDEIA DO AVISO: "${promptAi}"

Retorne o resultado estritamente em um JSON com os campos 'title' (o título) e 'message' (a mensagem completa). Crie algo amigável e caloroso.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              message: { type: Type.STRING }
            },
            required: ["title", "message"]
          }
        }
      });

      const responseText = response.text();
      if (responseText) {
        const jsonContent = JSON.parse(responseText);
        setTitle(jsonContent.title || "");
        setMessage(jsonContent.message || "");
        setShowAiModal(false);
        setPromptAi("");
      }
    } catch (error: any) {
      console.error("Erro ao gerar texto com IA", error);
      showAlert("Não foi possível gerar a notificação pela IA. Verifique sua chave da API do Gemini.", { type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animated-fade-in max-w-3xl lg:max-w-4xl p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl relative">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Send className="w-6 h-6 text-sky-500" />
          Compositor de Notificações
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Envie avisos, atualizações e informações em tempo real para todos os alunos conectados no aplicativo.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Título da Notificação
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Atualização Importante"
                className="input-modern"
                maxLength={60}
                required
              />
            </div>

            <div>
               <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Tipo da Notificação
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-modern"
              >
                <option value="sistema">Aviso do Sistema</option>
                <option value="evento">Evento ou Reunião</option>
                <option value="carteirinha">Carteirinha</option>
                <option value="inscricao">Inscrição</option>
                <option value="certificado">Certificado</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Mensagem Principal
                </label>
                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                >
                  <Sparkles className="w-3.5 h-3.5" /> IA Compositor
                </button>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite a mensagem para os alunos..."
                className="input-modern min-h-[140px] resize-none"
                maxLength={300}
                required
              />
              <div className="flex justify-end text-[10px] text-slate-400 mt-1 font-bold">
                {message.length} / 300 caracteres
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {sending ? "Enviando Notificação..." : "Enviar para Todos (Broadcast)"}
              </button>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex gap-3 text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs leading-relaxed">
                <strong>Atenção:</strong> O broadcast enviará esta notificação para o painel de TODOS os alunos imediatamente. Esta ação não poderá ser desfeita.
              </p>
            </div>
          </form>
        </div>

        <div className="w-full xl:w-[280px] shrink-0 border-t xl:border-t-0 xl:border-l border-slate-200 dark:border-slate-800 pt-6 xl:pt-0 xl:pl-6 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Modelos Rápidos
          </h3>
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
            {NOTIFICATION_TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="text-left text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all group"
              >
                <div className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 mb-1">{tmpl.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{tmpl.message}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50 dark:bg-indigo-950/30">
              <h3 className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                L.A.I.A Compositor
              </h3>
              <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Descreva de forma simples o que você quer avisar aos alunos, a nossa Inteligência Artificial criará um texto engajador e direto.
              </p>
              <textarea
                value={promptAi}
                onChange={(e) => setPromptAi(e.target.value)}
                placeholder="Ex: Avisar que a entrega de trabalhos foi prorrogada para a próxima sexta devido ao feriado..."
                className="input-modern min-h-[100px] text-sm resize-none"
                autoFocus
              />
              <button
                onClick={generateAI}
                disabled={generating || !promptAi.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-xl font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Gerando Título e Texto..." : "Gerar Notificação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Mail } from "lucide-react";
import { PASSWORD_STORAGE_KEY, DEFAULT_ADMIN_PASSWORD } from "../lib/constants";
import { auth } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";

interface AdminLoginProps {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [masterConfirm, setMasterConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (isRegister = false) => {
    if (!email || !emailPassword) {
      setError("Preencha todos os campos.");
      return;
    }

    if (isRegister) {
      const storedMaster =
        localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
      if (masterConfirm !== storedMaster) {
        setError("Senha Mestra incorreta para autorizar o registro.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, emailPassword);
      } else {
        await signInWithEmailAndPassword(auth, email, emailPassword);
      }
      onLogin();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setError("Usuário não encontrado. Se for seu primeiro acesso, registre-se.");
      } else if (err.code === "auth/wrong-password") {
        setError("Senha incorreta.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso.");
      } else {
        setError("Erro ao autenticar: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Preencha o campo de e-mail para recuperar a senha.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("E-mail de redefinição de senha enviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setError("Usuário não encontrado.");
      } else if (err.code === "auth/invalid-email") {
        setError("E-mail inválido.");
      } else {
        setError("Erro ao enviar e-mail de recuperação: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-2xl p-6 sm:p-8 w-full max-w-sm mx-auto animated-scale-in">
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-sky-50/50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 border border-sky-100/50 dark:border-slate-700/50 shadow-inner">
        <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-sky-600 dark:text-sky-400" />
      </div>
      <h1 className="text-xl sm:text-2xl font-bold text-center text-slate-800 dark:text-white tracking-tight mb-2">
        Acesso Reservado
      </h1>
      <p className="text-slate-500 dark:text-slate-400 text-center text-xs sm:text-sm mb-6">
        Identifique-se com seu e-mail institucional. Para o primeiro acesso, preencha a senha mestra para registrar seu e-mail com segurança.
      </p>

      {error && (
        <div className="text-center p-2 sm:p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-xs font-medium">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="text-center p-2 sm:p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-xs font-medium">
          {successMsg}
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="input-modern w-full text-sm rounded-xl py-2.5 px-4"
        />
        <div className="space-y-2">
          <input
            type="password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            placeholder="Sua senha"
            className="input-modern w-full text-sm rounded-xl py-2.5 px-4"
          />
          <div className="flex justify-end px-1">
            <button
              onClick={handleForgotPassword}
              disabled={loading}
              className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-medium"
            >
              Esqueci minha senha
            </button>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 mt-1">
          <p className="text-[9px] text-slate-500 font-bold uppercase mb-1.5 px-1">
            Autorização (Necessário para Registrar)
          </p>
          <input
            type="password"
            value={masterConfirm}
            onChange={(e) => setMasterConfirm(e.target.value)}
            placeholder="Senha Mestra"
            className="input-modern w-full text-sm rounded-xl py-2 px-4 bg-amber-50/30 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleEmailLogin(false)}
            disabled={loading}
            className="btn-modern py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-500/30 disabled:opacity-50"
          >
            {loading ? "Acessando..." : "Entrar"}
          </button>
          <button
            onClick={() => handleEmailLogin(true)}
            disabled={loading}
            className="btn-modern py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {loading ? "..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

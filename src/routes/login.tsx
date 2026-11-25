import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { inputCls, btnPrimary } from "@/components/app-ui";
import { iniciarSesion, useSesion } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — CierreClaro" },
      { name: "description", content: "Entra a CierreClaro para ver a quién le tienes que escribir hoy." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const sesion = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Si ya hay sesión, directo al inicio.
  useEffect(() => { if (sesion) navigate({ to: "/" }); }, [sesion, navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Escribe tu correo y tu contraseña."); return; }
    setEnviando(true);
    setError(null);
    const fallo = await iniciarSesion(email, password);
    setEnviando(false);
    if (fallo) setError(fallo);
    else navigate({ to: "/" });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="bg-hero rounded-b-3xl px-6 pb-10 pt-14 text-primary-foreground">
        <p className="text-sm font-medium opacity-80">CierreClaro</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">Que ningún cliente se te enfríe.</h1>
        <p className="mt-3 text-sm opacity-80">Entra para ver a quién le tienes que escribir hoy.</p>
      </header>
      <form onSubmit={entrar} className="space-y-4 px-6 pt-8">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Correo</span>
          <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Contraseña</span>
          <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
        <button className={btnPrimary} disabled={enviando}>
          {enviando ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />} Entrar
        </button>
        <p className="pt-2 text-center text-xs text-muted-foreground">Tu cuenta se crea al contratar CierreClaro. ¿Aún no tienes una? Escríbenos.</p>
      </form>
    </div>
  );
}

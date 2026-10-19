"use client";

import { useState } from "react";
import { Check, ChevronDown, Mail, LogIn, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { getUserInitials } from "@/lib/auth-utils";
import { useAuth } from "./auth-provider";

type AccountMenuProps = {
  onNotice?: (message: string) => void;
};

export function AccountMenu({ onNotice }: AccountMenuProps) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSignOut = async () => {
    const result = await auth.signOut();
    if (result.error) onNotice?.(result.error);
    else onNotice?.("Signed out securely. Mimo is keeping you in guest mode.");
    setOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button className="flex items-center gap-2 rounded-full border border-[#eeeaf5] bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm transition hover:border-[#d5c7ff] hover:bg-[#fbfaff]" onClick={() => setOpen((current) => !current)} type="button" aria-expanded={open} aria-label="Open account menu">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${auth.isGuest ? "bg-[#fff0f4] text-[#bd6c8d]" : "bg-[#eee7ff] text-[#5c40a8]"}`}>{auth.isGuest ? "G" : getUserInitials(auth.user)}</span>
          <span className="hidden text-left sm:block"><span className="block text-[11px] font-bold text-[#4f4964]">{auth.isGuest ? "Guest ID" : auth.displayName}</span><span className="block max-w-[150px] truncate text-[10px] text-[#aaa5b8]">{auth.isGuest ? auth.guestId : auth.user?.email}</span></span>
          <ChevronDown className="text-[#aaa5b8]" size={14} />
        </button>
        {open ? (
          <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-[#eeeaf5] bg-white p-2 shadow-2xl">
            <div className="rounded-xl bg-[#fbfaff] px-3 py-3"><p className="text-xs font-bold text-[#4f4964]">{auth.isGuest ? "You’re in guest mode" : `Signed in as ${auth.displayName}`}</p><p className="mt-1 break-all text-[10px] leading-4 text-[#918aa3]">{auth.isGuest ? `Guest ID: ${auth.guestId}` : auth.user?.email}</p></div>
            <button className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#5d5871] hover:bg-[#f5f1ff] hover:text-[#5c40a8]" onClick={() => { setDialogOpen(true); setOpen(false); }} type="button"><LogIn size={15} /> {auth.isGuest ? "Sign in or create account" : "Manage account"}</button>
            {!auth.isGuest ? <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#bd6c8d] hover:bg-[#fff0f4]" onClick={handleSignOut} type="button"><LogOut size={15} /> Sign out</button> : null}
          </div>
        ) : null}
      </div>
      {dialogOpen ? <AuthDialog onClose={() => setDialogOpen(false)} onNotice={onNotice} /> : null}
    </>
  );
}

type AuthDialogProps = { onClose: () => void; onNotice?: (message: string) => void };

function AuthDialog({ onClose, onNotice }: AuthDialogProps) {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(auth.authError);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (password.length < 8) { setError("Use a password with at least 8 characters."); return; }
    setBusy(true);
    if (mode === "signin") {
      const result = await auth.signInWithEmail(email.trim(), password);
      setBusy(false);
      if (result.error) { setError(result.error); return; }
      onNotice?.("Welcome back — your memories are synced.");
      onClose();
      return;
    }
    const result = await auth.signUpWithEmail(email.trim(), password);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    if (result.needsConfirmation) {
      setSuccess("Check your inbox to confirm your email. Your memories will stay with this account.");
    } else {
      onNotice?.("Account created — your memories are protected.");
      onClose();
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await auth.signInWithGoogle();
    if (result.error) { setBusy(false); setError(result.error); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#261b3a]/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-t-3xl border border-[#eeeaf5] bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Your private memory space</p><h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-[#302845]" id="auth-title">{mode === "signin" ? "Welcome back to Mimo" : "Create your Mimo account"}</h2><p className="mt-2 text-sm leading-6 text-[#817b96]">{auth.isGuest ? "Sign in to keep your memories available on every device." : "Your memories stay scoped to this account."}</p></div><button className="quiet-button !rounded-full !p-2" onClick={onClose} type="button" aria-label="Close account dialog"><X size={16} /></button></div>
        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#e8e3f1] bg-white px-4 py-3 text-sm font-bold text-[#4f4964] transition hover:border-[#b8a2f5] hover:bg-[#fbfaff] disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !auth.configured} onClick={google} type="button"><span className="text-base font-extrabold text-[#4285f4]">G</span> Continue with Google</button>
        {!auth.configured ? <p className="mt-2 text-center text-[10px] font-semibold text-[#bd6c8d]">Add Supabase settings from `.env.example` to enable login.</p> : null}
        <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#aaa5b8]"><span className="h-px flex-1 bg-[#f1eef7]" /> or email <span className="h-px flex-1 bg-[#f1eef7]" /></div>
        <form className="space-y-3" onSubmit={submit}><div><label className="mb-1.5 block text-xs font-bold text-[#5d5871]" htmlFor="auth-email">Email</label><div className="relative"><Mail className="absolute left-3.5 top-3.5 text-[#aaa5b8]" size={16} /><input autoComplete="email" className="field pl-10" disabled={busy || !auth.configured} id="auth-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} /></div></div><div><label className="mb-1.5 block text-xs font-bold text-[#5d5871]" htmlFor="auth-password">Password</label><input autoComplete={mode === "signin" ? "current-password" : "new-password"} className="field" disabled={busy || !auth.configured} id="auth-password" minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required type="password" value={password} /></div>{error ? <p className="rounded-xl bg-[#fff8fa] p-3 text-xs font-semibold leading-5 text-[#a25f7c]">{error}</p> : null}{success ? <p className="flex items-start gap-2 rounded-xl bg-[#f1fbf6] p-3 text-xs font-semibold leading-5 text-[#397a5e]"><Check className="mt-0.5 shrink-0" size={14} />{success}</p> : null}<button className="primary-button w-full" disabled={busy || !auth.configured} type="submit">{busy ? "Connecting..." : mode === "signin" ? "Sign in with email" : "Create account"}</button></form>
        <button className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-bold text-[#7354c7] hover:text-[#5c40a8]" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setSuccess(null); }} type="button"><UserRound size={14} /> {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
        <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#fbfaff] p-3 text-[10px] leading-4 text-[#918aa3]"><ShieldCheck className="mt-0.5 shrink-0 text-[#9273e6]" size={14} /> Your account data is isolated with Supabase Row Level Security. Mimo never puts private provider keys in the browser.</div>
      </div>
    </div>
  );
}

"use client";
import "../admin.css";

import { FormEvent, useState } from "react";
import { LockKeyhole, Mail, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      window.location.href = "/admin";
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  return <main className="cb-admin-login-page">
    <div className="cb-login-brand"><div className="cb-login-logo">C<span>B</span></div><div><strong>CLEARBOT</strong><small>ADMINISTRATION PORTAL</small></div></div>
    <section className="cb-login-card">
      <div className="cb-login-icon"><ShieldCheck size={25}/></div>
      <span className="cb-admin-kicker">SECURE WORKSPACE</span>
      <h1>Welcome back.</h1>
      <p>Sign in to manage Clearbot enquiries, content and website SEO.</p>
      <form onSubmit={submit} className="cb-admin-form">
        <label>Email address</label><div className="cb-admin-input-icon"><Mail size={17}/><input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@clearbot.org"/></div>
        <label>Password</label><div className="cb-admin-input-icon"><LockKeyhole size={17}/><input type={showPassword?"text":"password"} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/><button type="button" className="cb-show-password" onClick={()=>setShowPassword(v=>!v)} aria-label="Toggle password visibility">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
        {error && <div className="cb-admin-alert error">{error}</div>}
        <button className="cb-admin-primary full" disabled={busy}>{busy?"Signing in…":"Sign in to dashboard"}<ArrowRight size={17}/></button>
      </form>
      <div className="cb-login-security"><LockKeyhole size={13}/> Protected admin access · Clear Robotics</div>
    </section>
    <footer className="cb-login-footer">© {new Date().getFullYear()} Clear Robotics. All rights reserved.</footer>
  </main>;
}

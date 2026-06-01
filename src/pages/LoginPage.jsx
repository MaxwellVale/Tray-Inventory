import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signInWithEmail } from "../lib/auth";
import { useAuth } from "../lib/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";
  const { authUser, authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Enter your staff login.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && authUser) {
      navigate(from, { replace: true });
    }
  }, [authLoading, authUser, from, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setStatus("Signing in...");
      await signInWithEmail(email, password);
      setStatus("Signed in.");
      // navigate(from, { replace: true });
    } catch (error) {
      setStatus(error.message || "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Staff login</p>
        <h1>Sign in</h1>

        <form onSubmit={handleSubmit}>
          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="field">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            Sign In
          </button>
        </form>

        <p className="status">{status}</p>
      </section>
    </main>
  );
}
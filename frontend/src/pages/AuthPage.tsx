import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "../store/auth";
import { ErrorNotice, PageTitle } from "../components/Feedback";
import { Disclaimer } from "../components/Disclaimer";
export function AuthPage({ register = false }: { register?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const nav = useNavigate();
  const submit = useMutation({
    mutationFn: () =>
      register
        ? authApi.register({ email, password })
        : authApi.login({ email, password }),
    onSuccess: (tokens) => {
      useAuth.getState().login(tokens);
      nav(register ? "/onboarding" : "/");
    },
  });
  return (
    <div className="auth-panel">
      <section className="card auth-form">
        <img className="auth-logo auth-form-logo" src="/dayfeel.svg" alt="DayFeel" />
        <div className="auth-brand-copy">
          <p className="auth-brand-name">DayFeel</p>
          <p className="auth-tagline">Your day, your feelings.</p>
        </div>
        <PageTitle title="Hey, how's your heart today?" />
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <label htmlFor="email">Email</label>
          <input
            autoComplete="email"
            id="email"
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="password">Password</label>
          <div className="password-field">
          <input
            autoComplete={register ? "new-password" : "current-password"}
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder={register ? "Create a password" : "Enter your password"}
            minLength={register ? 12 : 1}
            maxLength={72}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-controls="password"
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <ErrorNotice error={submit.error} />
          <button disabled={submit.isPending}>
            {submit.isPending
              ? "One moment…"
              : register
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already have an account?" : "New to DayFeel?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <Disclaimer />
        <div className="auth-help">
          <a className="auth-help-link" href="https://findahelpline.com/">
            Need help now?
          </a>
        </div>
      </section>
    </div>
  );
}

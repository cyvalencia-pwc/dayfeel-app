import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="page">
        <h1>Let’s take a fresh start</h1>
        <p>Something didn’t load as expected.</p>
        <button onClick={() => window.location.reload()}>Reload DayFeel</button>
        <p>
          <a href="https://findahelpline.com/">Need help now?</a>
        </p>
      </main>
    ) : (
      this.props.children
    );
  }
}

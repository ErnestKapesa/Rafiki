import { Component, type ReactNode } from "react";

/** Keeps one broken widget from blanking the whole app; offers a gentle retry. */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.warn(`[rafiki] ${this.props.label ?? "ui"} crashed:`, error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <b>Oops — Rafiki tripped over a moon rock.</b>
        <button className="btn small primary" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}

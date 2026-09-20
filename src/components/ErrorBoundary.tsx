import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { message: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message || "Something went wrong." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Life in Receipts error boundary", error, info.componentStack);
  }

  render() {
    if (!this.state.message) return this.props.children;
    return (
      <main id="main" className="page">
        <div className="error-box" role="alert">
          <h1>This view failed</h1>
          <p>{this.state.message}</p>
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ message: null })}>
            Try again
          </button>
        </div>
      </main>
    );
  }
}

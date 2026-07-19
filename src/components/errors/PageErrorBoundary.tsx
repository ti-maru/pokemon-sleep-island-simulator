import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  readonly pageKey: string;
  readonly children: ReactNode;
}

interface State {
  readonly failedPage: string | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { failedPage: null };

  static getDerivedStateFromError(): State {
    return { failedPage: "failed" };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV)
      console.error("Page rendering failed", error, info.componentStack);
  }

  componentDidUpdate(previousProps: Props) {
    if (
      previousProps.pageKey !== this.props.pageKey &&
      this.state.failedPage !== null
    ) {
      this.setState({ failedPage: null });
    }
  }

  render() {
    if (this.state.failedPage !== null) {
      return (
        <main className="loading-screen" role="alert">
          <div>
            <h1>この画面を表示できませんでした</h1>
            <p>
              入力中の保存データは端末内に残っています。別の画面へ移動してから、もう一度お試しください。
            </p>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

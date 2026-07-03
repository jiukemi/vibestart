import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("VibeStart render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-md space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <h1 className="text-lg font-semibold">界面加载出错</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.error.message}
            </p>
            <button
              type="button"
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-muted/50"
              onClick={() => {
                localStorage.removeItem("vibestart-wizard");
                window.location.reload();
              }}
            >
              清除向导缓存并刷新
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

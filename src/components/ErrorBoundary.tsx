import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, KeyRound } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReload = () => {
    try {
      // Clean hash and reload cleanly
      if (typeof window !== 'undefined') {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.location.href = cleanUrl;
      }
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 font-sans text-neutral-900">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-neutral-900">
                Hubo un detalle al iniciar la aplicación
              </h1>
              <p className="text-xs text-neutral-500 leading-relaxed">
                No te preocupes, tus datos están a salvo. Puedes reiniciar la aplicación o acceder a la recuperación directamente.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-neutral-100 rounded-xl text-[11px] font-mono text-neutral-700 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reiniciar ReewAI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = window.location.origin + window.location.pathname;
                  } catch {
                    window.location.reload();
                  }
                }}
                className="w-full py-2 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium rounded-xl cursor-pointer transition-colors"
              >
                Limpiar datos temporales y reiniciar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

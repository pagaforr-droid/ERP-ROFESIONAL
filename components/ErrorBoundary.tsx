import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-white p-8 rounded-xl shadow-lg border border-red-200 text-center animate-fade-in">
          <div className="bg-red-50 p-4 rounded-full mb-4">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Error Inesperado en la Interfaz</h2>
          <p className="text-slate-600 mb-6 max-w-md">
            El sistema encontró un error al intentar mostrar este componente. El equipo técnico ha sido notificado.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 w-full max-w-3xl text-left overflow-auto max-h-64 text-xs font-mono text-red-700">
            <strong>{this.state.error && this.state.error.toString()}</strong>
            <br/>
            <pre className="mt-2 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow transition-colors"
          >
            <RefreshCcw className="w-4 h-4" /> RECARGAR SISTEMA
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

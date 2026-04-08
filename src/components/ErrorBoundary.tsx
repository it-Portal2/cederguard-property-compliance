// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
    children?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ fontFamily: "sans-serif", padding: "40px", color: "#1e293b", background: "#f8fafc", minHeight: "100vh" }}>
                    <h1 style={{ color: "#dc2626", fontSize: "24px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        React Render Error
                    </h1>
                    <p style={{ color: "#475569", marginBottom: "12px" }}>The application crashed during rendering.</p>
                    <pre style={{ background: "#1e293b", color: "#e2e8f0", padding: "20px", borderRadius: "8px", fontSize: "12px", overflow: "auto", whiteSpace: "pre-wrap" }}>
                        {this.state.error && this.state.error.toString()}
                        <br /><br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                </div>
            );
        }
        return (this.props as ErrorBoundaryProps).children;
    }
}

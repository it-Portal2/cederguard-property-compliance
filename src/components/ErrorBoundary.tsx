// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
    children?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    copyState: "idle" | "copying" | "copied" | "failed";
}

// PT-ErrorBoundary — React 19-compatible class boundary.
//
// Catches render-time errors and shows a fallback with the error stack +
// componentStack. On desktop (window.cedar present) adds a "Copy Diagnostics"
// button that bundles: app/runtime/OS metadata + last 200 log lines + the
// React error stack, so a user can paste the whole thing into a support
// email. GitHub Desktop's pattern.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null, copyState: "idle" };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
        // Best-effort: log to disk via the desktop bridge if available.
        const cedar = (window as any).cedar;
        if (cedar?.log) {
            cedar.log("error", "lifecycle.react.crash", {
                message: error?.message,
                stack: error?.stack,
                componentStack: errorInfo?.componentStack,
            });
        }
    }

    handleCopyDiagnostics = async () => {
        this.setState({ copyState: "copying" });
        try {
            const cedar = (window as any).cedar;
            const sysinfo = cedar?.diagnostics?.get ? await cedar.diagnostics.get() : null;
            const bundle = {
                app: sysinfo?.app ?? { name: "CedarGuard (web)", isDesktop: false },
                runtime: sysinfo?.runtime ?? { userAgent: navigator.userAgent },
                os: sysinfo?.os ?? { platform: navigator.platform },
                locale: sysinfo?.locale ?? navigator.language,
                timestamp: new Date().toISOString(),
                error: {
                    message: this.state.error?.message ?? "unknown",
                    stack: this.state.error?.stack ?? "",
                    componentStack: this.state.errorInfo?.componentStack ?? "",
                },
                recentLogs: sysinfo?.recentLogs ?? "(desktop log file not available on web)",
            };

            const human =
                `CedarGuard — Diagnostic Report\n` +
                `Generated: ${bundle.timestamp}\n\n` +
                `App: ${JSON.stringify(bundle.app, null, 2)}\n` +
                `Runtime: ${JSON.stringify(bundle.runtime, null, 2)}\n` +
                `OS: ${JSON.stringify(bundle.os, null, 2)}\n` +
                `Locale: ${bundle.locale}\n\n` +
                `--- Error ---\n${bundle.error.message}\n\n${bundle.error.stack}\n\nComponent stack:${bundle.error.componentStack}\n\n` +
                `--- Recent logs (last ~200 lines) ---\n${bundle.recentLogs}\n`;

            await navigator.clipboard.writeText(human);
            this.setState({ copyState: "copied" });
            setTimeout(() => this.setState({ copyState: "idle" }), 3000);
        } catch (err) {
            console.error("Copy diagnostics failed:", err);
            this.setState({ copyState: "failed" });
            setTimeout(() => this.setState({ copyState: "idle" }), 3000);
        }
    };

    handleReload = () => {
        // Force a fresh load — works in both web (location.reload) and
        // desktop (Electron treats it the same).
        try {
            window.location.reload();
        } catch {
            this.setState({ hasError: false, error: null, errorInfo: null });
        }
    };

    render() {
        if (this.state.hasError) {
            const isDesktop = !!(window as any).cedar?.isDesktop;
            const copyLabel = {
                idle: "Copy Diagnostics",
                copying: "Copying…",
                copied: "✓ Copied",
                failed: "Copy failed",
            }[this.state.copyState];

            return (
                <div style={{ fontFamily: "sans-serif", padding: "40px", color: "#1e293b", background: "#f8fafc", minHeight: "100vh" }}>
                    <h1 style={{ color: "#dc2626", fontSize: "24px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        Something went wrong
                    </h1>
                    <p style={{ color: "#475569", marginBottom: "16px" }}>
                        CedarGuard hit a render error and stopped to avoid corrupting your data.
                        {isDesktop
                            ? " You can copy the diagnostics below and send them to support, or reload the app."
                            : " Reload to try again."}
                    </p>
                    <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                        <button
                            type="button"
                            onClick={this.handleReload}
                            style={{ background: "#4f46e5", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: 500 }}
                        >
                            Reload
                        </button>
                        <button
                            type="button"
                            onClick={this.handleCopyDiagnostics}
                            disabled={this.state.copyState === "copying"}
                            style={{ background: "white", color: "#1e293b", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: 500 }}
                        >
                            {copyLabel}
                        </button>
                    </div>
                    <pre style={{ background: "#1e293b", color: "#e2e8f0", padding: "20px", borderRadius: "8px", fontSize: "12px", overflow: "auto", whiteSpace: "pre-wrap", maxHeight: "60vh" }}>
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

// electron-log wrapper for CedarGuard desktop.
//
// Why electron-log: ~270k weekly downloads on npm; only Electron-aware logger
// that handles renderer→main IPC bridging for file sinks (pino/winston don't).
//
// JSON format from day one — switching format mid-flight invalidates
// historical log analysis. Senior-dev hygiene per research findings.
//
// Convention: event names are dot-notation strings, payloads are structured
// objects, e.g.:
//   log('info', 'auth.signin.start', { method: 'google' })
//   log('error', 'api.call.error', { action: 'getProfile', status: 500 })

const electronLog = require('electron-log/main');
const { app } = require('electron');
const path = require('path');

let configured = false;

function configure() {
  if (configured) return;
  configured = true;

  // File sink at <userData>/logs/main.log on macOS this resolves to
  // ~/Library/Logs/CedarGuard/main.log
  electronLog.transports.file.resolvePathFn = (vars) =>
    path.join(app.getPath('logs'), vars.fileName || 'main.log');
  electronLog.transports.file.maxSize = 5 * 1024 * 1024; // 5MB rotation

  // JSON format on disk so external ingestion (Datadog, Loki, etc.) is
  // trivial later. Each line: { ts, level, event, ...payload }.
  //
  // Defensive against electron-log v5's slightly-variable message shape:
  // some code paths don't set msg.date, msg.data may be empty or shaped
  // differently than expected. The format MUST NEVER throw — if it does,
  // electron-log swallows the message and logs an "Unhandled electron-log
  // error", which is exactly what we don't want for diagnostics.
  electronLog.transports.file.format = (msg) => {
    try {
      const data = Array.isArray(msg && msg.data) ? msg.data : [];
      const [eventRaw, payloadRaw] = data;
      const payload =
        payloadRaw && typeof payloadRaw === 'object' && !Array.isArray(payloadRaw)
          ? payloadRaw
          : payloadRaw !== undefined
            ? { value: payloadRaw }
            : {};
      const event = typeof eventRaw === 'string' ? eventRaw : String(eventRaw ?? '');
      const ts =
        msg && msg.date instanceof Date
          ? msg.date.toISOString()
          : new Date().toISOString();
      return JSON.stringify({
        ts,
        level: (msg && msg.level) || 'info',
        event,
        ...payload,
      });
    } catch (err) {
      // Last-resort fallback so the file sink never breaks.
      return JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        event: 'log.format.error',
        error: err && err.message ? err.message : String(err),
      });
    }
  };

  // Keep stdout/stderr readable for dev — text format, not JSON.
  electronLog.transports.console.format = '[{level}] {h}:{i}:{s} {text}';

  // Make `electron-log` the default for unhandled exceptions + rejections.
  electronLog.initialize(); // sets up renderer→main IPC bridging
  electronLog.errorHandler.startCatching({
    showDialog: false,
    onError: ({ error }) => {
      // also captured by ErrorBoundary on the renderer side
      electronLog.error('lifecycle.uncaught', { message: error?.message });
    },
  });
}

// Main-process logging helper. Renderer-side equivalent goes through the
// `cedar.log` preload bridge below.
function log(level, event, payload) {
  if (!configured) configure();
  const fn = electronLog[level] || electronLog.info;
  fn(event, payload || {});
}

module.exports = {
  configure,
  log,
  // Expose the underlying transports for advanced configuration (tests etc.)
  _electronLog: electronLog,
};

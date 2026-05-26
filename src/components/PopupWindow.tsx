import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

type PopupData = {
  title?: string;
  message: string;
  kind: "info" | "warning" | "success" | "error";
  timer?: number;
  timerTo?: "yes" | "no";
  okLabel?: string;
  isCancel?: boolean;
  cancelLabel?: string;
};

export default function PopupWindow() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("popup") ?? "";

  const [data, setData] = useState<PopupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const didSendRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`popup:${id}`);

      if (!raw) {
        setError("Popup data was not found.");

        requestAnimationFrame(() => {
          getCurrentWindow().show();
        });
        
        return;
      }

      const parsed = JSON.parse(raw) as PopupData;
      setData(parsed);

      requestAnimationFrame(() => {
        getCurrentWindow().show();
      });

      if (typeof parsed.timer === "number" && parsed.timer > 0) {
        setSecondsLeft(parsed.timer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));

      requestAnimationFrame(() => {
        getCurrentWindow().show();
      });
    }
  }, [id]);

  const ui = useMemo(() => {
    switch (data?.kind) {
      case "success":
        return {
          dot: "bg-emerald-400",
          box: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
          okButton: "bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-500/50",
        };
      case "warning":
        return {
          dot: "bg-yellow-400",
          box: "border border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
          okButton: "bg-yellow-500 text-zinc-950 hover:bg-yellow-400 border border-yellow-400/50",
        };
      case "error":
        return {
          dot: "bg-red-400",
          box: "border border-red-500/40 bg-red-500/10 text-red-200",
          okButton: "bg-red-600 text-white hover:bg-red-500 border border-red-500/50",
        };
      default:
        return {
          dot: "bg-sky-400",
          box: "border border-sky-500/40 bg-sky-500/10 text-sky-200",
          okButton: "bg-sky-600 text-white hover:bg-sky-500 border border-sky-500/50",
        };
    }
  }, [data?.kind]);

  const send = useCallback(
    async (ok: boolean, reason: "ok" | "cancel" | "timeout") => {
      if (didSendRef.current) return;
      didSendRef.current = true;

      try {
        await emit("popup-result", {
          id,
          result: {
            ok,
            reason,
            error: false,
            errorMessage: null,
          },
        });
      } finally {
        localStorage.removeItem(`popup:${id}`);
        await getCurrentWindow().close();
      }
    },
    [id],
  );

  const formatTimer = (totalSeconds: number) => {
    const seconds = Math.max(0, Math.floor(totalSeconds));

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      if (hours === 0 && minutes === 0 && secs === 0) return `${days}d`;
      if (minutes === 0 && secs === 0) return `${days}d ${hours}h`;
      if (secs === 0) return `${days}d ${hours}h ${minutes}m`;
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }

    if (hours > 0) {
      if (minutes === 0 && secs === 0) return `${hours}h`;
      if (secs === 0) return `${hours}h ${minutes}m`;
      return `${hours}h ${minutes}m ${secs}s`;
    }

    if (minutes > 0) {
      if (secs === 0) return `${minutes}m`;
      return `${minutes}m ${secs}s`;
    }

    return `${secs}s`;
  };

  useEffect(() => {
    if (!data || secondsLeft === null) return;

    if (secondsLeft <= 0) {
      const timerTo = data.timerTo ?? "yes";
      void send(timerTo === "yes", "timeout");
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => (current === null ? null : current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [data, secondsLeft]);

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 p-5 text-center text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-sm text-zinc-300">
        Loading popup...
      </div>
    );
  }

  const title = data.title?.trim() || data.kind;
  const okLabel = data.okLabel?.trim() || "Yes";
  const cancelLabel = data.cancelLabel?.trim() || "No";
  const showCancel = data.isCancel ?? false;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-900 text-white">
      <div data-tauri-drag-region
      className="flex h-8 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3">
        <div data-tauri-drag-region className="flex min-w-0 items-center gap-2">
          <span data-tauri-drag-region className={`h-2.5 w-2.5 shrink-0 rounded-full ${ui.dot}`} />
          <span data-tauri-drag-region className="truncate text-sm font-semibold" >
            {title}
          </span>
        </div>
      </div>

      <div className="flex h-35 flex-1 flex-col p-2">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="flex max-h-full w-full flex-col items-center justify-center gap-2">
            <div className={`max-h-24 w-full overflow-auto whitespace-pre-line rounded-xl p-2 text-center text-sm leading-relaxed ${ui.box}`} >
              {data.message}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3">
          <div className="mr-auto flex h-8 min-w-0 items-center justify-start gap-1 text-left text-xs text-zinc-500">
            {secondsLeft !== null && (
              <>
                <span className="shrink-0">Auto selecting</span>
                <span className="shrink-0 font-semibold text-zinc-300">
                  {(data.timerTo ?? "yes") === "yes" ? okLabel : cancelLabel}
                </span>
                <span className="shrink-0">in</span>
                <span className="shrink-0 font-semibold text-zinc-300">
                  {formatTimer(secondsLeft)}
                </span>
              </>
            )}
          </div>

          {showCancel && (
            <button
              className="h-8 w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              onClick={() => send(false, "cancel")}
            >
              {cancelLabel}
            </button>
          )}

          <button
            className={`h-8 w-20 rounded-lg px-2 py-1 text-sm font-semibold shadow-sm transition-colors ${ui.okButton}`}
            onClick={() => send(true, "ok")}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
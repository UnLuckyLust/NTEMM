import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type PopupKind = "info" | "warning" | "success" | "error";

export type PopupArgs = {
  title?: string;
  message: string;
  kind: PopupKind;
  timer?: number;
  timerTo?: "yes" | "no";
  okLabel?: string;
  isCancel?: boolean;
  cancelLabel?: string;
};

export type DialogResult = {
  ok: boolean;
  reason?: "ok" | "cancel" | "timeout";
  error?: boolean;
  errorMessage?: string | null;
};

type PopupEventPayload = {
  id: string;
  result: DialogResult;
};

const pending = new Map<string, (result: DialogResult) => Promise<void>>();
let listenerPromise: Promise<UnlistenFn> | null = null;

function initPopupListener() {
  if (listenerPromise) return listenerPromise;

  listenerPromise = listen<PopupEventPayload>("popup-result", (event) => {
    const { id, result } = event.payload;

    const resolver = pending.get(id);
    if (!resolver) return;

    pending.delete(id);
    localStorage.removeItem(`popup:${id}`);
    void resolver(result);
  });

  return listenerPromise;
}

export async function dialog(args: PopupArgs): Promise<DialogResult> {
  const mainWindow = getCurrentWindow();
  await mainWindow.setEnabled(false);

  try {
    await initPopupListener();

    if (!args.message?.trim()) {
      return {
        ok: false,
        error: true,
        errorMessage: "Popup message is required.",
      };
    }

    if (!args.kind?.trim()) {
      return {
        ok: false,
        error: true,
        errorMessage: "Popup kind is required.",
      };
    }

    const id = crypto.randomUUID();
    const label = `popup-${id}`;
    const title = args.title?.trim() || args.kind;

    localStorage.setItem(
      `popup:${id}`,
      JSON.stringify({
        ...args,
        title,
        timerTo: args.timerTo ?? "yes",
        okLabel: args.okLabel?.trim() || "Ok",
        isCancel: args.isCancel ?? false,
        cancelLabel: args.cancelLabel?.trim() || "Cancel",
      }),
    );

    return await new Promise<DialogResult>((resolve) => {
      let finished = false;

      const finish = async (result: DialogResult) => {
        if (finished) return;
        finished = true;

        pending.delete(id);
        localStorage.removeItem(`popup:${id}`);

        try {
          await mainWindow.setEnabled(true);
          await mainWindow.setFocus();
        } catch (error) {
          console.error("Failed to re-enable main window:", error);
        }

        resolve(result);
      };

      pending.set(id, finish);

      const popup = new WebviewWindow(label, {
        url: `/?popup=${encodeURIComponent(id)}`,
        title,
        width: 440,
        height: 180,
        center: true,
        decorations: false,
        resizable: false,
        alwaysOnTop: true,
        focus: true,
        visible: false,
      });

      popup.once("tauri://created", async () => {
        try {
          await invoke("play_dialog_sound", { kind: args.kind });
        } catch (error) {
          console.error("Failed to play popup sound:", error);
        }
      });

      popup.once("tauri://error", (event) => {
        void finish({
          ok: false,
          error: true,
          errorMessage: String(event.payload),
        });
      });

      popup.once("tauri://destroyed", () => {
        void finish({
          ok: false,
          reason: "cancel",
          error: false,
          errorMessage: null,
        });
      });
    });
  } catch (error) {
    return {
      ok: false,
      error: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
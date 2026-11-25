import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PopupArgs, DialogResult, PopupEventPayload } from "@/types/app";
import { translate } from "@/i18n";

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

    if (!args.message?.trim() && !args.messageKey?.trim()) {
      return {
        ok: false,
        error: true,
        errorMessage: translate("errors.popupMessageRequired"),
      };
    }

    if (!args.kind?.trim()) {
      return {
        ok: false,
        error: true,
        errorMessage: translate("errors.popupKindRequired"),
      };
    }

    const id = crypto.randomUUID();
    const label = `popup-${id}`;
    const title = args.title?.trim() || args.kind;

    const translatedTitle = args.titleKey
      ? translate(args.titleKey, args.params)
      : args.title;

    const translatedMessage = args.messageKey
      ? translate(args.messageKey, args.params)
      : args.message;

    const translatedOkLabel = args.okLabelKey
      ? translate(args.okLabelKey, args.params)
      : args.okLabel;

    const translatedCancelLabel = args.cancelLabelKey
      ? translate(args.cancelLabelKey, args.params)
      : args.cancelLabel;

    localStorage.setItem(
      `popup:${id}`,
      JSON.stringify({
        ...args,
        title: translatedTitle?.trim() || title,
        message: translatedMessage?.trim() || "",
        timerTo: args.timerTo ?? "yes",
        okLabel: translatedOkLabel?.trim() || translate("common.ok"),
        isCancel: args.isCancel ?? false,
        cancelLabel: translatedCancelLabel?.trim() || translate("common.cancel"),
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
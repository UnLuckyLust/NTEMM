import type { IconProp } from "@fortawesome/fontawesome-svg-core"

export type AppIconProps = {
  icon: IconProp
  className?: string
  title?: string
}

export type AppPage = "home" | "settings" | "gamebanana"

export type PopupData = {
  title?: string;
  message: string;
  kind: "info" | "warning" | "success" | "error";
  timer?: number;
  timerTo?: "yes" | "no";
  okLabel?: string;
  isCancel?: boolean;
  cancelLabel?: string;
};

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

export type PopupEventPayload = {
  id: string;
  result: DialogResult;
};
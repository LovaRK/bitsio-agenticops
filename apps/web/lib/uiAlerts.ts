export type AppAlertLevel = "info" | "success" | "warning" | "error";

export type AppAlertPayload = {
  level: AppAlertLevel;
  message: string;
};

export const APP_ALERT_EVENT = "app-alert";

export function emitAppAlert(payload: AppAlertPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AppAlertPayload>(APP_ALERT_EVENT, { detail: payload }));
}

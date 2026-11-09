export type ToastType = 'error' | 'warning' | 'info' | 'success';
export type ToastHandler = (type: ToastType, title: string, message: string) => void;

let globalToastHandler: ToastHandler | null = null;

export function registerToastHandler(handler: ToastHandler | null): void {
  globalToastHandler = handler;
}

export function showNotificationToast(
  type: ToastType,
  title: string,
  message: string
): void {
  globalToastHandler?.(type, title, message);
}

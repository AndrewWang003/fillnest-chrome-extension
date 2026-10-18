import { permissionOriginFromUrl } from "../permissions/permission-origin";

export interface SenderAuthorizationRuntime {
  id: string;
  extensionUrlPrefix: string;
}

export type RuntimeSender = Pick<chrome.runtime.MessageSender, "id" | "url">;

export function requireExtensionPage(
  sender: RuntimeSender,
  runtime: SenderAuthorizationRuntime,
): void {
  if (sender.id !== runtime.id || !sender.url?.startsWith(runtime.extensionUrlPrefix)) {
    throw new Error("Permission changes require a FillNest extension page");
  }
}

export function requireOriginActivationSender(
  sender: RuntimeSender,
  origin: string,
  runtime: SenderAuthorizationRuntime,
): void {
  if (sender.id !== runtime.id) {
    throw new Error("Origin Activation requires a FillNest context");
  }
  if (sender.url?.startsWith(runtime.extensionUrlPrefix)) return;

  try {
    if (sender.url && permissionOriginFromUrl(sender.url).origin === origin) return;
  } catch {
    // Fall through to the authorization error.
  }
  throw new Error("Origin Activation requires its matching page context");
}

export function requireExactContentOriginSender(
  sender: RuntimeSender,
  origin: string,
  runtime: SenderAuthorizationRuntime,
): void {
  if (sender.id !== runtime.id) {
    throw new Error("Logical Page evidence requires its matching content-page Origin");
  }
  try {
    if (sender.url && permissionOriginFromUrl(sender.url).origin === origin) return;
  } catch {
    // Fall through to the authorization error.
  }
  throw new Error("Logical Page evidence requires its matching content-page Origin");
}

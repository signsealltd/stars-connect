"use client";

type DialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

function openDialog(message: string, options: DialogOptions & { input?: boolean; initialValue?: string; alert?: boolean } = {}) {
  return new Promise<string | boolean | null>((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "app-dialog-backdrop";
    const dialog = document.createElement("section");
    dialog.className = "app-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const title = document.createElement("h2");
    title.textContent = options.title || (options.alert ? "STARS Connect" : options.input ? "Enter details" : "Please confirm");
    const copy = document.createElement("p");
    copy.textContent = message;
    dialog.append(title, copy);
    let input: HTMLInputElement | undefined;
    if (options.input) {
      input = document.createElement("input");
      input.className = "field";
      input.value = options.initialValue || "";
      input.autocomplete = "off";
      dialog.append(input);
    }
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const close = (value: string | boolean | null) => {
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(value);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(options.alert ? true : null);
      if (event.key === "Enter" && input) close(input.value.trim() || null);
    };
    if (!options.alert) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn secondary";
      cancel.textContent = options.cancelLabel || "Cancel";
      cancel.onclick = () => close(null);
      actions.append(cancel);
    }
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = `btn ${options.danger ? "danger-solid" : "primary"}`;
    confirm.textContent = options.confirmLabel || (options.alert ? "Close" : "Confirm");
    confirm.onclick = () => close(input ? input.value.trim() || null : true);
    actions.append(confirm);
    dialog.append(actions);
    backdrop.append(dialog);
    document.body.append(backdrop);
    document.addEventListener("keydown", onKey);
    setTimeout(() => (input || confirm).focus(), 0);
  });
}

export async function appConfirm(message: string, options?: DialogOptions) {
  return (await openDialog(message, options)) === true;
}

export async function appPrompt(message: string, initialValue = "", options?: DialogOptions) {
  const result = await openDialog(message, { ...options, input: true, initialValue });
  return typeof result === "string" ? result : null;
}

export async function appAlert(message: string, options?: DialogOptions) {
  await openDialog(message, { ...options, alert: true });
}

import { toast } from "./toast-helper";

export async function copyToClipboard(text: string, alertText = "Text copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.info(alertText);
  } catch {
    // fallback
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.info(alertText);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }
}

export async function pasteFromClipboard(alertText = "Pasted from clipboard") {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      const text = await navigator.clipboard.readText();
      toast.info(alertText);
      return text;
    } else {
      // fallback for non-secure contexts
      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();
      document.execCommand("paste");
      const text = textarea.value;
      document.body.removeChild(textarea);
      toast.info(alertText);
      return text;
    }
  } catch (error) {
    toast.error("Failed to paste from clipboard");
    console.error("Paste failed:", error);
    throw error;
  }
}

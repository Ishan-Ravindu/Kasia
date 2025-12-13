/**
 * Safely trigger a file download that works across browsers including iOS Safari.
 *
 * The key difference from a simple link.click() is that we:
 * 1. Append the link to the DOM before triggering (required for iOS)
 * 2. Remove it after a delay to ensure the download starts
 * 3. This prevents iOS Safari from navigating to the link and reloading the page
 */
export function downloadFile(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;

  // Required for iOS Safari - link must be in DOM
  link.style.display = "none";
  document.body.appendChild(link);

  // Trigger download
  link.click();

  // Clean up after a short delay to ensure download starts
  setTimeout(() => {
    document.body.removeChild(link);
  }, 100);
}

/**
 * Extract file extension from a data URL
 */
function getExtensionFromDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (
    dataUrl.startsWith("data:image/jpeg") ||
    dataUrl.startsWith("data:image/jpg")
  )
    return "jpg";
  if (dataUrl.startsWith("data:image/webp")) return "webp";
  if (dataUrl.startsWith("data:image/gif")) return "gif";
  return "png"; // default
}

/**
 * Generate a timestamped filename for an image
 */
function generateImageFilename(extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  return `kasia-image-${timestamp}.${extension}`;
}

/**
 * Download an image from a data URL with an automatically generated filename
 */
export function downloadImage(dataUrl: string): void {
  const extension = getExtensionFromDataUrl(dataUrl);
  const fileName = generateImageFilename(extension);
  downloadFile(dataUrl, fileName);
}

import { useUiStore } from "../../store/ui.store";
import { useEffect } from "react";
import { Download } from "lucide-react";

// in the modal show an image that is enlarged
export const ImagePresenter = () => {
  const { imagePresenterImage, setImagePresenterImage } = useUiStore();

  // clear image data when component unmounts (modal closes)
  useEffect(() => {
    return () => {
      setImagePresenterImage(null);
    };
  }, [setImagePresenterImage]);

  if (!imagePresenterImage) {
    return null;
  }

  const handleDownload = () => {
    // Extract filename from data URL or use timestamp-based default
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const extension = imagePresenterImage.startsWith("data:image/png")
      ? "png"
      : imagePresenterImage.startsWith("data:image/jpeg") ||
          imagePresenterImage.startsWith("data:image/jpg")
        ? "jpg"
        : imagePresenterImage.startsWith("data:image/webp")
          ? "webp"
          : imagePresenterImage.startsWith("data:image/gif")
            ? "gif"
            : "png";
    const fileName = `kasia-image-${timestamp}.${extension}`;

    // Create temporary link and trigger download
    const link = document.createElement("a");
    link.href = imagePresenterImage;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <img
        src={imagePresenterImage}
        alt="Presented image"
        className="h-auto max-w-full rounded-lg object-contain"
      />
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 rounded-lg bg-[var(--button-primary)] px-4 py-2 text-[var(--text-primary)] transition-colors hover:bg-[var(--button-primary)]/80 active:scale-95"
      >
        <Download className="h-4 w-4" />
        Download Image
      </button>
    </div>
  );
};

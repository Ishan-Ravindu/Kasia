import { useUiStore } from "../../store/ui.store";
import { useEffect } from "react";
import { Download } from "lucide-react";
import { downloadImage } from "../../utils/file-download";

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
    downloadImage(imagePresenterImage);
  };

  return (
    <div className="relative inline-block">
      <img
        src={imagePresenterImage}
        alt="Presented image"
        className="h-auto max-w-full rounded-lg object-contain"
      />
      <button
        onClick={handleDownload}
        className="absolute top-1 left-1 flex cursor-pointer items-center justify-center rounded-lg bg-[var(--button-primary)]/60 p-1 text-[var(--text-primary)] transition-colors hover:bg-[var(--button-primary)]/100 active:scale-95 sm:p-2"
      >
        <Download className="size-4" />
        <span className="absolute p-4 pointer-fine:hidden" />
      </button>
    </div>
  );
};

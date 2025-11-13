import { useEffect, useState, useCallback } from "react";
import { Modal } from "../Common/modal";
import { Loader2, Image as ImageIcon } from "lucide-react";
import {
  prepareFileForUpload,
  CompressImageOptions,
} from "../../service/upload-file-service";
import { MAX_PAYLOAD_SIZE } from "../../config/constants";

interface ImageCompressionModalProps {
  file: File | null;
  onConfirm: (fileMessage: string, compressedFile: File) => void;
  onCancel: () => void;
  estimatedBaseFee?: bigint;
}

export const ImageCompressionModal = ({
  file,
  onConfirm,
  onCancel,
  estimatedBaseFee = BigInt(0),
}: ImageCompressionModalProps) => {
  const [compressionQuality, setCompressionQuality] = useState(0.8);
  const [maxDimension, setMaxDimension] = useState(800);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<{
    fileMessage: string;
    file: File;
    size: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Generate preview
  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
    return () => setPreview(null);
  }, [file]);

  // Process image whenever settings change
  const processImage = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const compressOptions: CompressImageOptions = {
        maxWidth: maxDimension,
        maxHeight: maxDimension,
        minWidth: 150,
        minHeight: 150,
        maxQuality: compressionQuality,
        minQuality: Math.max(0.3, compressionQuality - 0.2),
        maxAttempts: 20,
      };

      const result = await prepareFileForUpload(
        file,
        MAX_PAYLOAD_SIZE,
        compressOptions
      );

      if (result.error) {
        setError(result.error);
        setProcessedResult(null);
      } else if (result.fileMessage && result.file) {
        const size = new Blob([result.fileMessage]).size;
        setProcessedResult({
          fileMessage: result.fileMessage,
          file: result.file,
          size,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
      setProcessedResult(null);
    } finally {
      setIsProcessing(false);
    }
  }, [file, compressionQuality, maxDimension]);

  useEffect(() => {
    processImage();
  }, [processImage]);

  if (!file) return null;

  const handleConfirm = () => {
    if (processedResult) {
      onConfirm(processedResult.fileMessage, processedResult.file);
    }
  };

  const formatSize = (bytes: number) => {
    return (bytes / 1024).toFixed(2);
  };

  const estimateFee = () => {
    if (!processedResult) return "Calculating...";
    // Simple estimation: base fee + size-based component
    const baseFee = Number(estimatedBaseFee) / 100_000_000; // Convert sompi to KAS
    const sizeFee = (processedResult.size / 1024) * 0.0001; // Rough estimate
    return (baseFee + sizeFee).toFixed(5);
  };

  const compressionPercentage = Math.round(compressionQuality * 100);

  return (
    <Modal onClose={onCancel} className="!max-w-2xl">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-3">
          <ImageIcon className="h-5 w-5 text-[var(--text-secondary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Configure Image Compression
          </h2>
        </div>

        {/* Image Preview */}
        <div className="flex justify-center">
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="max-h-64 rounded-lg object-contain"
            />
          )}
        </div>

        {/* Compression Quality Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Image Quality
            </label>
            <span className="text-sm text-[var(--text-secondary)]">
              {compressionPercentage}%
            </span>
          </div>
          <input
            type="range"
            min="30"
            max="100"
            step="5"
            value={compressionPercentage}
            onChange={(e) =>
              setCompressionQuality(Number(e.target.value) / 100)
            }
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--button-primary)]/20 accent-[var(--button-primary)]"
            disabled={isProcessing}
          />
          <div className="flex justify-between text-xs text-[var(--text-secondary)]">
            <span>Smaller file</span>
            <span>Better quality</span>
          </div>
        </div>

        {/* Max Dimension Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Maximum Dimension
            </label>
            <span className="text-sm text-[var(--text-secondary)]">
              {maxDimension}px
            </span>
          </div>
          <input
            type="range"
            min="150"
            max="2048"
            step="50"
            value={maxDimension}
            onChange={(e) => setMaxDimension(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--button-primary)]/20 accent-[var(--button-primary)]"
            disabled={isProcessing}
          />
          <div className="flex justify-between text-xs text-[var(--text-secondary)]">
            <span>150px</span>
            <span>2048px</span>
          </div>
        </div>

        {/* File Info */}
        <div className="space-y-2 rounded-lg bg-[var(--bg-secondary)] p-3">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Original Size:</span>
            <span className="font-medium text-[var(--text-primary)]">
              {formatSize(file.size)} KB
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">
              Compressed Size:
            </span>
            <span className="font-medium text-[var(--text-primary)]">
              {isProcessing ? (
                <Loader2 className="inline h-4 w-4 animate-spin" />
              ) : processedResult ? (
                `${formatSize(processedResult.size)} KB`
              ) : (
                "—"
              )}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Estimated Fee:</span>
            <span className="font-medium text-[var(--text-primary)]">
              {isProcessing ? (
                <Loader2 className="inline h-4 w-4 animate-spin" />
              ) : (
                `~${estimateFee()} KAS`
              )}
            </span>
          </div>
          {processedResult && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Reduction:</span>
              <span className="font-medium text-green-500">
                {Math.round((1 - processedResult.size / file.size) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[var(--border-primary)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || !processedResult || !!error}
            className="flex-1 rounded-lg bg-[var(--button-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--button-primary)]/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Attach Image"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

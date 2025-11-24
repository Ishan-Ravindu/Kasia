import { useEffect, useState } from "react";
import { Modal } from "../Common/modal";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { prepareFileForUpload } from "../../service/upload-file-service";
import { MAX_PAYLOAD_SIZE } from "../../config/constants";

const MIN_DIMENSION = 150;
const DIMENSION_STEP = 50;
const MIN_QUALITY = 0.3;
const QUALITY_STEP = 0.05;

type CompressionResult = {
  fileMessage: string;
  file: File;
  size: number;
  quality: number;
  dimensions: { width: number; height: number };
};

type DimensionAnalysis = {
  dimension: number;
  originalWidth: number;
  originalHeight: number;
  compression: CompressionResult;
};

function roundQuality(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeQualityLevels(): number[] {
  const qualities: number[] = [];
  for (let q = 0.95; q > MIN_QUALITY; q -= QUALITY_STEP) {
    qualities.push(roundQuality(q));
  }
  qualities.push(MIN_QUALITY);
  return qualities.reverse(); // Start from minimum quality
}

function calculateTargetDimensions(
  targetMaxDimension: number,
  originalWidth: number,
  originalHeight: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  const clampedMax = Math.max(MIN_DIMENSION, targetMaxDimension);

  if (aspectRatio >= 1) {
    const width = Math.min(clampedMax, originalWidth);
    const height = Math.max(MIN_DIMENSION, Math.round(width / aspectRatio));
    return { width, height };
  }

  const height = Math.min(clampedMax, originalHeight);
  const width = Math.max(MIN_DIMENSION, Math.round(height * aspectRatio));
  return { width, height };
}

async function attemptCompression(
  file: File,
  maxSize: number,
  originalWidth: number,
  originalHeight: number,
  targetDimension: number,
  quality: number
): Promise<CompressionResult | null> {
  const target = calculateTargetDimensions(
    targetDimension,
    originalWidth,
    originalHeight
  );

  const result = await prepareFileForUpload(file, maxSize, {
    maxWidth: target.width,
    maxHeight: target.height,
    minWidth: MIN_DIMENSION,
    minHeight: MIN_DIMENSION,
    maxQuality: quality,
    minQuality: quality,
    maxAttempts: 1,
  });

  if (!result.fileMessage || !result.file || result.error) {
    return null;
  }

  const payloadSize = new Blob([result.fileMessage]).size;
  if (payloadSize > maxSize) {
    return null;
  }

  // Get actual dimensions of the compressed file
  const compressedImg = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(result.file!);
  });

  return {
    fileMessage: result.fileMessage,
    file: result.file,
    size: payloadSize,
    quality,
    dimensions: { width: compressedImg.width, height: compressedImg.height },
  };
}

// Find maximum dimension that actually fits by testing with prepareFileForUpload
async function findMaxAllowedDimension(
  file: File,
  maxSize: number
): Promise<DimensionAnalysis | null> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const image = new Image();
      image.onload = () => res(image);
      image.onerror = rej;
      image.src = URL.createObjectURL(file);
    });

    const originalWidth = img.width;
    const originalHeight = img.height;
    const maxOriginalDimension = Math.max(originalWidth, originalHeight);

    const candidateSet = new Set<number>();

    candidateSet.add(Math.round(maxOriginalDimension));

    const roundedOriginal = Math.max(
      MIN_DIMENSION,
      Math.floor(maxOriginalDimension / DIMENSION_STEP) * DIMENSION_STEP
    );

    for (
      let dim = roundedOriginal;
      dim >= MIN_DIMENSION;
      dim -= DIMENSION_STEP
    ) {
      candidateSet.add(dim);
    }

    candidateSet.add(MIN_DIMENSION);

    const candidates = Array.from(candidateSet)
      .filter((dim) => dim >= MIN_DIMENSION)
      .sort((a, b) => b - a);

    for (const candidate of candidates) {
      const compression = await attemptCompression(
        file,
        maxSize,
        originalWidth,
        originalHeight,
        candidate,
        MIN_QUALITY
      );

      if (compression) {
        return {
          dimension: candidate,
          originalWidth,
          originalHeight,
          compression,
        };
      }
    }

    return null;
  } catch (error) {
    console.warn("Failed to calculate max allowed dimension:", error);
    return null;
  }
}

// Find maximum quality that fits within maxSize for given dimensions
async function findMaxQualityForDimensions(
  file: File,
  originalWidth: number,
  originalHeight: number,
  targetDimension: number,
  maxSize: number
): Promise<CompressionResult | null> {
  const qualities = normalizeQualityLevels();

  let bestResult: CompressionResult | null = null;

  for (const quality of qualities) {
    const compression = await attemptCompression(
      file,
      maxSize,
      originalWidth,
      originalHeight,
      targetDimension,
      quality
    );

    if (!compression) {
      if (bestResult) {
        break;
      }
      return null;
    }

    bestResult = compression;
  }

  return bestResult;
}

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
  const [maxDimension, setMaxDimension] = useState(MIN_DIMENSION);
  const [maxAllowedDimension, setMaxAllowedDimension] = useState(MIN_DIMENSION);
  const [imageMeta, setImageMeta] = useState<DimensionAnalysis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] =
    useState<CompressionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Temporary value for smooth slider interaction
  const [tempMaxDimension, setTempMaxDimension] = useState(MIN_DIMENSION);

  // Initialize default dimension based on image and calculate slider bounds
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setImageMeta(null);
      setMaxAllowedDimension(MIN_DIMENSION);
      setMaxDimension(MIN_DIMENSION);
      setTempMaxDimension(MIN_DIMENSION);
      setProcessedResult(null);
      setError(null);
      return;
    }

    let cancelled = false;

    setImageMeta(null);
    setProcessedResult(null);
    setError(null);
    setIsProcessing(true);

    findMaxAllowedDimension(file, MAX_PAYLOAD_SIZE)
      .then((analysis) => {
        if (cancelled) {
          return;
        }

        if (!analysis) {
          setImageMeta(null);
          setMaxAllowedDimension(MIN_DIMENSION);
          setMaxDimension(MIN_DIMENSION);
          setTempMaxDimension(MIN_DIMENSION);
          setError(
            "Image cannot be compressed within transaction limits, even at minimum quality."
          );
          setProcessedResult(null);
          return;
        }

        setImageMeta(analysis);
        setMaxAllowedDimension(analysis.dimension);
        setMaxDimension(analysis.dimension);
        setTempMaxDimension(analysis.dimension);
        // Don't set processedResult here - let the processing effect handle it
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        console.warn("Failed to calculate slider bounds:", err);
        setImageMeta(null);
        setMaxAllowedDimension(MIN_DIMENSION);
        setMaxDimension(MIN_DIMENSION);
        setTempMaxDimension(MIN_DIMENSION);
        setError("Failed to analyse image dimensions for compression.");
        setProcessedResult(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsProcessing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Slider interaction handlers
  const handleMaxDimensionChange = (value: number) => {
    const clamped = Math.min(
      Math.max(value, MIN_DIMENSION),
      maxAllowedDimension
    );
    setTempMaxDimension(clamped);
    setMaxDimension(clamped); // Update immediately for real-time compression
  };

  const handleMaxDimensionMouseUp = () => {
    // Already updated in change handler
  };

  const handleMaxDimensionKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      const clamped = Math.min(
        Math.max(tempMaxDimension, MIN_DIMENSION),
        maxAllowedDimension
      );
      setMaxDimension(clamped);
      setTempMaxDimension(clamped);
    }
  };

  // Generate preview - use compressed image if available, otherwise original
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const imageToPreview = processedResult?.file || file;

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(imageToPreview);
  }, [file, processedResult?.file]);

  // Process image whenever dimensions change - find max quality for dimensions
  useEffect(() => {
    if (!file || !imageMeta) {
      return;
    }

    let cancelled = false;

    setIsProcessing(true);
    setError(null);

    findMaxQualityForDimensions(
      file,
      imageMeta.originalWidth,
      imageMeta.originalHeight,
      maxDimension,
      MAX_PAYLOAD_SIZE
    )
      .then((compression) => {
        if (cancelled) {
          return;
        }

        if (!compression) {
          setError("Could not find suitable compression for these dimensions");
          setProcessedResult(null);
          return;
        }

        setProcessedResult(compression);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        console.warn("Failed to compress image:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process image"
        );
        setProcessedResult(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsProcessing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file, maxDimension, imageMeta]);

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

        {/* Maximum Dimension Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Maximum Dimension
            </label>
            <span className="text-sm text-[var(--text-secondary)]">
              {tempMaxDimension}px
            </span>
          </div>
          <input
            type="range"
            min="150"
            max={maxAllowedDimension}
            step="50"
            value={tempMaxDimension}
            onChange={(e) => handleMaxDimensionChange(Number(e.target.value))}
            onMouseUp={handleMaxDimensionMouseUp}
            onTouchEnd={handleMaxDimensionMouseUp}
            onKeyUp={handleMaxDimensionKeyUp}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--button-primary)]/20 accent-[var(--button-primary)]"
            disabled={isProcessing}
          />
          <div className="flex justify-between text-xs text-[var(--text-secondary)]">
            <span>Smaller image</span>
            <span>Larger image</span>
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
            <>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Quality:</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {Math.round(processedResult.quality * 100)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">
                  Dimensions:
                </span>
                <span className="font-medium text-[var(--text-primary)]">
                  {processedResult.dimensions.width} ×{" "}
                  {processedResult.dimensions.height}px
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Reduction:</span>
                <span className="font-medium text-green-500">
                  {Math.round((1 - processedResult.size / file.size) * 100)}%
                </span>
              </div>
            </>
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
            className="flex-1 rounded-lg border border-[var(--border-primary)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:cursor-pointer hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || !processedResult || !!error}
            className="flex-1 rounded-lg bg-[var(--button-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:cursor-pointer hover:bg-[var(--button-primary)]/80 disabled:cursor-not-allowed disabled:opacity-50"
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

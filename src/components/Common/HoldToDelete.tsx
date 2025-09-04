import { FC, useState, useRef } from "react";
import { Trash2 } from "lucide-react";
import clsx from "clsx";

interface HoldToDeleteProps {
  onComplete: () => void;
  holdDuration?: number;
  size?: "md" | "xl";
  className?: string;
  title?: string;
}

export const HoldToDelete: FC<HoldToDeleteProps> = ({
  onComplete,
  holdDuration = 750,
  size = "md",
  className = "",
  title = "Click and hold to delete",
}) => {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const rafIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const sizeClasses = { md: "h-10 w-10", xl: "h-14 w-14" };
  const iconSizes = { md: "h-5 w-5", xl: "h-6 w-6" };

  const stopAnimation = () => {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
    startTimeRef.current = null;
  };
  const startHold = () => {
    setIsHolding(true);
    setHoldProgress(0);
    completedRef.current = false;
    startTimeRef.current = null;
    const tick = (ts: number) => {
      if (startTimeRef.current === null) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const pct = Math.min(100, (elapsed / holdDuration) * 100);
      setHoldProgress(pct);
      if (pct >= 100 && !completedRef.current) {
        completedRef.current = true;
        onComplete();
        setIsHolding(false);
        stopAnimation();
        setHoldProgress(0);
        return;
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  };
  const stopHold = () => {
    stopAnimation();
    setIsHolding(false);
    setHoldProgress(0);
    completedRef.current = false;
  };

  const C = 2 * Math.PI * 14;

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={startHold}
      onTouchEnd={stopHold}
      onBlur={stopHold}
      onContextMenu={(e) => e.preventDefault()}
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center text-[var(--accent-red)] hover:text-[var(--accent-red)] focus:outline-none",
        className
      )}
      title={title}
      aria-label={title}
    >
      <div
        className={clsx(
          "relative flex items-center justify-center",
          sizeClasses[size]
        )}
      >
        {isHolding && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-red)]/30"></div>
            <svg
              className={clsx(sizeClasses[size], "-rotate-90 transform")}
              viewBox="0 0 32 32"
            >
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${C}`}
                strokeDashoffset={`${C * (1 - holdProgress / 100)}`}
                className="text-[var(--accent-red)]"
              />
            </svg>
          </div>
        )}
        <Trash2 className={iconSizes[size]} />
      </div>
    </button>
  );
};

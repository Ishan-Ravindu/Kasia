import clsx from "clsx";
import { bubbleVar } from "./bubble-color-generator";

type GroupPosition = "single" | "top" | "middle" | "bottom";
type BubbleClassOptions = {
  isOutgoing: boolean;
  groupPosition: GroupPosition;
  className?: string;
  noBubble?: boolean;
  status?: "pending" | "confirmed" | "failed";
  addressForCustomColor?: string;
};

export const generateBubbleClasses = ({
  isOutgoing,
  groupPosition,
  className,
  noBubble,
  status = "confirmed",
  addressForCustomColor: address,
}: BubbleClassOptions) => {
  if (noBubble) return;

  const bubbleClass = (() => {
    if (isOutgoing) {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tr-sm rounded-br-sm";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tr-sm rounded-br-2xl";
      return "rounded-2xl rounded-br-sm";
    } else {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tl-sm rounded-bl-sm";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tl-sm rounded-bl-2xl";
      return "rounded-2xl rounded-bl-sm";
    }
  })();

  const getBackgroundClass = () => {
    if (isOutgoing) {
      if (status === "pending")
        return "border border-[var(--button-primary)]/30 bg-[var(--button-primary)]/5";
      if (status === "failed")
        return "border border-[var(--accent-red)] bg-[var(--accent-red)]/10";
      return "border border-[var(--button-primary)] bg-[var(--button-primary)]/20";
    } else {
      if (address)
        return `border border-[var(${bubbleVar})]/45 bg-[var(${bubbleVar})]/35`;
      return "bg-[var(--secondary-bg)]";
    }
  };

  return clsx(
    "relative z-0 max-w-[70%] cursor-pointer px-4 py-1 text-left break-words hyphens-auto",
    getBackgroundClass(),
    bubbleClass,
    className
  );
};

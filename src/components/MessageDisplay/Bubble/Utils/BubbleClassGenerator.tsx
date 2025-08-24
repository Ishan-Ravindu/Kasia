import clsx from "clsx";

type GroupPosition = "single" | "top" | "middle" | "bottom";

type BubbleClassOptions = {
  isOutgoing: boolean;
  groupPosition: GroupPosition;
  className?: string;
  noBubble?: boolean;
  status?: "pending" | "confirmed" | "failed";
};

export const generateBubbleClasses = ({
  isOutgoing,
  groupPosition,
  className,
  noBubble,
  status = "confirmed",
}: BubbleClassOptions) => {
  if (noBubble) return;

  // determine the 'chat' style that we apply
  const bubbleClass = (() => {
    if (isOutgoing) {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tr-sm rounded-br-sm";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tr-sm rounded-br-2xl";
      // top and single: default (one square edge)
      return "rounded-2xl rounded-br-sm";
    } else {
      if (groupPosition === "middle")
        return "rounded-2xl rounded-tl-sm rounded-bl-sm";
      if (groupPosition === "bottom")
        return "rounded-2xl rounded-tl-sm rounded-bl-2xl";
      // top and single: default (one square edge)
      return "rounded-2xl rounded-bl-sm";
    }
  })();

  // determine background based on status
  const getBackgroundClass = () => {
    if (isOutgoing) {
      if (status === "pending")
        return "border border-[var(--button-primary)]/30 bg-[var(--button-primary)]/5";
      if (status === "failed")
        return "border border-[var(--accent-red)] bg-[var(--accent-red)]/10";
      // confirmed or default
      return "border border-[var(--button-primary)] bg-[var(--button-primary)]/20";
    } else {
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

import { FC } from "react";
import { AvatarHash } from "../icons/AvatarHash";
import { Button } from "../Common/Button";
import { Copy } from "lucide-react";
import { copyToClipboard } from "../../utils/copy-to-clipboard";
import clsx from "clsx";

type BroadcastParticipantInfoProps = {
  address: string;
  nickname?: string;
  onClose: () => void;
};

export const BroadcastParticipantInfo: FC<BroadcastParticipantInfoProps> = ({
  address,
  nickname,
}) => {
  const handleCopyAddress = async () => {
    if (!address) {
      return;
    }
    await copyToClipboard(address, "Address copied to clipboard");
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="space-y-2">
        {/* Avatar and basic info */}
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12">
            <AvatarHash
              address={address}
              size={48}
              className={clsx({
                "opacity-80": !!nickname?.trim()?.[0],
              })}
              selected={true}
              isGroup={true}
            />
            {nickname && (
              <span
                className={clsx(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  "pointer-events-none select-none",
                  "flex h-12 w-12 items-center justify-center",
                  "rounded-full text-base leading-none font-bold tracking-wide text-[var(--text-primary)]"
                )}
              >
                {nickname.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="font-semibold break-all text-[var(--text-primary)]">
              {nickname || "No nickname"}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              Broadcast Participant
            </div>
          </div>
        </div>

        {/* Address section with copy button - similar to wallet address section */}
        <div className="mb-2">
          <strong>Address:</strong>
          <div className="address-actions my-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <span
                id="broadcast-address"
                className="border-primary-border bg-primary-bg flex w-full cursor-pointer items-center rounded-lg border px-3 py-2 font-mono text-[13px] leading-[1.4] break-all transition-colors"
                onClick={() => {
                  // select the text when clicked
                  const selection = window.getSelection();
                  const range = document.createRange();
                  const addressElement =
                    document.getElementById("broadcast-address");
                  if (addressElement && selection) {
                    range.selectNodeContents(addressElement);
                    selection.removeAllRanges();
                    selection.addRange(range);
                  }
                }}
                title="Click to select address"
              >
                {address}
              </span>
            </div>
            <Button
              onClick={handleCopyAddress}
              title="Copy address to clipboard"
              type="button"
              variant="primary"
              className="flex h-auto items-center justify-center rounded-lg px-6 !py-2 sm:w-auto"
            >
              <Copy className="h-6 w-6 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

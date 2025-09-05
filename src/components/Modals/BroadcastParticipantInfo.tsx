import { FC } from "react";
import { AvatarHash } from "../icons/AvatarHash";
import { WalletAddressSection } from "./WalletAddressSection";
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

        {/* Address section */}
        <WalletAddressSection address={address} />
      </div>
    </div>
  );
};

import { FC } from "react";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import { MessageCircle, Radio } from "lucide-react";

type ModeSelectorProps = {
  onModeChange: (isBroadcastMode: boolean) => void;
  isBroadcastMode: boolean;
  shouldShow?: boolean;
};

export const ModeSelector: FC<ModeSelectorProps> = ({
  onModeChange,
  isBroadcastMode,
  shouldShow = true,
}) => {
  // Early return if shouldShow is false
  if (!shouldShow) {
    return null;
  }

  const modeDisplay = isBroadcastMode ? "Broadcast" : "Chat";

  const modeIcon = isBroadcastMode ? (
    <Radio className="size-5" />
  ) : (
    <MessageCircle className="size-5" />
  );

  const modes = [
    {
      id: "chat",
      displayableString: "Chat",
      icon: <MessageCircle className="size-3" />,
      value: false,
    },
    {
      id: "radio",
      displayableString: "Broadcast",
      icon: <Radio className="size-3" />,
      value: true,
    },
  ];

  return (
    <Menu>
      <MenuButton className="inline-flex min-w-[100px] cursor-pointer items-center justify-center gap-2 rounded-3xl border border-[var(--color-kas-secondary)]/60 bg-[var(--color-kas-secondary)]/20 px-3 py-0.5 text-sm font-medium transition-colors duration-200 hover:scale-110">
        {modeIcon}
        {modeDisplay}
      </MenuButton>
      <MenuItems
        className="absolute top-full left-0 z-10 min-w-[140px] rounded-sm border border-[var(--border-color)] bg-[var(--secondary-bg)] shadow-md"
        anchor="bottom"
      >
        {modes.map((mode) => (
          <MenuItem key={mode.id}>
            <div
              onClick={() => onModeChange(mode.value)}
              className={`flex w-full cursor-pointer items-center gap-2 border-none bg-none px-3 py-2 text-left text-sm font-semibold text-[var(--text-primary)] transition-colors duration-200 ${
                isBroadcastMode === mode.value
                  ? "bg-[var(--kas-primary)] text-[var(--text-primary)]"
                  : "hover:bg-[var(--kas-secondary)]"
              }`}
            >
              {mode.icon}
              {mode.displayableString}
            </div>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
};

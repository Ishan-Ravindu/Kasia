import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { FC } from "react";

export const AppVersion: FC = () => {
  return (
    <Popover className="relative">
      <PopoverButton className="cursor-pointer">
        v{__APP_VERSION__}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom"
        transition
        className="text-text-primary z-[60] flex flex-col rounded bg-[var(--primary-bg)] p-4 shadow-2xl ring-1 shadow-(color:--button-primary)/30 ring-[var(--primary-border)] transition duration-200 ease-out data-closed:scale-95 data-closed:opacity-0"
      >
        {__COMMIT_SHA__}
      </PopoverPanel>
    </Popover>
  );
};

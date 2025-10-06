import { HeartHandshake } from "lucide-react";
import { useUiStore } from "../../store/ui.store";
import type { ModalType } from "../../store/ui.store";

interface DonationsProps {
  closeModalKey?: ModalType;
}

export const Donations = ({ closeModalKey }: DonationsProps) => {
  const openModal = useUiStore((state) => state.openModal);
  const closeModal = useUiStore((state) => state.closeModal);

  const handleClick = () => {
    if (closeModalKey) {
      closeModal(closeModalKey);
    }
    openModal("donation");
  };

  return (
    <button
      onClick={handleClick}
      className="shadow-4xl fixed top-2 left-2 z-50 cursor-pointer rounded-full p-2 text-pink-500/90 backdrop-blur-sm transition-colors duration-200 hover:text-pink-600"
      title="Support us with a donation"
    >
      <HeartHandshake className="size-7" />
    </button>
  );
};

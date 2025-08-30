import { useRef } from "react";
import { SendHorizonal } from "lucide-react";
import clsx from "clsx";
import {
  useComposerStore,
  useComposerSlice,
} from "../../store/message-composer.store";
import { useBroadcastComposer } from "../../hooks/MessageComposer/useBroadcastComposer";
import { MessageInput } from "./MessageInput";
import { FeeDisplay } from "./FeeDisplay";
import { useFeeEstimate } from "../../hooks/MessageComposer/useFeeEstimate";
import { toast } from "../../utils/toast-helper";

export const BroadcastComposerShell = ({
  channelName,
}: {
  channelName: string;
}) => {
  const setDraft = useComposerStore((s) => s.setDraft);
  const draft = useComposerStore((s) => s.drafts[channelName] || "");
  const priority = useComposerStore((s) => s.priority);
  const setPriority = useComposerStore((s) => s.setPriority);
  const sendState = useComposerSlice((s) => s.sendState);
  const setSendState = useComposerStore((s) => s.setSendState);

  const { sendBroadcast } = useBroadcastComposer(channelName);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  const feeState = useFeeEstimate({
    toSelf: true,
    recipient: undefined,
    draft,
    attachment: undefined,
    broadcastOptions: {
      isBroadcast: true,
      channelName,
    },
  });

  const handleDraftChange = (value: string) => {
    setDraft(channelName, value);
    if (sendState.status === "error") {
      setSendState({ status: "idle" });
    }
  };

  const onSend = async () => {
    if (!draft.trim()) {
      toast.error("Please enter a message to broadcast");
      return;
    }
    await sendBroadcast();
  };

  return (
    <div className="border-primary-border bg-secondary-bg relative flex-col gap-8 border-t">
      <FeeDisplay
        recipient={undefined}
        draft={draft}
        attachment={undefined}
        feeState={feeState}
        priority={priority}
        onPriorityChange={setPriority}
        isBroadcast={true}
      />
      <div className="relative mx-2 my-2 rounded-lg p-1 pb-3 sm:pb-0">
        <div className="relative flex items-center">
          <MessageInput
            ref={messageInputRef}
            value={draft}
            onChange={handleDraftChange}
            onSend={onSend}
            onDragOver={false} // no drag support
            onPaste={() => {}} // no pasting
            placeholder="Type your broadcast..."
            disabled={sendState.status === "loading"}
          />

          <div className="absolute right-2 flex h-full items-center gap-1">
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={onSend}
                  className={clsx(
                    "absolute flex h-6 w-6 cursor-pointer items-center justify-center text-[var(--button-primary)] transition-all duration-200 ease-in-out hover:text-[var(--button-primary)]/80 active:scale-90 active:opacity-80",
                    draft.trim()
                      ? "pointer-events-auto translate-x-0 opacity-100"
                      : "pointer-events-none translate-x-4 opacity-0"
                  )}
                  aria-label="Send Broadcast"
                >
                  <SendHorizonal className="size-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

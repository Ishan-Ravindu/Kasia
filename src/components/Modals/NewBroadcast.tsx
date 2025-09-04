import React, { useState } from "react";
import { Button } from "../Common/Button";
import { useBroadcastStore } from "../../store/broadcast.store";
import { toast } from "../../utils/toast-helper";
import clsx from "clsx";

const MAX_BROADCAST_LENGTH = 20;

interface NewBroadcast {
  onClose: () => void;
}

export const NewBroadcast: React.FC<NewBroadcast> = ({ onClose }) => {
  const [inputValue, setInputValue] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const addChannel = useBroadcastStore((state) => state.addChannel);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // clear error when user starts typing
    if (error) setError(null);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDescription(value);

    // clear error when user starts typing
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAdd();
  };

  const validateInput = (value: string): string | null => {
    if (!value.trim()) {
      return "Channel name cannot be empty";
    }
    if (value.length > MAX_BROADCAST_LENGTH) {
      return `Channel name cannot exceed ${MAX_BROADCAST_LENGTH} characters`;
    }
    if (value.includes(" ")) {
      return "Channel name cannot contain spaces";
    }
    return null;
  };
  const handleAdd = async () => {
    const validationError = validateInput(inputValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    toast.removeAll();
    try {
      await addChannel(inputValue, description.trim() || "Broadcast channel");
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to add channel. Please try again.";
      setError(errorMessage); // use setError for store errors too
      console.error("Error adding broadcast channel:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isInputValid =
    !error &&
    inputValue.trim().length > 0 &&
    inputValue.length <= MAX_BROADCAST_LENGTH &&
    !inputValue.includes(" ");
  return (
    <div className="w-full">
      <div className="mb-4">
        <strong className="mb-3 block text-lg text-[var(--text-primary)]">
          Broadcast Channel:
        </strong>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-full space-y-3">
            <div>
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="Name your channel to tune in to (e.g. general)"
                maxLength={MAX_BROADCAST_LENGTH}
                className="border-primary-border bg-primary-bg w-full cursor-text items-center rounded-lg border px-3 py-2 transition-colors focus:ring-2 focus:ring-[var(--kas-primary)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {inputValue.length}/{MAX_BROADCAST_LENGTH} characters
              </p>
            </div>

            <div>
              <input
                type="text"
                value={description}
                onChange={handleDescriptionChange}
                placeholder="Enter description (optional)"
                maxLength={100}
                className="border-primary-border bg-primary-bg w-full cursor-text items-center rounded-lg border px-3 py-2 transition-colors focus:ring-2 focus:ring-[var(--kas-primary)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {description.length}/100 characters
              </p>
            </div>
            {error && <p className="text-accent-yellow text-sm">{error}</p>}
          </div>
          <div className="flex w-full">
            <Button
              type="submit"
              title="Add broadcast channel"
              variant="primary"
              className={clsx("h-12 !rounded-lg", {
                "opacity-60": !isInputValid || isLoading,
              })}
            >
              {isLoading ? "Adding..." : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

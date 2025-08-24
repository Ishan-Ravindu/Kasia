import { Button } from "../Common/Button";

type ImportSuccessProps = {
  onBack: () => void;
};

export const ImportSuccess = ({ onBack }: ImportSuccessProps) => {
  return (
    <>
      <h2 className="text-center text-lg font-bold">
        Wallet Imported Successfully
      </h2>
      <div className="mt-5 flex justify-center">
        <Button
          onClick={onBack}
          variant="primary"
          className="w-full px-4 py-2 text-sm"
        >
          Back to Wallets
        </Button>
      </div>
    </>
  );
};

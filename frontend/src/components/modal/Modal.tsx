
import { AuthStep } from "../auth/AuthStep";

// --------------------------- Types ---------------------------
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}


export const Modal = ({ isOpen, onClose }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative "
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors text-2xl w-8 h-8 flex items-center justify-center cursor-pointer"
        >
          ×
        </button>
        <div className="border-8">
            <AuthStep />
        </div>  
      </div>
    </div>
  );
};
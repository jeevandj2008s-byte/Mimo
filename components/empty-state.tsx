import { BookOpen, Sparkles } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: "book" | "sparkle";
};

export function EmptyState({ title, description, actionLabel, onAction, icon = "book" }: EmptyStateProps) {
  const Icon = icon === "sparkle" ? Sparkles : BookOpen;
  return (
    <div className="surface flex min-h-[250px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f1ff] text-[#7354c7]">
        <Icon size={21} strokeWidth={1.8} />
      </div>
      <h3 className="text-base font-bold text-[#342e4c]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#817b96]">{description}</p>
      {actionLabel && onAction ? (
        <button className="primary-button mt-5" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

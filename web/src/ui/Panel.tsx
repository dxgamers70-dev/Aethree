import { HTMLAttributes } from "react";

export function Panel({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-panel border border-ink/8 rounded-2xl p-5 shadow-[0_2px_12px_-6px_rgba(20,17,13,0.12)] ${className}`}
      {...props}
    />
  );
}

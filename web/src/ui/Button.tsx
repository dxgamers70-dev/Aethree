import { ButtonHTMLAttributes } from "react";

type Variant = "acid" | "volt" | "ghost";
const styles: Record<Variant, string> = {
  acid: "bg-acid text-void glow-acid hover:brightness-110",
  volt: "bg-volt text-void glow-volt hover:brightness-110",
  ghost: "bg-transparent text-ink border border-ink/15 hover:border-acid hover:text-acid",
};

export function Button({
  variant = "acid",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`px-5 py-2.5 rounded-xl font-bold uppercase tracking-wide text-sm transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

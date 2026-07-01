export function MonoNum({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-mono tabular-nums text-acid ${className}`}>{children}</span>;
}

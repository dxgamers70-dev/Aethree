import Link from "next/link";
import Image from "next/image";

/** Product logo + wordmark, links home. Used in the app navs. */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label="AeThree home">
      <Image
        src="/logo.png"
        alt="AeThree"
        width={36}
        height={36}
        priority
        className="h-9 w-9 rounded-md ring-1 ring-muted/20"
      />
      <span className="text-xl font-black tracking-tight">
        Ae<span className="text-acid">Three</span>
      </span>
    </Link>
  );
}

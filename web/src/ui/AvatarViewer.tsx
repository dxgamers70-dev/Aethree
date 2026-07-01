"use client";

import dynamic from "next/dynamic";

// Load the three.js canvas client-side only — never during SSR.
const AvatarCanvas = dynamic(() => import("./AvatarCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-gradient-to-b from-panel to-void">
      <span className="font-mono text-xs text-muted animate-pulse">loading 3D…</span>
    </div>
  ),
});

export default function AvatarViewer({
  url,
  className = "",
  autoRotate = true,
}: {
  url: string;
  className?: string;
  autoRotate?: boolean;
}) {
  return (
    <div className={className}>
      <AvatarCanvas url={url} autoRotate={autoRotate} />
    </div>
  );
}

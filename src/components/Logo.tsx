"use client";

export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Table top */}
      <rect x="8" y="32" width="36" height="5" rx="2.5" fill="#0f172a" />
      {/* Left leg */}
      <rect x="12" y="37" width="4" height="16" rx="2" fill="#0f172a" />
      {/* Right leg */}
      <rect x="36" y="37" width="4" height="16" rx="2" fill="#0f172a" />

      {/* Speech bubble */}
      <rect x="28" y="6" width="30" height="22" rx="6" fill="#10b981" />
      {/* Bubble tail */}
      <path d="M34 28 L30 34 L40 28" fill="#10b981" />

      {/* Three dots in bubble */}
      <circle cx="37" cy="17" r="2.5" fill="white" />
      <circle cx="43" cy="17" r="2.5" fill="white" />
      <circle cx="49" cy="17" r="2.5" fill="white" />
    </svg>
  );
}

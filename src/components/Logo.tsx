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
      {/* Rounded square background */}
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#0f172a" />

      {/* Stylized "M" mark — clean, geometric */}
      <path
        d="M16 44V24l10 12 10-12v20"
        stroke="#10b981"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Signal waves — representing AI/voice */}
      <path
        d="M44 22c2.5-2.5 2.5-6.5 0-9"
        stroke="#10b981"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M48 19c4-4 4-10.5 0-14.5"
        stroke="#10b981"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

"use client";

export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rounded square background */}
      <rect x="3" y="3" width="94" height="94" rx="22" fill="#0f172a" />

      {/* Plate rim — dinner plate circle */}
      <circle cx="50" cy="50" r="32" stroke="#2dd4a8" strokeWidth="4" fill="none" />

      {/* Inner plate glow */}
      <circle cx="50" cy="50" r="26" fill="#2dd4a8" opacity="0.15" />

      {/* M lettermark inside plate */}
      <path
        d="M34 60V38l16 12 16-12v22"
        stroke="#2dd4a8"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

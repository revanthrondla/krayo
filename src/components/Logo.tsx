export function KrayoLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <rect width="26" height="26" rx="7" fill="#2F8074" />
      <path d="M6 13c3 0 3-5 6-5s3 5 6 5-3 5-6 5-3-5-6-5z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

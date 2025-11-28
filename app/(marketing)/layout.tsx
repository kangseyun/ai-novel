export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black flex justify-center">
      {/* 모바일 너비로 제한 (max-width: 430px) */}
      <div className="w-full max-w-[430px] min-h-screen relative bg-black shadow-2xl">
        {children}
      </div>
    </div>
  );
}

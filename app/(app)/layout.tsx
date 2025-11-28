export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#111] flex justify-center">
      {/* Mobile App Container Constraint */}
      <div className="w-full max-w-[480px] min-h-screen bg-white shadow-2xl relative overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}

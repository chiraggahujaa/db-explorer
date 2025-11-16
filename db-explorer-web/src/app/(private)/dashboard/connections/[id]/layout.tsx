export default function ConnectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      {children}
    </div>
  );
}

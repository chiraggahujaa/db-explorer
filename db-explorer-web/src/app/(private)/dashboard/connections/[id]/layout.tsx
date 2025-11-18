export default function ConnectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full w-full overflow-hidden">
      {children}
    </div>
  );
}

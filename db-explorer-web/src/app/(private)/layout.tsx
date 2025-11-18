import Header from "@/components/layout/Header/Header";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 pt-16 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
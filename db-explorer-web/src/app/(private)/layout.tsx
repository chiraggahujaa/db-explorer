import Header from "@/components/layout/Header/Header";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden mt-16">
        {children}
      </main>
    </div>
  );
}
import Header from "@/components/layout/Header/Header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="h-16" />
      {children}
    </>
  );
}
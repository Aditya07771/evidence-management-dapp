export const metadata = {
  title: 'Evidence Management System',
  description: 'Blockchain-based evidence tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
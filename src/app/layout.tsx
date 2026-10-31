import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Echoverse — A Universe That Listens to You',
  description:
    'Multimodal AI-powered 3D music discovery platform powered by Google Gemini and Jamendo.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#030308] text-white">{children}</body>
    </html>
  );
}

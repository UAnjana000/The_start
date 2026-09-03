import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NSG CQB-MANET // Tactical C2 Dashboard',
  description: 'Zero-Profile Directional Patch Helmet Antenna & Tactical Mesh Command & Control (SIH Problem Statement 26185 - Ministry of Home Affairs / NSG)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-tactical-bg text-tactical-textBright antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

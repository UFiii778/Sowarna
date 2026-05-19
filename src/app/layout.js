import './globals.css';

export const metadata = {
  title: 'SowanQR - Buku Tamu Digital',
  description: 'Aplikasi Buku Tamu Berbasis QR Code',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
import './globals.css';

export const metadata = {
  title: 'Sistema de Verificação de Duplicatas',
  description: 'Sistema para verificar duplicatas de notas fiscais',
  icons: {
    shortcut: '/logo.png'

  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="bg-linear-to-br from-dark[#071A36] via-dark-alt[#0D2D5D] to-dark[#071A36] text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}

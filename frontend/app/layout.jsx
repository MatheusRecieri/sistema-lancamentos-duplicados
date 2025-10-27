import './globals.css';

export const metadata = {
  title: 'Sistema de Verificação de Duplicatas',
  description: 'Sistema para verificar duplicatas de notas fiscais',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gradient-to-br from-[#071A36] via-[#0D2D5D] to-[#071A36] text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}

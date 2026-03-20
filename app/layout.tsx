import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "持参薬MRCI評価システム",
  description: "入院時持参薬鑑別・処方複雑性指数評価・最適化支援",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={geist.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2">
              <a href="/" className="flex items-center gap-1.5 font-bold text-gray-900 hover:opacity-80 shrink-0">
                <span className="text-blue-600 text-lg">💊</span>
                <span className="hidden sm:inline text-sm sm:text-base">持参薬MRCI評価システム</span>
                <span className="sm:hidden text-sm">持参薬MRCI</span>
              </a>
              <nav className="flex items-center gap-1 ml-auto">
                <a
                  href="/"
                  className="px-2 sm:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  症例一覧
                </a>
                <a
                  href="/renal-db"
                  className="px-2 sm:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  腎機能DB
                </a>
                <a
                  href="/pmis-db"
                  className="px-2 sm:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  PMIS
                </a>
                <a
                  href="/analyze"
                  className="px-2 sm:px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
                >
                  新規鑑別
                </a>
              </nav>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        </div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

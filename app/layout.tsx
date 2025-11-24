import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
    title: "Lvapp tagging-plan",
    description: "Premium web analytics dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider>
            <html lang="fr">
                <head>
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
                </head>
                <body className={`${inter.className} flex min-h-screen bg-slate-950 text-white font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200`}>
                    {children}
                </body>
            </html>
        </ClerkProvider>
    )
}

import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
            <h2 className="text-4xl font-bold text-white mb-4">404 - Page Not Found</h2>
            <p className="text-slate-400 mb-8">Could not find requested resource</p>
            <Link href="/" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition">
                Return Home
            </Link>
        </div>
    );
}

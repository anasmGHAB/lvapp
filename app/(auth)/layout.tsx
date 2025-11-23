export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-[#F5F1E8] via-[#EDE8DC] to-[#E8E3D5]">
            {children}
        </div>
    )
}

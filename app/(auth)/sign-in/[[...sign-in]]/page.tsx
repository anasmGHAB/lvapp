'use client';
import { SignIn } from "@clerk/nextjs";

export default function Page() {
    return (
        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md px-6">

            {/* Branding Louis Vuitton Style */}
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-light tracking-[0.5em] text-[#5D4E37] uppercase mb-3">LV Data</h1>
                <div className="h-[2px] w-16 bg-gradient-to-r from-[#C9A961] via-[#D4AF37] to-[#C9A961] mx-auto"></div>
            </div>

            {/* Card avec effet luxe */}
            <div className="w-full bg-white/80 backdrop-blur-sm rounded-sm shadow-2xl border border-[#D4AF37]/20 p-8">
                <SignIn
                    appearance={{
                        layout: { socialButtonsPlacement: 'bottom' },
                        elements: {
                            rootBox: "w-full",
                            card: "bg-transparent shadow-none p-0 w-full",
                            headerTitle: "text-[#5D4E37] text-xl font-light tracking-wide",
                            headerSubtitle: "text-[#8B7355] text-sm",

                            // Labels et Inputs
                            formFieldRow: "mb-5",
                            formFieldLabel: "text-[#8B7355] text-[11px] uppercase tracking-[0.15em] mb-2 font-medium",
                            formFieldInput: "bg-[#FDFBF7] border border-[#D4AF37]/30 rounded-sm text-[#5D4E37] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 transition-all h-11 px-4 text-sm placeholder-[#B8A88A]",

                            // Bouton Principal - Marron LV avec or
                            formButtonPrimary: "bg-gradient-to-r from-[#5D4E37] to-[#4A3C2A] text-[#F5F1E8] hover:from-[#4A3C2A] hover:to-[#5D4E37] rounded-sm py-3 uppercase tracking-[0.2em] text-[11px] font-bold mt-6 w-full shadow-lg hover:shadow-xl transition-all border border-[#D4AF37]/30",

                            // Divider
                            dividerRow: "my-6",
                            dividerLine: "bg-[#D4AF37]/20",
                            dividerText: "text-[#8B7355] text-[10px] uppercase tracking-wider",

                            // Boutons sociaux - Visibles avec bordure or
                            socialButtonsBlockButton: "bg-white border-2 border-[#D4AF37]/40 text-[#5D4E37] hover:bg-[#FDFBF7] hover:border-[#D4AF37] rounded-sm py-3 font-medium text-sm transition-all shadow-sm hover:shadow-md",
                            socialButtonsBlockButtonText: "text-[#5D4E37] font-medium",

                            // Footer
                            footer: "mt-6",
                            footerActionText: "text-[#8B7355] text-sm",
                            footerActionLink: "text-[#5D4E37] font-semibold hover:text-[#D4AF37] transition-colors",

                            // Autres éléments
                            formFieldInputShowPasswordButton: "text-[#8B7355] hover:text-[#5D4E37]",
                            identityPreviewText: "text-[#8B7355] text-xs",
                            formResendCodeLink: "text-[#D4AF37] text-xs hover:text-[#5D4E37] font-medium",
                            otpCodeFieldInput: "bg-[#FDFBF7] border border-[#D4AF37]/30 text-[#5D4E37] focus:border-[#D4AF37] rounded-sm"
                        },
                        variables: {
                            colorPrimary: "#D4AF37",
                            colorText: "#5D4E37",
                            colorBackground: "#FDFBF7",
                            colorInputBackground: "#FDFBF7",
                            colorInputText: "#5D4E37",
                            fontFamily: "inherit",
                            borderRadius: "0.125rem"
                        }
                    }}
                />
            </div>

            {/* Footer Legal */}
            <div className="mt-8 text-center">
                <p className="text-[9px] text-[#8B7355] uppercase tracking-[0.3em] opacity-60">Louis Vuitton Malletier • 2025</p>
            </div>
        </div>
    );
}

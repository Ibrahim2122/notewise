import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CtaSection } from "@/components/landing/cta-section";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}


import HeroSection from "@/components/hero-section";
import Features from "@/components/features-3";
import ContentSection from "@/components/content-2";
import StatsSection from "@/components/stats-3";
import Pricing from "@/components/pricing";
import FooterSection from "@/components/footer";
import ContentSection1 from "@/components/content-1";

export default function Home() {
  return (
    <>
    <HeroSection />
    <Features />
    <ContentSection />
    <ContentSection1 />
    <StatsSection />
    <Pricing />
    <FooterSection />
    </>
  );
}

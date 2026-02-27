import { Hero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { ToolGrid } from "@/components/marketing/ToolGrid";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { CTASection } from "@/components/marketing/CTASection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <ToolGrid />
      <HowItWorks />
      <CTASection />
    </>
  );
}

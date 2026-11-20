"use client";

import {
  Store,
  Clock,
  Palette,
  MapPin,
  Share2,
  Sparkles,
} from "lucide-react";
import { ComingSoonPage, type PlannedFeature } from "@/components/ui/coming-soon";

const STORE_FEATURES: PlannedFeature[] = [
  {
    title: "WhatsApp Business Profile",
    description: "Edit description, business address, email, website links, and cover photo synced with Meta.",
    icon: Store,
    status: "in-progress",
  },
  {
    title: "Operating Hours & Away Messages",
    description: "Set working hours and automate out-of-office autoreplies when your team is closed.",
    icon: Clock,
    status: "in-progress",
  },
  {
    title: "Storefront Branding",
    description: "Customize colors, logo badges, greeting messages, and welcome catalogs shown to shoppers.",
    icon: Palette,
    status: "planned",
  },
  {
    title: "Direct Share Links & QR Codes",
    description: "Generate WhatsApp direct chat links, click-to-chat QR codes, and embedded website widgets.",
    icon: Share2,
    status: "planned",
  },
];

export default function StorePage() {
  return (
    <ComingSoonPage
      title="Store"
      subtitle="Manage your WhatsApp Business storefront, operating hours, and customer catalog."
      icon={Store}
      badge="Coming Soon"
      features={STORE_FEATURES}
    />
  );
}

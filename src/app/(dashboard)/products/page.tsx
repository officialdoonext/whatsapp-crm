"use client";

import {
  Layers,
  ShoppingBag,
  RefreshCw,
  Image,
  Tag,
  Boxes,
} from "lucide-react";
import { ComingSoonPage, type PlannedFeature } from "@/components/ui/coming-soon";

const PRODUCT_FEATURES: PlannedFeature[] = [
  {
    title: "Meta Catalog Live Sync",
    description: "Two-way synchronization with Meta Commerce Manager catalog, prices, and inventory status.",
    icon: RefreshCw,
    status: "in-progress",
  },
  {
    title: "Rich Media & Gallery",
    description: "Upload high-res product photos, descriptions, and WhatsApp-optimized compressed media.",
    icon: Image,
    status: "in-progress",
  },
  {
    title: "Stock & Inventory Alerts",
    description: "Track inventory quantities, low-stock thresholds, and automatically hide out-of-stock items.",
    icon: Boxes,
    status: "planned",
  },
  {
    title: "One-Click In-Chat Dispatch",
    description: "Send single product cards or multi-item collection lists straight from the inbox composer.",
    icon: Tag,
    status: "planned",
  },
];

export default function ProductsPage() {
  return (
    <ComingSoonPage
      title="Products"
      subtitle="Manage your product inventory, pricing, descriptions, and catalog items."
      icon={Layers}
      badge="Coming Soon"
      features={PRODUCT_FEATURES}
    />
  );
}

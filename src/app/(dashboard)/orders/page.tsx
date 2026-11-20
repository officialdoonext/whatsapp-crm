"use client";

import {
  Package,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Receipt,
  Truck,
  Filter,
  FileSpreadsheet,
} from "lucide-react";
import { ComingSoonPage, type PlannedFeature } from "@/components/ui/coming-soon";

const ORDER_FEATURES: PlannedFeature[] = [
  {
    title: "Native WhatsApp Cart Sync",
    description: "Capture and review multi-product carts submitted directly by WhatsApp customers inside chat threads.",
    icon: ShoppingBag,
    status: "in-progress",
  },
  {
    title: "Lifecycle Order Tracking",
    description: "Move orders seamlessly across Pending, Paid, Processing, Shipped, Delivered, and Cancelled stages.",
    icon: Clock,
    status: "in-progress",
  },
  {
    title: "Invoicing & Receipts",
    description: "Generate branded PDF invoices and payment receipts sent automatically back to the customer's chat.",
    icon: Receipt,
    status: "planned",
  },
  {
    title: "Shipping & Fulfillment",
    description: "Log courier tracking numbers and trigger automated WhatsApp shipping notifications.",
    icon: Truck,
    status: "planned",
  },
];

export default function OrdersPage() {
  return (
    <ComingSoonPage
      title="Orders"
      subtitle="View, track, and manage customer orders and shopping carts from WhatsApp."
      icon={Package}
      badge="Coming Soon"
      features={ORDER_FEATURES}
    />
  );
}

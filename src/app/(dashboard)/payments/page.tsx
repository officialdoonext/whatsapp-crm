"use client";

import {
  CreditCard,
  QrCode,
  DollarSign,
  ArrowRightLeft,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { ComingSoonPage, type PlannedFeature } from "@/components/ui/coming-soon";

const PAYMENT_FEATURES: PlannedFeature[] = [
  {
    title: "Multi-Gateway Processing",
    description: "Connect Razorpay, Stripe, and Meta Pay with instant API keys and automated webhook settlement.",
    icon: CreditCard,
    status: "in-progress",
  },
  {
    title: "UPI Dynamic QR & Links",
    description: "Generate instant UPI pay links and dynamic QR codes for zero-friction payments in India.",
    icon: QrCode,
    status: "in-progress",
  },
  {
    title: "Refunds & Adjustments",
    description: "Issue full or partial refunds directly from the CRM without opening gateway merchant panels.",
    icon: ArrowRightLeft,
    status: "planned",
  },
  {
    title: "Automated Reconciliation",
    description: "Auto-reconcile bank payouts, platform fees, and order payments with detailed financial audit logs.",
    icon: ShieldCheck,
    status: "planned",
  },
];

export default function PaymentsPage() {
  return (
    <ComingSoonPage
      title="Payments"
      subtitle="Payment gateway integrations, transaction logs, and WhatsApp in-chat checkout."
      icon={CreditCard}
      badge="Coming Soon"
      features={PAYMENT_FEATURES}
    />
  );
}

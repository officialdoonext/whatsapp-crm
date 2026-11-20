"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  Store,
  Clock,
  Phone,
  MapPin,
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Ticket,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  Crosshair,
  CreditCard,
  Building,
  ArrowRight,
  ExternalLink,
  Loader2,
  Sparkles,
  Info,
  DollarSign,
  ShieldCheck,
  FolderTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type {
  StoreProfile,
  StoreProduct,
  CommerceCategory,
  StoreCoupon,
  StoreOrder,
  ProductVariantItem,
} from "@/types";

interface CartItem {
  id: string;
  product: StoreProduct;
  variant?: ProductVariantItem;
  quantity: number;
  unitPrice: number;
  salePrice: number;
  totalPrice: number;
}

interface SavedAddress {
  fullName: string;
  mobileNumber: string;
  streetAddress: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
}

export default function PublicStorefrontPage() {
  const params = useParams();
  const storeId = params?.storeId as string;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const [store, setStore] = useState<StoreProfile | null>(null);
  const [storeStatus, setStoreStatus] = useState<{
    isOpen: boolean;
    statusLabel: string;
    statusDescription: string;
  } | null>(null);
  const [categories, setCategories] = useState<CommerceCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<{
    cod?: { enabled: boolean; min_order_value?: number };
    online?: {
      enabled: boolean;
      provider?: 'razorpay' | 'cashfree' | 'phonepe';
      key_id?: string;
      app_id?: string;
      merchant_id?: string;
      env?: string;
    };
    hasAnyPaymentConfigured?: boolean;
  }>({});

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [foodTypeFilter, setFoodTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Variant Modal
  const [variantProduct, setVariantProduct] = useState<StoreProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantItem | null>(null);

  // Coupons State
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<StoreCoupon | null>(null);

  // Checkout Form State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Saved Addresses in local storage
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  // Payment Selection & Submission
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"cod" | "online">("cod");
  const [placingOrder, setPlacingOrder] = useState(false);

  // Order Confirmed State
  const [confirmedOrder, setConfirmedOrder] = useState<StoreOrder | null>(null);

  // Fetch Store Data
  const fetchStoreData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/user/store/${storeId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Store is currently unavailable");
      }

      setStore(data.store);
      setIsExpired(Boolean(data.isExpired));
      setStoreStatus(data.status);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setPaymentConfig(data.paymentConfig || {});

      // Auto select first enabled payment method
      if (data.paymentConfig?.cod?.enabled) {
        setSelectedPaymentMethod("cod");
      } else if (data.paymentConfig?.online?.enabled) {
        setSelectedPaymentMethod("online");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load store");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  // Fetch Store Coupons
  const fetchCoupons = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/user/coupons/${storeId}`);
      const data = await res.json();
      if (res.ok && data.coupons) {
        setCoupons(data.coupons);
      }
    } catch {
      // non-fatal
    }
  }, [storeId]);

  useEffect(() => {
    fetchStoreData();
    fetchCoupons();

    try {
      const savedInfo = localStorage.getItem("wacrm_customer_info");
      if (savedInfo) {
        const parsed = JSON.parse(savedInfo);
        if (parsed.name) setCustomerName(parsed.name);
        if (parsed.mobile) setCustomerMobile(parsed.mobile);
        if (Array.isArray(parsed.addresses) && parsed.addresses.length > 0) {
          setSavedAddresses(parsed.addresses);
          setStreetAddress(parsed.addresses[0].streetAddress);
          setLandmark(parsed.addresses[0].landmark || "");
        }
      }
    } catch {
      // non-fatal
    }
  }, [fetchStoreData, fetchCoupons]);

  // Dynamic Razorpay SDK loader
  const loadRazorpaySDK = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && (window as unknown as { Razorpay?: unknown }).Razorpay) {
        return resolve(true);
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "all") {
        const catMatch =
          p.category?.toLowerCase() === selectedCategory.toLowerCase() ||
          (p.metadata?.category_id as string) === selectedCategory;
        if (!catMatch) return false;
      }

      if (foodTypeFilter !== "all" && p.food_type !== foodTypeFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const codeMatch = p.short_code?.toLowerCase().includes(q);
        const descMatch = p.description?.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !descMatch) return false;
      }

      return true;
    });
  }, [products, selectedCategory, foodTypeFilter, searchQuery]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [cart]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Discount Calculation based on applied coupon
  const discountAmount = useMemo(() => {
    if (!appliedCoupon || subtotal < appliedCoupon.min_order_value) return 0;
    if (appliedCoupon.discount_type === "flat") {
      return Math.min(appliedCoupon.discount_value, subtotal);
    } else {
      const perc = (subtotal * appliedCoupon.discount_value) / 100;
      return appliedCoupon.max_discount ? Math.min(perc, appliedCoupon.max_discount) : perc;
    }
  }, [appliedCoupon, subtotal]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  // Evaluated Coupons with Eligibility
  const evaluatedCoupons = useMemo(() => {
    return coupons
      .map((c) => {
        const meetsMinOrder = subtotal >= c.min_order_value;
        const isEligible = meetsMinOrder;

        let reason = "";
        if (!meetsMinOrder) {
          const diff = c.min_order_value - subtotal;
          reason = `Add ₹${diff.toFixed(0)} more to unlock this coupon`;
        }

        return {
          ...c,
          isEligible,
          reason,
        };
      })
      .sort((a, b) => (b.isEligible ? 1 : 0) - (a.isEligible ? 1 : 0));
  }, [coupons, subtotal]);

  // Handle Add to Cart
  const handleAddToCart = (product: StoreProduct) => {
    const variants =
      product.variants_config ||
      (Array.isArray(product.metadata?.variants)
        ? (product.metadata.variants as ProductVariantItem[])
        : []);

    if (variants && variants.length > 0) {
      setVariantProduct(product);
      setSelectedVariant(variants[0]);
    } else {
      const itemPrice = product.sale_price || product.list_price || 0;
      addItemToCart(product, undefined, itemPrice);
    }
  };

  const addItemToCart = (
    product: StoreProduct,
    variant: ProductVariantItem | undefined,
    salePrice: number
  ) => {
    const itemKey = variant
      ? `${product.id}_${variant.variant_label}_${variant.value}`
      : product.id;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === itemKey);
      if (existing) {
        return prev.map((item) =>
          item.id === itemKey
            ? {
                ...item,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.salePrice,
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            id: itemKey,
            product,
            variant,
            quantity: 1,
            unitPrice: product.list_price || salePrice,
            salePrice,
            totalPrice: salePrice,
          },
        ];
      }
    });

    toast.success(`Added ${product.name}${variant ? ` (${variant.value})` : ""} to cart`);
  };

  const handleUpdateQuantity = (itemKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === itemKey) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? { ...item, quantity: newQty, totalPrice: newQty * item.salePrice }
              : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Apply / Remove Coupon
  const handleApplyCoupon = (coupon: StoreCoupon) => {
    if (subtotal < coupon.min_order_value) {
      toast.error(`Minimum cart value of ₹${coupon.min_order_value} required`);
      return;
    }
    setAppliedCoupon(coupon);
    toast.success(`Coupon "${coupon.code}" applied!`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    toast.info("Coupon removed");
  };

  // Geolocation handler
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          if (data && data.display_name) {
            setStreetAddress(data.display_name);
            toast.success("Location retrieved and address auto-filled!");
          } else {
            setStreetAddress(`GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
            toast.success("GPS coordinates attached!");
          }
        } catch {
          setStreetAddress(`GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
          toast.success("GPS coordinates attached!");
        } finally {
          setLocationLoading(false);
        }
      },
      (err) => {
        setLocationLoading(false);
        toast.error(`Location error: ${err.message}. Please type your address manually.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Save Customer Address Helper
  const persistCustomerInfo = () => {
    try {
      const existingInfo = {
        name: customerName.trim(),
        mobile: customerMobile.trim(),
        addresses: [
          {
            fullName: customerName.trim(),
            mobileNumber: customerMobile.trim(),
            streetAddress: streetAddress.trim(),
            landmark: landmark.trim(),
            latitude: userCoords?.lat,
            longitude: userCoords?.lng,
          },
          ...savedAddresses.filter((a) => a.streetAddress !== streetAddress.trim()),
        ].slice(0, 5),
      };
      localStorage.setItem("wacrm_customer_info", JSON.stringify(existingInfo));
    } catch {
      // non-fatal
    }
  };

  // Place Order Flow
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!customerMobile.trim()) {
      toast.error("Please enter your mobile number");
      return;
    }

    if (!streetAddress.trim()) {
      toast.error("Please enter your delivery address or allow location");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    const isCod = selectedPaymentMethod === "cod";
    const isOnline = selectedPaymentMethod === "online";

    if (!isCod && !isOnline) {
      toast.error("Please choose a payment method");
      return;
    }

    setPlacingOrder(true);

    const baseOrderPayload = {
      store_id: storeId,
      customer_name: customerName.trim(),
      customer_mobile: customerMobile.trim(),
      delivery_address: {
        fullName: customerName.trim(),
        mobileNumber: customerMobile.trim(),
        streetAddress: streetAddress.trim(),
        landmark: landmark.trim() || undefined,
        latitude: userCoords?.lat,
        longitude: userCoords?.lng,
      },
      items: cart.map((item) => ({
        product_id: item.product.id,
        name: item.product.name,
        short_code: item.product.short_code,
        variant_id: item.variant?.id,
        variant_name: item.variant
          ? `${item.variant.variant_label}: ${item.variant.value}`
          : undefined,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        sale_price: item.salePrice,
        total_price: item.totalPrice,
        food_type: item.product.food_type,
        image_url: item.product.images?.[0] || item.product.image_url,
      })),
      subtotal,
      discount_amount: discountAmount,
      coupon_code: appliedCoupon?.code || null,
      total_amount: finalTotal,
    };

    // 1. ONLINE PAYMENT FLOW
    if (isOnline) {
      const onlineProvider = paymentConfig.online?.provider || "razorpay";
      const razorpayKey = paymentConfig.online?.key_id;

      if (onlineProvider === "razorpay" && razorpayKey) {
        const sdkLoaded = await loadRazorpaySDK();
        if (!sdkLoaded) {
          toast.error("Failed to load payment gateway SDK. Please check your network.");
          setPlacingOrder(false);
          return;
        }

        const options = {
          key: razorpayKey,
          amount: Math.round(finalTotal * 100), // in paise
          currency: "INR",
          name: store?.name || "WhatsApp Store",
          description: `Order Payment for ${cart.length} items`,
          image: store?.logo_url || undefined,
          prefill: {
            name: customerName.trim(),
            contact: customerMobile.trim(),
          },
          theme: { color: "#059669" },
          handler: async function (response: {
            razorpay_payment_id: string;
            razorpay_order_id?: string;
            razorpay_signature?: string;
          }) {
            // ONLY create and confirm order when Razorpay payment is actually paid!
            try {
              const res = await fetch("/api/user/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...baseOrderPayload,
                  payment_method: "online",
                  payment_details: {
                    provider: "razorpay",
                    payment_id: response.razorpay_payment_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                  },
                }),
              });

              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Failed to record order");

              persistCustomerInfo();
              setConfirmedOrder(data.order);
              setCart([]);
              setAppliedCoupon(null);
              setIsCheckoutOpen(false);
              setIsCartOpen(false);
              toast.success("Payment verified! Order placed successfully.");
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to record order";
              toast.error(msg);
            } finally {
              setPlacingOrder(false);
            }
          },
          modal: {
            ondismiss: function () {
              setPlacingOrder(false);
              toast.info("Payment was cancelled. Order has not been placed.");
            },
          },
        };

        const RazorpayClass = (window as unknown as { Razorpay: new (opts: typeof options) => { open: () => void } }).Razorpay;
        const rzp = new RazorpayClass(options);
        rzp.open();
        return;
      } else {
        toast.error("Online payment gateway credentials are not configured by this store.");
        setPlacingOrder(false);
        return;
      }
    }

    // 2. CASH ON DELIVERY FLOW
    try {
      const res = await fetch("/api/user/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseOrderPayload,
          payment_method: "cod",
          payment_details: {},
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");

      persistCustomerInfo();
      setConfirmedOrder(data.order);
      setCart([]);
      setAppliedCoupon(null);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      toast.success("Order confirmed successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setPlacingOrder(false);
    }
  };

  const isCodAvailable = Boolean(paymentConfig?.cod?.enabled);
  const isOnlineAvailable = Boolean(
    paymentConfig?.online?.enabled &&
      (paymentConfig?.online?.key_id ||
        paymentConfig?.online?.app_id ||
        paymentConfig?.online?.merchant_id)
  );
  const hasAnyPayment = isCodAvailable || isOnlineAvailable;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Opening Store...</p>
      </div>
    );
  }

  if (errorMsg || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Card className="max-w-md w-full text-center p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
            <XCircle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold">Store Unavailable</h2>
          <p className="text-xs text-muted-foreground mt-2">
            {errorMsg || "The requested store does not exist or has been deactivated."}
          </p>
        </Card>
      </div>
    );
  }

  // Check subscription expiry
  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Card className="max-w-md w-full text-center p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold">Store Temporarily Closed</h2>
          <p className="text-xs text-muted-foreground mt-2">
            This store subscription has expired and is currently not accepting new orders. Please check back later.
          </p>
        </Card>
      </div>
    );
  }

  // Order Confirmed Screen
  if (confirmedOrder) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full shadow-lg border-emerald-500/30 overflow-hidden">
          <div className="bg-emerald-600 text-white p-6 text-center">
            <div className="mx-auto h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
              <Check className="h-9 w-9 text-white stroke-[3]" />
            </div>
            <h2 className="text-xl font-bold">Order Confirmed!</h2>
            <p className="text-xs text-emerald-100 mt-1">
              Thank you for ordering with {store.name}.
            </p>
          </div>

          <CardContent className="p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Order Number
                </span>
                <p className="text-base font-mono font-bold text-foreground mt-0.5">
                  {confirmedOrder.order_number}
                </p>
              </div>
              <Badge className="bg-emerald-600 text-white text-xs">
                {confirmedOrder.order_status.toUpperCase()}
              </Badge>
            </div>

            {/* Notification Alert */}
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
              <Phone className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Order confirmation has been sent to your WhatsApp at +
                {confirmedOrder.customer_mobile.replace(/[^0-9]/g, "")}.
              </span>
            </div>

            {/* Delivery Details */}
            <div className="space-y-1.5 p-3 rounded-xl border bg-card">
              <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                Delivering to
              </span>
              <p className="font-medium text-foreground">{confirmedOrder.customer_name}</p>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {confirmedOrder.delivery_address?.streetAddress}
              </p>
            </div>

            {/* Ordered Items */}
            <div className="space-y-2 border-t pt-3">
              <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                Items Summary
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {confirmedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {item.quantity}x {item.name}{" "}
                      {item.variant_name ? `(${item.variant_name})` : ""}
                    </span>
                    <span className="font-medium">₹{item.total_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center text-sm font-bold border-t pt-3">
              <span>Total ({confirmedOrder.payment_method.toUpperCase()})</span>
              <span className="text-base text-primary">₹{confirmedOrder.total_amount.toFixed(2)}</span>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                onClick={() =>
                  window.open(
                    `https://wa.me/${store.mobile_number.replace(/[^0-9]/g, "")}`,
                    "_blank"
                  )
                }
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
              >
                <Phone className="h-4 w-4" />
                Chat with Store on WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmedOrder(null)}
                className="w-full text-xs"
              >
                Back to Storefront
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950 text-foreground flex flex-col">
      {/* Top Header: Logo & Store Name ONLY */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo & Store Name */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-11 w-11 rounded-xl overflow-hidden border bg-muted shrink-0 flex items-center justify-center shadow-2xs">
              {store.logo_url ? (
                <Image
                  src={store.logo_url}
                  alt={store.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <Building className="h-6 w-6 text-muted-foreground/60" />
              )}
            </div>

            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg truncate text-foreground">{store.name}</h1>
              {storeStatus && (
                <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full inline-block shrink-0 ${
                      storeStatus.isOpen ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                    }`}
                  />
                  <span>{storeStatus.statusLabel}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filter & Search Bar: Category Dropdown + Search + Food Type */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 pt-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-t">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            {/* Category Dropdown */}
            <div className="w-full sm:w-56 shrink-0">
              <Select
                value={selectedCategory}
                onValueChange={(val) => {
                  if (val) setSelectedCategory(val);
                }}
              >
                <SelectTrigger className="h-9 w-full text-xs bg-muted/40 font-medium">
                  <FolderTree className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Categories ({products.length})
                  </SelectItem>
                  {categories.map((cat) => {
                    const count = products.filter(
                      (p) =>
                        p.category?.toLowerCase() === cat.name.toLowerCase() ||
                        (p.metadata?.category_id as string) === cat.id
                    ).length;
                    return (
                      <SelectItem key={cat.id} value={cat.name} className="text-xs">
                        {cat.name} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search items, dishes, snacks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-muted/30"
              />
            </div>
          </div>

          {/* Food Type Filter Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 shrink-0">
            <button
              onClick={() => setFoodTypeFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                foodTypeFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setFoodTypeFilter("veg")}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                foodTypeFilter === "veg"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-muted hover:bg-muted/80 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Veg
            </button>
            <button
              onClick={() => setFoodTypeFilter("non-veg")}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                foodTypeFilter === "non-veg"
                  ? "bg-red-600 text-white shadow-2xs"
                  : "bg-muted hover:bg-muted/80 text-red-600 dark:text-red-400"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Non-Veg
            </button>
            <button
              onClick={() => setFoodTypeFilter("others")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                foodTypeFilter === "others"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-muted hover:bg-muted/80 text-amber-600 dark:text-amber-400"
              }`}
            >
              Others
            </button>
          </div>
        </div>
      </header>

      {/* Main Storefront Body: Products Grid (2 columns on Mobile) */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 flex-1 w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
            <span>{selectedCategory === "all" ? "All Items" : selectedCategory}</span>
            <span className="text-xs font-normal text-muted-foreground">
              ({filteredProducts.length} items)
            </span>
          </h2>
        </div>

        {filteredProducts.length === 0 ? (
          <Card className="border-dashed border-2 p-12 text-center bg-card">
            <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
            <p className="mt-3 text-sm font-semibold">No Items Found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try selecting another category or clearing search filters.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {filteredProducts.map((product) => {
              const img = product.images?.[0] || product.image_url;
              const variants =
                product.variants_config ||
                (Array.isArray(product.metadata?.variants)
                  ? (product.metadata.variants as ProductVariantItem[])
                  : []);
              const hasVariants = variants && variants.length > 0;
              const salePrice = product.sale_price || product.list_price || 0;
              const listPrice = product.list_price;

              return (
                <Card
                  key={product.id}
                  className="overflow-hidden border shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between bg-card group"
                >
                  <div>
                    {/* Image Thumbnail */}
                    <div className="relative h-32 sm:h-44 w-full bg-muted overflow-hidden">
                      {img ? (
                        <Image
                          src={img}
                          alt={product.name}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="h-8 sm:h-10 w-8 sm:w-10 opacity-30" />
                        </div>
                      )}

                      {/* Food Type Badge */}
                      <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5">
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-sm border-2 ${
                            product.food_type === "veg"
                              ? "border-emerald-600 bg-white"
                              : product.food_type === "non-veg"
                              ? "border-red-600 bg-white"
                              : "border-amber-600 bg-white"
                          }`}
                        >
                          <span
                            className={`block h-1.5 w-1.5 rounded-full mx-auto my-[2px] ${
                              product.food_type === "veg"
                                ? "bg-emerald-600"
                                : product.food_type === "non-veg"
                                ? "bg-red-600"
                                : "bg-amber-600"
                            }`}
                          />
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-2.5 sm:p-4 space-y-1 sm:space-y-2">
                      <h4 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1">
                        {product.name}
                      </h4>

                      {product.description && (
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 sm:line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </CardContent>
                  </div>

                  <div className="p-2.5 sm:p-4 pt-0 border-t mt-1.5 sm:mt-2 flex items-center justify-between gap-1.5 sm:gap-2">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-sm sm:text-base text-foreground">
                          ₹{salePrice.toFixed(0)}
                        </span>
                        {listPrice && listPrice > salePrice && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                            ₹{listPrice.toFixed(0)}
                          </span>
                        )}
                      </div>
                      {hasVariants && (
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">
                          {variants.length} options
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleAddToCart(product)}
                      className="gap-1 text-[11px] sm:text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs h-7 sm:h-8 px-2 sm:px-3 shrink-0"
                    >
                      <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Add
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* VARIANT PICKER MODAL (WIDER) */}
      <Dialog
        open={Boolean(variantProduct)}
        onOpenChange={(open) => !open && setVariantProduct(null)}
      >
        <DialogContent className="sm:max-w-lg md:max-w-xl w-full">
          {variantProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Choose Variant for</span>
                  <span className="text-primary">{variantProduct.name}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Please select your preferred size, portion, or variant option.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5 py-3">
                {(
                  variantProduct.variants_config ||
                  (variantProduct.metadata?.variants as ProductVariantItem[]) ||
                  []
                ).map((variant, i) => {
                  const isSelected = selectedVariant?.value === variant.value;
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedVariant(variant)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500"
                          : "hover:border-zinc-300 dark:hover:border-zinc-700 bg-card"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-xs text-foreground">
                          {variant.value}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {variant.variant_label}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-foreground">
                          ₹{variant.sale_price || variantProduct.sale_price}
                        </span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setVariantProduct(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedVariant && variantProduct) {
                      addItemToCart(
                        variantProduct,
                        selectedVariant,
                        selectedVariant.sale_price || variantProduct.sale_price
                      );
                      setVariantProduct(null);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add to Cart
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* CART DRAWER / MODAL (WIDER) */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShoppingBag className="h-5 w-5 text-emerald-600" />
              Your Shopping Cart ({totalCartCount} items)
            </DialogTitle>
            <DialogDescription>
              Review your selected items and apply coupons before checkout.
            </DialogDescription>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto opacity-30" />
              <p className="font-semibold text-sm">Your cart is empty</p>
              <p className="text-xs text-muted-foreground">
                Add delicious items from the menu to place an order.
              </p>
            </div>
          ) : (
            <div className="space-y-5 py-2 text-xs">
              {/* Cart Items List */}
              <div className="divide-y border rounded-xl overflow-hidden bg-card">
                {cart.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-foreground truncate">
                        {item.product.name}
                      </p>
                      {item.variant && (
                        <p className="text-[11px] text-muted-foreground">
                          {item.variant.variant_label}: {item.variant.value}
                        </p>
                      )}
                      <p className="text-[11px] font-semibold text-primary mt-0.5">
                        ₹{item.salePrice.toFixed(0)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border rounded-lg overflow-hidden bg-muted/40">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="px-2.5 py-1 hover:bg-muted text-foreground transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 font-bold text-xs text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="px-2.5 py-1 hover:bg-muted text-foreground transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <span className="font-bold text-xs w-16 text-right text-foreground">
                        ₹{item.totalPrice.toFixed(0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* COUPONS SECTION (ELIGIBLE & INELIGIBLE) */}
              <div className="p-3.5 rounded-xl border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Ticket className="h-4 w-4 text-primary" />
                    Available Discount Coupons
                  </span>
                  {appliedCoupon && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCoupon}
                      className="text-[11px] text-destructive h-7 px-2"
                    >
                      Remove Coupon
                    </Button>
                  )}
                </div>

                {appliedCoupon && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-300">
                        {appliedCoupon.code} Applied!
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Saving ₹{discountAmount.toFixed(0)} on this order
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                )}

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {evaluatedCoupons.map((coupon) => {
                    const isApplied = appliedCoupon?.id === coupon.id;
                    return (
                      <div
                        key={coupon.id}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all ${
                          coupon.isEligible
                            ? isApplied
                              ? "bg-emerald-500/10 border-emerald-500/40"
                              : "bg-muted/30 hover:border-primary/40"
                            : "opacity-60 bg-muted/10 border-dashed"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {coupon.code}
                            </span>
                            <span className="font-semibold text-[11px]">
                              {coupon.discount_type === "percentage"
                                ? `${coupon.discount_value}% OFF`
                                : `₹${coupon.discount_value} OFF`}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {coupon.isEligible
                              ? coupon.description ||
                                `Valid on orders above ₹${coupon.min_order_value}`
                              : coupon.reason}
                          </p>
                        </div>

                        {coupon.isEligible ? (
                          isApplied ? (
                            <Badge className="bg-emerald-600 text-white text-[10px]">
                              Applied
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApplyCoupon(coupon)}
                              className="text-xs h-7 px-3 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                            >
                              Apply
                            </Button>
                          )
                        ) : (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            Locked
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Cart Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Coupon Discount</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Charges</span>
                  <span className="text-emerald-600 font-medium">FREE</span>
                </div>

                <div className="flex justify-between font-bold text-base text-foreground pt-2 border-t">
                  <span>Total Amount</span>
                  <span className="text-primary">₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setIsCartOpen(false)}>
                  Continue Shopping
                </Button>
                <Button
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm font-semibold"
                >
                  Proceed to Checkout (₹{finalTotal.toFixed(0)})
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CHECKOUT & LOCATION MODAL (WIDER & ONLY CONFIGURED PAYMENTS) */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-emerald-600" />
              Delivery Details & Payment
            </DialogTitle>
            <DialogDescription>
              Enter your contact details, delivery address, and choose your payment method.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePlaceOrder} className="space-y-4 py-2 text-xs">
            {/* Customer Name */}
            <div className="space-y-1.5">
              <Label htmlFor="checkout-name" className="text-xs font-semibold">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="checkout-name"
                placeholder="e.g. Rahul Sharma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>

            {/* Mobile Number */}
            <div className="space-y-1.5">
              <Label htmlFor="checkout-mobile" className="text-xs font-semibold">
                Mobile Number (WhatsApp) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="checkout-mobile"
                placeholder="e.g. +91 98765 43210"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Order updates and tracking will be sent to this WhatsApp number.
              </p>
            </div>

            {/* Address & Allow Location Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="checkout-address" className="text-xs font-semibold">
                  Delivery Address <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="gap-1.5 text-xs h-7 border-primary text-primary"
                >
                  {locationLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Crosshair className="h-3 w-3" />
                  )}
                  Allow Location / Use GPS
                </Button>
              </div>

              <Textarea
                id="checkout-address"
                placeholder="Flat / House No, Street Name, Area..."
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                rows={2}
                required
              />
            </div>

            {/* Landmark */}
            <div className="space-y-1.5">
              <Label htmlFor="checkout-landmark" className="text-xs font-semibold">
                Landmark <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                id="checkout-landmark"
                placeholder="e.g. Near HDFC Bank, Opposite Park"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
              />
            </div>

            {/* PAYMENT METHOD SELECTOR - ONLY CONFIGURED PAYMENTS */}
            <div className="space-y-2.5 pt-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Payment Method
              </Label>

              {!hasAnyPayment ? (
                /* No payment configured alert */
                <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    No Payment Method Configured by Store
                  </p>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    This store has not yet enabled Cash on Delivery or Online Payment in settings.
                    Orders cannot be placed online right now. Please message the store directly on WhatsApp.
                  </p>
                </div>
              ) : (
                /* Display ONLY configured methods */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Cash on Delivery option (only if enabled in store) */}
                  {isCodAvailable && (
                    <div
                      onClick={() => setSelectedPaymentMethod("cod")}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedPaymentMethod === "cod"
                          ? "border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500"
                          : "hover:border-zinc-300 dark:hover:border-zinc-700 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          💵 Cash on Delivery (COD)
                        </span>
                        {selectedPaymentMethod === "cod" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Pay cash or UPI at delivery doorstep
                      </p>
                    </div>
                  )}

                  {/* Online Payment option (only if enabled & configured in store) */}
                  {isOnlineAvailable && (
                    <div
                      onClick={() => setSelectedPaymentMethod("online")}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedPaymentMethod === "online"
                          ? "border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500"
                          : "hover:border-zinc-300 dark:hover:border-zinc-700 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          💳 Online Payment
                        </span>
                        {selectedPaymentMethod === "online" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Instant UPI, Cards & Netbanking
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total Summary */}
            <div className="p-3.5 rounded-xl bg-muted/30 border flex items-center justify-between font-bold text-sm">
              <span>Total Payable</span>
              <span className="text-base text-primary">₹{finalTotal.toFixed(2)}</span>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCheckoutOpen(false)}>
                Back
              </Button>
              <Button
                type="submit"
                disabled={placingOrder || !hasAnyPayment}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm font-semibold"
              >
                {placingOrder ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {selectedPaymentMethod === "online"
                      ? `Proceed to Pay (₹${finalTotal.toFixed(0)})`
                      : `Confirm Order (₹${finalTotal.toFixed(0)})`}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* FLOATING CART BUTTON AT BOTTOM RIGHT CORNER */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          aria-label="View Cart and Checkout"
          className="group relative flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full p-3.5 sm:px-5 sm:py-3.5 shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 cursor-pointer"
        >
          <div className="relative flex items-center justify-center">
            <ShoppingBag className="h-6 w-6 transition-transform group-hover:scale-110" />
            {totalCartCount > 0 && (
              <span className="absolute -top-2.5 -right-2.5 bg-white text-emerald-700 rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center font-extrabold text-[11px] shadow-md border-2 border-emerald-600">
                {totalCartCount}
              </span>
            )}
          </div>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-xs uppercase tracking-wider font-bold">Cart</span>
            {totalCartCount > 0 ? (
              <span className="text-xs font-semibold text-emerald-100">
                ₹{subtotal.toFixed(0)} • {totalCartCount} {totalCartCount === 1 ? "item" : "items"}
              </span>
            ) : (
              <span className="text-[10px] text-emerald-100">0 items</span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

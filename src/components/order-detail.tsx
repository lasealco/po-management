"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type OrderDetailResponse = {
  order: {
    id: string;
    orderNumber: string;
    title: string | null;
    currency: string;
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
    createdAt: string;
    updatedAt: string;
    buyerReference: string | null;
    supplierReference: string | null;
    paymentTermsDays: number | null;
    paymentTermsLabel: string | null;
    incoterm: string | null;
    requestedDeliveryDate: string | null;
    shipToName: string | null;
    shipToLine1: string | null;
    shipToLine2: string | null;
    shipToCity: string | null;
    shipToRegion: string | null;
    shipToPostalCode: string | null;
    shipToCountryCode: string | null;
    internalNotes: string | null;
    notesToSupplier: string | null;
    status: { code: string; label: string };
    workflow: {
      id: string;
      name: string;
      allowSplitOrders: boolean;
      supplierPortalOn: boolean;
    };
    supplier: {
      id: string;
      name: string;
      paymentTermsDays: number | null;
      paymentTermsLabel: string | null;
      defaultIncoterm: string | null;
    } | null;
    requester: { id: string; name: string; email: string };
    splitParentId: string | null;
    splitParent: { id: string; orderNumber: string } | null;
    splitIndex: number | null;
    plannedShipDates: string[];
  };
  items: Array<{
    id: string;
    lineNo: number;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    productId: string | null;
    product: {
      sku: string | null;
      productCode: string | null;
      name: string;
    } | null;
  }>;
  splitChildren: Array<{
    id: string;
    orderNumber: string;
    splitIndex: number | null;
    status: { code: string; label: string };
    totalAmount: string;
  }>;
  shipments: Array<{
    id: string;
    shipmentNo: string | null;
    status:
      | "SHIPPED"
      | "VALIDATED"
      | "BOOKED"
      | "IN_TRANSIT"
      | "DELIVERED"
      | "RECEIVED";
    shippedAt: string;
    receivedAt: string | null;
    carrier: string | null;
    trackingNo: string | null;
    transportMode: "OCEAN" | "AIR" | "ROAD" | "RAIL" | null;
    estimatedVolumeCbm: string | null;
    estimatedWeightKg: string | null;
    notes: string | null;
    createdBy: { name: string; email: string };
    booking: null | {
      status: "DRAFT" | "CONFIRMED" | "CANCELLED";
      bookingNo: string | null;
      serviceLevel: string | null;
      mode: "OCEAN" | "AIR" | "ROAD" | "RAIL" | null;
      originCode: string | null;
      destinationCode: string | null;
      etd: string | null;
      eta: string | null;
      latestEta: string | null;
      notes: string | null;
      forwarderSupplier: { id: string; name: string; code: string | null } | null;
      forwarderOffice: { id: string; name: string } | null;
      forwarderContact: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
      } | null;
    };
    milestones: Array<{
      id: string;
      code:
        | "ASN_SUBMITTED"
        | "ASN_VALIDATED"
        | "BOOKING_CONFIRMED"
        | "DEPARTED"
        | "ARRIVED"
        | "DELIVERED"
        | "RECEIVED";
      source: "SUPPLIER" | "INTERNAL" | "FORWARDER" | "SYSTEM";
      plannedAt: string | null;
      actualAt: string | null;
      note: string | null;
      createdAt: string;
      updatedBy: { name: string; email: string };
    }>;
    items: Array<{
      id: string;
      orderItemId: string;
      lineNo: number;
      description: string;
      quantityShipped: string;
      quantityReceived: string;
      plannedShipDate: string | null;
    }>;
  }>;
  pendingProposal: null | {
    id: string;
    status: string;
    comment: string | null;
    lines: Array<{
      id: string;
      childIndex: number;
      quantity: string;
      plannedShipDate: string;
      sourceLineId: string;
      sourceDescription: string;
    }>;
  };
  allowedActions: Array<{
    actionCode: string;
    label: string;
    requiresComment: boolean;
    toStatus: { code: string; label: string };
  }>;
  activity: Array<{
    id: string;
    createdAt: string;
    actionCode: string;
    comment: string | null;
    actor: { name: string; email: string };
    fromStatus: { code: string; label: string } | null;
    toStatus: { code: string; label: string };
  }>;
  messages: Array<{
    id: string;
    createdAt: string;
    body: string;
    isInternal: boolean;
    author: { name: string; email: string };
  }>;
  messageCapabilities: {
    canPost: boolean;
    canPostInternal: boolean;
  };
  splitCapabilities: {
    canPropose: boolean;
  };
  shipmentCapabilities: {
    canCreate: boolean;
    canReceive: boolean;
    canValidate: boolean;
    canBook: boolean;
    canUpdateMilestones: boolean;
  };
  forwarders: Array<{
    id: string;
    code: string | null;
    name: string;
    offices: Array<{ id: string; name: string }>;
    contacts: Array<{ id: string; name: string; email: string | null; phone: string | null }>;
  }>;
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

function deliveryDateInputValue(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

type BookingDraft = {
  bookingNo: string;
  serviceLevel: string;
  forwarderSupplierId: string;
  forwarderOfficeId: string;
  forwarderContactId: string;
  transportMode: "OCEAN" | "AIR" | "ROAD" | "RAIL" | "";
  originCode: string;
  destinationCode: string;
  etd: string;
  eta: string;
  latestEta: string;
  notes: string;
};

export function OrderDetail({
  orderId,
  canTransition = true,
  canSplit = true,
  canEditHeader = false,
  canViewProducts = false,
  canViewInternalNotes = false,
}: {
  orderId: string;
  canTransition?: boolean;
  canSplit?: boolean;
  canEditHeader?: boolean;
  /** When true and line has productId, SKU/code links to the catalog detail page. */
  canViewProducts?: boolean;
  /** Buyer/internal only. */
  canViewInternalNotes?: boolean;
}) {
  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [childCount, setChildCount] = useState(2);
  const [allocations, setAllocations] = useState<
    Record<string, Record<number, { quantity: string; plannedShipDate: string }>>
  >({});

  const [buyerReference, setBuyerReference] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("");
  const [paymentTermsLabel, setPaymentTermsLabel] = useState("");
  const [incoterm, setIncoterm] = useState("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState("");
  const [shipToName, setShipToName] = useState("");
  const [shipToLine1, setShipToLine1] = useState("");
  const [shipToLine2, setShipToLine2] = useState("");
  const [shipToCity, setShipToCity] = useState("");
  const [shipToRegion, setShipToRegion] = useState("");
  const [shipToPostalCode, setShipToPostalCode] = useState("");
  const [shipToCountryCode, setShipToCountryCode] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [notesToSupplier, setNotesToSupplier] = useState("");

  const [newMessageBody, setNewMessageBody] = useState("");
  const [newMessageInternal, setNewMessageInternal] = useState(false);
  const [asnShipmentNo, setAsnShipmentNo] = useState("");
  const [asnCarrier, setAsnCarrier] = useState("");
  const [asnTrackingNo, setAsnTrackingNo] = useState("");
  const [asnTransportMode, setAsnTransportMode] = useState<
    "OCEAN" | "AIR" | "ROAD" | "RAIL"
  >("OCEAN");
  const [asnEstimatedVolumeCbm, setAsnEstimatedVolumeCbm] = useState("");
  const [asnEstimatedWeightKg, setAsnEstimatedWeightKg] = useState("");
  const [asnShippedDate, setAsnShippedDate] = useState(todayIsoDate());
  const [asnNotes, setAsnNotes] = useState("");
  const [asnQtyByItemId, setAsnQtyByItemId] = useState<Record<string, string>>({});
  const [receiveQtyByShipmentItemId, setReceiveQtyByShipmentItemId] = useState<
    Record<string, string>
  >({});
  const [bookingDraftByShipmentId, setBookingDraftByShipmentId] = useState<
    Record<string, BookingDraft>
  >({});

  const searchParams = useSearchParams();

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    const payload = (await response.json()) as OrderDetailResponse & {
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Failed to load order.");
      setData(null);
      return;
    }
    setData(payload);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const focus = searchParams.get("focus");
    if (!focus) return;
    const timer = window.setTimeout(() => {
      let el: Element | null = null;
      if (focus === "split") {
        el = document.querySelector("[data-help-focus='split']");
      } else if (
        focus === "workflow" ||
        focus === "asn" ||
        focus === "chat"
      ) {
        el = document.getElementById(`help-focus-${focus}`);
      }
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add(
        "ring-2",
        "ring-violet-500",
        "ring-offset-2",
        "rounded-lg",
      );
      window.setTimeout(() => {
        el?.classList.remove(
          "ring-2",
          "ring-violet-500",
          "ring-offset-2",
          "rounded-lg",
        );
      }, 4200);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [data?.order.id, searchParams]);

  useEffect(() => {
    if (!data) return;
    const o = data.order;
    setBuyerReference(o.buyerReference ?? "");
    setSupplierReference(o.supplierReference ?? "");
    setPaymentTermsDays(
      o.paymentTermsDays != null ? String(o.paymentTermsDays) : "",
    );
    setPaymentTermsLabel(o.paymentTermsLabel ?? "");
    setIncoterm(o.incoterm ?? "");
    setRequestedDeliveryDate(deliveryDateInputValue(o.requestedDeliveryDate));
    setShipToName(o.shipToName ?? "");
    setShipToLine1(o.shipToLine1 ?? "");
    setShipToLine2(o.shipToLine2 ?? "");
    setShipToCity(o.shipToCity ?? "");
    setShipToRegion(o.shipToRegion ?? "");
    setShipToPostalCode(o.shipToPostalCode ?? "");
    setShipToCountryCode(o.shipToCountryCode ?? "");
    setInternalNotes(o.internalNotes ?? "");
    setNotesToSupplier(o.notesToSupplier ?? "");
    setAsnQtyByItemId((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const item of data.items) {
        if (!(item.id in next)) next[item.id] = "";
      }
      return next;
    });
    setBookingDraftByShipmentId((prev) => {
      const next = { ...prev };
      for (const shipment of data.shipments) {
        if (next[shipment.id]) continue;
        next[shipment.id] = {
          bookingNo: shipment.booking?.bookingNo ?? "",
          serviceLevel: shipment.booking?.serviceLevel ?? "",
          forwarderSupplierId: shipment.booking?.forwarderSupplier?.id ?? "",
          forwarderOfficeId: shipment.booking?.forwarderOffice?.id ?? "",
          forwarderContactId: shipment.booking?.forwarderContact?.id ?? "",
          transportMode: shipment.booking?.mode ?? shipment.transportMode ?? "",
          originCode: shipment.booking?.originCode ?? "",
          destinationCode: shipment.booking?.destinationCode ?? "",
          etd: deliveryDateInputValue(shipment.booking?.etd ?? null),
          eta: deliveryDateInputValue(shipment.booking?.eta ?? null),
          latestEta: deliveryDateInputValue(shipment.booking?.latestEta ?? null),
          notes: shipment.booking?.notes ?? "",
        };
      }
      return next;
    });
  }, [data?.order.updatedAt]);

  useEffect(() => {
    if (!data?.items.length) return;
    setAllocations((previous) => {
      const next: typeof previous = { ...previous };
      for (const item of data.items) {
        if (!next[item.id]) next[item.id] = {};
        for (let i = 1; i <= childCount; i += 1) {
          if (!next[item.id][i]) {
            next[item.id][i] = {
              quantity: "",
              plannedShipDate: todayIsoDate(),
            };
          }
        }
        Object.keys(next[item.id]).forEach((key) => {
          const idx = Number(key);
          if (idx > childCount) delete next[item.id][idx];
        });
      }
      return next;
    });
  }, [data?.items, childCount]);

  const canProposeSplit = useMemo(() => {
    if (!data || !canSplit || !data.splitCapabilities.canPropose) return false;
    const hasProposeTransition = data.allowedActions.some(
      (a) => a.actionCode === "propose_split",
    );
    return hasProposeTransition && !data.pendingProposal && !data.order.splitParentId;
  }, [data, canSplit]);

  const canResolveSplitProposal = useMemo(() => {
    if (!data || !canTransition) return false;
    const actionCodes = new Set(data.allowedActions.map((a) => a.actionCode));
    return (
      actionCodes.has("buyer_accept_split") ||
      actionCodes.has("buyer_reject_proposal")
    );
  }, [data, canTransition]);

  async function postMessage() {
    if (!data || !newMessageBody.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${data.order.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: newMessageBody.trim(),
        isInternal:
          data.messageCapabilities.canPostInternal && newMessageInternal,
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not post message.");
      setBusy(false);
      return;
    }
    setNewMessageBody("");
    setNewMessageInternal(false);
    await load();
    setBusy(false);
  }

  async function saveOrderHeader() {
    if (!data) return;
    setBusy(true);
    setError(null);
    const days =
      paymentTermsDays.trim() === ""
        ? null
        : Number.parseInt(paymentTermsDays.trim(), 10);
    if (
      paymentTermsDays.trim() !== "" &&
      (Number.isNaN(days) || days! < 0 || days! > 3650)
    ) {
      setError("Payment terms (days) must be 0–3650 or empty.");
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/orders/${data.order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerReference: buyerReference || null,
        supplierReference: supplierReference || null,
        paymentTermsDays: days,
        paymentTermsLabel: paymentTermsLabel || null,
        incoterm: incoterm || null,
        requestedDeliveryDate: requestedDeliveryDate.trim() || null,
        shipToName: shipToName || null,
        shipToLine1: shipToLine1 || null,
        shipToLine2: shipToLine2 || null,
        shipToCity: shipToCity || null,
        shipToRegion: shipToRegion || null,
        shipToPostalCode: shipToPostalCode || null,
        shipToCountryCode: shipToCountryCode.trim().toUpperCase() || null,
        internalNotes: internalNotes || null,
        notesToSupplier: notesToSupplier || null,
      }),
    });
    const payload = (await res.json()) as OrderDetailResponse & { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Save failed.");
      setBusy(false);
      return;
    }
    setData(payload);
    setBusy(false);
  }

  async function runTransition(actionCode: string) {
    if (!data) return;
    setBusy(true);
    setError(null);
    let comment: string | undefined;
    const action = data.allowedActions.find((a) => a.actionCode === actionCode);
    if (action?.requiresComment) {
      const value = window.prompt("Comment required:");
      if (!value?.trim()) {
        setBusy(false);
        setError("This action requires a comment.");
        return;
      }
      comment = value.trim();
    }
    const response = await fetch(`/api/orders/${data.order.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionCode, comment }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Action failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function submitSplit() {
    if (!data?.items.length) return;
    setBusy(true);
    setError(null);
    const lines = data.items.map((item) => {
      const row = allocations[item.id] ?? {};
      const allocationList = [];
      for (let i = 1; i <= childCount; i += 1) {
        const cell = row[i];
        if (!cell?.quantity?.trim()) continue;
        allocationList.push({
          childIndex: i,
          quantity: cell.quantity.trim(),
          plannedShipDate: new Date(
            `${cell.plannedShipDate}T12:00:00.000Z`,
          ).toISOString(),
        });
      }
      return { sourceLineId: item.id, allocations: allocationList };
    });

    const response = await fetch(`/api/orders/${data.order.id}/split-proposal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Split proposal failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function acceptSplit(proposalId: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/split-proposals/${proposalId}/accept`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Accept failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function createShipment() {
    if (!data || !data.shipmentCapabilities.canCreate) return;
    const lines = data.items
      .map((item) => ({
        orderItemId: item.id,
        quantityShipped: (asnQtyByItemId[item.id] ?? "").trim(),
      }))
      .filter((line) => line.quantityShipped !== "");
    if (lines.length === 0) {
      setError("Enter at least one shipped quantity for ASN.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${data.order.id}/shipments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipmentNo: asnShipmentNo || null,
        carrier: asnCarrier || null,
        trackingNo: asnTrackingNo || null,
        transportMode: asnTransportMode,
        estimatedVolumeCbm: asnEstimatedVolumeCbm || null,
        estimatedWeightKg: asnEstimatedWeightKg || null,
        shippedAt: asnShippedDate || null,
        notes: asnNotes || null,
        lines,
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not create ASN.");
      setBusy(false);
      return;
    }
    setAsnShipmentNo("");
    setAsnCarrier("");
    setAsnTrackingNo("");
    setAsnEstimatedVolumeCbm("");
    setAsnEstimatedWeightKg("");
    setAsnShippedDate(todayIsoDate());
    setAsnNotes("");
    setAsnQtyByItemId({});
    await load();
    setBusy(false);
  }

  async function receiveShipment(
    shipment: OrderDetailResponse["shipments"][number],
    mode: "all" | "partial",
  ) {
    if (!data || !data.shipmentCapabilities.canReceive) return;
    setBusy(true);
    setError(null);
    const lines =
      mode === "partial"
        ? shipment.items
            .map((item) => ({
              shipmentItemId: item.id,
              quantityReceived: (receiveQtyByShipmentItemId[item.id] ?? "").trim(),
            }))
            .filter((row) => row.quantityReceived !== "")
        : [];
    if (mode === "partial" && lines.length === 0) {
      setError("Enter at least one received quantity.");
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/shipments/${shipment.id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not receive shipment.");
      setBusy(false);
      return;
    }
    if (mode === "partial") {
      setReceiveQtyByShipmentItemId((prev) => {
        const next = { ...prev };
        for (const row of lines) delete next[row.shipmentItemId];
        return next;
      });
    }
    await load();
    setBusy(false);
  }

  function patchBookingDraft(shipmentId: string, patch: Partial<BookingDraft>) {
    const fallback: BookingDraft = {
      bookingNo: "",
      serviceLevel: "",
      forwarderSupplierId: "",
      forwarderOfficeId: "",
      forwarderContactId: "",
      transportMode: "",
      originCode: "",
      destinationCode: "",
      etd: "",
      eta: "",
      latestEta: "",
      notes: "",
    };
    setBookingDraftByShipmentId((prev) => ({
      ...prev,
      [shipmentId]: {
        ...(prev[shipmentId] ?? fallback),
        ...patch,
      },
    }));
  }

  async function validateShipment(shipmentId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/shipments/${shipmentId}/validate`, {
      method: "POST",
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not validate ASN.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function saveBooking(shipmentId: string, mode: "draft" | "confirm" | "cancel") {
    const draft = bookingDraftByShipmentId[shipmentId];
    if (!draft) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/shipments/${shipmentId}/booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        bookingNo: draft.bookingNo || null,
        serviceLevel: draft.serviceLevel || null,
        forwarderSupplierId: draft.forwarderSupplierId || null,
        forwarderOfficeId: draft.forwarderOfficeId || null,
        forwarderContactId: draft.forwarderContactId || null,
        transportMode: draft.transportMode || null,
        originCode: draft.originCode || null,
        destinationCode: draft.destinationCode || null,
        etd: draft.etd || null,
        eta: draft.eta || null,
        latestEta: draft.latestEta || null,
        notes: draft.notes || null,
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not save booking.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function postMilestone(
    shipmentId: string,
    code: "DEPARTED" | "ARRIVED" | "DELIVERED",
  ) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/shipments/${shipmentId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        actualAt: todayIsoDate(),
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not post milestone.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function rejectSplit(proposalId: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/split-proposals/${proposalId}/reject`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Reject failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  if (!data && !error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10 text-zinc-600">
        Loading…
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block text-zinc-700 underline">
          Back
        </Link>
      </main>
    );
  }

  if (!data) return null;

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900";
  const sup = data.order.supplier;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Orders
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            {data.order.orderNumber}
          </h1>
          <p className="text-zinc-600">{data.order.title ?? "Untitled PO"}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
          {data.order.status.label}
        </span>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <p className="font-medium text-zinc-900">Summary</p>
        <div className="mt-3 grid gap-2 text-zinc-700 sm:grid-cols-2">
          <p>
            Workflow:{" "}
            <span className="font-medium text-zinc-800">
              {data.order.workflow.name}
            </span>
          </p>
          <p>
            Supplier:{" "}
            <span className="font-medium text-zinc-800">
              {sup?.name ?? "—"}
            </span>
          </p>
          <p>
            Requester:{" "}
            <span className="font-medium text-zinc-800">
              {data.order.requester.name}
            </span>
          </p>
          <p>
            Created:{" "}
            <span className="font-medium text-zinc-800">
              {new Date(data.order.createdAt).toLocaleString()}
            </span>
          </p>
        </div>
        {sup ? (
          <p className="mt-3 text-xs text-zinc-500">
            Supplier profile terms:{" "}
            {sup.paymentTermsLabel ??
              (sup.paymentTermsDays != null ? `Net ${sup.paymentTermsDays}` : "—")}
            {sup.defaultIncoterm ? ` · Incoterm ${sup.defaultIncoterm}` : ""}
          </p>
        ) : null}
        <p className="mt-3 text-zinc-800">
          Subtotal {data.order.currency} {data.order.subtotal} · Tax{" "}
          {data.order.taxAmount} ·{" "}
          <span className="font-semibold">
            Total {data.order.currency} {data.order.totalAmount}
          </span>
        </p>
        {data.order.splitParent ? (
          <p className="mt-3 text-sm text-zinc-800">
            Parent order:{" "}
            <Link
              href={`/orders/${data.order.splitParent.id}`}
              className="font-medium text-amber-800 underline-offset-2 hover:underline"
            >
              {data.order.splitParent.orderNumber}
            </Link>
          </p>
        ) : null}
        {data.order.plannedShipDates.length > 0 ? (
          <p className="mt-2 text-sm text-zinc-800">
            Supplier planned ship date
            {data.order.plannedShipDates.length > 1 ? "s" : ""}:{" "}
            <span className="font-medium">
              {data.order.plannedShipDates
                .map((d) => new Date(`${d}T12:00:00.000Z`).toLocaleDateString())
                .join(", ")}
            </span>
          </p>
        ) : null}
      </section>

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <h2 className="text-lg font-medium text-zinc-900">Order details</h2>
        <p className="mt-1 text-xs text-zinc-700">
          References, commercial terms, ship-to, and notes. Line totals are not
          edited here.
        </p>
        {canEditHeader ? (
          <p className="mt-1 text-xs text-amber-800">
            Saved with the button at the bottom of this section.
          </p>
        ) : null}

        {!canEditHeader ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-zinc-500">
                Buyer reference
              </dt>
              <dd className="text-zinc-900">{data.order.buyerReference ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-zinc-500">
                Supplier reference
              </dt>
              <dd className="text-zinc-900">
                {data.order.supplierReference ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-zinc-500">
                Terms
              </dt>
              <dd className="text-zinc-900">
                {data.order.paymentTermsLabel ??
                  (data.order.paymentTermsDays != null
                    ? `Net ${data.order.paymentTermsDays}`
                    : "—")}
                {data.order.incoterm ? ` · ${data.order.incoterm}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-zinc-500">
                Requested delivery
              </dt>
              <dd className="text-zinc-900">
                {data.order.requestedDeliveryDate
                  ? new Date(
                      data.order.requestedDeliveryDate,
                    ).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-zinc-500">
                Ship to
              </dt>
              <dd className="whitespace-pre-line text-zinc-900">
                {[
                  data.order.shipToName,
                  data.order.shipToLine1,
                  data.order.shipToLine2,
                  [
                    data.order.shipToCity,
                    data.order.shipToRegion,
                    data.order.shipToPostalCode,
                  ]
                    .filter(Boolean)
                    .join(", "),
                  data.order.shipToCountryCode,
                ]
                  .filter(Boolean)
                  .join("\n") || "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-zinc-500">
                Notes to supplier
              </dt>
              <dd className="whitespace-pre-wrap text-zinc-900">
                {data.order.notesToSupplier ?? "—"}
              </dd>
            </div>
            {canViewInternalNotes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase text-zinc-500">
                  Internal notes
                </dt>
                <dd className="whitespace-pre-wrap text-zinc-900">
                  {data.order.internalNotes ?? "—"}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-sm">
                <span className="font-medium text-zinc-800">Buyer reference</span>
                <input
                  value={buyerReference}
                  onChange={(e) => setBuyerReference(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="font-medium text-zinc-800">
                  Supplier reference
                </span>
                <input
                  value={supplierReference}
                  onChange={(e) => setSupplierReference(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="font-medium text-zinc-800">
                  Payment terms (days)
                </span>
                <input
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(e.target.value)}
                  className={f}
                  inputMode="numeric"
                  placeholder="30"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="font-medium text-zinc-800">Terms label</span>
                <input
                  value={paymentTermsLabel}
                  onChange={(e) => setPaymentTermsLabel(e.target.value)}
                  className={f}
                  placeholder="Net 30"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="font-medium text-zinc-800">Incoterm</span>
                <input
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value)}
                  className={f}
                  placeholder="FOB, DDP…"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="font-medium text-zinc-800">
                  Requested delivery
                </span>
                <input
                  type="date"
                  value={requestedDeliveryDate}
                  onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                  className={f}
                />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900">Ship to</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col text-sm sm:col-span-2">
                  <span>Name / attention</span>
                  <input
                    value={shipToName}
                    onChange={(e) => setShipToName(e.target.value)}
                    className={f}
                  />
                </label>
                <label className="flex flex-col text-sm sm:col-span-2">
                  <span>Address line 1</span>
                  <input
                    value={shipToLine1}
                    onChange={(e) => setShipToLine1(e.target.value)}
                    className={f}
                  />
                </label>
                <label className="flex flex-col text-sm sm:col-span-2">
                  <span>Address line 2</span>
                  <input
                    value={shipToLine2}
                    onChange={(e) => setShipToLine2(e.target.value)}
                    className={f}
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span>City</span>
                  <input
                    value={shipToCity}
                    onChange={(e) => setShipToCity(e.target.value)}
                    className={f}
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span>Region</span>
                  <input
                    value={shipToRegion}
                    onChange={(e) => setShipToRegion(e.target.value)}
                    className={f}
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span>Postal code</span>
                  <input
                    value={shipToPostalCode}
                    onChange={(e) => setShipToPostalCode(e.target.value)}
                    className={f}
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span>Country (ISO)</span>
                  <input
                    value={shipToCountryCode}
                    onChange={(e) =>
                      setShipToCountryCode(e.target.value.toUpperCase())
                    }
                    className={f}
                    maxLength={2}
                    placeholder="US"
                  />
                </label>
              </div>
            </div>
            <label className="flex flex-col text-sm">
              <span className="font-medium text-zinc-800">Notes to supplier</span>
              <textarea
                value={notesToSupplier}
                onChange={(e) => setNotesToSupplier(e.target.value)}
                rows={3}
                className={f}
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="font-medium text-zinc-800">Internal notes</span>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={3}
                className={f}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveOrderHeader()}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save order details"}
            </button>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Lines</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">SKU / code</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-zinc-500"
                  >
                    No line items on this order. If this is production demo data,
                    run <code className="rounded bg-zinc-100 px-1">npm run db:seed</code>{" "}
                    against the same database so demo lines are created.
                  </td>
                </tr>
              ) : (
                data.items.map((item) => {
                  const skuDisplay =
                    item.product?.sku || item.product?.productCode || "—";
                  const skuCell =
                    canViewProducts && item.productId ? (
                      <Link
                        href={`/products/${item.productId}`}
                        className="font-mono text-xs text-amber-800 underline-offset-2 hover:underline"
                      >
                        {skuDisplay}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-zinc-600">
                        {skuDisplay}
                      </span>
                    );
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-zinc-800">{item.lineNo}</td>
                      <td className="px-3 py-2">{skuCell}</td>
                      <td className="px-3 py-2 text-zinc-900">
                        {item.description}
                        {item.product?.name &&
                        item.product.name !== item.description ? (
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            Product: {item.product.name}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-800">{item.quantity}</td>
                      <td className="px-3 py-2 font-medium text-zinc-800">{item.unitPrice}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{item.lineTotal}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="help-focus-asn"
        className="mb-8 scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-lg font-medium text-zinc-900">ASNs / Shipments</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Supplier creates ASNs with shipped quantities. Buyer records receipt.
        </p>

        <ul className="mt-4 space-y-3 text-sm">
          {data.shipments.length === 0 ? (
            <li className="text-zinc-500">No shipments yet.</li>
          ) : (
            data.shipments.map((shipment) => {
              const remaining = shipment.items.reduce(
                (sum, row) =>
                  sum + (Number(row.quantityShipped) - Number(row.quantityReceived)),
                0,
              );
              const bookingDraft = bookingDraftByShipmentId[shipment.id];
              const selectedForwarder = data.forwarders.find(
                (f) => f.id === bookingDraft?.forwarderSupplierId,
              );
              return (
                <li
                  key={shipment.id}
                  className="rounded-md border border-zinc-100 bg-zinc-50/80 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                    <span className="font-medium text-zinc-900">
                      {shipment.shipmentNo || shipment.id.slice(0, 8)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-semibold ${
                        shipment.status === "RECEIVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {shipment.status}
                    </span>
                    <span>Shipped {new Date(shipment.shippedAt).toLocaleDateString()}</span>
                    {shipment.carrier ? <span>· {shipment.carrier}</span> : null}
                    {shipment.trackingNo ? <span>· {shipment.trackingNo}</span> : null}
                    {shipment.transportMode ? <span>· {shipment.transportMode}</span> : null}
                    {shipment.estimatedVolumeCbm ? (
                      <span>· {shipment.estimatedVolumeCbm} cbm</span>
                    ) : null}
                    {shipment.estimatedWeightKg ? (
                      <span>· {shipment.estimatedWeightKg} kg</span>
                    ) : null}
                    {shipment.receivedAt ? (
                      <span>
                        · Received {new Date(shipment.receivedAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                    {shipment.items.map((row) => (
                      <li key={row.id}>
                        L{row.lineNo} {row.description}: shipped {row.quantityShipped}, received{" "}
                        {row.quantityReceived}
                        {row.plannedShipDate ? (
                          <> · planned {new Date(row.plannedShipDate).toLocaleDateString()}</>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {shipment.notes ? (
                    <p className="mt-2 text-xs text-zinc-700">{shipment.notes}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.shipmentCapabilities.canValidate && shipment.status === "SHIPPED" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void validateShipment(shipment.id)}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50"
                      >
                        Validate ASN
                      </button>
                    ) : null}
                    {data.shipmentCapabilities.canUpdateMilestones ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postMilestone(shipment.id, "DEPARTED")}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50"
                        >
                          Mark departed
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postMilestone(shipment.id, "ARRIVED")}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50"
                        >
                          Mark arrived
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postMilestone(shipment.id, "DELIVERED")}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50"
                        >
                          Mark delivered
                        </button>
                      </>
                    ) : null}
                  </div>
                  {shipment.milestones.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                      {shipment.milestones.map((m) => (
                        <li key={m.id}>
                          {m.code} · {m.source}
                          {m.actualAt
                            ? ` · ${new Date(m.actualAt).toLocaleDateString()}`
                            : m.plannedAt
                              ? ` · planned ${new Date(m.plannedAt).toLocaleDateString()}`
                              : ""}
                          {m.note ? ` · ${m.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {data.shipmentCapabilities.canBook && bookingDraft ? (
                    <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                        Forwarder booking
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <input
                          value={bookingDraft.bookingNo}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { bookingNo: e.target.value })
                          }
                          placeholder="Booking reference"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <input
                          value={bookingDraft.serviceLevel}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { serviceLevel: e.target.value })
                          }
                          placeholder="Service level"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <select
                          value={bookingDraft.forwarderSupplierId}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, {
                              forwarderSupplierId: e.target.value,
                              forwarderOfficeId: "",
                              forwarderContactId: "",
                            })
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          <option value="">Select forwarder</option>
                          {data.forwarders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.code ? `${f.code} · ` : ""}
                              {f.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bookingDraft.forwarderOfficeId}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { forwarderOfficeId: e.target.value })
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          <option value="">Forwarder office</option>
                          {(selectedForwarder?.offices ?? []).map((office) => (
                            <option key={office.id} value={office.id}>
                              {office.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bookingDraft.forwarderContactId}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { forwarderContactId: e.target.value })
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          <option value="">Forwarder contact</option>
                          {(selectedForwarder?.contacts ?? []).map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.name}
                              {contact.email ? ` · ${contact.email}` : ""}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bookingDraft.transportMode}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, {
                              transportMode: e.target.value as BookingDraft["transportMode"],
                            })
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          <option value="">Transport mode</option>
                          <option value="OCEAN">Ocean</option>
                          <option value="AIR">Air</option>
                          <option value="ROAD">Road</option>
                          <option value="RAIL">Rail</option>
                        </select>
                        <input
                          value={bookingDraft.originCode}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { originCode: e.target.value })
                          }
                          placeholder="Origin code"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <input
                          value={bookingDraft.destinationCode}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { destinationCode: e.target.value })
                          }
                          placeholder="Destination code"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="date"
                          value={bookingDraft.etd}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { etd: e.target.value })
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="date"
                          value={bookingDraft.eta}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { eta: e.target.value })
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="date"
                          value={bookingDraft.latestEta}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { latestEta: e.target.value })
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <textarea
                          value={bookingDraft.notes}
                          onChange={(e) =>
                            patchBookingDraft(shipment.id, { notes: e.target.value })
                          }
                          placeholder="Booking notes"
                          className="sm:col-span-3 rounded border border-zinc-300 px-2 py-1 text-xs"
                          rows={2}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveBooking(shipment.id, "draft")}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50"
                        >
                          Save draft booking
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveBooking(shipment.id, "confirm")}
                          className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Confirm booking
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveBooking(shipment.id, "cancel")}
                          className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-50"
                        >
                          Cancel booking
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {data.shipmentCapabilities.canReceive && remaining > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="grid gap-1">
                        {shipment.items.map((row) => {
                          const remainingForRow = Math.max(
                            0,
                            Number(row.quantityShipped) - Number(row.quantityReceived),
                          );
                          if (remainingForRow <= 0) return null;
                          return (
                            <label
                              key={`recv-${row.id}`}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span className="min-w-48 text-zinc-700">
                                L{row.lineNo} receive (max {remainingForRow})
                              </span>
                              <input
                                inputMode="decimal"
                                placeholder="Qty"
                                value={receiveQtyByShipmentItemId[row.id] ?? ""}
                                onChange={(e) =>
                                  setReceiveQtyByShipmentItemId((prev) => ({
                                    ...prev,
                                    [row.id]: e.target.value,
                                  }))
                                }
                                className="w-24 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-900"
                              />
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void receiveShipment(shipment, "partial")}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50"
                        >
                          Receive entered qty
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void receiveShipment(shipment, "all")}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50"
                        >
                          Receive all remaining
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>

        {data.shipmentCapabilities.canCreate ? (
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <p className="text-sm font-medium text-zinc-900">Create ASN</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col text-sm">
                <span className="text-zinc-700">Shipment no</span>
                <input
                  value={asnShipmentNo}
                  onChange={(e) => setAsnShipmentNo(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-zinc-700">Shipped date</span>
                <input
                  type="date"
                  value={asnShippedDate}
                  onChange={(e) => setAsnShippedDate(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-zinc-700">Carrier</span>
                <input
                  value={asnCarrier}
                  onChange={(e) => setAsnCarrier(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-zinc-700">Tracking</span>
                <input
                  value={asnTrackingNo}
                  onChange={(e) => setAsnTrackingNo(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-zinc-700">Transport mode</span>
                <select
                  value={asnTransportMode}
                  onChange={(e) =>
                    setAsnTransportMode(
                      e.target.value as "OCEAN" | "AIR" | "ROAD" | "RAIL",
                    )
                  }
                  className={f}
                >
                  <option value="OCEAN">Ocean</option>
                  <option value="AIR">Air</option>
                  <option value="ROAD">Road</option>
                  <option value="RAIL">Rail</option>
                </select>
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-zinc-700">Est. volume (cbm)</span>
                <input
                  inputMode="decimal"
                  value={asnEstimatedVolumeCbm}
                  onChange={(e) => setAsnEstimatedVolumeCbm(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-zinc-700">Est. weight (kg)</span>
                <input
                  inputMode="decimal"
                  value={asnEstimatedWeightKg}
                  onChange={(e) => setAsnEstimatedWeightKg(e.target.value)}
                  className={f}
                />
              </label>
            </div>
            <label className="mt-3 flex flex-col text-sm">
              <span className="text-zinc-700">Notes</span>
              <textarea
                value={asnNotes}
                onChange={(e) => setAsnNotes(e.target.value)}
                rows={2}
                className={f}
              />
            </label>
            <div className="mt-3 grid gap-2">
              {data.items.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-48 text-zinc-700">
                    L{item.lineNo} {item.description}
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder="Qty shipped"
                    value={asnQtyByItemId[item.id] ?? ""}
                    onChange={(e) =>
                      setAsnQtyByItemId((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    className="w-32 rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void createShipment()}
              className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Create ASN"}
            </button>
          </div>
        ) : null}
      </section>

      <section
        id="help-focus-chat"
        className="mb-8 scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-lg font-medium text-zinc-900">Messages</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Shared thread with the supplier (and internal notes for buyers with
          edit permission). Internal messages are hidden from supplier-portal
          users.
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          {data.messages.length === 0 ? (
            <li className="text-zinc-500">No messages yet.</li>
          ) : (
            data.messages.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">
                    {m.author.name}
                  </span>
                  <span>{m.author.email}</span>
                  <span>·</span>
                  <span>{new Date(m.createdAt).toLocaleString()}</span>
                  {m.isInternal ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                      Internal
                    </span>
                  ) : (
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-900">
                      Shared
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-zinc-800">
                  {m.body}
                </p>
              </li>
            ))
          )}
        </ul>
        {data.messageCapabilities.canPost ? (
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <label className="flex flex-col text-sm">
              <span className="font-medium text-zinc-700">Add message</span>
              <textarea
                value={newMessageBody}
                onChange={(e) => setNewMessageBody(e.target.value)}
                rows={3}
                className={f}
                placeholder="Question, confirmation, or handoff…"
              />
            </label>
            {data.messageCapabilities.canPostInternal ? (
              <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={newMessageInternal}
                  onChange={(e) => setNewMessageInternal(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Internal (buyer-only, not visible to supplier portal)
              </label>
            ) : null}
            <button
              type="button"
              disabled={busy || !newMessageBody.trim()}
              onClick={() => void postMessage()}
              className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Posting…" : "Post message"}
            </button>
          </div>
        ) : null}
      </section>

      {data.splitChildren.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-zinc-900">
            Split children
          </h2>
          <ul className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            {data.splitChildren.map((child) => (
              <li key={child.id} className="flex justify-between gap-4">
                <Link
                  href={`/orders/${child.id}`}
                  className="font-medium text-amber-800 underline-offset-2 hover:underline"
                >
                  {child.orderNumber}
                </Link>
                <span className="text-zinc-600">{child.status.label}</span>
                <span>
                  {data.order.currency} {child.totalAmount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.pendingProposal ? (
        <section
          data-help-focus="split"
          className="mb-8 scroll-mt-24 rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          <h2 className="text-lg font-medium text-zinc-900">
            Pending split proposal
          </h2>
          <p className="mt-1 text-sm text-zinc-800">
            Buyer must accept or reject. Allocations:
          </p>
          <ul className="mt-3 space-y-1 text-sm text-zinc-900">
            {data.pendingProposal.lines.map((line) => (
              <li key={line.id}>
                <span className="font-medium">{line.sourceDescription}</span>: qty{" "}
                <span className="font-medium">{line.quantity}</span> to{" "}
                <span className="font-medium">child {line.childIndex}</span> · ship{" "}
                <span className="font-medium">
                  {new Date(line.plannedShipDate).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
          {canResolveSplitProposal ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => acceptSplit(data.pendingProposal!.id)}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Accept split
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => rejectSplit(data.pendingProposal!.id)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 disabled:opacity-50"
              >
                Reject split
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-600">
              Buyer review required: this user cannot accept/reject split proposals.
            </p>
          )}
        </section>
      ) : null}

      {canProposeSplit ? (
        <section
          data-help-focus="split"
          className="mb-8 scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-4"
        >
          <h2 className="text-lg font-medium text-zinc-900">Propose split</h2>
          <p className="mt-1 text-sm text-zinc-600">
            For each line, totals per child must sum exactly to the ordered
            quantity. At least two child orders required.
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            Child orders
            <input
              type="number"
              min={2}
              max={5}
              value={childCount}
              onChange={(event) =>
                setChildCount(Math.max(2, Number(event.target.value) || 2))
              }
              className="w-16 rounded border border-zinc-300 px-2 py-1"
            />
          </label>

          <div className="mt-4 space-y-6">
            {data.items.map((item) => (
              <div key={item.id} className="rounded-md border border-zinc-100 p-3">
                <p className="text-sm font-medium">
                  Line {item.lineNo}: {item.description} (order {item.quantity})
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: childCount }, (_, index) => index + 1).map(
                    (childIndex) => (
                      <div
                        key={`${item.id}-${childIndex}`}
                        className="rounded border border-zinc-100 p-2"
                      >
                        <p className="text-xs font-medium text-zinc-500">
                          Child {childIndex}
                        </p>
                        <label className="mt-1 block text-xs text-zinc-600">
                          Qty
                          <input
                            type="text"
                            value={allocations[item.id]?.[childIndex]?.quantity ?? ""}
                            onChange={(event) =>
                              setAllocations((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...previous[item.id],
                                  [childIndex]: {
                                    quantity: event.target.value,
                                    plannedShipDate:
                                      previous[item.id]?.[childIndex]
                                        ?.plannedShipDate ?? todayIsoDate(),
                                  },
                                },
                              }))
                            }
                            className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="mt-2 block text-xs text-zinc-600">
                          Ship date
                          <input
                            type="date"
                            value={
                              allocations[item.id]?.[childIndex]
                                ?.plannedShipDate ?? todayIsoDate()
                            }
                            onChange={(event) =>
                              setAllocations((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...previous[item.id],
                                  [childIndex]: {
                                    quantity:
                                      previous[item.id]?.[childIndex]
                                        ?.quantity ?? "",
                                    plannedShipDate: event.target.value,
                                  },
                                },
                              }))
                            }
                            className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void submitSplit()}
            className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Submit split proposal
          </button>
        </section>
      ) : null}

      {data.activity.length > 0 ? (
        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-lg font-medium text-zinc-900">Activity</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Recent status changes and workflow actions.
          </p>
          <ul className="mt-4 space-y-3 border-l border-zinc-200 pl-4 text-sm">
            {data.activity.map((row) => (
              <li key={row.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-zinc-400" />
                <p className="font-medium text-zinc-900">
                  {row.fromStatus ? (
                    <>
                      {row.fromStatus.label} → {row.toStatus.label}
                    </>
                  ) : (
                    row.toStatus.label
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {new Date(row.createdAt).toLocaleString()} · {row.actor.name} ·{" "}
                  <code className="rounded bg-zinc-100 px-1">{row.actionCode}</code>
                </p>
                {row.comment ? (
                  <p className="mt-1 text-zinc-600">{row.comment}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        id="help-focus-workflow"
        className="scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-lg font-medium text-zinc-900">Actions</h2>
        {(() => {
          const actions = data.allowedActions.filter(
            (action) =>
              action.actionCode !== "propose_split" &&
              action.actionCode !== "buyer_accept_split" &&
              action.actionCode !== "buyer_reject_proposal",
          );
          if (!canTransition) {
            return (
              <p className="mt-3 text-sm text-zinc-600">
                You do not have permission to run workflow actions (org.orders
                → transition).
              </p>
            );
          }
          if (actions.length === 0) {
            return (
              <p className="mt-3 text-sm text-zinc-500">
                No workflow actions from the current status. For supplier
                orders after seeding, &ldquo;Confirmed&rdquo; includes{" "}
                <span className="font-medium text-zinc-700">Mark fulfilled</span>
                .
              </p>
            );
          }
          return (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.actionCode}
                  type="button"
                  disabled={busy}
                  onClick={() => void runTransition(action.actionCode)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          );
        })()}
      </section>
    </main>
  );
}

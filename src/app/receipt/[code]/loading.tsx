import React from "react";
import { ReceiptSkeleton } from "@/components/ui/Skeleton";

export default function ReceiptLoading() {
  return (
    <div className="min-h-screen py-10 px-4">
      <ReceiptSkeleton />
    </div>
  );
}

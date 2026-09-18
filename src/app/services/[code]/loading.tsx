import React from "react";
import { DivergenceSkeleton } from "@/components/ui/Skeleton";

export default function ServicesLoading() {
  return (
    <div className="min-h-screen py-10 px-4">
      <DivergenceSkeleton />
    </div>
  );
}

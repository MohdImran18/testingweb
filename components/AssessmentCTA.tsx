"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

export default function AssessmentCTA() {
  return (
    <Link href="/assessment" className="cb-assessment-cta" aria-label="Start a waterbody project assessment">
      <ClipboardList size={17} strokeWidth={2.2} />
      <span>Project Assessment</span>
    </Link>
  );
}

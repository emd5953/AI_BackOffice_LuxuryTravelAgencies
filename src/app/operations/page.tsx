import type { Metadata } from "next";
import { OperationsDesk } from "@/components/operations-desk";

export const metadata: Metadata = { title: "Conversation desk · Analogue" };
export default function OperationsPage() {
  return <OperationsDesk />;
}

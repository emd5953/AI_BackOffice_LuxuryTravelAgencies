import type { Metadata } from "next";
import Image from "next/image";
import hillTown from "../../../public/images/background_1.jpeg";
import { WayContent } from "@/components/way-content";

export const metadata: Metadata = {
  title: "Analogue — The Way",
};

export default function WayPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="way-photo absolute inset-0">
        <Image
          alt="Montepulciano rooftops above the Tuscan countryside at sunset"
          src={hillTown}
          placeholder="blur"
          preload
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#4a3d24]/50 via-transparent to-transparent" />

      <WayContent />

      <div className="way-veil pointer-events-none absolute inset-0 z-20" aria-hidden="true" />
    </main>
  );
}

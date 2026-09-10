"use client";

import { ConsultationModal } from "@/components/consultation-modal";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ModalProvider } from "@/components/modal-provider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ModalProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ConsultationModal />
    </ModalProvider>
  );
}

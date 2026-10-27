import { ChatWidget } from "@/components/chat-widget";
import { ConsultationModal } from "@/components/consultation-modal";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ModalProvider } from "@/components/modal-provider";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModalProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ConsultationModal />
      <ChatWidget />
    </ModalProvider>
  );
}

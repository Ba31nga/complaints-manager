import type { Metadata } from "next";
import ClientLogin from "./ClientLogin";

export const metadata: Metadata = {
  title: "התחברות",
  description: "עמוד התחברות עם Google בלבד",
};

export default function Page() {
  return <ClientLogin />;
}

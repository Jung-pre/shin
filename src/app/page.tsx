import { redirect } from "next/navigation";
import { defaultLocale } from "@/shared/config/i18n";

export default function RootPage() {
  redirect(`/${defaultLocale}`);
}

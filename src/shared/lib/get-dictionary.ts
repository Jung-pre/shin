import { defaultLocale, type Locale } from "@/shared/config/i18n";
import { dictionaries, type Dictionary } from "@/shared/i18n/messages";

export const getDictionary = (locale: Locale): Dictionary => {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
};

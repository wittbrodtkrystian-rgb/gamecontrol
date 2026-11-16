import { pl } from "./pl";
import { en } from "./en";
export type Locale = "pl" | "en";
/** UI jest dziś w pełni po polsku; angielski jest szkieletem gotowym do rozbudowy. */
export const getDict = (locale: Locale = "pl") => (locale === "en" ? en : pl);
export const t = pl;

import { bookletPdfView } from "booklet-pdf";

// The native reader component, or null in a build that does not have it (web, Expo Go). Resolved once at load.
export const BookletPdf = bookletPdfView();

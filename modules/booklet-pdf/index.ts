import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";

// A local PDF reader: PDFKit on iOS, PdfRenderer on Android. It renders one file and reports the page. It does not
// annotate, search or read the text. The react-native-pdf route stays out because @config-plugins/react-native-pdf has no
// release for Expo SDK 58 (its README stops at SDK 56).
export type PageChange = { page: number; pageCount: number };

export type BookletPdfViewProps = {
  /** file:// URI of the PDF. */
  uri: string;
  /** 1-based page to show. */
  page: number;
  onPageChange?: (event: { nativeEvent: PageChange }) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type BookletPdfModule = {
  pageCount(uri: string): Promise<number>;
};

function nativeModule(): BookletPdfModule | null {
  try {
    return requireOptionalNativeModule<BookletPdfModule>("BookletPdf");
  } catch {
    return null;
  }
}

/** False in a build without the module (Expo Go, web). The reader then says so instead of failing. */
export function bookletPdfAvailable(): boolean {
  return nativeModule() != null;
}

/** The page count of a local PDF, read by the platform's own PDF API. Rejects when the file is not a PDF. */
export async function pdfPageCount(uri: string): Promise<number> {
  const native = nativeModule();
  if (!native) throw new Error("This build cannot read PDFs");
  return native.pageCount(uri);
}

let view: ComponentType<BookletPdfViewProps> | null | undefined;

export function bookletPdfView(): ComponentType<BookletPdfViewProps> | null {
  if (view !== undefined) return view;
  view = nativeModule() ? requireNativeViewManager<BookletPdfViewProps>("BookletPdf") : null;
  return view;
}

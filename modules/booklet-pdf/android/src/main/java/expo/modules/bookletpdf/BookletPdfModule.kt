package expo.modules.bookletpdf

import android.net.Uri
import android.os.ParcelFileDescriptor
import android.graphics.pdf.PdfRenderer
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

internal class PdfOpenFailed : CodedException("The file could not be opened as a PDF")

class BookletPdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BookletPdf")

    AsyncFunction("pageCount") { uri: String ->
      val path = Uri.parse(uri).path ?: throw PdfOpenFailed()
      try {
        ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
          PdfRenderer(descriptor).use { renderer -> renderer.pageCount }
        }
      } catch (error: Exception) {
        throw PdfOpenFailed()
      }
    }

    View(BookletPdfView::class) {
      Events("onPageChange")

      Prop("uri") { view: BookletPdfView, uri: String ->
        view.load(uri)
      }

      Prop("page") { view: BookletPdfView, page: Int ->
        view.show(page)
      }
    }
  }
}

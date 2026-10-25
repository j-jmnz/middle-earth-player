package expo.modules.bookletpdf

import android.net.Uri
import android.os.ParcelFileDescriptor
import android.graphics.pdf.PdfRenderer
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// The detail names the exception PdfRenderer threw, the file size and its first bytes, so a report says why.
internal class PdfOpenFailed(detail: String) : CodedException("The file could not be opened as a PDF ($detail)")

class BookletPdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BookletPdf")

    AsyncFunction("pageCount") { uri: String ->
      val path = Uri.parse(uri).path ?: throw PdfOpenFailed("no path in $uri")
      val file = File(path)
      try {
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
          PdfRenderer(descriptor).use { renderer -> renderer.pageCount }
        }
      } catch (error: Exception) {
        val head = runCatching {
          val bytes = ByteArray(8)
          val read = file.inputStream().use { input -> input.read(bytes) }
          String(bytes, 0, maxOf(read, 0), Charsets.ISO_8859_1)
        }.getOrDefault("")
        throw PdfOpenFailed("${error.javaClass.simpleName}: ${error.message}; ${file.length()} bytes, starts ${head.trim()}")
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

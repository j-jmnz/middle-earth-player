package expo.modules.bookletpdf

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.view.ViewGroup
import android.widget.ImageView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.util.concurrent.Executors

// One PDF as a vertical list of pages drawn by PdfRenderer, scaled to the width. PdfRenderer opens one page at a time, so
// every render runs on one background thread. It reports the first page that is showing.
class BookletPdfView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onPageChange by EventDispatcher()
  private val renderThread = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())
  private val manager = LinearLayoutManager(context)
  private val list = RecyclerView(context)
  private val adapter = PageAdapter()

  private var descriptor: ParcelFileDescriptor? = null
  private var renderer: PdfRenderer? = null
  private var loadedUri: String? = null
  private var wantedPage = 1
  private var reported = 0

  init {
    list.layoutManager = manager
    list.adapter = adapter
    list.setBackgroundColor(Color.TRANSPARENT)
    list.addOnScrollListener(object : RecyclerView.OnScrollListener() {
      override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
        report()
      }
    })
    addView(list, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
  }

  fun load(uri: String) {
    if (loadedUri == uri) return
    loadedUri = uri
    closeRenderer()
    val path = Uri.parse(uri).path ?: return
    try {
      val opened = ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY)
      descriptor = opened
      renderer = PdfRenderer(opened)
    } catch (error: Exception) {
      closeRenderer()
    }
    adapter.notifyDataSetChanged()
    show(wantedPage)
  }

  fun show(page: Int) {
    wantedPage = maxOf(1, page)
    val count = renderer?.pageCount ?: 0
    if (count == 0) return
    val index = minOf(wantedPage, count) - 1
    if (manager.findFirstVisibleItemPosition() != index) {
      manager.scrollToPositionWithOffset(index, 0)
    }
  }

  private fun report() {
    val count = renderer?.pageCount ?: 0
    val position = manager.findFirstVisibleItemPosition()
    if (count == 0 || position < 0 || position + 1 == reported) return
    reported = position + 1
    wantedPage = reported
    onPageChange(mapOf("page" to reported, "pageCount" to count))
  }

  // The renderer is closed on the render thread, after the renders that are already queued, under the lock they take.
  private fun closeRenderer() {
    val old = renderer
    val oldDescriptor = descriptor
    renderer = null
    descriptor = null
    reported = 0
    if (old == null) return
    renderThread.execute {
      synchronized(old) { old.close() }
      oldDescriptor?.close()
    }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    closeRenderer()
    renderThread.shutdown()
  }

  private inner class PageAdapter : RecyclerView.Adapter<PageHolder>() {
    override fun getItemCount(): Int = renderer?.pageCount ?: 0

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PageHolder {
      val image = ImageView(parent.context)
      image.layoutParams = RecyclerView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
      image.adjustViewBounds = true
      image.scaleType = ImageView.ScaleType.FIT_CENTER
      image.setBackgroundColor(Color.WHITE)
      return PageHolder(image)
    }

    override fun onBindViewHolder(holder: PageHolder, position: Int) {
      val width = if (list.width > 0) list.width else resources.displayMetrics.widthPixels
      holder.image.setImageDrawable(null)
      holder.image.tag = position
      val current = renderer ?: return
      renderThread.execute {
        val bitmap = try {
          synchronized(current) {
            current.openPage(position).use { page ->
              val height = (width.toFloat() * page.height / page.width).toInt()
              val rendered = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
              rendered.eraseColor(Color.WHITE)
              page.render(rendered, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              rendered
            }
          }
        } catch (error: Exception) {
          null
        }
        main.post {
          if (bitmap != null && holder.image.tag == position) holder.image.setImageBitmap(bitmap)
        }
      }
    }
  }

  private class PageHolder(val image: ImageView) : RecyclerView.ViewHolder(image)
}

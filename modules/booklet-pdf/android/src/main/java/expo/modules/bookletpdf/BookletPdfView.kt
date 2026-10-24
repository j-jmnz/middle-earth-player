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
  private val main = Handler(Looper.getMainLooper())
  private val manager = LinearLayoutManager(context)
  private val list = RecyclerView(context)
  private val adapter = PageAdapter()

  private var descriptor: ParcelFileDescriptor? = null
  private var renderer: PdfRenderer? = null
  private var loadedUri: String? = null
  private var wantedPage = 1
  private var reported = 0
  // False until the list is at the wanted page; scroll events before that are the layout settling, not the reader.
  private var settled = false
  // Height over width of the first page: the placeholder height of a page that is not drawn yet.
  private var aspect = 0f
  private var renderThread = Executors.newSingleThreadExecutor()

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
    open(uri)
  }

  // Opens the file on a fresh render thread. Detaching shuts the thread down, so attaching again calls this too.
  private fun open(uri: String) {
    settled = false
    closeRenderer()
    if (renderThread.isShutdown) renderThread = Executors.newSingleThreadExecutor()
    aspect = 0f
    val path = Uri.parse(uri).path
    if (path != null) {
      try {
        val opened = ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY)
        descriptor = opened
        val opening = PdfRenderer(opened)
        renderer = opening
        // No render is queued yet, so opening page 0 here does not meet the render thread. Pages are about the same shape.
        if (opening.pageCount > 0) {
          opening.openPage(0).use { first -> if (first.width > 0) aspect = first.height.toFloat() / first.width }
        }
      } catch (error: Exception) {
        closeRenderer()
      }
    }
    adapter.notifyDataSetChanged()
    show(wantedPage)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    val uri = loadedUri
    if (uri != null && renderer == null) open(uri)
  }

  fun show(page: Int) {
    wantedPage = maxOf(1, page)
    val count = renderer?.pageCount ?: 0
    if (count == 0) return
    val index = minOf(wantedPage, count) - 1
    if (manager.findFirstVisibleItemPosition() != index) {
      manager.scrollToPositionWithOffset(index, 0)
    } else {
      settled = true
    }
  }

  private fun report() {
    val count = renderer?.pageCount ?: 0
    val position = manager.findFirstVisibleItemPosition()
    if (count == 0 || position < 0) return
    if (!settled) {
      if (position + 1 != minOf(wantedPage, count)) return
      settled = true
    }
    if (position + 1 == reported) return
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
      // A placeholder of the page shape keeps the list height and the scroll position steady while pages render.
      if (aspect > 0f) {
        holder.image.layoutParams.height = (width * aspect).toInt()
        holder.image.requestLayout()
      }
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
          if (bitmap != null && holder.image.tag == position) {
            holder.image.layoutParams.height = bitmap.height
            holder.image.setImageBitmap(bitmap)
          }
        }
      }
    }
  }

  private class PageHolder(val image: ImageView) : RecyclerView.ViewHolder(image)
}

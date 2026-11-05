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
import android.view.accessibility.AccessibilityManager
import android.widget.ImageView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.sqrt

// One PDF as a vertical list of pages drawn by PdfRenderer, scaled to the width. PdfRenderer opens one page at a time, so
// every render runs on one background thread. It reports the first page that is showing. Pinch and double tap zoom
// (ZoomList); when a zoom settles, the pages on screen are drawn again at that scale, up to MAX_PAGE_PIXELS.
class BookletPdfView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onPageChange by EventDispatcher()
  private val main = Handler(Looper.getMainLooper())
  private val manager = LinearLayoutManager(context)
  private val list = ZoomList(context)
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
  // Bitmap pixels per view pixel of width for new renders: 1 unzoomed, up to the zoom while zoomed.
  private var quality = 1f

  init {
    list.layoutManager = manager
    list.adapter = adapter
    list.setBackgroundColor(Color.TRANSPARENT)
    // Fewer off-screen pages hold bitmaps, which are larger while zoomed.
    list.setItemViewCacheSize(1)
    list.onZoomSettled = { sharpen() }
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

  // Draws the pages on screen again at the current zoom, or back at width when the zoom returns to 1.
  private fun sharpen() {
    val wanted = list.scale
    if (abs(wanted - quality) < 0.25f) return
    quality = wanted
    val first = manager.findFirstVisibleItemPosition()
    val last = manager.findLastVisibleItemPosition()
    if (first >= 0 && last >= first) adapter.notifyItemRangeChanged(first, last - first + 1)
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
    announcePage(reported, count)
  }

  // Says the page that came into view, only while TalkBack's touch exploration is on; a sighted reader hears nothing.
  private fun announcePage(page: Int, count: Int) {
    val accessibility = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager ?: return
    if (accessibility.isEnabled && accessibility.isTouchExplorationEnabled) announceForAccessibility("Page $page of $count")
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
      // A page drawn again at a new zoom keeps its old picture and size until the new one is ready.
      if (holder.bound != position) {
        holder.image.setImageDrawable(null)
        // A placeholder of the page shape keeps the list height and the scroll position steady while pages render.
        if (aspect > 0f) {
          holder.image.layoutParams.height = (width * aspect).toInt()
          holder.image.requestLayout()
        }
      }
      holder.bound = position
      // The page's spoken name for TalkBack; it draws nothing.
      holder.image.contentDescription = "Page ${position + 1} of ${renderer?.pageCount ?: 0}"
      val token = Any()
      holder.token = token
      val scale = quality
      val current = renderer ?: return
      renderThread.execute {
        val bitmap = try {
          synchronized(current) {
            current.openPage(position).use { page ->
              val pageAspect = page.height.toFloat() / page.width
              // The bitmap is the view width times the zoom, held under MAX_PAGE_PIXELS.
              val budget = sqrt(MAX_PAGE_PIXELS / pageAspect)
              val renderWidth = maxOf(1, minOf(width * scale, maxOf(width.toFloat(), budget)).toInt())
              val rendered = Bitmap.createBitmap(renderWidth, maxOf(1, (renderWidth * pageAspect).toInt()), Bitmap.Config.ARGB_8888)
              rendered.eraseColor(Color.WHITE)
              page.render(rendered, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              Pair(rendered, (width * pageAspect).toInt())
            }
          }
        } catch (error: Exception) {
          null
        } catch (error: OutOfMemoryError) {
          // A zoomed page too large for the heap keeps the picture it has.
          null
        }
        main.post {
          if (bitmap != null && holder.token === token) {
            // The view keeps the page's size at width; a sharper bitmap is drawn into the same box.
            holder.image.layoutParams.height = bitmap.second
            holder.image.setImageBitmap(bitmap.first)
          }
        }
      }
    }
  }

  private class PageHolder(val image: ImageView) : RecyclerView.ViewHolder(image) {
    var bound = -1
    // The render this holder waits for; an older one that finishes later is dropped.
    var token: Any? = null
  }

  companion object {
    // About 24 MB of ARGB per page.
    const val MAX_PAGE_PIXELS = 6_000_000f
  }
}

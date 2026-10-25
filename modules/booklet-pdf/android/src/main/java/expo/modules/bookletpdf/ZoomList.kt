package expo.modules.bookletpdf

import android.content.Context
import android.graphics.Canvas
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.VelocityTracker
import android.view.ViewConfiguration
import androidx.recyclerview.widget.RecyclerView
import kotlin.math.abs

// The page list with pinch zoom. The list lays its pages out at width as before; drawing is scaled by `scale` and moved
// by (tx, ty), kept inside the view. Unzoomed, touches are the list's own (scroll and fling). Once two fingers are down,
// or while zoomed, this view owns the gesture: the focus point pans, vertical movement past the page edge scrolls the
// list, and a lift flings it. A double tap zooms to DOUBLE_TAP and back.
class ZoomList(context: Context) : RecyclerView(context) {
  var scale = 1f
    private set
  private var tx = 0f
  private var ty = 0f
  // Called when a pinch or a double tap ends, so the view can redraw the visible pages at the new scale.
  var onZoomSettled: (() -> Unit)? = null

  private var owned = false
  private var lastX = 0f
  private var lastY = 0f
  // Vertical movement smaller than a pixel of content, kept so slow drags still scroll.
  private var pendingScroll = 0f
  private var velocity: VelocityTracker? = null
  private val minFling = ViewConfiguration.get(context).scaledMinimumFlingVelocity

  private val scaler = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
    override fun onScale(detector: ScaleGestureDetector): Boolean {
      zoomTo(scale * detector.scaleFactor, detector.focusX, detector.focusY)
      return true
    }

    override fun onScaleEnd(detector: ScaleGestureDetector) {
      onZoomSettled?.invoke()
    }
  })

  private val taps = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
    override fun onDoubleTap(event: MotionEvent): Boolean {
      zoomTo(if (scale > 1.01f) 1f else DOUBLE_TAP, event.x, event.y)
      onZoomSettled?.invoke()
      return true
    }
  })

  // Scales about the focus point: the content under the fingers stays under them.
  fun zoomTo(target: Float, focusX: Float, focusY: Float) {
    val next = target.coerceIn(1f, MAX_SCALE)
    tx = focusX - (focusX - tx) * (next / scale)
    ty = focusY - (focusY - ty) * (next / scale)
    scale = next
    clamp()
    invalidate()
  }

  private fun clamp() {
    tx = tx.coerceIn(width - width * scale, 0f)
    ty = ty.coerceIn(height - height * scale, 0f)
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    clamp()
  }

  override fun dispatchDraw(canvas: Canvas) {
    canvas.save()
    canvas.translate(tx, ty)
    canvas.scale(scale, scale)
    super.dispatchDraw(canvas)
    canvas.restore()
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_DOWN) {
      owned = scale > 1f
      if (owned) stopScroll()
      velocity?.recycle()
      velocity = VelocityTracker.obtain()
    }
    velocity?.addMovement(event)
    scaler.onTouchEvent(event)
    taps.onTouchEvent(event)
    if (!owned && (scaler.isInProgress || event.pointerCount > 1 || scale > 1f)) {
      // A second finger, or a double tap that zoomed in: the list's own drag is cancelled and this view takes the rest.
      owned = true
      val cancel = MotionEvent.obtain(event)
      cancel.action = MotionEvent.ACTION_CANCEL
      super.dispatchTouchEvent(cancel)
      cancel.recycle()
      resetFocus(event)
    }
    if (!owned) return super.dispatchTouchEvent(event)
    parent?.requestDisallowInterceptTouchEvent(true)
    pan(event)
    return true
  }

  private fun pan(event: MotionEvent) {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN, MotionEvent.ACTION_POINTER_UP -> resetFocus(event)
      MotionEvent.ACTION_MOVE -> {
        val (x, y) = focus(event)
        val dx = x - lastX
        val dy = y - lastY
        lastX = x
        lastY = y
        tx += dx
        val before = ty
        ty += dy
        clamp()
        // What the edge did not absorb scrolls the list, in content pixels.
        pendingScroll += (dy - (ty - before)) / scale
        val step = pendingScroll.toInt()
        if (step != 0) {
          scrollBy(0, -step)
          pendingScroll -= step
        }
        invalidate()
      }
      MotionEvent.ACTION_UP -> {
        val tracker = velocity
        if (tracker != null && !scaler.isInProgress) {
          tracker.computeCurrentVelocity(1000)
          val vy = tracker.yVelocity
          if (abs(vy) > minFling) fling(0, (-vy / scale).toInt())
        }
        endGesture()
      }
      MotionEvent.ACTION_CANCEL -> endGesture()
    }
  }

  private fun endGesture() {
    velocity?.recycle()
    velocity = null
    pendingScroll = 0f
  }

  private fun resetFocus(event: MotionEvent) {
    val (x, y) = focus(event)
    lastX = x
    lastY = y
  }

  // The mean of the fingers still down: a lifting finger is left out, so the focus does not jump.
  private fun focus(event: MotionEvent): Pair<Float, Float> {
    val lifting = if (event.actionMasked == MotionEvent.ACTION_POINTER_UP) event.actionIndex else -1
    var sumX = 0f
    var sumY = 0f
    var count = 0
    for (index in 0 until event.pointerCount) {
      if (index == lifting) continue
      sumX += event.getX(index)
      sumY += event.getY(index)
      count += 1
    }
    return if (count == 0) Pair(lastX, lastY) else Pair(sumX / count, sumY / count)
  }

  companion object {
    const val MAX_SCALE = 4f
    const val DOUBLE_TAP = 2.5f
  }
}

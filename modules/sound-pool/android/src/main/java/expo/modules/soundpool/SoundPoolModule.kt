package expo.modules.soundpool

import android.media.AudioAttributes
import android.media.SoundPool
import android.net.Uri
import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The most sounds heard at once: past it SoundPool stops the oldest.
private const val MAX_STREAMS = 12

// A play asked for while its sample still loads is played when the load ends this soon after; later, the sound's moment has gone.
private const val LATE_MS = 700L

class SoundPoolModule : Module() {
  private val lock = Any()
  private var pool: SoundPool? = null

  // The samples whose load has ended well, and for a sample still loading the last play asked of it: when, and how loud.
  private val loaded = HashSet<Int>()
  private val waiting = HashMap<Int, Pair<Long, Float>>()

  // A game's sounds: they follow the media volume, mix with the player's own music and take no audio focus.
  private fun pool(): SoundPool = synchronized(lock) {
    pool ?: SoundPool.Builder()
      .setMaxStreams(MAX_STREAMS)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_GAME)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      .build()
      .also { created ->
        created.setOnLoadCompleteListener { sounds, sample, status ->
          val asked = synchronized(lock) {
            if (status == 0) loaded.add(sample)
            waiting.remove(sample)
          }
          if (status == 0 && asked != null && SystemClock.elapsedRealtime() - asked.first <= LATE_MS) {
            sounds.play(sample, asked.second, asked.second, 1, 0, 1f)
          }
        }
        pool = created
      }
  }

  override fun definition() = ModuleDefinition {
    Name("SoundPool")

    Function("load") { uri: String ->
      val path = if (uri.startsWith("file:")) Uri.parse(uri).path else uri
      if (path == null) 0 else pool().load(path, 1)
    }

    Function("play") { sample: Int, volume: Float ->
      val level = volume.coerceIn(0f, 1f)
      val ready = synchronized(lock) {
        if (loaded.contains(sample)) {
          true
        } else {
          waiting[sample] = Pair(SystemClock.elapsedRealtime(), level)
          false
        }
      }
      if (ready) pool().play(sample, level, level, 1, 0, 1f)
    }

    Function("unload") { sample: Int ->
      synchronized(lock) {
        loaded.remove(sample)
        waiting.remove(sample)
      }
      pool?.unload(sample)
    }

    // The sounds stop with the app, as the music does, and one cut short goes on when the app is back in front.
    OnActivityEntersBackground {
      pool?.autoPause()
    }

    OnActivityEntersForeground {
      pool?.autoResume()
    }

    OnDestroy {
      synchronized(lock) {
        pool?.release()
        pool = null
        loaded.clear()
        waiting.clear()
      }
    }
  }
}

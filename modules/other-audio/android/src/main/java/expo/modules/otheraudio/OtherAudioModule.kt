package expo.modules.otheraudio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OtherAudioModule : Module() {
  // The app keeps playing when it loses the focus again (another app starts, a call): its sounds mix, as they do without the focus.
  private val listener = AudioManager.OnAudioFocusChangeListener { }
  private var request: AudioFocusRequest? = null
  private var asked = false

  private fun audio(): AudioManager? = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  @Suppress("DEPRECATION")
  private fun abandon(audio: AudioManager) {
    if (!asked) return
    asked = false
    val made = request
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && made != null) {
      audio.abandonAudioFocusRequest(made)
    } else {
      audio.abandonAudioFocus(listener)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("OtherAudio")

    // True while any app plays music. The app asks before its own music starts and while its players are paused (on return to the
    // foreground), so the answer is another app's.
    Function("isOtherAudioPlaying") {
      audio()?.isMusicActive ?: false
    }

    // Takes the audio focus for good, which tells the other apps to stop their audio. True when the phone granted it.
    AsyncFunction("stopOtherAudio") {
      val audio = audio() ?: return@AsyncFunction false
      asked = true
      @Suppress("DEPRECATION")
      val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val made = request ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_GAME)
              .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
              .build()
          )
          .setOnAudioFocusChangeListener(listener)
          .build()
          .also { request = it }
        audio.requestAudioFocus(made)
      } else {
        audio.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
      }
      result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    // Gives the focus up. An app that was stopped does not start again by itself.
    AsyncFunction("allowOtherAudio") {
      audio()?.let { abandon(it) }
      Unit
    }

    OnDestroy {
      audio()?.let { abandon(it) }
    }
  }
}

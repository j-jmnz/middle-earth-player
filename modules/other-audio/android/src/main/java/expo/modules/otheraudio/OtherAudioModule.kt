package expo.modules.otheraudio

import android.content.Context
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OtherAudioModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OtherAudio")

    // True while any app plays music. The app asks before its own music starts and while its players are paused (on return to the
    // foreground), so the answer is another app's.
    Function("isOtherAudioPlaying") {
      val audio = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      audio?.isMusicActive ?: false
    }
  }
}

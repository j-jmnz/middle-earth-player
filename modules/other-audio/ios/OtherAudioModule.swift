import AVFoundation
import ExpoModulesCore

public class OtherAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OtherAudio")

    // True while another app plays audio that this app's secondary audio (its music) should give way to.
    Function("isOtherAudioPlaying") { () -> Bool in
      return AVAudioSession.sharedInstance().secondaryAudioShouldBeSilencedHint
    }

    // Activates the audio session. With a category that does not mix (expo-audio sets it before this is called), iOS then stops
    // the audio of other apps. True when the session is active.
    AsyncFunction("stopOtherAudio") { () -> Bool in
      do {
        try AVAudioSession.sharedInstance().setActive(true)
        return true
      } catch {
        return false
      }
    }

    // Nothing to give up on iOS: a category that mixes, which expo-audio sets, is what lets other audio play.
    AsyncFunction("allowOtherAudio") { () -> Void in
    }
  }
}

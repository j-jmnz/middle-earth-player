import AVFoundation
import ExpoModulesCore

public class OtherAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OtherAudio")

    // True while another app plays audio that this app's secondary audio (its music) should give way to.
    Function("isOtherAudioPlaying") { () -> Bool in
      return AVAudioSession.sharedInstance().secondaryAudioShouldBeSilencedHint
    }
  }
}

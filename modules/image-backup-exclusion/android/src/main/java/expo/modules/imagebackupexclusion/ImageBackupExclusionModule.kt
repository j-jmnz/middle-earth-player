package expo.modules.imagebackupexclusion

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ImageBackupExclusionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ImageBackupExclusion")

    Function("excludeFromBackup") { _: String ->
    }
  }
}

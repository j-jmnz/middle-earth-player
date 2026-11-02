import ExpoModulesCore
import Foundation

internal final class BackupExclusionFailed: Exception {
  private let detail: String

  init(_ detail: String, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.detail = detail
    super.init(file: file, line: line, function: function)
  }

  override var reason: String { detail }
}

public class ImageBackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ImageBackupExclusion")

    Function("excludeFromBackup") { (directoryUri: String) throws in
      guard let url = URL(string: directoryUri) else {
        throw BackupExclusionFailed("The image directory URI is not a URL")
      }
      var target = url
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try target.setResourceValues(values)
    }
  }
}

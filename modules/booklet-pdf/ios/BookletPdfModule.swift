import ExpoModulesCore
import PDFKit

internal final class PdfOpenFailed: Exception {
  override var reason: String { "The file could not be opened as a PDF" }
}

public class BookletPdfModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BookletPdf")

    AsyncFunction("pageCount") { (uri: String) -> Int in
      guard let url = URL(string: uri), let document = PDFDocument(url: url) else {
        throw PdfOpenFailed()
      }
      return document.pageCount
    }

    View(BookletPdfView.self) {
      Events("onPageChange")

      Prop("uri") { (view: BookletPdfView, uri: String) in
        view.load(uri)
      }

      Prop("page") { (view: BookletPdfView, page: Int) in
        view.show(page)
      }
    }
  }
}

// PDFKit's own view: continuous vertical pages, scaled to the width. It reports the page that is showing.
class BookletPdfView: ExpoView {
  let onPageChange = EventDispatcher()
  private let pdfView = PDFView()
  private var loadedUri: String?
  private var wantedPage = 1
  // False until the document is showing the wanted page. PDFKit posts PDFViewPageChanged for the first page when the
  // document is assigned; that event is not the reader's position and must not overwrite wantedPage or the saved page.
  private var settled = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    pdfView.autoScales = true
    pdfView.displayMode = .singlePageContinuous
    pdfView.displayDirection = .vertical
    pdfView.backgroundColor = .clear
    addSubview(pdfView)
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(pageChanged),
      name: .PDFViewPageChanged,
      object: pdfView
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  override func layoutSubviews() {
    pdfView.frame = bounds
    // go(to:) can be a no-op while the view has no size; ask again once it has one.
    if !settled { show(wantedPage) }
  }

  func load(_ uri: String) {
    if loadedUri == uri { return }
    loadedUri = uri
    settled = false
    guard let url = URL(string: uri), let document = PDFDocument(url: url) else {
      pdfView.document = nil
      return
    }
    pdfView.document = document
    show(wantedPage)
  }

  func show(_ page: Int) {
    wantedPage = max(1, page)
    guard let document = pdfView.document, document.pageCount > 0 else { return }
    let index = min(wantedPage, document.pageCount) - 1
    guard let target = document.page(at: index) else { return }
    if pdfView.currentPage != target {
      pdfView.go(to: target)
    }
    settled = pdfView.currentPage == target
  }

  @objc private func pageChanged() {
    guard let document = pdfView.document, let current = pdfView.currentPage else { return }
    let page = document.index(for: current) + 1
    // Until the wanted page has been shown, events are PDFKit settling in (page 1 on assignment), not the reader.
    if !settled { return }
    wantedPage = page
    onPageChange(["page": page, "pageCount": document.pageCount])
  }
}

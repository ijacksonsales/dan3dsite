// model-viewer only enables EXT_meshopt_compression after
// `ModelViewerElement.meshoptDecoderLocation` is set: it loads this URL as a
// script and then uses the MeshoptDecoder already bundled with it. Nothing else
// is needed here; serving it locally avoids a CDN dependency.

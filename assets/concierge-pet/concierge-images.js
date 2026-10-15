(function () {
  "use strict";
  // Read only a File supplied by a picker or the user's paste event.
  function pastedFile(event) {
    var items = Array.from(event.clipboardData && event.clipboardData.items || []);
    var images = items.filter(function (item) { return item.kind === "file" && /^image\//.test(item.type); });
    if (!images.length) return null;
    event.preventDefault();
    if (images.length !== 1) throw new Error("invalid_image");
    var file = images[0].getAsFile();
    if (!file) throw new Error("invalid_image");
    return file;
  }
  async function prepare(selected, doc) {
    if (!selected || !/^image\/(png|jpeg|webp)$/.test(selected.type) || !selected.size || selected.size > 10 * 1024 * 1024) throw new Error("invalid_image");
    var sourceUrl = window.URL.createObjectURL(selected), image = new window.Image(), timer;
    try {
      await new Promise(function (resolve, reject) {
        timer = window.setTimeout(function () { reject(new Error("invalid_image")); }, 15000);
        image.onload = resolve;
        image.onerror = function () { reject(new Error("invalid_image")); };
        image.src = sourceUrl;
      });
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error("invalid_image");
      var scale = Math.min(1, 1600 / image.naturalWidth, 1600 / image.naturalHeight);
      var canvas = doc.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      // Redrawing strips original metadata and normalizes the format.
      var context = canvas.getContext("2d");
      if (!context) throw new Error("invalid_image");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      var data = canvas.toDataURL("image/png").split(",")[1];
      var bytes = data ? data.length * 3 / 4 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0) : 0;
      if (!bytes || bytes > 2097152) throw new Error("image_large");
      return data;
    } finally {
      window.clearTimeout(timer);
      window.URL.revokeObjectURL(sourceUrl);
      image.onload = image.onerror = null;
      image.src = "";
    }
  }
  window.DcatsConciergeImages = Object.freeze({ pastedFile: pastedFile, prepare: prepare });
})();

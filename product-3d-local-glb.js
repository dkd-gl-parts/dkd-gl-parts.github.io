(function () {
  "use strict";
  // Read-only local preview preflight, not a replacement for server validation.
  // Single-file GLB only: reject every URI before GLTFLoader sees the document.
  var MAX_BYTES = 30 * 1024 * 1024;
  function validateFile(file) {
    if (!file || !/\.glb$/i.test(file.name) || file.size < 20 || file.size > MAX_BYTES ||
        ["", "model/gltf-binary", "application/octet-stream"].indexOf(file.type) < 0) {
      throw new Error("30 MB以下のGLBファイル（.glb）を選択してください。");
    }
  }
  function validateBytes(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20 || buffer.byteLength > MAX_BYTES) {
      throw new Error("GLBのサイズを確認してください。");
    }
    var view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 ||
        view.getUint32(8, true) !== buffer.byteLength) throw new Error("GLB 2.0形式ではありません。");
    var offset = 12;
    var json = null;
    var binaryBytes = -1;
    while (offset < buffer.byteLength) {
      if (offset + 8 > buffer.byteLength) throw new Error("GLBの構造が不正です。");
      var size = view.getUint32(offset, true);
      var type = view.getUint32(offset + 4, true);
      if (!size || size % 4 || offset + 8 + size > buffer.byteLength) throw new Error("GLBの構造が不正です。");
      if (offset === 12 && type === 0x4e4f534a && size <= 8 * 1024 * 1024) {
        try { json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(buffer, offset + 8, size))); }
        catch (_) { throw new Error("GLBのJSONを読み取れません。"); }
      } else if (json && type === 0x004e4942 && binaryBytes < 0) binaryBytes = size;
      else throw new Error("対応していないGLB構造です。");
      offset += size + 8;
    }
    if (!json || !json.asset || json.asset.version !== "2.0" || !Array.isArray(json.scenes) ||
        !json.scenes.length || !Array.isArray(json.nodes) || !Array.isArray(json.meshes)) {
      throw new Error("表示できるGLBシーンがありません。");
    }
    var stack = [{ value: json, depth: 0 }];
    var visited = 0;
    while (stack.length) {
      var entry = stack.pop();
      if (++visited > 200000 || entry.depth > 64) throw new Error("GLBの構造が複雑すぎます。");
      if (!entry.value || typeof entry.value !== "object") continue;
      Object.keys(entry.value).forEach(function (key) {
        if (key === "uri") throw new Error("外部参照を含むGLBは開けません。テクスチャを埋め込んだSingle fileで書き出してください。");
        stack.push({ value: entry.value[key], depth: entry.depth + 1 });
      });
    }
    if (!Array.isArray(json.buffers) || json.buffers.length !== 1 || binaryBytes < 0 ||
        !Number.isSafeInteger(json.buffers[0].byteLength) || json.buffers[0].byteLength <= 0 ||
        json.buffers[0].byteLength > binaryBytes || binaryBytes - json.buffers[0].byteLength > 3) {
      throw new Error("GLBに埋め込まれたデータを確認してください。");
    }
    (json.bufferViews || []).forEach(function (row) {
      var start = row.byteOffset || 0;
      if (row.buffer !== 0 || !Number.isSafeInteger(start) || start < 0 ||
          !Number.isSafeInteger(row.byteLength) || row.byteLength <= 0 ||
          start + row.byteLength > json.buffers[0].byteLength) throw new Error("GLBのデータ範囲が不正です。");
    });
    (json.images || []).forEach(function (row) {
      if (!["image/png", "image/jpeg", "image/webp", "image/ktx2"].includes(row.mimeType) ||
          !Number.isSafeInteger(row.bufferView) || !json.bufferViews || !json.bufferViews[row.bufferView]) {
        throw new Error("GLBのテクスチャを確認してください。");
      }
    });
    // Cyclic node hierarchies otherwise recurse indefinitely inside GLTFLoader.
    var marks = new Uint8Array(json.nodes.length);
    json.nodes.forEach(function (_, index) {
      var pending = [{ index: index, leaving: false }];
      while (pending.length) {
        var step = pending.pop();
        if (step.leaving) { marks[step.index] = 2; continue; }
        if (marks[step.index] === 1) throw new Error("GLBのノードが循環しています。");
        if (marks[step.index] === 2) continue;
        marks[step.index] = 1;
        pending.push({ index: step.index, leaving: true });
        var children = json.nodes[step.index].children || [];
        if (!Array.isArray(children)) throw new Error("GLBのノード構造が不正です。");
        children.forEach(function (child) {
          if (!Number.isSafeInteger(child) || child < 0 || child >= json.nodes.length) throw new Error("GLBのノード参照が不正です。");
          pending.push({ index: child, leaving: false });
        });
      }
    });
    return buffer;
  }
  window.Product3DLocalGlb = Object.freeze({ validateFile: validateFile, validateBytes: validateBytes });
})();

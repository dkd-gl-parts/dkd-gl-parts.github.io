const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing source section: ${start}`);
  return source.slice(from, to);
}

function imageRuntime(rows, error) {
  const filters = [];
  let requests = 0;
  const query = {
    select() { return this; },
    eq(column, value) { filters.push([column, value]); return this; },
    or() { return this; },
    order() { return this; },
    then(resolve) {
      requests++;
      return Promise.resolve({ data: rows, error: error || null }).then(resolve);
    }
  };
  const scope = {
    sb: { from(table) { assert.equal(table, "core_product_images"); return query; } },
    normalizeProductKind: kind => kind || "rebuilt",
    imageProductKindOptions: () => ["rebuilt", "aftermarket_new"],
    isImageVisibilitySchemaError: () => true
  };
  vm.createContext(scope);
  vm.runInContext(
    section("function imageContextMatches", "function imageProductKindMatches") +
    section("async function fetchAllCoreProductImagesForContext", "async function refreshSalesImageCacheForProduct"),
    scope
  );
  return { scope, filters, get requests() { return requests; } };
}

test("customer display uses approval without changing product kind or capture origin", () => {
  const { scope } = imageRuntime([]);
  const match = scope.imageContextMatches;
  assert.equal(match({ product_kind: "rebuilt", image_origin: "production", show_in_sales: false, show_in_customer: true }, "customer"), true);
  assert.equal(match({ product_kind: "aftermarket_new", show_in_customer: true }, "customer"), true);
  assert.equal(match({ product_kind: "rebuilt", image_origin: "sales", show_in_sales: true, show_in_customer: false }, "customer"), false);
  assert.equal(match({ product_kind: "used_core", show_in_customer: true }, "customer"), false);
  assert.equal(match({ product_kind: "rebuilt" }, "customer"), false);
});

test("customer query selects approved images and keeps their categories", async () => {
  const rows = [
    { id: 1, product_kind: "rebuilt", image_origin: "production", show_in_customer: true },
    { id: 2, product_kind: "aftermarket_new", image_origin: "sales", show_in_customer: true },
    { id: 3, product_kind: "rebuilt", image_origin: "sales", show_in_customer: false },
    { id: 4, product_kind: "used_core", show_in_customer: true }
  ];
  const runtime = imageRuntime(rows);
  const result = await runtime.scope.fetchAllCoreProductImagesForContext(42, "customer");
  assert.deepEqual(Array.from(result.data, row => [row.id, row.product_kind]), [
    [1, "rebuilt"],
    [2, "aftermarket_new"]
  ]);
  assert.ok(runtime.filters.some(([column, value]) => column === "show_in_customer" && value === true));
});

test("customer lookup fails closed when the publication column is unavailable", async () => {
  const runtime = imageRuntime([], { message: "show_in_customer column not found" });
  const result = await runtime.scope.fetchAllCoreProductImagesForContext(42, "customer");
  assert.ok(result.error);
  assert.equal(runtime.requests, 1);
});

test("customer thumbnails and counts cannot reuse internal image caches", () => {
  let customerMode = true;
  const scope = {
    imageCountMap: { "dkd:42": 8 },
    imageCountCache: { "dkd:42": 8 },
    imageThumbnailMap: { "dkd:42": "private.jpg" },
    imageThumbnailCache: { "dkd:42": "private.jpg" },
    customerImageCountMap: {},
    customerImageThumbnailMap: {},
    productImageCacheKeys: () => ["dkd:42"],
    productDkdId: () => 42,
    isCustomerViewer: () => customerMode,
    isCustomerPortalSearchMode: () => false
  };
  vm.createContext(scope);
  vm.runInContext(
    section("function getProductImageCount", "function getProductionImageCount") +
    section("function getProductImageThumbnail", "async function fetchProductImageCountMapForContext") +
    section("function applyProductImageCountMapForContext", "async function fetchProductSearchCardFlags"),
    scope
  );
  assert.equal(scope.getProductImageCount({}), 0);
  assert.equal(scope.getProductImageThumbnail({}), "");
  scope.applyProductImageCountMapForContext([{}], {
    counts: { "dkd:42": 1 },
    thumbnails: { "dkd:42": "approved.jpg" }
  }, "customer");
  assert.equal(scope.getProductImageCount({}), 1);
  assert.equal(scope.getProductImageThumbnail({}), "approved.jpg");
  customerMode = false;
  assert.equal(scope.getProductImageCount({}), 8);
  assert.equal(scope.getProductImageThumbnail({}), "private.jpg");
});

test("filtering the editor does not unpublish hidden image rows", async () => {
  const fields = {
    "image-edit-kind-0": { value: "rebuilt" },
    "image-edit-customer-0": { checked: true }
  };
  const scope = {
    imageEditRows: [
      { id: 1, product_kind: "rebuilt", show_in_customer: true },
      { id: 2, product_kind: "aftermarket_new", show_in_customer: true }
    ],
    currentImageEditContext: "sales",
    canManageAllImages: () => true,
    normalizeProductKind: kind => kind,
    document: { getElementById: id => fields[id] || null },
    sb: { from() { throw new Error("Hidden image was updated"); } },
    closeImageEditDialog() {},
    loadImages: async () => {},
    refreshSalesImageCacheForProduct: async () => {},
    render() {},
    currentProduct: {},
    detailSecondaryRequestSeq: 0
  };
  vm.createContext(scope);
  vm.runInContext(section("async function saveImageEditDialog", "async function deleteImageFromDialog"), scope);
  await scope.saveImageEditDialog();
});

test("upload review starts with an unchecked control for every selected image", () => {
  assert.doesNotMatch(html, /id="image-action-customer-publish"/);
  assert.match(html, /id="image-upload-review-overlay"/);
  assert.match(
    section("function openImageUploadReview", "function closeImageUploadReview"),
    /files\.map\(function\(file, index\)[\s\S]*id='image-upload-review-customer-" \+ index \+ "' type='checkbox'/
  );
  assert.match(section("async function uploadImages", "async function saveImageUploads"), /openImageUploadReview\(files, kind, targetProduct, uploadContext\)/);
  assert.match(source, /imagePayload\.show_in_customer = publishFlags\[i\] === true/);
});

test("upload review confirms individual flags and cancel discards the selection", async () => {
  const flags = [];
  const overlay = { classList: { remove() {} }, setAttribute() {} };
  const list = { innerHTML: "selected files" };
  const button = { disabled: false };
  const files = [{ name: "first.jpg" }, { name: "second.jpg" }];
  const fields = {
    "image-upload-review-customer-0": { checked: false },
    "image-upload-review-customer-1": { checked: true },
    "image-upload-review-submit": button,
    "image-upload-review-list": list,
    "image-upload-review-overlay": overlay
  };
  const scope = {
    pendingImageUpload: { files, kind: "rebuilt", product: { id: 42 }, context: "sales" },
    imageUploadBusy: false,
    document: { getElementById: id => fields[id] || null },
    saveImageUploads: async (_files, context, kind, product, values) => {
      assert.equal(context, "sales");
      assert.equal(kind, "rebuilt");
      assert.equal(product.id, 42);
      flags.push(...values);
    },
    console
  };
  vm.createContext(scope);
  vm.runInContext(section("function openImageUploadReview", "function openImageDeleteDialog"), scope);
  await scope.confirmImageUploadReview();
  assert.deepEqual(flags, [false, true]);
  assert.equal(scope.pendingImageUpload, null);
  assert.equal(list.innerHTML, "");
  assert.equal(button.disabled, false);
  scope.pendingImageUpload = { files, kind: "rebuilt", product: {}, context: "production" };
  scope.closeImageUploadReview();
  assert.equal(scope.pendingImageUpload, null);
  assert.deepEqual(flags, [false, true]);
});

test("each saved image receives its own customer publication flag", async () => {
  const inserted = [];
  const activity = [];
  const label = { classList: { add() {}, remove() {} } };
  const scope = {
    canManageImageKind: () => true,
    productDkdId: () => 42,
    productKindStockKindAllowed: () => true,
    currentSlPartIds: [],
    selectedProductVariantId: () => 7,
    document: { getElementById: id => id === "upload-label" ? label : null },
    sb: { storage: { from() {
      return {
        upload: async () => ({ error: null }),
        getPublicUrl: path => ({ data: { publicUrl: path } })
      };
    } } },
    insertCoreProductImageRow: async payload => { inserted.push(payload); return { error: null }; },
    logUserActivity: (_name, details) => activity.push(details),
    productActivityDesc: () => "sample",
    renderProductKindWrapForCurrent() {},
    loadImages: async () => {},
    refreshSalesImageCacheForProduct: async () => {},
    render() {},
    currentProduct: { id: 42 },
    detailSecondaryRequestSeq: 0,
    currentProductionRow: { id: 43 },
    productionDetailRequestSeq: 0,
    loadProductionImagesForRow: async () => {},
    refreshProductionImageCacheForProduct: async () => {},
    renderProductionList() {}
  };
  vm.createContext(scope);
  vm.runInContext(section("async function saveImageUploads", "async function deleteImage"), scope);
  await scope.saveImageUploads([{ name: "first.jpg" }, { name: "second.jpg" }], "sales", "rebuilt", scope.currentProduct, [false, true]);
  assert.deepEqual(inserted.map(row => row.show_in_customer), [false, true]);
  assert.equal(activity[0].metadata.customer_published_count, 1);
  await scope.saveImageUploads([{ name: "production-off.jpg" }, { name: "production-on.jpg" }], "production", "rebuilt", scope.currentProductionRow, [false, true]);
  assert.equal(inserted[2].show_in_customer, false);
  assert.equal(inserted[3].show_in_customer, true);
});

test("image editing and customer catalog still use per-image publication", () => {
  assert.match(source, /id='image-edit-customer-/);
  assert.match(
    section("async function openImageEditDialog", "function closeImageEditDialog"),
    /imageEditRows = \(r\.data \|\| \[\]\)\.filter/
  );
  assert.match(source, /payload\.show_in_customer = publishToCustomer/);
  assert.match(source, /if \(!select \|\| !publishInput\) continue;/);
  assert.match(source, /fetchProductImageCountMapForContext\(customerCatalogProducts, "customer"\)/);
  assert.match(
    section("async function loadCustomerCatalogImages", "async function loadCustomerCatalogAvailability"),
    /fetchAllCoreProductImagesForContext\(parseInt\(productDkdId\(product\), 10\), "customer"\)/
  );
  assert.match(source, /class='customer-catalog-image-kinds' role='tablist'/);
});

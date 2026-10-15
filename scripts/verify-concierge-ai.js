const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const runtime = fs.readFileSync(path.join(root, "assets", "concierge-pet", "concierge-pet.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "concierge-pet", "concierge-pet.css"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireFragment(source, fragment, message) {
  assert(source.includes(fragment), message || `Missing fragment: ${fragment}`);
}

[
  "window.DcatsConciergeAiApi = Object.freeze",
  "if (!currentUser || !isSystemAdmin())",
  'sb.functions.invoke("concierge-ai-assist"',
  "body: { question: question, language: language, screen_id: screenId }",
  "question.length > 800",
  "CONCIERGE_AI_SCREEN_IDS[screenId]"
].forEach((fragment) => requireFragment(app, fragment));

[
  'createElement("section", "dcats-concierge-ai-card")',
  'openPanel("question")',
  'aiQuestionInput.focus()',
  'aiQuestionInput.maxLength = 800',
  'aiAskButton.addEventListener("click", runAiRequest)',
  'if (aiRequestPending || !isSystemAdminSession()) return;',
  'if (aiCard.parentElement) aiCard.parentElement.removeChild(aiCard);',
  "question: question",
  "language: activeLanguage()",
  "screenId: currentAiScreenId(api)",
  'data.performed_action !== false',
  'aiAnswer.textContent = data.answer.trim()',
  'aiAskButton.textContent = copy(aiRequestPending ? "aiWorking" : "aiAsk")',
  'aiAskButton.setAttribute("aria-busy", String(aiRequestPending))',
  'revealAiFeedback()',
  'API料金：GPT-5.6 Luna 入力 US$0.20／100万トークン、出力 US$1.20／100万トークン（ChatGPTサブスクリプションとは別料金）。D-CATS追加料金：0円。',
  '送信するのは質問文・表示言語・現在の画面名だけです。',
  '画面移動やデータの入力・更新・削除は自動実行しません。'
].forEach((fragment) => requireFragment(runtime, fragment));

[
  ".dcats-concierge-ai-card",
  ".dcats-concierge-ai-question",
  ".dcats-concierge-panel.is-question-view",
  ".dcats-concierge-panel.is-question-view .dcats-concierge-ai-button",
  ".dcats-concierge-ai-status.is-success",
  ".dcats-concierge-ai-status.is-error",
  ".dcats-concierge-ai-feedback",
  "body.dcats-concierge-floating-body .dcats-concierge-panel.is-question-view .dcats-concierge-panel-body"
].forEach((fragment) => requireFragment(css, fragment));

assert(runtime.indexOf("aiCard.appendChild(aiFeedback)") < runtime.indexOf("aiCard.appendChild(aiPrivacy)"),
  "AI status and answer must precede the long privacy/cost disclosures after submission");
const revealStart = runtime.indexOf("  function revealAiFeedback() {");
const revealEnd = runtime.indexOf("\n  function ", revealStart + 5);
assert(revealStart >= 0 && revealEnd > revealStart, "Scoped feedback reveal helper missing");
const feedbackBody = { scrollTop: 120, getBoundingClientRect: () => ({ top: 20, height: 180 }) };
const feedbackContext = {
  panelOpen: true, panelBody: feedbackBody,
  aiStatus: { getBoundingClientRect: () => ({ top: 320 }) },
  panel: { contains: () => false }, aiCard: { contains: () => false },
  presentationDocument: () => ({ activeElement: null }),
};
vm.createContext(feedbackContext);
vm.runInContext(runtime.slice(revealStart, revealEnd) + "\nrevealAiFeedback();", feedbackContext);
assert(feedbackBody.scrollTop === 412, "Feedback outside a small floating panel must scroll into view");
feedbackContext.panelOpen = false;
feedbackBody.scrollTop = 0;
vm.runInContext("revealAiFeedback();", feedbackContext);
assert(feedbackBody.scrollTop === 0, "Closed question panels must not scroll");
feedbackContext.panelOpen = true;
feedbackContext.panel.contains = () => true;
feedbackContext.presentationDocument = () => ({ activeElement: {} });
vm.runInContext("revealAiFeedback();", feedbackContext);
assert(feedbackBody.scrollTop === 0, "A response must not disrupt another form the user is editing");

assert(!/OPENAI_API_KEY|api\.openai\.com/.test(app), "The public application must not contain the OpenAI API key name or call OpenAI directly");
assert(!/OPENAI_API_KEY|api\.openai\.com/.test(runtime), "The concierge browser runtime must not contain OpenAI credentials or call OpenAI directly");
assert(!/screenshot|html2canvas|getDisplayMedia|captureStream/i.test(runtime), "The admin AI pilot must not capture or transmit the screen");
assert(!/navigateToScreen|showScreen|window\.location\s*=/.test(runtime), "The admin AI pilot must not navigate automatically");
assert(!runtime.includes("innerHTML"), "AI responses must be rendered as text, not HTML");

const allowlistStart = app.indexOf("var CONCIERGE_AI_SCREEN_IDS = Object.freeze({");
const allowlistEnd = app.indexOf("\n});", allowlistStart);
assert(allowlistStart >= 0 && allowlistEnd > allowlistStart, "The fixed D-CATS screen allowlist is missing");
const allowlistContext = {};
vm.createContext(allowlistContext);
vm.runInContext(app.slice(allowlistStart, allowlistEnd + 4).replace(/^var CONCIERGE_AI_SCREEN_IDS\s*=\s*/, "CONCIERGE_AI_SCREEN_IDS = "), allowlistContext);
const actualScreens = Object.keys(allowlistContext.CONCIERGE_AI_SCREEN_IDS || {}).sort();
const excludedScreens = new Set(["boot", "login", "forgot", "reset"]);
const expectedScreens = Array.from(html.matchAll(/id="screen-([^"]+)"/g), (match) => match[1])
  .filter((screen) => !excludedScreens.has(screen))
  .sort();
assert(JSON.stringify(actualScreens) === JSON.stringify(expectedScreens), "The AI screen allowlist must cover every current non-login D-CATS screen and no arbitrary destination");

console.log("concierge AI browser guard passed");

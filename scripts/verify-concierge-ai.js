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

function rule(selector) {
  const start = css.indexOf(selector + " {");
  assert(start >= 0, `Missing presentation rule: ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}
const questionStyle = rule(".dcats-concierge-ai-question");
const answerStyle = rule(".dcats-concierge-ai-answer");
const meterStyle = rule(".dcats-concierge-ai-usage");
const questionSize = Number(questionStyle.match(/font:\s*(\d+)px/)[1]);
const answerSize = Number(answerStyle.match(/font-size:\s*(\d+)px/)[1]);
assert(questionSize >= 16 && answerSize >= questionSize && answerStyle.includes("line-height: 1.8"), "Answer must be at least as readable as the question, with comfortable line spacing");
assert(Number(meterStyle.match(/font-size:\s*(\d+)px/)[1]) <= 10 && meterStyle.includes("justify-content: flex-end") && rule(".dcats-token-bar").includes("height: 3px"), "Token telemetry must remain a tiny, right-aligned secondary indicator");
assert(!runtime.includes('aiUsage.appendChild(createElement("strong"') && !runtime.includes('createElement("span", "dcats-token-parts"'), "Token heading and breakdown must not dominate the answer");
assert(!runtime.includes("回答しました。操作は実行していません。") && runtime.includes('aiDone: "回答"') && runtime.includes('aiDone: "Answer"'), "Success heading must be concise and localized");

[
  "window.DcatsConciergeAiApi = Object.freeze",
  "if (!currentUser || !isSystemAdmin())",
  'sb.functions.invoke("concierge-ai-assist"',
  "var body = { question: question, language: language, screen_id: screenId }",
  "if (image) body.image = image",
  "question.length > 800",
  "CONCIERGE_AI_SCREEN_IDS[screenId]"
].forEach((fragment) => requireFragment(app, fragment));

[
  'createElement("section", "dcats-concierge-ai-card")',
  'openPanel("question")',
  'aiQuestionInput.focus()',
  'aiQuestionInput.maxLength = 800',
  'aiAskButton.addEventListener("click", runAiRequest)',
  'if (aiRequestPending || aiImagePending || (requestUi && requestUi.pending()) || !isSystemAdminSession()) return;',
  'if (aiCard.parentElement) aiCard.parentElement.removeChild(aiCard);',
  "question: question",
  "language: activeLanguage()",
  "screenId: currentAiScreenId(api)",
  'data.performed_action !== false',
  'aiAnswer.textContent = data.answer.trim()',
  'aiAskButton.textContent = copy(aiRequestPending ? "aiWorking" : "aiAsk")',
  'aiAskButton.setAttribute("aria-busy", String(aiRequestPending))',
  'revealAiFeedback()',
  'トークンメーター（直近の質問）',
  '送信時にOpenAIへ送ります。',
  'aiCard.addEventListener("paste"',
  'aiImagePending',
  'aiImagePreview.removeAttribute("src")',
  '画面移動や業務データの変更は自動実行しません。',
  'classify: true',
  'requestUi.prepare({ kind: route.kind',
  'requestUi.resetDraft()'
].forEach((fragment) => requireFragment(runtime, fragment));
requireFragment(app, 'body.classify = request.classify');

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
  requestUi: null,
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
assert(!/screenshot|html2canvas|getDisplayMedia|captureStream/i.test(runtime), "The AI pilot must not capture a screen automatically");
assert(!/aiCost:|推定API料金|estimated API cost|今回の使用量/.test(runtime), "Cost prose must be replaced by the token meter");
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

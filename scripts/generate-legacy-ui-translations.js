const fs = require("fs");
const path = require("path");
const vm = require("vm");
const os = require("os");
const childProcess = require("child_process");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "app.js");
const htmlPath = path.join(root, "index.html");
const outputPath = path.join(root, "legacy-i18n.js");
const runtimeScriptPaths = [
  "app.js",
  "sales-order-revision.js",
  "install-app.js",
  "label-print-window.js",
  "manufacturing-ranking-report.js",
  "product-3d.js",
  "product-3d-viewer.js",
  "assets/concierge-pet/concierge-pet.js"
];
const curatedTranslations = {
  en: {
    "出荷": "Shipping",
    "出荷管理": "Shipping Operations",
    "受注・出荷管理、ピッキング、出荷帳票、完品出荷、在庫更新。商品マスタ・販売価格設定・ユーザー管理は不可": "Manage orders, picking, shipping documents, finished-product shipping, and stock updates. Product master, sales pricing, and user management are unavailable.",
    "受注・出荷": "Orders / Shipping",
    "注文受付・ピッキング・B2 CSV・出荷処理": "Order acceptance, picking, B2 CSV, and shipping",
    "出荷指示書・保証書・コア返却帳票": "Dispatch instructions, warranties, and core-return documents",
    "受取方法": "Delivery destination",
    "通常のお届け先": "Standard delivery address",
    "ヤマト運輸 営業所止め": "Yamato sales office pickup",
    "ヤマト営業所": "Yamato sales office",
    "登録済みのヤマト営業所": "Saved Yamato sales office",
    "別の営業所を指定": "Choose a different sales office",
    "別のヤマト営業所": "Different Yamato sales office",
    "ヤマト公式で営業所を検索": "Search Yamato sales offices",
    "営業所コード（6桁）": "Sales office code (6 digits)",
    "営業所名": "Sales office name",
    "例：〇〇営業所": "Example: XX Sales Office",
    "営業所の郵便番号・都道府県・所在地は、下の住所欄に入力してください。": "Enter the sales office postal code, prefecture, and address in the address fields below.",
    "箕面船場（箕面船場西）営業所（068721）": "Minoh Senba (Minoh Senba Nishi) Sales Office (068721)",
    "箕面船場西営業所（068721）": "Minoh Senba Nishi Sales Office (068721)",
    "〒562-0035 大阪府箕面市船場東": "562-0035 Semba-higashi, Minoh, Osaka",
    "B2 CSV：止置き「1」・営業所コード「068721」": "B2 CSV: Hold at office 1 / Office code 068721",
    "複写伝票：「ヤマト運輸 箕面船場（箕面船場西）営業所止め」と印字": "Multipart waybill: Print Yamato Minoh Senba (Minoh Senba Nishi) Sales Office pickup",
    "箕面船場（箕面船場西）営業所": "Minoh Senba (Minoh Senba Nishi) Sales Office",
    "箕面市船場東": "Semba-higashi, Minoh",
    "有限会社ストレイン": "Strain Co., Ltd.",
    "ヤマト営業所コードを6桁の数字で入力してください。": "Enter the 6-digit Yamato sales office code.",
    "ヤマト営業所名を入力してください。": "Enter the Yamato sales office name.",
    "営業所止めの商品発送便はヤマト運輸を選択してください。": "Select Yamato Transport for sales-office-pickup shipments.",
    "営業所": "Sales office",
    "止め": "pickup",
    "受付時自動発行": "Auto-issued on acceptance",
    "出荷完了時自動発行": "Auto-issued on shipment",
    "受付時に自動発行": "Auto-issue on acceptance",
    "出荷帳票発行で印刷": "Print from Shipping Documents",
    "CSV発行済み": "CSV issued",
    "CSV未発行": "CSV not issued",
    "受注変更あり": "Order changed",
    "A5 / 端末印刷": "A5 / Terminal print",
    "商品数量分": "One per product unit",
    "コア返却必要時": "When core return is required",
    "/ 1商品1枚": "/ 1 sheet per item",
    "用紙・発行方法": "Paper / Output method",
    "再発行が必要": "Reissue required",
    "受注全体を修正": "Edit Entire Order",
    "受注修正": "Edit Order",
    "受注修正画面から変更": "Updated from the order revision screen",
    "受注修正履歴": "Order Revision History",
    "この商品を削除": "Remove this item",
    "調整を追加": "Add adjustment",
    "建物名等": "Building / suite",
    "配送条件": "Delivery Details",
    "お届け時間帯": "Delivery time",
    "変更の確認": "Confirm Changes",
    "変更理由": "Reason for change",
    "変更内容を確認しました。変更前の帳票は使わず、必要な帳票・送り状を再発行します。": "I checked the changes. I will discard outdated documents and reissue the required documents and waybills.",
    "品番を入力してください。": "Enter a part number.",
    "同じ商品・区分は1行にまとめてください。": "Combine the same product and type in one row.",
    "商品は100件までです。": "Up to 100 items are allowed.",
    "追加した商品の単価を入力してください。": "Enter the added item's unit price.",
    "検索に失敗しました。": "Search failed.",
    "商品を1件以上指定してください。": "Specify at least one item.",
    "商品の数量・単価を確認してください。": "Check item quantities and unit prices.",
    "値引・調整額を確認してください。": "Check discount and adjustment amounts.",
    "変更内容と帳票の再発行を確認してください。": "Confirm the changes and document reissue.",
    "受注内容・在庫・金額を確認して保存しています。": "Checking order details, stock and amounts before saving.",
    "商品、コア代金、値引・調整、送料、税を明細行で確認します。": "Review products, core charges, adjustments, shipping, and tax as itemized rows.",
    "受注を修正しました。変更前の帳票は破棄し、必要な帳票・送り状を再発行してください。": "Order updated. Discard outdated documents and reissue the required documents and waybills.",
    "保存結果を確認できません。最新の受注内容を確認してください。": "Could not confirm the save result. Check the latest order details.",
    "12〜14時": "12:00-14:00",
    "14〜16時": "14:00-16:00",
    "16〜18時": "16:00-18:00",
    "18〜20時": "18:00-20:00",
    "19〜21時": "19:00-21:00",
    "18〜21時": "18:00-21:00",
    "受注を検索": "Search Orders",
    "注文状態": "Order Status",
    "選択した受注の処理": "Selected Order Actions",
    "データ連携": "Data Integration",
    "B2発送データ取込ナビ": "B2 Shipping Data Import Guide",
    "クロネコビジネスメンバーズで発行済データCSVをダウンロードし、D-CATSで選択するまでを案内します。": "Follow these steps to download the issued-data CSV from Yamato Business Members and select it in D-CATS.",
    "B2発送データの取込手順": "B2 shipping data import steps",
    "クロネコビジネスメンバーズへログイン": "Sign in to Yamato Business Members",
    "下のボタンからヤマト運輸の公式サイトを別タブで開きます。": "Use the button below to open the official Yamato Transport site in a new tab.",
    "ヤマト運輸の公式サイトを別タブで開き、ログインします。": "Open the official Yamato Transport site in a new tab and sign in.",
    "ログインページを開く": "Open sign-in page",
    "ヤマト画面に戻る": "Return to Yamato",
    "発行済データの検索を開く": "Open Issued Data Search",
    "B2クラウドを開く": "Open B2 Cloud",
    "トップメニューから「送り状発行システム B2クラウド」を開きます。": "From the top menu, open Waybill Issuance System B2 Cloud.",
    "ログイン後のマイページで「送り状発行システム B2クラウド」を押します。": "After signing in, select Waybill Issuance System B2 Cloud on the My Page screen.",
    "ログイン後のマイページで、次の項目を押します。": "After signing in, select the following item on the My Page screen.",
    "ヤマト画面の項目名": "Item name on the Yamato page",
    "送り状発行システム B2クラウド": "Waybill Issuance System B2 Cloud",
    "発行済データをCSV出力": "Export issued data as CSV",
    "「発行済データの検索」で対象を検索し、「外部ファイル出力」でCSVをダウンロードします。": "Search for the records in Issued Data Search, then download the CSV with External File Export.",
    "B2クラウドのメインメニューで「発行済データの検索」を押し、対象を検索して「外部ファイル出力」でCSVをダウンロードします。": "On the B2 Cloud main menu, select Issued Data Search, find the target records, and download the CSV using External File Export.",
    "B2クラウドのメインメニューで、次の項目を押します。": "On the B2 Cloud main menu, select the following item.",
    "発行済データの検索": "Issued Data Search",
    "検索条件を表示": "Show search conditions",
    "ヤマトB2に入力する検索条件": "Search conditions to enter in Yamato B2",
    "出荷予定日": "Planned shipping date",
    "送り状に設定した日付を、開始・終了の両方に入力します。": "Enter the date set on the waybill in both the start and end fields.",
    "送り状の状態": "Waybill status",
    "指定しません。": "Leave this blank.",
    "削除済のデータのみ表示する": "Show deleted data only",
    "チェックしません。": "Leave this unchecked.",
    "検索後の操作": "After searching",
    "検索": "Search",
    "検索ボタンを押します。": "Select Search.",
    "対象を選択": "Select target records",
    "対象データの「選択」にチェックします。": "Check Select for the target records.",
    "外部ファイルに出力": "External File Export",
    "「外部ファイルに出力」を押します。": "Select External File Export.",
    "見出しを出力": "Output headings",
    "1行目に見出しを出力する": "Output headings in the first row",
    "「1行目に見出しを出力する」にチェックします。": "Check Output headings in the first row.",
    "ファイル出力": "Export File",
    "「ファイル出力」を押します。": "Select Export File.",
    "ダウンロード": "Download",
    "「ダウンロード」を押します。": "Select Download.",
    "D-CATSでCSVを選択": "Select the CSV in D-CATS",
    "D-CATSへ戻り、ダウンロードした発行済データCSVを選択します。": "Return to D-CATS and select the issued-data CSV you downloaded.",
    "CSVを選択": "Select CSV",
    "手順1のボタンからログインを開始してください。": "Start by using the button in step 1 to sign in.",
    "うまく進まない場合": "If you cannot continue",
    "ヤマト画面が開かない": "The Yamato page does not open",
    "ブラウザでポップアップを許可し、手順1をもう一度押してください。": "Allow pop-ups in your browser, then use step 1 again.",
    "ログイン画面に戻る": "The sign-in page appears again",
    "セッション切れです。再ログインし、「送り状発行システム B2クラウド」から続けてください。": "Your session has expired. Sign in again, then continue from Waybill Issuance System B2 Cloud.",
    "B2画面でエラーになる": "An error appears in B2",
    "直接URLは使わず、手順1で開いたマイページから進んでください。": "Do not use a direct URL. Continue from the My Page opened in step 1.",
    "CSVを選択できない": "The CSV cannot be selected",
    "「発行済データの検索」の「外部ファイル出力」で作成したCSVを選択してください。": "Select the CSV created with External File Export in Issued Data Search.",
    "B2の内部画面は直接URLで開けません。手順2と3のボタンは、手順1で開いたヤマト画面へ戻ります。": "B2 internal pages cannot be opened by direct URL. The buttons in steps 2 and 3 return you to the Yamato page opened in step 1.",
    "B2の内部画面は直接URLで開けません。強調表示された項目名を、手順1で開いたヤマト画面から順に選択してください。": "B2 internal pages cannot be opened by direct URL. In the Yamato page opened in step 1, select the highlighted item names in order.",
    "1 クロネコビジネスメンバーズを開く": "1 Open Yamato Business Members",
    "4 ダウンロードしたCSVを選択": "4 Select the downloaded CSV",
    "直接URLでは開けません。ヤマト画面は手順1で開いた同じタブのまま操作してください。": "This screen cannot be opened with a direct URL. Continue in the same Yamato tab opened in step 1.",
    "ヤマト画面を開けませんでした。ブラウザでポップアップを許可し、もう一度お試しください。": "The Yamato page could not be opened. Allow pop-ups in your browser and try again.",
    "ヤマト画面を開きました。ログイン後、マイページで「送り状発行システム B2クラウド」を押してください。": "The Yamato page is open. After signing in, select Waybill Issuance System B2 Cloud on My Page.",
    "ヤマト画面を開き直しました。ログイン状態を確認してから続けてください。": "The Yamato page was reopened. Check that you are signed in before continuing.",
    "ヤマト画面へ戻れませんでした。手順1から開き直してください。": "Could not return to the Yamato page. Reopen it from step 1.",
    "マイページで「送り状発行システム B2クラウド」を押してください。ログイン画面が表示された場合は再ログインしてください。": "On My Page, select Waybill Issuance System B2 Cloud. If the sign-in page appears, sign in again.",
    "B2クラウドで「発行済データの検索」を押し、対象を検索して「外部ファイル出力」を実行してください。": "In B2 Cloud, select Issued Data Search, find the records, and run External File Export.",
    "ヤマト画面は別タブで開いています。続ける手順のボタンを押してください。": "The Yamato page is open in another tab. Use the button for the step you want to continue.",
    "ヤマト画面は別タブで開いています。強調表示された項目名に沿って操作してください。": "The Yamato page is open in another tab. Follow the highlighted item names.",
    "検索条件を表示しました。ヤマトB2の画面に同じ条件を入力してください。": "The search conditions are displayed. Enter the same conditions in Yamato B2.",
    "ダウンロードしたB2発行済データCSVを選択してください。": "Select the downloaded B2 issued-data CSV.",
    "CSVが選択されませんでした。": "No CSV was selected.",
    "CSVファイルを選択してください。": "Select a CSV file.",
    "選択したCSVは空です。B2クラウドからもう一度出力してください。": "The selected CSV is empty. Export it from B2 Cloud again.",
    "CSVのサイズが大きすぎます。B2クラウドで対象期間を短くして再出力してください。": "The CSV is too large. Export it again from B2 Cloud with a shorter date range.",
    "ネットワークに接続できません。接続を確認して、同じCSVをもう一度選択してください。": "No network connection is available. Check the connection and select the same CSV again.",
    "D-CATSのログイン有効期限が切れました。再ログイン後、同じCSVをもう一度選択してください。": "Your D-CATS session has expired. Sign in again and select the same CSV.",
    "発送データを確認できませんでした。通信状態を確認して、同じCSVをもう一度選択してください。": "The shipping data could not be checked. Check the connection and select the same CSV again.",
    "ログインID・パスワードなどの認証情報を、D-CATSへ入力・送信・保存することはありません。": "D-CATS does not ask for, transmit, or store sign-in credentials such as your login ID or password.",
    "注文を選択": "Select an Order",
    "左の注文一覧から、確認または処理する受注を選択してください。": "Select an order from the list on the left to review or process it.",
    "受注処理の進捗": "Order Processing Progress",
    "受注処理は取消で終了": "Order processing ended by cancellation",
    "処理終了": "Processing Complete",
    "D-CATSコンシェルジュ": "D-CATS Concierge",
    "処理しています。少しお待ちください。": "Processing. Please wait.",
    "確認をお待ちしています。": "Waiting for your confirmation.",
    "内容を確認しています。": "Reviewing the details.",
    "うまくいきませんでした。もう一度確認します。": "That did not work. I will check again.",
    "完了しました。": "Done.",
    "いつでもお手伝いします。": "I am always here to help.",
    "コンシェルジュ": "Concierge",
    "コンシェルジュ設定": "Concierge settings",
    "設定を閉じる": "Close settings",
    "コンシェルジュを選ぶ（1体のみ表示）": "Choose a concierge (only one appears)",
    "スズト": "Suzuto",
    "リンナ": "Rinna",
    "動き方": "Movement",
    "よく動く": "Active",
    "定位置": "Stay put",
    "非表示": "Hide",
    "選択した1体だけを読み込みます。「よく動く」は操作部品を避けて歩き、「定位置」は画面右下で反応だけを表示します。OSの「視差効果を減らす」が有効な場合も静止します。": "Only the selected concierge is loaded. Active mode walks around while avoiding controls. Stay put keeps the concierge in the lower-right corner for reactions only. Motion also stops when your OS requests reduced motion.",
    "{name}の設定を開く": "Open {name}'s settings",
    "コンシェルジュを表示": "Show concierge",
    "{name}に切り替えました。": "Switched to {name}.",
    "元気にご案内します。": "I will guide you actively.",
    "画面の隅で待機します。": "I will wait in the corner.",
    "dkd商品id": "DKD Product ID",
    "受注金額の修正": "Edit Order Amounts",
    "受注を取り消す": "Cancel Order",
    "受注金額": "Order Total",
    "対象の受注内容を確認してから実行してください。": "Confirm the order details before continuing.",
    "取消後は在庫引当を解除し、処理履歴へ記録します。対象受注を確認してから実行してください。": "Cancelling releases the inventory allocation and records the action in the history. Confirm the target order before continuing.",
    "この受注は出荷済みです。商品がまだ社内にあることを確認してください。取消後、在庫とシリアルを戻します。運送会社へ渡した後は、受注取消ではなく返品処理を行ってください。": "This order is marked shipped. Confirm the product is still in-house. Cancelling restores inventory and serial assignments. After handoff to the carrier, use the return process instead.",
    "取消後は在庫引当を解除し、処理履歴へ記録します。元に戻す場合は再受注が必要です。": "Cancelling releases the inventory allocation and records the action in the history. A new order is required to restore it.",
    "商品がまだ社内にあることを確認しました": "I confirmed that the product is still in-house",
    "表示中の受注を取り消すことを確認しました": "I confirmed that I want to cancel the displayed order",
    "対象受注を確認してから実行してください。": "Confirm the target order before continuing.",
    "在庫・シリアル・送り状の状態を確認して取り消しています。": "Checking inventory, serial, and waybill status and cancelling the order.",
    "受注を取り消せませんでした。": "Could not cancel the order.",
    "取消処理中...": "Cancelling...",
    "取消をやめる": "Keep Order",
    "この受注を取り消す": "Cancel This Order",
    "その他の操作": "More Actions",
    "商品発送送り状": "Outbound Shipping Waybill",
    "発送用送り状": "Outbound Waybill",
    "返却用送り状": "Return Waybill",
    "コア返却用複写伝票": "Multipart Core Return Waybill",
    "ヤマト運輸 / 宅急便 元払い": "Yamato Transport / TA-Q-BIN Prepaid",
    "佐川急便 / 飛脚宅配便 元払い": "Sagawa Express / Hikyaku Courier Prepaid",
    "ヤマト運輸 / 宅急便 着払い": "Yamato Transport / TA-Q-BIN Collect",
    "佐川急便 / 飛脚宅配便 着払い": "Sagawa Express / Hikyaku Courier Collect",
    "返却用伝票なし": "No Core Return Waybill",
    "発行方法未設定": "Issuance Method Not Set",
    "B2 CSV発行済み": "B2 CSV Issued",
    "発送データ取込済み": "Shipping Data Imported",
    "発送データ未取込": "Shipping Data Not Imported",
    "B2 CSV未発行": "B2 CSV Not Issued",
    "発送・返却の送り状進捗": "Shipping & Return Waybill Progress",
    "B2送り状と複写送り状を、運送会社・発行方法ごとに表示します。": "Shows B2 and multipart waybills by carrier and issuance method.",
    "発行方法": "Issuance Method",
    "B2送り状番号": "B2 Waybill Number",
    "複写送り状番号": "Multipart Waybill Number",
    "B2発行済データの取込後に、送り状番号を確認・修正できます。": "After importing issued B2 data, you can review or correct the waybill number.",
    "送り状番号を登録": "Register Waybill Number",
    "番号の登録・変更は「出荷帳票発行」で行います。": "Register or change the number in Shipping Documents.",
    "発送用送り状の番号は12桁で入力してください。": "Enter the 12-digit outbound waybill number.",
    "商品発送送り状番号": "Outbound Shipping Waybill Number",
    "複写送り状番号未登録": "Multipart Waybill Number Not Registered",
    "複写送り状印刷待ち": "Multipart Waybill Awaiting Print",
    "複写送り状記入済み": "Multipart Waybill Entry Complete",
    "複写送り状記入待ち": "Awaiting Multipart Waybill Entry",
    "送り状番号登録済み": "Waybill Number Registered",
    "伝票番号未登録": "Waybill Number Not Registered",
    "受注内容": "Order Contents",
    "コア返却分": "Core Return",
    "受注明細がありません。": "No order items are available.",
    "コア返却対象の商品を確認できません。受注明細を再読込してください。": "Could not confirm the products requiring core return. Reload the order details.",
    "この商品の手書きを完了しました。次の商品へ進みます。": "Handwriting for this product is complete. Proceeding to the next product.",
    "対象商品1個につき1枚": "One sheet per eligible product unit",
    "対象商品1個につき1枚 /": "One sheet per eligible product unit /",
    "対象商品1個につき1枚 / 佐川急便 着払い": "One sheet per eligible product unit / Sagawa collect-on-delivery",
    "着払い伝票の種類と伝票番号を登録し、コア返却対象の商品1個につき1枚を発行します。": "Register the collect-on-delivery waybill type and number, then issue one sheet per product unit requiring core return.",
    "枚": "sheets",
    "枚 /": "sheets /",
    "枚を印刷待ちに登録しました。": "sheets were queued for printing.",
    "コア返却用複写伝票の印刷が完了しました。必要な場合は「再印刷」からもう一度発行できます。": "The multipart core return waybill has finished printing. Use \"Reprint\" to print it again if needed.",
    "コア返却用複写伝票を印刷できませんでした。印刷端末を確認して「再送」してください。": "The multipart core return waybill could not be printed. Check the printing terminal, then select \"Resend\".",
    "再送": "Resend",
    "印刷位置調整": "Print Position Adjustment",
    "自動印刷設定": "Automatic Print Settings",
    "受付時の自動印刷": "Automatic Printing on Order Acceptance",
    "帳票の標準設定": "Default Document Settings",
    "未印刷あり": "Has unprinted documents",
    "未印刷": "Not printed",
    "印刷済み": "Printed",
    "待機中": "Pending",
    "出荷処理中": "Preparing Shipment",
    "出荷指示待ち": "Awaiting Dispatch Instruction",
    "帳票の印刷は完了しています。次は商品と製造シリアルを照合してください。": "Document printing is complete. Next, match the products with their manufacturing serial numbers.",
    "帳票の印刷は完了しています。次はB2発行済データを取り込んでください。": "Document printing is complete. Next, import the issued B2 data.",
    "保証書・コア返却シートは発行できます。出荷完了には商品と製造シリアルの照合が必要です。": "Warranty certificates and core return sheets are available. Complete product and manufacturing serial verification to finish shipping.",
    "保証書・コア返却シートは発行できます。出荷完了にはB2発行済データを取り込んでください。": "Warranty certificates and core return sheets are available. Import the B2 issued data to finish shipping.",
    "この注文はコア返却不要のため、コア返却シートを発行しません。": "This order does not require a core return, so no core return sheet will be issued.",
    "専用BOX": "Dedicated Box",
    "規定サイズ": "Standard Size",
    "北海道": "Hokkaido",
    "北東北": "Northern Tohoku",
    "南東北": "Southern Tohoku",
    "関東": "Kanto",
    "信越": "Shinetsu",
    "北陸": "Hokuriku",
    "中部": "Chubu",
    "関西": "Kansai",
    "中国": "Chugoku",
    "四国": "Shikoku",
    "九州": "Kyushu",
    "沖縄": "Okinawa",
    "各ランキング内で連番（重複なし）": "Sequential (no duplicates)",
    "商品別出荷実績集計": "Product-level Shipment Summary",
    "オルタ": "Alternator",
    "Sジェネ": "Starter Generator",
    "他オルタ": "Other Alternators",
    "セル": "Starter",
    "デスビ": "Distributor",
    "インジェ": "Injector",
    "スロボ": "Throttle Body",
    "センサ": "Sensor",
    "ランプ": "Lamp",
    "B2契約情報": "B2 Contract Settings",
    "B2 CSV事前検査": "B2 CSV Preflight Check",
    "チェックした受注を発行します。": "Issue the checked orders.",
    "現在表示中の受注を発行します。": "Issue the currently displayed order.",
    "注文を表示するか、一覧の処理対象にチェックを入れてください。": "Display an order or check the orders to process in the list.",
    "発行できない項目を注文ごとに表示しています。修正後にもう一度発行してください。": "Items blocking issuance are shown for each order. Correct them and issue the file again.",
    "ヤマトB2クラウド基本レイアウトへ出力する発送元と契約コードを設定します。": "Configure the sender and contract codes exported to the Yamato B2 Cloud basic layout.",
    "設定を確認しています。": "Checking the settings.",
    "発送元電話番号": "Sender Phone Number",
    "発送元郵便番号": "Sender Postal Code",
    "発送元住所": "Sender Address",
    "発送元建物名": "Sender Building",
    "発送元名称": "Sender Name",
    "請求先顧客コードと運賃管理番号は、ヤマト運輸の契約運賃資料またはB2クラウドの設定内容を確認して入力してください。": "Enter the billing customer code and fare management number from your Yamato contract-rate documents or B2 Cloud settings.",
    "空欄または3桁": "Blank or 3 digits",
    "B2クラウド連携の応答がありません。通信状態を確認して、もう一度実行してください。": "B2 Cloud did not respond. Check the connection and try again.",
    "B2 CSV発行に必要な契約情報は設定済みです。": "The contract information required for B2 CSV issuance is configured.",
    "未設定または形式確認が必要です:": "Missing or invalid settings:",
    "必須項目": "Required fields",
    "B2契約情報の読み込みに時間がかかっています。画面を閉じて、もう一度開いてください。": "Loading the B2 contract settings is taking too long. Close this window and open it again.",
    "B2契約情報はシステム管理者が設定します。": "B2 contract settings are managed by a system administrator.",
    "B2契約情報を読み込んでいます。": "Loading B2 contract settings.",
    "内容を変更した場合は「設定を保存」を押してください。": "After changing any values, select Save Settings.",
    "B2契約情報を読み込めませんでした。": "Could not load the B2 contract settings.",
    "発送元電話番号を10桁または11桁で入力してください。": "Enter a 10- or 11-digit sender phone number.",
    "発送元郵便番号を7桁で入力してください。": "Enter the sender postal code as 7 digits.",
    "発送元住所を入力してください。": "Enter the sender address.",
    "発送元名称を入力してください。": "Enter the sender name.",
    "請求先顧客コードを10桁から12桁で入力してください。": "Enter a 10- to 12-digit billing customer code.",
    "請求先分類コードは空欄または3桁で入力してください。": "Leave the billing classification code blank or enter 3 digits.",
    "運賃管理番号を2桁で入力してください。": "Enter the 2-digit fare management number.",
    "B2契約情報を保存しています。": "Saving B2 contract settings.",
    "B2契約情報の保存に時間がかかっています。通信状態を確認して、もう一度保存してください。": "Saving the B2 contract settings is taking too long. Check the connection and save again.",
    "B2契約情報を保存しました。CSV発行前の事前検査に反映されます。": "B2 contract settings were saved and will be used by the CSV preflight check.",
    "B2契約情報を保存できませんでした。": "Could not save the B2 contract settings.",
    "内容を確認してください。": "Review the details.",
    "B2 CSVの必須項目を確認できませんでした。": "Could not validate the required B2 CSV fields.",
    "必須項目を確認中...": "Checking required fields...",
    "B2 CSVの必須項目を確認しています。": "Checking required B2 CSV fields.",
    "B2 CSVの事前検査に時間がかかっています。通信状態を確認して、もう一度発行してください。": "The B2 CSV preflight check is taking too long. Check the connection and issue it again.",
    "B2 CSVの発行に時間がかかっています。発行履歴を確認してから、もう一度操作してください。": "B2 CSV issuance is taking too long. Check the issuance history before trying again.",
    "B2 CSVを保存できませんでした。ブラウザのダウンロード許可を確認してください。": "Could not save the B2 CSV. Check the browser's download permission.",
    "B2 CSVを発行しました。ダウンロードフォルダを確認してください。": "The B2 CSV was issued. Check the Downloads folder.",
    "B2 CSVの再取得に時間がかかっています。通信状態を確認して、もう一度実行してください。": "Retrieving the B2 CSV is taking too long. Check the connection and try again.",
    "B2 CSVを再ダウンロードしました。": "The B2 CSV was downloaded again.",
    "本保証は、本書に記載された保証期間内の製品不具合について、下記条件に基づき対応するものです。大切に保管してください。": "This warranty covers product defects within the warranty period stated in this document under the conditions below. Please keep it in a safe place.",
    "識別情報": "Identification",
    "ご購入者": "Purchaser",
    "情報": "Information",
    "連絡先": "Contact",
    "（電話番号・メール等）": "(Phone number, email, etc.)",
    "販売店名／取付店名・住所・電話番号・担当者": "Seller / installer name, address, phone number, and contact person",
    "店印がない場合は、納品書・領収書・整備伝票等の購入証明と本書を保管してください。": "If no store stamp is provided, keep this document together with proof of purchase such as a delivery note, receipt, or service record.",
    "印鑑欄（任意）": "Stamp Area (Optional)",
    "販売店印": "Seller Stamp",
    "（任意）": "(Optional)",
    "取付店印": "Installer Stamp",
    "本書、対象製品、製造シリアル、車両・取付情報をご提示ください。": "Present this document, the covered product, the manufacturing serial number, and the vehicle and installation information."
  },
  zh: {
    "出荷": "出货",
    "出荷管理": "出货管理",
    "受注・出荷管理、ピッキング、出荷帳票、完品出荷、在庫更新。商品マスタ・販売価格設定・ユーザー管理は不可": "可管理订单、拣货、出货单据、成品出货和库存更新。不可管理商品主数据、销售价格和用户。",
    "受注・出荷": "订单・出货",
    "注文受付・ピッキング・B2 CSV・出荷処理": "订单受理、拣货、B2 CSV和出货处理",
    "出荷指示書・保証書・コア返却帳票": "出货指示书、保修书和旧件返还单据",
    "受取方法": "收货方式",
    "通常のお届け先": "普通收货地址",
    "ヤマト運輸 営業所止め": "雅玛多营业所自取",
    "ヤマト営業所": "雅玛多营业所",
    "登録済みのヤマト営業所": "已保存的雅玛多营业所",
    "別の営業所を指定": "指定其他营业所",
    "別のヤマト営業所": "其他雅玛多营业所",
    "ヤマト公式で営業所を検索": "在雅玛多官网搜索营业所",
    "営業所コード（6桁）": "营业所代码（6位）",
    "営業所名": "营业所名称",
    "例：〇〇営業所": "例：〇〇营业所",
    "営業所の郵便番号・都道府県・所在地は、下の住所欄に入力してください。": "请在下方地址栏输入营业所的邮政编码、都道府县和地址。",
    "箕面船場（箕面船場西）営業所（068721）": "箕面船场（箕面船场西）营业所（068721）",
    "箕面船場西営業所（068721）": "箕面船场西营业所（068721）",
    "〒562-0035 大阪府箕面市船場東": "邮编562-0035 大阪府箕面市船场东",
    "B2 CSV：止置き「1」・営業所コード「068721」": "B2 CSV：营业所留置“1”・营业所代码“068721”",
    "複写伝票：「ヤマト運輸 箕面船場（箕面船場西）営業所止め」と印字": "复写运单：打印“雅玛多运输 箕面船场（箕面船场西）营业所自取”",
    "箕面船場（箕面船場西）営業所": "箕面船场（箕面船场西）营业所",
    "箕面市船場東": "箕面市船场东",
    "有限会社ストレイン": "有限会社Strain",
    "ヤマト営業所コードを6桁の数字で入力してください。": "请输入6位雅玛多营业所代码。",
    "ヤマト営業所名を入力してください。": "请输入雅玛多营业所名称。",
    "営業所止めの商品発送便はヤマト運輸を選択してください。": "营业所自取的商品发货请选择雅玛多运输。",
    "営業所": "营业所",
    "止め": "自取",
    "受付時自動発行": "接单时自动发行",
    "出荷完了時自動発行": "出货完成时自动发行",
    "受付時に自動発行": "接单时自动发行",
    "出荷帳票発行で印刷": "在出货单据页面打印",
    "CSV発行済み": "CSV已发行",
    "CSV未発行": "CSV未发行",
    "受注変更あり": "订单已变更",
    "A5 / 端末印刷": "A5 / 终端打印",
    "商品数量分": "每件商品一份",
    "コア返却必要時": "需要返还旧件时",
    "/ 1商品1枚": "/ 每件商品一张",
    "用紙・発行方法": "纸张・发行方式",
    "再発行が必要": "需要重新签发",
    "受注全体を修正": "修改整张订单",
    "受注修正": "修改订单",
    "受注修正画面から変更": "通过订单修改画面更新",
    "受注修正履歴": "订单修改记录",
    "この商品を削除": "删除此商品",
    "調整を追加": "添加调整",
    "建物名等": "楼宇等",
    "配送条件": "配送条件",
    "お届け時間帯": "配送时段",
    "変更の確認": "确认修改",
    "変更理由": "修改原因",
    "変更内容を確認しました。変更前の帳票は使わず、必要な帳票・送り状を再発行します。": "已确认修改内容。将停用旧单据，并重新签发所需单据和运单。",
    "品番を入力してください。": "请输入零件编号。",
    "同じ商品・区分は1行にまとめてください。": "请将相同商品及类别合并为一行。",
    "商品は100件までです。": "最多可添加100项商品。",
    "追加した商品の単価を入力してください。": "请输入新增商品的单价。",
    "検索に失敗しました。": "搜索失败。",
    "商品を1件以上指定してください。": "请至少指定一项商品。",
    "商品の数量・単価を確認してください。": "请检查商品数量和单价。",
    "値引・調整額を確認してください。": "请检查折扣及调整金额。",
    "変更内容と帳票の再発行を確認してください。": "请确认修改内容及单据重新签发。",
    "受注内容・在庫・金額を確認して保存しています。": "正在核对订单、库存和金额并保存。",
    "商品、コア代金、値引・調整、送料、税を明細行で確認します。": "以明细行查看商品、旧件费用、折扣调整、运费和税额。",
    "受注を修正しました。変更前の帳票は破棄し、必要な帳票・送り状を再発行してください。": "订单已修改。请作废旧单据并重新签发所需单据和运单。",
    "保存結果を確認できません。最新の受注内容を確認してください。": "无法确认保存结果。请检查最新订单内容。",
    "12〜14時": "12:00-14:00",
    "14〜16時": "14:00-16:00",
    "16〜18時": "16:00-18:00",
    "18〜20時": "18:00-20:00",
    "19〜21時": "19:00-21:00",
    "18〜21時": "18:00-21:00",
    "受注を検索": "搜索订单",
    "注文状態": "订单状态",
    "選択した受注の処理": "所选订单操作",
    "データ連携": "数据联动",
    "B2発送データ取込ナビ": "B2发货数据导入指南",
    "クロネコビジネスメンバーズで発行済データCSVをダウンロードし、D-CATSで選択するまでを案内します。": "按照以下步骤从雅玛多商务会员下载已发行数据CSV，并在D-CATS中选择该文件。",
    "B2発送データの取込手順": "B2发货数据导入步骤",
    "クロネコビジネスメンバーズへログイン": "登录雅玛多商务会员",
    "下のボタンからヤマト運輸の公式サイトを別タブで開きます。": "使用下方按钮在新标签页中打开雅玛多运输官方网站。",
    "ヤマト運輸の公式サイトを別タブで開き、ログインします。": "在新标签页中打开雅玛多运输官方网站并登录。",
    "ログインページを開く": "打开登录页面",
    "ヤマト画面に戻る": "返回雅玛多页面",
    "発行済データの検索を開く": "打开发行数据搜索",
    "B2クラウドを開く": "打开B2 Cloud",
    "トップメニューから「送り状発行システム B2クラウド」を開きます。": "从顶部菜单打开“运单发行系统 B2 Cloud”。",
    "ログイン後のマイページで「送り状発行システム B2クラウド」を押します。": "登录后，在会员首页点击“运单发行系统 B2 Cloud”。",
    "ログイン後のマイページで、次の項目を押します。": "登录后，在会员首页点击以下项目。",
    "ヤマト画面の項目名": "雅玛多页面中的项目名称",
    "送り状発行システム B2クラウド": "运单发行系统 B2 Cloud",
    "発行済データをCSV出力": "将已发行数据导出为CSV",
    "「発行済データの検索」で対象を検索し、「外部ファイル出力」でCSVをダウンロードします。": "在“搜索已发行数据”中查找目标记录，然后通过“导出外部文件”下载CSV。",
    "B2クラウドのメインメニューで「発行済データの検索」を押し、対象を検索して「外部ファイル出力」でCSVをダウンロードします。": "在B2 Cloud主菜单中点击“搜索已发行数据”，查找目标记录后通过“导出外部文件”下载CSV。",
    "B2クラウドのメインメニューで、次の項目を押します。": "在B2 Cloud主菜单中点击以下项目。",
    "発行済データの検索": "搜索已发行数据",
    "検索条件を表示": "显示搜索条件",
    "ヤマトB2に入力する検索条件": "在雅玛多B2中输入的搜索条件",
    "出荷予定日": "预计发货日期",
    "送り状に設定した日付を、開始・終了の両方に入力します。": "将运单中设置的日期同时填入开始和结束栏。",
    "送り状の状態": "运单状态",
    "指定しません。": "不指定。",
    "削除済のデータのみ表示する": "仅显示已删除的数据",
    "チェックしません。": "不勾选。",
    "検索後の操作": "搜索后的操作",
    "検索": "搜索",
    "検索ボタンを押します。": "点击“搜索”。",
    "対象を選択": "选择目标数据",
    "対象データの「選択」にチェックします。": "勾选目标数据的“选择”。",
    "外部ファイルに出力": "导出到外部文件",
    "「外部ファイルに出力」を押します。": "点击“导出到外部文件”。",
    "見出しを出力": "输出标题",
    "1行目に見出しを出力する": "在第一行输出标题",
    "「1行目に見出しを出力する」にチェックします。": "勾选“在第一行输出标题”。",
    "ファイル出力": "文件输出",
    "「ファイル出力」を押します。": "点击“文件输出”。",
    "ダウンロード": "下载",
    "「ダウンロード」を押します。": "点击“下载”。",
    "D-CATSでCSVを選択": "在D-CATS中选择CSV",
    "D-CATSへ戻り、ダウンロードした発行済データCSVを選択します。": "返回D-CATS并选择已下载的发行数据CSV。",
    "CSVを選択": "选择CSV",
    "手順1のボタンからログインを開始してください。": "请先使用步骤1中的按钮登录。",
    "うまく進まない場合": "无法继续时",
    "ヤマト画面が開かない": "雅玛多页面无法打开",
    "ブラウザでポップアップを許可し、手順1をもう一度押してください。": "请在浏览器中允许弹出窗口，然后再次执行步骤1。",
    "ログイン画面に戻る": "再次显示登录页面",
    "セッション切れです。再ログインし、「送り状発行システム B2クラウド」から続けてください。": "会话已过期。请重新登录，然后从“运单发行系统 B2 Cloud”继续。",
    "B2画面でエラーになる": "B2页面出现错误",
    "直接URLは使わず、手順1で開いたマイページから進んでください。": "请勿使用直接URL，请从步骤1打开的会员首页继续。",
    "CSVを選択できない": "无法选择CSV",
    "「発行済データの検索」の「外部ファイル出力」で作成したCSVを選択してください。": "请选择在“搜索已发行数据”中通过“导出外部文件”创建的CSV。",
    "B2の内部画面は直接URLで開けません。手順2と3のボタンは、手順1で開いたヤマト画面へ戻ります。": "B2内部页面无法通过直接URL打开。步骤2和3中的按钮会返回步骤1打开的雅玛多页面。",
    "B2の内部画面は直接URLで開けません。強調表示された項目名を、手順1で開いたヤマト画面から順に選択してください。": "B2内部页面无法通过直接URL打开。请在步骤1打开的雅玛多页面中依次选择突出显示的项目名称。",
    "1 クロネコビジネスメンバーズを開く": "1 打开雅玛多商务会员",
    "4 ダウンロードしたCSVを選択": "4 选择已下载的CSV",
    "直接URLでは開けません。ヤマト画面は手順1で開いた同じタブのまま操作してください。": "此页面无法通过直接URL打开。请继续使用步骤1中打开的同一个雅玛多标签页。",
    "ヤマト画面を開けませんでした。ブラウザでポップアップを許可し、もう一度お試しください。": "无法打开雅玛多页面。请在浏览器中允许弹出窗口后重试。",
    "ヤマト画面を開きました。ログイン後、マイページで「送り状発行システム B2クラウド」を押してください。": "雅玛多页面已打开。登录后请在会员首页点击“运单发行系统 B2 Cloud”。",
    "ヤマト画面を開き直しました。ログイン状態を確認してから続けてください。": "已重新打开雅玛多页面。请确认登录状态后继续。",
    "ヤマト画面へ戻れませんでした。手順1から開き直してください。": "无法返回雅玛多页面。请从步骤1重新打开。",
    "マイページで「送り状発行システム B2クラウド」を押してください。ログイン画面が表示された場合は再ログインしてください。": "请在会员首页点击“运单发行系统 B2 Cloud”。如果显示登录页面，请重新登录。",
    "B2クラウドで「発行済データの検索」を押し、対象を検索して「外部ファイル出力」を実行してください。": "请在B2 Cloud中点击“搜索已发行数据”，查找目标记录并执行“导出外部文件”。",
    "ヤマト画面は別タブで開いています。続ける手順のボタンを押してください。": "雅玛多页面已在另一个标签页中打开。请点击要继续步骤中的按钮。",
    "ヤマト画面は別タブで開いています。強調表示された項目名に沿って操作してください。": "雅玛多页面已在另一个标签页中打开。请按照突出显示的项目名称操作。",
    "検索条件を表示しました。ヤマトB2の画面に同じ条件を入力してください。": "搜索条件已显示。请在雅玛多B2页面中输入相同条件。",
    "ダウンロードしたB2発行済データCSVを選択してください。": "请选择已下载的B2发行数据CSV。",
    "CSVが選択されませんでした。": "未选择CSV。",
    "CSVファイルを選択してください。": "请选择CSV文件。",
    "選択したCSVは空です。B2クラウドからもう一度出力してください。": "所选CSV为空。请从B2 Cloud重新导出。",
    "CSVのサイズが大きすぎます。B2クラウドで対象期間を短くして再出力してください。": "CSV文件过大。请在B2 Cloud中缩短日期范围后重新导出。",
    "ネットワークに接続できません。接続を確認して、同じCSVをもう一度選択してください。": "无法连接网络。请检查连接后重新选择同一个CSV。",
    "D-CATSのログイン有効期限が切れました。再ログイン後、同じCSVをもう一度選択してください。": "D-CATS登录会话已过期。请重新登录后再次选择同一个CSV。",
    "発送データを確認できませんでした。通信状態を確認して、同じCSVをもう一度選択してください。": "无法确认发货数据。请检查网络后再次选择同一个CSV。",
    "ログインID・パスワードなどの認証情報を、D-CATSへ入力・送信・保存することはありません。": "D-CATS不会要求输入、传输或保存登录ID、密码等认证信息。",
    "注文を選択": "选择订单",
    "左の注文一覧から、確認または処理する受注を選択してください。": "请从左侧订单列表中选择要确认或处理的订单。",
    "受注処理の進捗": "订单处理进度",
    "受注処理は取消で終了": "订单处理已因取消而结束",
    "処理終了": "处理结束",
    "D-CATSコンシェルジュ": "D-CATS礼宾助手",
    "処理しています。少しお待ちください。": "正在处理，请稍候。",
    "確認をお待ちしています。": "正在等待您的确认。",
    "内容を確認しています。": "正在确认内容。",
    "うまくいきませんでした。もう一度確認します。": "处理未成功，我会再次确认。",
    "完了しました。": "已完成。",
    "いつでもお手伝いします。": "随时为您提供帮助。",
    "コンシェルジュ": "礼宾助手",
    "コンシェルジュ設定": "礼宾助手设置",
    "設定を閉じる": "关闭设置",
    "コンシェルジュを選ぶ（1体のみ表示）": "选择礼宾助手（仅显示一位）",
    "スズト": "Suzuto",
    "リンナ": "Rinna",
    "動き方": "移动方式",
    "よく動く": "活跃移动",
    "定位置": "固定位置",
    "非表示": "隐藏",
    "選択した1体だけを読み込みます。「よく動く」は操作部品を避けて歩き、「定位置」は画面右下で反応だけを表示します。OSの「視差効果を減らす」が有効な場合も静止します。": "仅加载所选的一位礼宾助手。“活跃移动”会避开操作控件在画面中行走；“固定位置”只在右下角作出反应。操作系统启用减少动态效果时也会停止移动。",
    "{name}の設定を開く": "打开{name}的设置",
    "コンシェルジュを表示": "显示礼宾助手",
    "{name}に切り替えました。": "已切换为{name}。",
    "元気にご案内します。": "我会积极为您引导。",
    "画面の隅で待機します。": "我会在画面角落等候。",
    "dkd商品id": "DKD商品ID",
    "受注金額の修正": "修改订单金额",
    "受注を取り消す": "取消订单",
    "受注金額": "订单金额",
    "対象の受注内容を確認してから実行してください。": "请确认订单内容后再继续。",
    "取消後は在庫引当を解除し、処理履歴へ記録します。対象受注を確認してから実行してください。": "取消后将解除库存预留，并记录到处理历史中。请确认目标订单后再继续。",
    "この受注は出荷済みです。商品がまだ社内にあることを確認してください。取消後、在庫とシリアルを戻します。運送会社へ渡した後は、受注取消ではなく返品処理を行ってください。": "此订单已标记为已发货。请确认商品仍在公司内。取消后将恢复库存和序列号分配。交给承运商后，请改用退货流程。",
    "取消後は在庫引当を解除し、処理履歴へ記録します。元に戻す場合は再受注が必要です。": "取消后将解除库存预留，并记录到处理历史中。如需恢复，必须重新下单。",
    "商品がまだ社内にあることを確認しました": "我已确认商品仍在公司内",
    "表示中の受注を取り消すことを確認しました": "我已确认要取消当前显示的订单",
    "対象受注を確認してから実行してください。": "请确认目标订单后再继续。",
    "在庫・シリアル・送り状の状態を確認して取り消しています。": "正在确认库存、序列号和运单状态并取消订单。",
    "受注を取り消せませんでした。": "无法取消订单。",
    "取消処理中...": "正在取消...",
    "取消をやめる": "保留订单",
    "この受注を取り消す": "取消此订单",
    "その他の操作": "更多操作",
    "商品発送送り状": "商品发货运单",
    "発送用送り状": "发货用运单",
    "返却用送り状": "退货用运单",
    "コア返却用複写伝票": "旧件返还用复写运单",
    "ヤマト運輸 / 宅急便 元払い": "雅玛多运输 / 宅急便 预付",
    "佐川急便 / 飛脚宅配便 元払い": "佐川急便 / 飞脚宅配便 预付",
    "ヤマト運輸 / 宅急便 着払い": "雅玛多运输 / 宅急便 到付",
    "佐川急便 / 飛脚宅配便 着払い": "佐川急便 / 飞脚宅配便 到付",
    "返却用伝票なし": "无旧件返还运单",
    "発行方法未設定": "未设置发行方式",
    "B2 CSV発行済み": "B2 CSV已发行",
    "発送データ取込済み": "发货数据已导入",
    "発送データ未取込": "发货数据未导入",
    "B2 CSV未発行": "B2 CSV未发行",
    "発送・返却の送り状進捗": "发货与返还运单进度",
    "B2送り状と複写送り状を、運送会社・発行方法ごとに表示します。": "按运输公司和发行方式显示B2运单与复写运单。",
    "発行方法": "发行方式",
    "B2送り状番号": "B2运单号码",
    "複写送り状番号": "复写运单号码",
    "B2発行済データの取込後に、送り状番号を確認・修正できます。": "导入B2已发行数据后，可确认或修改运单号码。",
    "送り状番号を登録": "登记运单号码",
    "番号の登録・変更は「出荷帳票発行」で行います。": "请在“出货单据发行”中登记或修改号码。",
    "発送用送り状の番号は12桁で入力してください。": "请输入12位发货用运单号码。",
    "商品発送送り状番号": "商品发货运单号码",
    "複写送り状番号未登録": "复写运单号码未登记",
    "複写送り状印刷待ち": "复写运单等待打印",
    "複写送り状記入済み": "复写运单填写完成",
    "複写送り状記入待ち": "复写运单等待填写",
    "送り状番号登録済み": "运单号码已登记",
    "伝票番号未登録": "运单号码未登记",
    "受注内容": "订单内容",
    "コア返却分": "旧件返还",
    "受注明細がありません。": "没有订单明细。",
    "コア返却対象の商品を確認できません。受注明細を再読込してください。": "无法确认需要返还旧件的商品。请重新加载订单明细。",
    "この商品の手書きを完了しました。次の商品へ進みます。": "该商品的手写已完成。继续处理下一件商品。",
    "対象商品1個につき1枚": "每个适用商品单位一张",
    "対象商品1個につき1枚 /": "每个适用商品单位一张 /",
    "対象商品1個につき1枚 / 佐川急便 着払い": "每个适用商品单位一张 / 佐川急便到付",
    "着払い伝票の種類と伝票番号を登録し、コア返却対象の商品1個につき1枚を発行します。": "登记到付运单类型和运单号码，并为每个需要返还旧件的商品单位签发一张。",
    "枚": "张",
    "枚 /": "张 /",
    "枚を印刷待ちに登録しました。": "张已加入打印队列。",
    "コア返却用複写伝票の印刷が完了しました。必要な場合は「再印刷」からもう一度発行できます。": "旧件返还用复写运单已打印完成。如需再次打印，请选择“重新打印”。",
    "コア返却用複写伝票を印刷できませんでした。印刷端末を確認して「再送」してください。": "旧件返还用复写运单打印失败。请检查打印终端后选择“重新发送”。",
    "再送": "重新发送",
    "印刷位置調整": "打印位置调整",
    "自動印刷設定": "自动打印设置",
    "受付時の自動印刷": "接单时自动打印",
    "帳票の標準設定": "单据默认设置",
    "未印刷あり": "有未打印单据",
    "未印刷": "未打印",
    "印刷済み": "已打印",
    "待機中": "等待中",
    "出荷処理中": "出货处理中",
    "出荷指示待ち": "等待出货指示",
    "帳票の印刷は完了しています。次は商品と製造シリアルを照合してください。": "报表打印已完成。接下来请核对商品与制造序列号。",
    "帳票の印刷は完了しています。次はB2発行済データを取り込んでください。": "报表打印已完成。接下来请导入B2已发行数据。",
    "保証書・コア返却シートは発行できます。出荷完了には商品と製造シリアルの照合が必要です。": "可以发行保证书和旧件返还单。完成商品与制造序列号核对后方可完成出货。",
    "保証書・コア返却シートは発行できます。出荷完了にはB2発行済データを取り込んでください。": "可以发行保证书和旧件返还单。导入B2已发行数据后方可完成出货。",
    "この注文はコア返却不要のため、コア返却シートを発行しません。": "此订单无需返还旧件，因此不发行旧件返还单。",
    "専用BOX": "专用箱",
    "規定サイズ": "标准尺寸",
    "北海道": "北海道",
    "北東北": "北东北",
    "南東北": "南东北",
    "関東": "关东",
    "信越": "信越",
    "北陸": "北陆",
    "中部": "中部",
    "関西": "关西",
    "中国": "中国地区",
    "四国": "四国",
    "九州": "九州",
    "沖縄": "冲绳",
    "各ランキング内で連番（重複なし）": "各排名内连续编号（不重复）",
    "商品別出荷実績集計": "按商品统计出货实绩",
    "オルタ": "发电机",
    "Sジェネ": "起动发电机",
    "他オルタ": "其他发电机",
    "セル": "起动机",
    "デスビ": "分电器",
    "インジェ": "喷油器",
    "スロボ": "节气门体",
    "センサ": "传感器",
    "ランプ": "灯具",
    "B2契約情報": "B2合同信息",
    "B2 CSV事前検査": "B2 CSV预检",
    "チェックした受注を発行します。": "发行已勾选的订单。",
    "現在表示中の受注を発行します。": "发行当前显示的订单。",
    "注文を表示するか、一覧の処理対象にチェックを入れてください。": "请显示订单，或在列表中勾选要处理的订单。",
    "発行できない項目を注文ごとに表示しています。修正後にもう一度発行してください。": "按订单显示阻止发行的项目。修正后请重新发行。",
    "ヤマトB2クラウド基本レイアウトへ出力する発送元と契約コードを設定します。": "设置导出到雅玛多B2 Cloud基本布局的发件人和合同代码。",
    "設定を確認しています。": "正在检查设置。",
    "発送元電話番号": "发件人电话号码",
    "発送元郵便番号": "发件人邮政编码",
    "発送元住所": "发件人地址",
    "発送元建物名": "发件人楼宇名称",
    "発送元名称": "发件人名称",
    "請求先顧客コードと運賃管理番号は、ヤマト運輸の契約運賃資料またはB2クラウドの設定内容を確認して入力してください。": "请根据雅玛多合同运费资料或B2 Cloud设置输入账单客户代码和运费管理编号。",
    "空欄または3桁": "留空或3位数字",
    "B2クラウド連携の応答がありません。通信状態を確認して、もう一度実行してください。": "B2 Cloud无响应。请检查网络后重试。",
    "B2 CSV発行に必要な契約情報は設定済みです。": "发行B2 CSV所需的合同信息已设置。",
    "未設定または形式確認が必要です:": "未设置或格式不正确：",
    "必須項目": "必填项目",
    "B2契約情報の読み込みに時間がかかっています。画面を閉じて、もう一度開いてください。": "读取B2合同信息耗时过长。请关闭窗口后重新打开。",
    "B2契約情報はシステム管理者が設定します。": "B2合同信息由系统管理员设置。",
    "B2契約情報を読み込んでいます。": "正在读取B2合同信息。",
    "内容を変更した場合は「設定を保存」を押してください。": "更改内容后，请点击“保存设置”。",
    "B2契約情報を読み込めませんでした。": "无法读取B2合同信息。",
    "発送元電話番号を10桁または11桁で入力してください。": "请输入10位或11位发件人电话号码。",
    "発送元郵便番号を7桁で入力してください。": "请输入7位发件人邮政编码。",
    "発送元住所を入力してください。": "请输入发件人地址。",
    "発送元名称を入力してください。": "请输入发件人名称。",
    "請求先顧客コードを10桁から12桁で入力してください。": "请输入10至12位账单客户代码。",
    "請求先分類コードは空欄または3桁で入力してください。": "账单分类代码请留空或输入3位数字。",
    "運賃管理番号を2桁で入力してください。": "请输入2位运费管理编号。",
    "B2契約情報を保存しています。": "正在保存B2合同信息。",
    "B2契約情報の保存に時間がかかっています。通信状態を確認して、もう一度保存してください。": "保存B2合同信息耗时过长。请检查网络后重新保存。",
    "B2契約情報を保存しました。CSV発行前の事前検査に反映されます。": "B2合同信息已保存，并将用于CSV发行前预检。",
    "B2契約情報を保存できませんでした。": "无法保存B2合同信息。",
    "内容を確認してください。": "请确认内容。",
    "B2 CSVの必須項目を確認できませんでした。": "无法检查B2 CSV的必填项目。",
    "必須項目を確認中...": "正在检查必填项目...",
    "B2 CSVの必須項目を確認しています。": "正在检查B2 CSV必填项目。",
    "B2 CSVの事前検査に時間がかかっています。通信状態を確認して、もう一度発行してください。": "B2 CSV预检耗时过长。请检查网络后重新发行。",
    "B2 CSVの発行に時間がかかっています。発行履歴を確認してから、もう一度操作してください。": "B2 CSV发行耗时过长。请先检查发行历史再重试。",
    "B2 CSVを保存できませんでした。ブラウザのダウンロード許可を確認してください。": "无法保存B2 CSV。请检查浏览器下载权限。",
    "B2 CSVを発行しました。ダウンロードフォルダを確認してください。": "B2 CSV已发行。请检查下载文件夹。",
    "B2 CSVの再取得に時間がかかっています。通信状態を確認して、もう一度実行してください。": "重新获取B2 CSV耗时过长。请检查网络后重试。",
    "B2 CSVを再ダウンロードしました。": "B2 CSV已重新下载。",
    "本保証は、本書に記載された保証期間内の製品不具合について、下記条件に基づき対応するものです。大切に保管してください。": "本保修按照以下条件处理本文件所载保修期内的产品故障。请妥善保管。",
    "識別情報": "识别信息",
    "ご購入者": "购买者",
    "情報": "信息",
    "連絡先": "联系方式",
    "（電話番号・メール等）": "（电话、电子邮箱等）",
    "販売店名／取付店名・住所・電話番号・担当者": "销售店／安装店名称、地址、电话及负责人",
    "店印がない場合は、納品書・領収書・整備伝票等の購入証明と本書を保管してください。": "如无店铺盖章，请将本文件与送货单、收据或维修单等购买凭证一并保管。",
    "印鑑欄（任意）": "印章栏（可选）",
    "販売店印": "销售店章",
    "（任意）": "（可选）",
    "取付店印": "安装店章",
    "本書、対象製品、製造シリアル、車両・取付情報をご提示ください。": "请出示本文件、相关产品、制造序列号以及车辆和安装信息。"
  }
};

function extractTranslations(appSource) {
  const start = appSource.indexOf("var TRANSLATIONS = ");
  const currentLang = appSource.indexOf("\nvar currentLang", start);
  const source = appSource.slice(start, currentLang);
  const close = source.lastIndexOf("\n};");
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    source.slice(0, close + 3).replace(/^var TRANSLATIONS\s*=\s*/, "TRANSLATIONS = "),
    context
  );
  return context.TRANSLATIONS;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#43;/g, "+")
    .replace(/&times;/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function addCandidate(set, value) {
  const text = decodeHtml(value).replace(/\\n/g, " ").replace(/\\t/g, " ").trim();
  if (!text || text.length > 300 || !/[ぁ-んァ-ヶ一-龠]/.test(text)) return;
  if (/^[#./:_-]+$/.test(text)) return;
  set.add(text);
}

function extractHtmlCandidates(source, set) {
  const clean = source
    .replace(/<!--[^]*?-->/g, "")
    .replace(/<script[^]*?<\/script>/gi, "")
    .replace(/<style[^]*?<\/style>/gi, "");
  for (const match of clean.matchAll(/>([^<>]*[ぁ-んァ-ヶ一-龠][^<>]*)</g)) addCandidate(set, match[1]);
  for (const match of clean.matchAll(/(?:placeholder|title|aria-label|value)="([^"]*[ぁ-んァ-ヶ一-龠][^"]*)"/g)) {
    addCandidate(set, match[1]);
  }
}

function extractJsCandidates(source, set) {
  for (const line of source.split(/\r?\n/)) {
    const literal = /(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/g;
    let match;
    while ((match = literal.exec(line))) {
      const raw = match[1] == null ? match[2] : match[1];
      if (!/[ぁ-んァ-ヶ一-龠]/.test(raw)) continue;
      if (/[<>]/.test(raw)) {
        for (const textMatch of raw.matchAll(/>([^<>]*[ぁ-んァ-ヶ一-龠][^<>]*)</g)) addCandidate(set, textMatch[1]);
        for (const attrMatch of raw.matchAll(/(?:placeholder|title|aria-label)=(?:"|')([^"']*[ぁ-んァ-ヶ一-龠][^"']*)(?:"|')/g)) {
          addCandidate(set, attrMatch[1]);
        }
      } else {
        addCandidate(set, raw);
      }
    }
  }
}

function plainDictionaryValue(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "));
}

function existingJapaneseValues(translations) {
  return new Set(Object.values(translations.ja || {}).map(plainDictionaryValue).filter(Boolean));
}

function appRuntimeUiSource(source) {
  let runtime = source.slice(source.indexOf("\nvar currentLang"));
  const bridgeStart = runtime.indexOf("\nvar legacyI18nTextSources");
  const bridgeEnd = runtime.indexOf("\n// HTMLのdata-i18n属性", bridgeStart);
  if (bridgeStart >= 0 && bridgeEnd > bridgeStart) runtime = runtime.slice(0, bridgeStart) + runtime.slice(bridgeEnd);
  return runtime;
}

function runtimeUiSource(relativePath, source) {
  if (relativePath !== "assets/concierge-pet/concierge-pet.js") return source;
  const copyStart = source.indexOf("\n  var COPY = {");
  const nonJapaneseStart = source.indexOf("\n    en: {", copyStart);
  const copyEnd = source.indexOf("\n  var STATE_MESSAGE_KEYS", nonJapaneseStart);
  if (copyStart < 0 || nonJapaneseStart < 0 || copyEnd < 0) {
    throw new Error("Concierge local translation dictionary markers are missing");
  }
  return source.slice(0, copyStart) + source.slice(copyEnd);
}

function readExistingSupplemental() {
  if (!fs.existsSync(outputPath)) return { en: {}, zh: {} };
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(outputPath, "utf8"), context);
  return context.DCATS_LEGACY_UI_TRANSLATIONS || { en: {}, zh: {} };
}

async function bingSession() {
  const response = await fetch("https://www.bing.com/translator", {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36" }
  });
  if (!response.ok) throw new Error(`Bing translator bootstrap failed: ${response.status}`);
  const html = await response.text();
  const ig = (html.match(/IG:"([A-F0-9]+)"/) || [])[1];
  const auth = html.match(/params_AbusePreventionHelper = \[(\d+),"([^"]+)"/);
  if (!ig || !auth) throw new Error("Could not read Bing translator session parameters");
  const cookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie().map((item) => item.split(";", 1)[0]).join("; ")
    : "";
  return { ig, key: auth[1], token: auth[2], cookies, iid: 0 };
}

async function translateRequest(session, text, target) {
  session.iid += 1;
  const url = `https://www.bing.com/ttranslatev3?isVertical=1&&IG=${session.ig}&IID=translator.5025.${session.iid}`;
  const body = new URLSearchParams({
    fromLang: "ja",
    to: target,
    text,
    token: session.token,
    key: session.key,
    tryFetchingGenderDebiasedTranslations: "true"
  });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "origin": "https://www.bing.com",
      "referer": "https://www.bing.com/translator",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      ...(session.cookies ? { cookie: session.cookies } : {})
    },
    body
  });
  if (!response.ok) throw new Error(`Bing translation failed (${target}): ${response.status}`);
  const payload = await response.json();
  return payload && payload[0] && payload[0].translations && payload[0].translations[0]
    ? String(payload[0].translations[0].text || "")
    : "";
}

function makeBatches(values) {
  const batches = [];
  let current = [];
  let length = 0;
  values.forEach((value, index) => {
    const delimiterLength = index ? 32 : 0;
    if (current.length && (current.length >= 35 || length + value.length + delimiterLength > 3400)) {
      batches.push(current);
      current = [];
      length = 0;
    }
    current.push({ value, index });
    length += value.length + delimiterLength;
  });
  if (current.length) batches.push(current);
  return batches;
}

async function translateValues(values, target) {
  const session = await bingSession();
  const result = {};
  const batches = makeBatches(values);
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const source = batch.map((item, index) => {
      return (index ? `\n<<<DCATS_SPLIT_${item.index}>>>\n` : "") + item.value;
    }).join("");
    const translated = await translateRequest(session, source, target);
    const parts = translated.split(/\s*<<<DCATS_SPLIT_\d+>>>\s*/);
    if (parts.length !== batch.length) {
      for (const item of batch) result[item.value] = await translateRequest(session, item.value, target);
    } else {
      batch.forEach((item, index) => { result[item.value] = parts[index].trim(); });
    }
    process.stdout.write(`${target}: ${batchIndex + 1}/${batches.length}\n`);
  }
  return result;
}

async function main() {
  const app = fs.readFileSync(appPath, "utf8");
  const html = fs.readFileSync(htmlPath, "utf8");
  const translations = extractTranslations(app);
  const candidates = new Set();
  extractHtmlCandidates(html, candidates);
  runtimeScriptPaths.forEach((relativePath) => {
    let source = relativePath === "app.js"
      ? appRuntimeUiSource(app)
      : fs.readFileSync(path.join(root, relativePath), "utf8");
    source = runtimeUiSource(relativePath, source);
    extractJsCandidates(source, candidates);
  });
  const existing = existingJapaneseValues(translations);
  const values = Array.from(candidates).filter((value) => !existing.has(value)).sort((a, b) => a.localeCompare(b, "ja"));
  const previous = readExistingSupplemental();
  const curatedOnly = process.env.DCATS_I18N_CURATED_ONLY === "1";
  const missing = curatedOnly ? [] : values.filter((value) =>
    !(previous.en[value] || curatedTranslations.en[value]) ||
    !(previous.zh[value] || curatedTranslations.zh[value])
  );
  console.log(`Supplemental translations: ${values.length} total, ${missing.length} new`);
  let translated = { en: {}, zh: {} };
  if (missing.length && process.platform === "win32") {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dcats-i18n-"));
    const candidatePath = path.join(tempDir, "candidates.json");
    const translatedPath = path.join(tempDir, "translated.json");
    fs.writeFileSync(candidatePath, JSON.stringify(missing), "utf8");
    const helper = path.join(__dirname, "generate-legacy-ui-translations.ps1");
    const processResult = childProcess.spawnSync("pwsh.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper,
      "-CandidatePath", candidatePath, "-OutputPath", translatedPath
    ], { stdio: "inherit" });
    if (processResult.status !== 0) throw new Error("PowerShell translation helper failed");
    translated = JSON.parse(fs.readFileSync(translatedPath, "utf8"));
    fs.rmSync(tempDir, { recursive: true, force: true });
  } else if (missing.length) {
    translated.en = await translateValues(missing, "en");
    translated.zh = await translateValues(missing, "zh-Hans");
  }
  const en = Object.assign({}, previous.en || {}, translated.en || {});
  const zh = Object.assign({}, previous.zh || {}, translated.zh || {});
  Object.assign(en, curatedTranslations.en);
  Object.assign(zh, curatedTranslations.zh);
  const content = [
    "// Generated by scripts/generate-legacy-ui-translations.js.",
    "// Runtime translation is local; this file makes no external requests.",
    "var DCATS_LEGACY_UI_TRANSLATIONS = " + JSON.stringify({ en, zh }, null, 2) + ";",
    ""
  ].join("\n");
  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`Wrote ${path.relative(root, outputPath)}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

(function(root) {
  'use strict';
  var state={owner:null,lists:[],listId:'',rows:[],selected:new Set(),focused:null,detailOpen:false,busy:false,run:null,pending:null,epoch:0,ec:null,ecTimer:null,dksProgress:null};
  var words={
    ja:{fetchHeld:"参考価格の取得を保留しました。",fetchTax:"販売価格が税抜か税込か確認できないため、価格を採用していません。",fetchGateway:"参照先の入口認証を確認してください。",fetchLogin:"接続先のログインを確認してください。",fetchLayout:"参照先の検索画面を確認できないため保留しました。",fetchIdentity:"一致するOEM品番・純正品番・価格を確認できないため保留しました。",fetchAmbiguous:"一致する品番に複数の価格があるため保留しました。",fetchStore:"取得価格の保存結果を確認できません。最新の内容を確認してください。",title:'原価計算リストから価格を設定',intro:"参考価格−2,000円と、総原価に対する利益率30%を満たす価格の高い方を100円単位で切り上げます。金額は税抜です。",scope:'未設定品の販売基準価格と販売価格区分1を同額で登録します。他区分は既存のランク計算を適用します。設定済み品は上書きしません。',list:'保存済み原価計算リスト',choose:'リストを選択',load:'リストを確認',refresh:'最新の内容を確認',all:'表示中の設定可能品を選択',none:'選択を解除',filter:'表示',any:'すべて',ready:'設定可能',configured:'設定済み',review:'要確認',search:"品番で絞り込み",part:'品番',cost:'保存総原価',dks:"参考価格",ec:'EC相場（参考）',target:"参考価格−2,000円",floor:'利益率30%の下限',proposal:'設定する価格',margin:'原価差額 / 利益率',status:'状態',one:'この品番を確認',bulk:'選択品をまとめて確認',history:'選定・設定履歴',empty:'このリストに品番がありません。',loading:'処理中…',error:'読み込みに失敗しました。再確認してください。',expired:'表示中に利用者または権限が変わりました。開き直してください。',confirm:'販売価格を設定',confirmText:"次の税抜価格で販売基準価格と区分1を登録します。保存直前に原価・参考価格・設定済み状態を再確認します。",cancel:'戻って確認',save:'この内容で設定する',invalid:'100円単位で、利益率30%の下限以上の価格を入力してください。',saved:'価格設定を保存しました。',unknown:'結果を確認できませんでした。同じ操作の結果確認を行ってください。',retry:'同じ操作の結果を確認',noSelection:'設定する品番を選択してください。',stale:'内容が変更されたか設定済みです。最新の内容を確認してください。',historyEmpty:'このリストの履歴はまだありません。',prepared:'リストを選定',committed:'価格設定済み',count:'品番',identity_review:'同一品番の複数商品を確認',missing_product:'商品マスタ未登録',kind_review:'商品区分を確認',oem_review:'OEM品番を確認',cost_review:'原価の不足項目を確認',dks_missing:"参考価格未取得",registered:"登録済み価格",strain:"取得済み価格",noEc:'未調査・30日以内の参考値なし',taxUnknown:'税込/税抜未確認',taxExclusive:'税抜',taxInclusive:'税込',scrape:"未取得の参考価格を取得",credentials:"参考価格を取得",settings:"参考価格の取得設定",ecFetch:"このリストのEC相場を取得",ecOpen:"ECモール価格調査を開く",ecCheck:"調査状況を確認",ecTitle:"ECモール価格調査で取得",ecHelp:"表示中の保存リスト全体を調査します。既存のECモール価格調査と共通の対象・調査履歴を使用します。新規対象だけを追加し、既存の調査先・販売店・中古品条件は保持します。要確認・削除済み・商品との対応を確認できない対象は除外します。",ecCounts:"調査対象 / 新規追加 / 要確認・除外",ecStart:"対象を追加して調査開始",ecNothing:"このリストに調査可能な対象がありません。ECモール価格調査で対象の登録内容を確認してください。",ecRunning:"ECモール価格調査を実行中",ecOther:"別のECモール価格調査が実行中です。完了後に再度開始してください。",ecDone:"ECモール価格調査が完了しました。最新の相場を反映しました。",ecPartial:"ECモール価格調査で未取得・失敗の対象があります。取得済みの相場を反映しました。詳細はECモール価格調査で確認してください。",ecUnknown:"受付結果を確認できません。自動再送せず、「調査状況を確認」から確認してください。",ecAddUnknown:"対象追加の結果を確認できません。自動再送していません。ECモール価格調査で登録状態を確認してください。",ecScope:"画面を閉じても受付済みの調査は継続します。戻ったらリストを再確認すると最新相場が表示されます。",credentialHelp:"入口認証と接続先のパスワードを、この管理者専用に暗号化して保存します。次回から再入力せず取得できます。更新時はすべての欄を入力してください。",stored:"登録済み（パスワードは表示しません）",notStored:"未登録",credentialSave:"暗号化して保存",credentialSaved:"参考価格の取得設定を保存しました。",credentialRemove:"登録を解除",credentialRemoved:"参考価格の取得設定の登録を解除しました。",credentialRemoveHelp:"この管理者の参考価格の取得設定を解除します。次回の取得には再登録が必要です。",credentialUnknown:"保存結果を確認できませんでした。認証情報を開き直して登録状態を確認してください。",credentialNeeded:"先に「参考価格の取得設定」から登録してください。",account:"接続アカウント",basicUser:"接続用アカウント",basicPassword:'入口認証パスワード',password:"接続先のパスワード",fetch:'未取得の選択品を取得',fetchMissing:'価格未取得品を選択してください。',fetchDone:'取得を完了しました。最新の内容を確認します。',fetchFailed:'取得できませんでした。認証またはサイトの表示を確認してください。',fetchReview:'品番・税区分・表示形式を確認できなかったため保留しました。',fetchSelect:'価格未取得品も取得対象として選択できます。',total:'選択',close:'閉じる'},
    en:{fetchHeld:"reference price retrieval needs review.",fetchTax:"The tax status of the selling price is unverified. No price has been adopted.",fetchGateway:"Check the reference provider gateway authentication.",fetchLogin:"Check the provider login.",fetchLayout:"The reference provider search page could not be verified.",fetchIdentity:"The matching OEM number, genuine number and price could not be verified.",fetchAmbiguous:"More than one price matches this part. Review is required.",fetchStore:"The quote save result is unknown. Check the latest list.",title:'Set prices from saved cost lists',intro:"Round up to ¥100: the higher of reference price minus ¥2,000 and the price needed for a 30% margin on total saved cost. Prices exclude tax.",scope:'Create the same base and class 1 price for unset products. Other classes use existing rank rules. Existing prices are preserved.',list:'Saved manufacturing cost list',choose:'Choose a list',load:'Review list',refresh:'Refresh',all:'Select visible eligible products',none:'Clear selection',filter:'Show',any:'All',ready:'Ready',configured:'Configured',review:'Review needed',search:"Filter part numbers",part:'Part number',cost:'Saved total cost',dks:"Reference price",ec:'EC market reference',target:"Reference minus ¥2,000",floor:'30% margin floor',proposal:'Price to save',margin:'Profit / margin',status:'Status',one:'Review this product',bulk:'Review selected products',history:'Selection and pricing history',empty:'This list has no products.',loading:'Working…',error:'Could not load. Please refresh.',expired:'Account or permissions changed. Reopen this view.',confirm:'Set selling prices',confirmText:"Create base and class 1 prices below, excluding tax. Cost, reference price and existing prices are checked again before saving.",cancel:'Back to review',save:'Set these prices',invalid:'Enter a multiple of ¥100 at or above the 30% margin floor.',saved:'Prices saved.',unknown:'The result is unknown. Check the same operation before continuing.',retry:'Check the same operation',noSelection:'Select products to price.',stale:'The data changed or a price already exists. Refresh the list.',historyEmpty:'No history for this list.',prepared:'List selected',committed:'Prices saved',count:'products',identity_review:'Check duplicate OEM product identities',missing_product:'Product not registered',kind_review:'Check product kind',oem_review:'Check OEM identity',cost_review:'Complete cost information',dks_missing:"Reference price missing",registered:"Registered price",strain:"Fetched price",noEc:'No reference within 30 days',taxUnknown:'Tax basis unknown',taxExclusive:'Excluding tax',taxInclusive:'Including tax',scrape:"Fetch missing reference prices",credentials:"Fetch reference prices",settings:"Reference price settings",ecFetch:"Fetch EC prices for this list",ecOpen:"Open EC Mall Price Research",ecCheck:"Check research status",ecTitle:"Fetch through EC Mall Price Research",ecHelp:"Research the entire displayed saved list using the existing EC targets and history. Add only new targets. Keep existing providers, sellers and used-item settings. Exclude review items, removed targets and unconfirmed product links.",ecCounts:"Research / New targets / Review or excluded",ecStart:"Add targets and start research",ecNothing:"No eligible targets. Check target registration in EC Mall Price Research.",ecRunning:"EC Mall Price Research is running",ecOther:"Another EC research run is in progress. Start again after it finishes.",ecDone:"EC research completed. Latest reference prices are now displayed.",ecPartial:"Some targets failed or returned no data. Available reference prices were refreshed. See EC Mall Price Research for details.",ecUnknown:"Acceptance is unconfirmed. Nothing is resent automatically. Use Check research status.",ecAddUnknown:"Target registration is unconfirmed and has not been retried. Check saved targets in EC Mall Price Research.",ecScope:"Accepted research continues if you leave. Review the list again when you return to see current prices.",credentialHelp:"Save the gateway credentials and provider password encrypted for this administrator. Future fetches use the saved credentials. Enter all fields to replace them.",stored:"Configured (passwords are never displayed)",notStored:"Not configured",credentialSave:"Save encrypted",credentialSaved:"reference price settings saved.",credentialRemove:"Remove saved credentials",credentialRemoved:"reference price settings removed.",credentialRemoveHelp:"Remove this administrator’s reference price settings? Register again before the next fetch.",credentialUnknown:"Could not confirm the result. Reopen reference price settings to check their status.",credentialNeeded:"Configure Reference price settings first.",account:"Connection account",basicUser:"Connection account",basicPassword:'Gateway password',password:"Provider password",fetch:'Fetch selected missing prices',fetchMissing:"Select products with missing reference prices.",fetchDone:'Fetch completed. Refreshing the list.',fetchFailed:'Could not fetch. Check authentication and the vendor page.',fetchReview:'Product identity, tax basis or page layout could not be verified.',fetchSelect:"Products missing a reference price can also be selected for fetching.",total:'Selected',close:'Close'},
    zh:{fetchHeld:"参考价格获取已保留。",fetchTax:"无法确认销售价格的税别，尚未采用该价格。",fetchGateway:"请确认参考来源的入口认证。",fetchLogin:"请确认参考来源登录。",fetchLayout:"无法确认参考来源的搜索页面。",fetchIdentity:"无法确认一致的OEM品号、原厂品号和价格。",fetchAmbiguous:"同一品号存在多个价格，请确认。",fetchStore:"无法确认参考价格的保存结果，请查看最新清单。",title:'从已保存成本清单设置价格',intro:"取参考价格减2,000日元与总成本利润率30%所需价格中的较高值，并以100日元向上取整。价格均不含税。",scope:'仅对未设置商品同时登记基准价格和价格类别1。其他类别沿用原有等级规则。已设置价格不覆盖。',list:'已保存成本清单',choose:'选择清单',load:'查看清单',refresh:'刷新',all:'选择当前可设置商品',none:'取消选择',filter:'显示',any:'全部',ready:'可设置',configured:'已设置',review:'待确认',search:"按品号筛选",part:'品号',cost:'已保存总成本',dks:"参考价格",ec:'电商参考行情',target:"参考价格减2,000日元",floor:'利润率30%下限',proposal:'设置价格',margin:'利润 / 利润率',status:'状态',one:'确认此商品',bulk:'批量确认所选商品',history:'选择及设置记录',empty:'清单中没有商品。',loading:'处理中…',error:'读取失败，请刷新。',expired:'用户或权限已改变，请重新打开。',confirm:'设置销售价格',confirmText:"按以下未税价格登记基准价格和类别1。保存前重新核对成本、参考价格及已设置状态。",cancel:'返回确认',save:'按此内容设置',invalid:'请输入100日元的整数倍，且不低于30%利润率下限。',saved:'价格已保存。',unknown:'结果不明，请先核对同一操作。',retry:'核对同一操作',noSelection:'请选择商品。',stale:'内容已改变或价格已设置，请刷新。',historyEmpty:'此清单暂无记录。',prepared:'已选清单',committed:'价格已设置',count:'商品',identity_review:'确认同品号的多个商品',missing_product:'未登记商品',kind_review:'确认商品类别',oem_review:'确认OEM品号',cost_review:'补全成本信息',dks_missing:"缺少参考价格",registered:"已登记价格",strain:"已获取价格",noEc:'30天内无参考行情',taxUnknown:'税别待确认',taxExclusive:'未税',taxInclusive:'含税',scrape:"获取缺少的参考价格",credentials:"获取参考价格",settings:"参考价格获取设置",ecFetch:"获取此清单的EC行情",ecOpen:"打开EC商城价格调查",ecCheck:"确认调查状态",ecTitle:"通过EC商城价格调查获取",ecHelp:"调查当前保存清单的全部对象，共用现有调查对象与历史。仅添加新对象，保留现有平台、卖家和二手品条件。排除需确认、已移除或商品关联不明的对象。",ecCounts:"调查 / 新增 / 需确认或排除",ecStart:"添加对象并开始调查",ecNothing:"没有可调查对象，请在EC商城价格调查中确认登记内容。",ecRunning:"EC商城价格调查进行中",ecOther:"其他EC调查正在进行，请完成后再开始。",ecDone:"EC调查完成，已更新参考行情。",ecPartial:"部分对象失败或无结果，已更新现有行情，请在EC商城价格调查中查看详情。",ecUnknown:"无法确认受理结果，不会自动重发，请确认调查状态。",ecAddUnknown:"无法确认对象添加结果，未自动重发，请在EC商城价格调查中确认登记。",ecScope:"离开画面后已受理的调查仍会继续，返回时重新查看清单以更新行情。",credentialHelp:"为此管理员加密保存入口认证和参考来源密码。以后获取无需重复输入。更新时请填写全部字段。",stored:"已登记（不显示密码）",notStored:"未登记",credentialSave:"加密保存",credentialSaved:"参考价格获取设置已保存。",credentialRemove:"解除登记",credentialRemoved:"参考价格获取设置已解除。",credentialRemoveHelp:"解除此管理员的参考价格获取设置？下次获取前需要重新登记。",credentialUnknown:"无法确认保存结果，请重新打开认证信息确认状态。",credentialNeeded:"请先登记参考价格获取设置。",account:"连接账号",basicUser:"连接账号",basicPassword:'入口认证密码',password:"连接密码",fetch:'获取所选缺少价格',fetchMissing:"请选择缺少参考价格的商品。",fetchDone:'获取完成，正在刷新。',fetchFailed:'获取失败，请确认认证或网站页面。',fetchReview:'品号、税别或页面格式无法确认。',fetchSelect:"也可选择缺少参考价格的商品进行获取。",total:'已选择',close:'关闭'}
  };
  Object.assign(words.ja,{fetchHelp:'表示中の価格未取得品から取得対象を選択してください。取得済み・設定済み・品番照合が必要な商品は除外します。販売価格は変更しません。',fetchNothing:'表示中に取得可能な価格未取得品はありません。表示条件・品番照合・取得済み状態を確認してください。',fetchAll:'未取得品をすべて選択',fetchTargets:'取得対象'});
  Object.assign(words.en,{fetchHelp:'Choose missing prices from the displayed products. Already fetched, configured and unverified identities are excluded. Selling prices are not changed.',fetchNothing:'No eligible missing prices are displayed. Check filters, identity review and existing quotes.',fetchAll:'Select all missing prices',fetchTargets:'Fetch targets'});
  Object.assign(words.zh,{fetchHelp:'请选择当前显示的缺价商品。排除已获取、已设置及品号待确认的商品。不会更改销售价格。',fetchNothing:'当前没有可获取的缺价商品，请检查筛选条件、品号核对及已有报价。',fetchAll:'选择全部缺价商品',fetchTargets:'获取对象'});
  Object.assign(words.ja,{unconfigured:'未登録',costPartial:'単価未設定あり・保存済み原価で暫定計算',costEmpty:'構成部品登録0件・設定不可',readyProvisional:'設定可能（暫定原価）',provisional:'暫定計算',ecFallback:"EC相場未取得：参考価格−2,000円を基準に計算",intro:"EC相場が不明でも、参考価格−2,000円と保存済み原価に対する利益率30%の下限の高い方を100円単位で切り上げて候補に反映します。金額は税抜です。現在のリビルト用構成部品が1件以上登録されていれば、単価未設定でも取得済み参考価格と有効な保存済み原価から設定できます。構成部品登録0件は設定できません。不足原価を含む実際の利益は未確定です。"});
  Object.assign(words.en,{unconfigured:'Unregistered',costPartial:'Unit prices missing: provisional saved cost',costEmpty:'No registered components: cannot set price',readyProvisional:'Ready (provisional cost)',provisional:'provisional',ecFallback:"No EC reference: based on reference price minus ¥2,000",intro:"Even without EC prices, propose the higher of reference price minus ¥2,000 and a 30% margin on saved cost, rounded up to ¥100. Prices exclude tax. At least one currently registered rebuilt component is required. Missing unit prices remain eligible with an existing reference and valid saved cost. No registered components means pricing is unavailable. Profit including missing costs is unverified."});
  Object.assign(words.zh,{unconfigured:'未登记',costPartial:'单价未设：按已保存成本暂算',costEmpty:'构成部件登记0件：不可设置',readyProvisional:'可设置（暂算成本）',provisional:'暂算',ecFallback:"无EC行情：以参考价格减2,000日元为基准",intro:"无EC行情时，也将参考价格减2,000日元与已保存成本利润率30%下限中的较高值，以100日元向上取整后填入候选价。价格未税。至少需要1个当前登记的再制造构成部件。如缺少单价，有已获取参考价及有效已保存成本时仍可设置；构成部件登记0件不可设置。计入缺失成本后的实际利润尚未确认。"});
  Object.assign(words.ja,{fetchProgressTitle:'参考価格を取得中',fetchResultTitle:'参考価格の取得結果',fetchChecking:'接続設定を確認中',fetchWaiting:'通信の応答待ち',fetchRefreshing:'取得結果を一覧に反映中',fetchComplete:'取得処理が完了しました。',fetchPartial:'取得処理が終了しました。保留・失敗・未実行の品番を確認してください。',fetchRefreshFailed:'取得結果の一覧への反映を確認できません。最新の内容を確認してください。',fetchProcessed:'処理済み',fetchElapsed:'経過',fetchSeconds:'秒',fetchCurrent:'現在の品番',fetchPending:'未実行',fetchWorking:'通信中',fetchFetched:'取得済み',fetchOnHold:'保留',fetchError:'失敗',fetchRequestUnknown:'応答結果を確認できませんでした。自動再取得はしていません。',fetchStartFailed:'取得を開始できませんでした。接続設定・通信状態を確認してください。'});
  Object.assign(words.en,{fetchProgressTitle:'Fetching reference prices',fetchResultTitle:'Reference price results',fetchChecking:'Checking connection settings',fetchWaiting:'Waiting for the response',fetchRefreshing:'Refreshing the list with fetch results',fetchComplete:'Price retrieval completed.',fetchPartial:'Retrieval ended. Review held, failed and unprocessed products.',fetchRefreshFailed:'Could not confirm the refreshed list. Check the latest data.',fetchProcessed:'Processed',fetchElapsed:'Elapsed',fetchSeconds:'s',fetchCurrent:'Current part',fetchPending:'Not processed',fetchWorking:'Fetching',fetchFetched:'Fetched',fetchOnHold:'Held',fetchError:'Failed',fetchRequestUnknown:'The response could not be confirmed. Nothing was retried automatically.',fetchStartFailed:'Could not start retrieval. Check connection settings and network status.'});
  Object.assign(words.zh,{fetchProgressTitle:'正在获取参考价格',fetchResultTitle:'参考价格获取结果',fetchChecking:'正在确认连接设置',fetchWaiting:'等待通信响应',fetchRefreshing:'正在将获取结果更新至清单',fetchComplete:'价格获取已完成。',fetchPartial:'获取已结束，请确认保留、失败和未处理的商品。',fetchRefreshFailed:'无法确认清单更新结果，请查看最新内容。',fetchProcessed:'已处理',fetchElapsed:'已用',fetchSeconds:'秒',fetchCurrent:'当前品号',fetchPending:'未处理',fetchWorking:'获取中',fetchFetched:'已获取',fetchOnHold:'保留',fetchError:'失败',fetchRequestUnknown:'无法确认响应结果，未自动重试。',fetchStartFailed:'无法开始获取，请确认连接设置和网络状态。'});
  Object.assign(words.ja,{fetchUnmatched:'該当なし／照合不可',fetchOem:'検索に必要なOEM品番を確認してください。',fetchAccess:'ログインまたは取得権限を確認してください。',fetchRateLimit:'取得回数の制限に達したため中断しました。時間をおいて確認してください。',fetchFinishedWithIssues:'全対象の処理が完了しました。該当なし・保留・失敗の結果を確認してください。',fetchPartial:'取得処理を中断しました。未実行の品番と停止理由を確認してください。'});
  Object.assign(words.en,{fetchUnmatched:'No match / identity unverified',fetchOem:'Check the OEM number required for this search.',fetchAccess:'Check your login and permission to fetch prices.',fetchRateLimit:'Retrieval stopped because the request limit was reached. Check again later.',fetchFinishedWithIssues:'All targets were processed. Review unmatched, held and failed results.',fetchPartial:'Retrieval stopped. Review unprocessed parts and the reason.'});
  Object.assign(words.zh,{fetchUnmatched:'无匹配／无法核对',fetchOem:'请确认搜索所需的OEM品号。',fetchAccess:'请确认登录及价格获取权限。',fetchRateLimit:'已达到获取次数限制，处理已中断，请稍后确认。',fetchFinishedWithIssues:'所有对象均已处理，请查看无匹配、保留及失败结果。',fetchPartial:'获取已中断，请确认未处理的品号及停止原因。'});
  Object.assign(words.ja,{componentRegistered:'リビルト構成部品登録',componentUnknown:'構成部品登録件数未確認・設定不可',costSnapshot:'構成部品登録に変更あり・保存済み原価で暫定計算'});
  Object.assign(words.en,{componentRegistered:'Registered rebuilt components',componentUnknown:'Component count unverified: cannot set price',costSnapshot:'Component registrations changed: provisional saved cost'});
  Object.assign(words.zh,{componentRegistered:'再制造构成部件登记',componentUnknown:'构成部件登记件数未确认：不可设置',costSnapshot:'构成部件登记已变更：按已保存成本暂算'});
  function w(k){return (words[root.currentLang]||words.ja)[k]||k;}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function money(v){return v==null?'—':'¥'+Number(v).toLocaleString('ja-JP');}
  Object.assign(words.ja,{relatedConfigured:'同一品番の別商品に価格設定あり・個別設定から確認'});
  Object.assign(words.en,{relatedConfigured:'Another duplicate has a price; review individually'});
  Object.assign(words.zh,{relatedConfigured:'同品号其他商品已设置价格，请单独确认'});
  Object.assign(words.ja,{unconfigured:'未登録・赤字',chosenProduct:'構成部品件数で採用した商品ID',lossUpdate:'赤字の設定済み価格（更新対象）',scope:'販売基準価格と販売価格区分1を同額で登録します。設定済みは、現在の税抜価格が保存総原価を下回る場合だけ一括更新の候補に含めます。同額以上・税区分未確認は変更しません。「この品番を確認」から個別に設定できます。同一品番はリビルト構成部品登録件数が多い商品、同数なら商品IDが若い商品を採用します。'});
  Object.assign(words.en,{unconfigured:'Unregistered / loss',chosenProduct:'Selected product ID by component count',lossUpdate:'Existing loss-making price (eligible for update)',scope:'Set the base and rank 1 price together. Existing prices are eligible only when the current net price is below saved total cost. Break-even, profitable or tax-unverified prices are preserved; use individual review to change them. Duplicate parts use the highest rebuilt component count, then the lowest product ID.'});
  Object.assign(words.zh,{unconfigured:'未登记／亏损',chosenProduct:'按构成部件数量采用的商品ID',lossUpdate:'已设置亏损价格（可更新）',scope:'同时登记基准价格和类别1。已设置价格仅在当前未税价格低于已保存总成本时可批量更新。持平、盈利或税别未确认的价格保持不变，请通过确认此商品单独设置。同品号优先采用再制造部件登记较多的商品，同数时采用较小商品ID。'});
  Object.assign(words.ja,{all:'表示中のすべてをチェック',excluded:'設定対象外',fetchSelect:'検索結果はすべてチェックできます。設定済みの非赤字品・構成部品登録0件など、一括設定の対象外品は除外します。参考価格の取得条件は変わりません。'});
  Object.assign(words.en,{all:'Check all visible results',excluded:'Excluded from pricing',fetchSelect:'All search results can be checked. Configured non-loss or otherwise ineligible products are excluded from bulk pricing. Reference-fetch requirements are unchanged.'});
  Object.assign(words.zh,{all:'勾选当前全部结果',excluded:'不属于价格设置对象',fetchSelect:'可勾选全部搜索结果，批量设置会排除已设置的非亏损价格及其他不符合条件的商品。参考价格获取条件不变。'});
  Object.assign(words.ja,{ecTools:'EC相場',log:'ログ',ecMinimum:'直近30日以内の調査先ごとの最新結果から最安値を表示。取得済み送料を加算し、送料不明は加算されません。税区分は各結果の表示を確認してください。'});
  Object.assign(words.en,{ecTools:'EC market prices',log:'Log',ecMinimum:'Lowest of each provider’s latest results within 30 days. Known shipping is added; unknown shipping is not. Check the tax basis shown for each result.'});
  Object.assign(words.zh,{ecTools:'电商行情',log:'日志',ecMinimum:'显示30天内各调查来源最新结果的最低价。加上已知运费，未知运费不加算。请确认各结果显示的税别。'});
  Object.assign(words.ja,{scope:'当社販売価格は販売価格区分1です。未登録品と、区分1の税抜価格が保存総原価を下回る品番を一括設定の候補にします。参考価格・商品マスター価格・基準価格だけでは設定済みと判定しません。登録時は販売基準価格と区分1を同額で保存します。個別変更は「この品番を確認」から行えます。',relatedConfigured:'同一品番の別商品に区分1価格あり・個別設定から確認'});
  Object.assign(words.en,{scope:'Company selling prices are class 1 prices. Unset products and class 1 net prices below saved cost may be bulk-priced. Reference, product master and base prices alone do not count as configured. Saving sets the base and class 1 price together. Use individual review for other changes.',relatedConfigured:'Another duplicate has a class 1 price; review individually'});
  Object.assign(words.zh,{scope:'本公司销售价格为类别1价格。未登记商品及类别1未税价格低于已保存成本的商品可批量设置。仅有参考价、商品主数据价格或基准价格不算已设置。保存时基准价格与类别1设为同额，其他变更请单独确认。',relatedConfigured:'同品号其他商品已有类别1价格，请单独确认'});
  Object.assign(words.ja,{list:'原価計算リスト',rules:'価格設定の考え方',ownPrice:'当社価格',net:'税抜・区分1',proposal:'設定候補',bulk:'選択した価格を確認',scrape:'参考価格を取得',shortOne:'個別',details:'価格の根拠',detailHelp:'品番を選ぶと、価格の根拠を確認できます。',backToList:'一覧に戻る',detailOf:'価格の詳細',components:'構成部品・採用商品',notSet:'未設定',selectCount:'選択',priceCount:'一括設定',noMatch:'条件に一致する品番がありません。',fetchSelect:'チェックした品番のうち、設定条件を満たすものだけを一括確認します。',ecSeparate:'EC価格は参考情報です。当社価格や赤字の判定には使用しません。',priceEdit:'設定候補（税抜）',viewProduct:'個別の販売価格設定を開く',partialCount:'暫定原価',refresh:'更新',settings:'取得設定'});
  Object.assign(words.en,{list:'Cost list',rules:'How prices are calculated',ownPrice:'Company price',net:'Net · class 1',proposal:'Proposed price',bulk:'Review selected prices',scrape:'Fetch reference prices',shortOne:'Edit',details:'Price breakdown',detailHelp:'Choose a part to see its price breakdown.',backToList:'Back to list',detailOf:'Price details',components:'Components and selected product',notSet:'Not set',selectCount:'Selected',priceCount:'Bulk eligible',noMatch:'No parts match these filters.',fetchSelect:'Only checked products that meet the pricing requirements are included in bulk review.',ecSeparate:'EC prices are for reference. They do not determine company prices or losses.',priceEdit:'Proposed price (net)',viewProduct:'Open individual selling price settings',partialCount:'Provisional cost',refresh:'Refresh',settings:'Fetch settings'});
  Object.assign(words.zh,{list:'成本清单',rules:'价格计算方式',ownPrice:'本公司价格',net:'未税・类别1',proposal:'建议价格',bulk:'确认所选价格',scrape:'获取参考价格',shortOne:'单独',details:'价格依据',detailHelp:'请选择品号以查看价格依据。',backToList:'返回清单',detailOf:'价格详情',components:'构成部件及采用商品',notSet:'未设置',selectCount:'已选',priceCount:'批量可设',noMatch:'没有符合筛选条件的品号。',fetchSelect:'批量确认仅包含已勾选且符合设置条件的商品。',ecSeparate:'电商价格仅供参考，不用于本公司价格或亏损判断。',priceEdit:'建议价格（未税）',viewProduct:'打开单独销售价格设置',partialCount:'暂算成本',refresh:'刷新',settings:'获取设置'});
  function el(id){return document.getElementById(id);}
  function permitted(){return !!root.currentUser && root.canEditBasePrice() && root.canViewManufacturingCostMgmt() && (!root.canViewBasePrice||root.canViewBasePrice());}
  function owner(){return root.currentUser&&root.currentUser.id;}
  function registeredComponentCount(r){var n=Number(r.registered_component_count);return r.registered_component_count!=null&&Number.isSafeInteger(n)&&n>=0?n:null;}
  function hasCostItems(r){return registeredComponentCount(r)>0;}
  function componentNote(r){return !hasCostItems(r)?(registeredComponentCount(r)==null?'componentUnknown':'costEmpty'):r.cost_snapshot_stale===true?'costSnapshot':r.cost_incomplete===true?'costPartial':null;}
  function existingPrice(r){return r.current_rank1_jpy!=null?money(r.current_rank1_jpy):'—';}
  function registered(r){return r.state==='configured'||r.current_rank1_jpy!=null||Number(r.identity_configured_count)>0;}
  function hasPriceableCost(r){var cost=Number(r.cost_jpy);return hasCostItems(r)&&r.cost_jpy!=null&&Number.isSafeInteger(cost)&&cost>=0;}
  function loss(r){var sale=Number(r.current_rank1_jpy);return r.is_loss===true&&r.current_rank1_jpy!=null&&Number.isSafeInteger(sale)&&sale>=0&&r.cost_jpy!=null&&sale<Number(r.cost_jpy);}
  function canPrice(r){return r.state==='ready'&&hasPriceableCost(r)&&Number(r.dks_price_jpy)>0&&(!registered(r)||loss(r));}
  function canFetch(r){return hasCostItems(r)&&!registered(r)&&!r.dks_price_jpy&&!['missing_product','kind_review','oem_review','identity_review'].includes(r.state);}
  function valid(){return permitted() && state.owner===owner();}
  async function rpc(action,payload){if(!valid())throw Error('session');var r=await root.sb.rpc('manage_sales_pricing_list',{action:action,payload:payload||{}});if(!valid())throw Error('session');if(r.error)throw r.error;return r.data;}
  function status(text,bad){var e=el('spl-status');if(e){e.textContent=text||'';e.classList.toggle('error',!!bad);}}
  function errorText(e){var m=String(e&&e.message||'');if(m==='session')return w('expired');if(/stale|configured|expired/.test(m))return w('stale');return w('error');}
  function button(id,key){return '<button type="button" class="'+(id==='spl-bulk'?'btn-primary':'btn-sm-edit')+'" id="'+id+'">'+esc(w(key))+'</button>';}
  function lock(on){state.busy=on;var host=el('sales-pricing-lists');if(host){host.setAttribute('aria-busy',String(on));host.querySelectorAll('button,input,select').forEach(function(n){n.disabled=on||!!state.pending&&!n.hasAttribute('data-spl-retry');});}if(!on){renderRows();ecRender();}}
  function reset(){if(state.dksProgress)dropDksProgress(state.dksProgress);clearTimeout(state.ecTimer);state.ecTimer=null;state.ec=null;state.epoch++;state.owner=null;state.rows=[];state.lists=[];state.selected.clear();state.focused=null;state.detailOpen=false;state.run=null;state.pending=null;state.busy=false;var host=el('sales-pricing-lists');if(host)host.replaceChildren();document.querySelectorAll('dialog[data-spl-owned]').forEach(function(d){if(d.open)d.close();d.remove();});}
  async function enter(){
    var host=el('sales-pricing-lists');if(!host)return;
    if(!permitted()){reset();host.hidden=true;return;}
    if(state.owner!==owner())reset();state.owner=owner();host.hidden=false;var epoch=++state.epoch;
    host.innerHTML='<div class="spl-workspace"><div class="spl-master"><div class="spl-listbar spl-toolbar"><label for="spl-list"><span>'+esc(w('list'))+'</span><select id="spl-list"><option value="">'+esc(w('choose'))+'</option></select></label>'+button('spl-load','load')+
      '<details class="spl-rules"><summary>'+esc(w('rules'))+'</summary><div><h2>'+esc(w('title'))+'</h2><p>'+esc(w('intro'))+'</p><p>'+esc(w('scope'))+'</p><p>'+esc(w('fetchSelect'))+'</p>'+(root.isSystemAdmin()?button('spl-credentials','settings'):'')+'</div></details></div>'+
      '<div id="spl-status" role="status" aria-live="polite"></div><div id="spl-content"></div></div><aside id="spl-inspector" class="spl-inspector" aria-label="'+esc(w('detailOf'))+'" tabindex="-1"></aside></div><div id="spl-selection"></div>';
    renderInspector();
    el('spl-load').addEventListener('click',function(){load(false);});
    if(el('spl-credentials'))el('spl-credentials').addEventListener('click',credentialSettings);
    lock(true);try{var r=await rpc('lists');if(epoch!==state.epoch)return;state.lists=r.lists||[];el('spl-list').innerHTML='<option value="">'+esc(w('choose'))+'</option>'+state.lists.map(function(l){return '<option value="'+esc(l.id)+'">'+esc(l.list_name)+' · '+esc(l.item_count)+' '+esc(w('count'))+'</option>';}).join('');el('spl-list').value=state.listId;
      if(state.listId&&state.rows.length)renderContent();
    }catch(e){if(epoch===state.epoch)status(errorText(e),true);}finally{if(epoch===state.epoch)lock(false);}
  }
  async function load(keep,preserveEdits){
    if(state.busy||state.pending||!valid())return;
    var id=el('spl-list').value;if(!id)return;
    if(state.ec&&String(state.ec.listId)!==String(id)){clearTimeout(state.ecTimer);state.ec=null;}
    var filterValue=keep&&el('spl-filter')?el('spl-filter').value:null,queryValue=keep&&el('spl-query')?el('spl-query').value:null;
    var oldRows=state.rows,epoch=++state.epoch;lock(true);status(w('loading'));
    try{var runId=crypto.randomUUID();var result=await rpc('preview',{operation_id:runId,list_id:Number(id)});if(epoch!==state.epoch)return;
      state.listId=id;state.run=result.run_id;state.rows=result.rows||[];if(!keep){state.selected.clear();state.focused=null;state.detailOpen=false;}
      if(preserveEdits)state.rows.forEach(function(r){var old=oldRows.find(function(o){return String(o.item_id)===String(r.item_id);});if(old&&canPrice(r)&&old.fingerprint===r.fingerprint&&Number.isSafeInteger(old.edited_jpy)&&old.edited_jpy>=Number(r.minimum_jpy)&&old.edited_jpy%100===0)r.edited_jpy=old.edited_jpy;});
      state.selected=new Set(Array.from(state.selected).filter(function(k){return state.rows.some(function(r){return String(r.item_id)===k;});}));
      renderContent();if(filterValue!=null){el('spl-filter').value=filterValue;el('spl-query').value=queryValue||'';renderRows();}status('');
    }catch(e){if(epoch===state.epoch){state.run=null;state.rows=[];state.focused=null;state.detailOpen=false;el('spl-content').replaceChildren();el('spl-selection').replaceChildren();renderInspector();status(errorText(e),true);}}finally{if(epoch===state.epoch)lock(false);}
  }
  function matchesQuery(r,q){
    if([r.dkd_shohin_id,r.manufacturer_part_number,r.genuine_part_number].join(' ').toLowerCase().includes(q))return true;
    if(!['MITSUBISHI','三菱','三菱電機'].includes(String(r.manufacturer||'').replace(/\s/g,'').toUpperCase()))return false;
    var normalize=function(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^([am])00(\d)t/,'$1$2t');};
    var key=normalize(q);return !!key&&normalize(r.manufacturer_part_number).includes(key);
  }
  function filtered(){var f=el('spl-filter')?el('spl-filter').value:'unconfigured',q=el('spl-query')?el('spl-query').value.trim().toLowerCase():'';return state.rows.filter(function(r){return (f==='any'||f==='unconfigured'&&(!registered(r)||loss(r)&&r.state!=='configured')||f==='ready'&&canPrice(r)||f==='dks_missing'&&r.state==='dks_missing'&&!registered(r)||f==='review'&&(!['ready','configured'].includes(r.state)||r.cost_incomplete===true)||f==='configured'&&registered(r))&&(!q||matchesQuery(r,q));});}
  function renderContent(){
    var filters=['any','ready','dks_missing','configured','review'];
    el('spl-content').innerHTML='<div class="spl-filter-tabs" role="group" aria-label="'+esc(w('filter'))+'">'+filters.map(function(k){return '<button type="button" data-spl-filter="'+k+'" aria-pressed="false"><span>'+esc(w(k))+'</span><strong data-spl-count="'+k+'">0</strong></button>';}).join('')+'</div><div class="spl-toolbar spl-searchbar"><label class="spl-filter-label"><span class="spl-sr-only">'+esc(w('filter'))+'</span><select id="spl-filter">'+['unconfigured','any','ready','dks_missing','review','configured'].map(function(k){return '<option value="'+k+'">'+esc(w(k))+'</option>';}).join('')+'</select></label><input id="spl-query" type="search" aria-label="'+esc(w('search'))+'" placeholder="'+esc(w('search'))+'">'+button('spl-refresh','refresh')+
      '<div class="spl-toolbar spl-aux-tools">'+(root.isSystemAdmin()?button('spl-scrape','scrape'):'')+
      (ecAllowed()?'<details class="spl-tools" data-spl-ec-tools><summary>'+esc(w('ecTools'))+'</summary><div class="spl-tools-popover"><div class="spl-toolbar">'+button('spl-ec','ecFetch')+button('spl-ec-open','ecOpen')+'</div><p class="spl-muted">'+esc(w('ecMinimum'))+'</p></div><div id="spl-ec-status" role="status" aria-live="polite"></div></details>':'')+
      '<div data-spl-log-tools>'+button('spl-history-button','log')+'</div></div></div><div id="spl-rows"></div><div id="spl-history"></div>';
    el('spl-selection').innerHTML='<div class="spl-selection-bar" data-spl-pricing-tools><div><div class="spl-selection-title" id="spl-selected-count"></div><div class="spl-muted" id="spl-summary"></div></div><div class="spl-selection-actions">'+button('spl-none','none')+button('spl-bulk','bulk')+'</div></div>';
    el('spl-filter').addEventListener('change',renderRows);el('spl-query').addEventListener('input',renderRows);
    el('spl-content').querySelectorAll('[data-spl-filter]').forEach(function(n){n.addEventListener('click',function(){if(state.busy||state.pending||!valid())return;el('spl-filter').value=n.dataset.splFilter;renderRows();});});
    el('spl-refresh').addEventListener('click',function(){load(true);});

    el('spl-none').addEventListener('click',function(){state.selected.clear();renderRows();});
    el('spl-bulk').addEventListener('click',function(){confirmPrices(state.rows.filter(function(r){return state.selected.has(String(r.item_id))&&canPrice(r);}),true);});
    if(el('spl-scrape'))el('spl-scrape').addEventListener('click',fetchMissing);
    if(el('spl-ec'))el('spl-ec').addEventListener('click',ecPreview);if(el('spl-ec-open'))el('spl-ec-open').addEventListener('click',function(){if(ecAllowed())root.enterRakutenPrice();});el('spl-history-button').addEventListener('click',history);renderRows();ecRender();
  }
  function selectVisible(on){if(state.busy||state.pending||!valid())return;filtered().forEach(function(r){if(on)state.selected.add(String(r.item_id));else state.selected.delete(String(r.item_id));});renderRows();}
  function rowStatus(r){return registered(r)&&!canPrice(r)?'configured':!hasCostItems(r)&&['ready','cost_review','dks_missing'].includes(r.state)?componentNote(r):canPrice(r)&&r.cost_incomplete?'readyProvisional':r.state;}
  function badge(r){return '<span class="spl-badge spl-'+esc(canPrice(r)?(r.cost_incomplete?'review':'ready'):registered(r)?'configured':'review')+'">'+esc(w(rowStatus(r)))+'</span>';}
  function focusPart(k){if(state.busy||state.pending||!valid()||!filtered().some(function(r){return String(r.item_id)===k;}))return;state.focused=k;state.detailOpen=true;renderInspector();var host=el('spl-rows');host.querySelectorAll('[data-spl-row]').forEach(function(n){n.classList.toggle('spl-active',n.dataset.splRow===k);});host.querySelectorAll('[data-spl-detail]').forEach(function(n){n.setAttribute('aria-pressed',String(n.dataset.splDetail===k));});if(root.matchMedia&&root.matchMedia('(max-width: 900px)').matches)el('spl-inspector').focus();}
  async function openIndividual(k){
    if(state.busy||state.pending||!valid())return;var r=state.rows.find(function(row){return String(row.item_id)===k;});if(!r||r.state==='missing_product'||!r.dkd_shohin_id)return;
    var epoch=state.epoch;lock(true);try{await root.openSalesPricingListProduct(r.dkd_shohin_id,r.product_kind||'rebuilt');}catch(e){if(valid()&&epoch===state.epoch)status(errorText(e),true);}finally{if(valid()&&epoch===state.epoch)lock(false);}
  }
  function editPrice(r,value){if(state.busy||state.pending||!valid()||!canPrice(r))return;r.edited_jpy=Number(value);document.querySelectorAll('[data-spl-price="'+r.item_id+'"],[data-spl-inspect-price="'+r.item_id+'"]').forEach(function(n){if(n.value!==value)n.value=value;});document.querySelectorAll('[data-spl-margin="'+r.item_id+'"]').forEach(function(n){n.textContent=profit(r,r.edited_jpy);});}
  function renderInspector(){
    var host=el('spl-inspector');if(!host)return;var workspace=el('sales-pricing-lists').querySelector('.spl-workspace');workspace.classList.toggle('spl-detail-open',state.detailOpen);
    if(!valid()){host.replaceChildren();return;}var r=filtered().find(function(row){return String(row.item_id)===state.focused;});
    if(!r){host.innerHTML='<p class="spl-detail-placeholder">'+esc(w('detailHelp'))+'</p>';return;}
    var k=String(r.item_id),p=r.edited_jpy==null?r.suggested_jpy:r.edited_jpy;
    host.innerHTML='<button type="button" class="spl-detail-back btn-sm-edit" id="spl-detail-back">'+esc(w('backToList'))+'</button><div class="spl-detail-body"><div class="spl-detail-heading"><h2>'+esc(r.manufacturer_part_number||r.genuine_part_number||'—')+'</h2><p>'+esc(r.manufacturer||'')+(r.genuine_part_number?' · '+esc(r.genuine_part_number):'')+'</p>'+badge(r)+'</div><h3>'+esc(w('details'))+'</h3><dl class="spl-price-facts"><div><dt>'+esc(w('cost'))+'</dt><dd>'+esc(money(r.cost_jpy))+'<small>'+esc(w('floor'))+' '+esc(money(r.minimum_jpy))+'</small></dd></div><div><dt>'+esc(w('dks'))+'</dt><dd>'+esc(money(r.dks_price_jpy))+'<small>'+esc(r.dks_source?w(r.dks_source==='strain3'?'strain':'registered'):'')+' '+esc((r.dks_observed_at||'').slice(0,10))+'</small><small>'+esc(w('target'))+' '+esc(money(r.target_jpy))+'</small></dd></div><div><dt>'+esc(w('ownPrice'))+'<small>'+esc(w('net'))+'</small></dt><dd>'+esc(r.current_rank1_jpy==null?w('notSet'):existingPrice(r))+(loss(r)?'<small class="spl-loss">'+esc(w('lossUpdate'))+'</small>':'')+(Number(r.identity_configured_count)>0&&r.current_rank1_jpy==null?'<small>'+esc(w('relatedConfigured'))+'</small>':'')+'</dd></div></dl>'+
      (canPrice(r)?'<div class="spl-detail-proposal"><label for="spl-detail-price">'+esc(w('priceEdit'))+'</label><input id="spl-detail-price" type="number" min="'+esc(r.minimum_jpy)+'" step="100" data-spl-inspect-price="'+esc(k)+'" value="'+esc(p)+'"><small data-spl-margin="'+esc(k)+'">'+esc(profit(r,p))+'</small></div>':'')+
      '<details class="spl-detail-section" open><summary>'+esc(w('ec'))+'</summary><p>'+esc(r.ec_price_jpy?money(r.ec_price_jpy)+' · '+w(r.ec_tax_basis==='exclusive'?'taxExclusive':r.ec_tax_basis==='inclusive'?'taxInclusive':'taxUnknown'):w('noEc'))+'</p><p class="spl-muted">'+esc(r.ec_seller||'')+' '+esc((r.ec_observed_at||'').slice(0,10))+'</p><p class="spl-muted">'+esc(w('ecSeparate'))+'</p></details>'+
      '<details class="spl-detail-section" open><summary>'+esc(w('components'))+'</summary><p>'+esc(w('componentRegistered'))+' '+esc(registeredComponentCount(r)==null?'—':registeredComponentCount(r))+'</p>'+(componentNote(r)?'<p class="spl-muted">'+esc(w(componentNote(r)))+'</p>':'')+(Number(r.identity_count)>1?'<p class="spl-muted">'+esc(w('chosenProduct'))+' '+esc(r.dkd_shohin_id)+'</p>':'')+'</details></div>'+
      (r.state!=='missing_product'&&r.dkd_shohin_id?'<button type="button" class="btn-sm-edit spl-detail-one" data-spl-inspect-one="'+esc(k)+'">'+esc(w('one'))+'</button>':'');
    host.querySelectorAll('button,input').forEach(function(n){n.disabled=state.busy||!!state.pending;});
    el('spl-detail-back').addEventListener('click',function(){if(state.busy||state.pending||!valid())return;state.detailOpen=false;workspace.classList.remove('spl-detail-open');var n=el('spl-rows').querySelector('[data-spl-detail="'+k+'"]');if(n)n.focus();});
    var input=host.querySelector('[data-spl-inspect-price]');if(input)input.addEventListener('input',function(){editPrice(r,input.value);});var one=host.querySelector('[data-spl-inspect-one]');if(one)one.addEventListener('click',function(){openIndividual(k);});
  }
  function renderRows(){
    var host=el('spl-rows');if(!host||!valid())return;
    el('spl-summary').textContent=state.rows.length+' '+w('count')+' · '+w('ready')+' '+state.rows.filter(canPrice).length+' · '+w('configured')+' '+state.rows.filter(registered).length+' · '+w('total')+' '+state.selected.size;
    var selected=state.rows.filter(function(r){return state.selected.has(String(r.item_id));}),eligible=selected.filter(canPrice),partial=eligible.filter(function(r){return r.cost_incomplete;}).length;
    el('spl-selected-count').textContent=w('selectCount')+' '+selected.length+' · '+w('priceCount')+' '+eligible.length+(selected.length>eligible.length?' · '+w('excluded')+' '+(selected.length-eligible.length):'')+(partial?' · '+w('partialCount')+' '+partial:'');
    el('spl-bulk').disabled=state.busy||!!state.pending||!eligible.length;
    el('spl-content').querySelectorAll('[data-spl-filter]').forEach(function(n){var f=n.dataset.splFilter,c=state.rows.filter(function(r){return f==='any'||f==='ready'&&canPrice(r)||f==='configured'&&registered(r)||f==='dks_missing'&&r.state==='dks_missing'&&!registered(r)||f==='review'&&(!['ready','configured'].includes(r.state)||r.cost_incomplete===true);}).length;n.setAttribute('aria-pressed',String(el('spl-filter').value===f));n.querySelector('strong').textContent=c;});
    var rows=filtered();if(!rows.some(function(r){return String(r.item_id)===state.focused;})){state.focused=rows.length?String(rows[0].item_id):null;state.detailOpen=false;}renderInspector();
    if(!rows.length){host.innerHTML='<p class="spl-empty">'+esc(w(state.rows.length?'noMatch':'empty'))+'</p>';return;}
    var keys=['part','ownPrice','proposal','status'];
    host.innerHTML='<table class="spl-table"><thead><tr><th><label class="spl-check"><input type="checkbox" data-spl-visible-all aria-label="'+esc(w('all'))+'" '+(rows.every(function(r){return state.selected.has(String(r.item_id));})?'checked ':'')+(state.busy||state.pending?'disabled':'')+'><span class="spl-mobile-all">'+esc(w('all'))+'</span></label></th>'+keys.map(function(k){return '<th>'+esc(w(k))+(k==='ownPrice'?'<small>'+esc(w('net'))+'</small>':k==='proposal'?'<small>'+esc(w('taxExclusive'))+'</small>':'')+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){
      var k=String(r.item_id),priceable=canPrice(r),p=r.edited_jpy==null?r.suggested_jpy:r.edited_jpy;
      return '<tr data-spl-row="'+esc(k)+'" class="'+(state.focused===k?'spl-active ':'')+(state.selected.has(k)?'spl-checked':'')+'"><td><label class="spl-check"><input type="checkbox" data-spl-select="'+esc(k)+'" aria-label="'+esc(r.manufacturer_part_number||r.genuine_part_number||w('part'))+'" '+(state.selected.has(k)?'checked ':'')+(state.busy||state.pending?'disabled':'')+'></label></td>'+
      '<td data-label="'+esc(w('part'))+'"><button type="button" class="spl-part" data-spl-detail="'+esc(k)+'" aria-pressed="'+(state.focused===k)+'" aria-controls="spl-inspector" '+(state.busy||state.pending?'disabled':'')+'><strong>'+esc(r.manufacturer_part_number||r.genuine_part_number||'—')+'</strong>'+(r.manufacturer?'<small>'+esc(r.manufacturer)+'</small>':'')+'</button></td>'+
      '<td data-label="'+esc(w('ownPrice'))+'">'+esc(existingPrice(r))+'</td>'+
      '<td data-label="'+esc(w('proposal'))+'">'+(priceable?'<input type="number" min="'+esc(r.minimum_jpy)+'" step="100" data-spl-price="'+esc(k)+'" value="'+esc(p)+'" aria-label="'+esc(w('proposal')+' '+r.manufacturer_part_number)+'" '+(state.busy||state.pending?'disabled':'')+'>':'—')+'</td>'+
      '<td data-label="'+esc(w('status'))+'"><div class="spl-row-state">'+badge(r)+(r.state!=='missing_product'&&r.dkd_shohin_id?'<button class="btn-sm-edit spl-row-one" type="button" aria-label="'+esc(w('one')+' '+(r.manufacturer_part_number||r.genuine_part_number||''))+'" data-spl-one="'+esc(k)+'" '+(state.busy||state.pending?'disabled':'')+'>'+esc(w('shortOne'))+'</button>':'')+'</div></td></tr>';
    }).join('')+'</tbody></table>';
    var all=host.querySelector('[data-spl-visible-all]'),checked=rows.filter(function(r){return state.selected.has(String(r.item_id));}).length;
    all.indeterminate=checked>0&&checked<rows.length;all.addEventListener('change',function(){var focused=document.activeElement===all;selectVisible(all.checked);if(focused){var current=host.querySelector('[data-spl-visible-all]');if(current)current.focus();}});
    host.querySelectorAll('[data-spl-select]').forEach(function(n){n.addEventListener('change',function(){if(state.busy||state.pending||!valid())return;var focused=document.activeElement===n,k=n.dataset.splSelect;if(n.checked)state.selected.add(k);else state.selected.delete(k);renderRows();if(focused){var next=host.querySelector('[data-spl-select="'+k+'"]');if(next)next.focus();}});});
    host.querySelectorAll('[data-spl-price]').forEach(function(n){n.addEventListener('input',function(){var r=state.rows.find(function(r){return String(r.item_id)===n.dataset.splPrice;});editPrice(r,n.value);});});
    host.querySelectorAll('[data-spl-row]').forEach(function(n){n.addEventListener('click',function(e){if(e.target.closest('button,input,select,textarea,a,label'))return;focusPart(n.dataset.splRow);});});
    host.querySelectorAll('[data-spl-detail]').forEach(function(n){n.addEventListener('click',function(){focusPart(n.dataset.splDetail);});});
    host.querySelectorAll('[data-spl-one]').forEach(function(n){n.addEventListener('click',function(){openIndividual(n.dataset.splOne);});});
    if(el('spl-bulk'))el('spl-bulk').disabled=state.busy||!!state.pending||!state.rows.some(function(r){return canPrice(r)&&state.selected.has(String(r.item_id));});
  }
  function profit(r,p){return p>0?money(p-r.cost_jpy)+' / '+((p-r.cost_jpy)/p*100).toFixed(1)+'%'+(r.cost_incomplete===true?' · '+w('provisional'):''):'—';}
  function dialog(title,body,saveKey){
    var d=document.createElement('dialog');d.className='spl-dialog';d.dataset.splOwned='1';
    d.innerHTML='<form method="dialog"><h2>'+esc(title)+'</h2>'+body+'<p class="error" id="spl-dialog-error" role="alert"></p><div class="spl-dialog-actions"><button type="button" data-spl-cancel>'+esc(w('cancel'))+'</button><button type="button" data-spl-confirm class="btn-primary">'+esc(w(saveKey))+'</button></div></form>';
    document.body.appendChild(d);if(typeof d.showModal!=='function'){d.remove();status(w('error'),true);return null;}d.showModal();
    d.querySelector('[data-spl-cancel]').addEventListener('click',function(){d.close();});
    d.addEventListener('close',function(){d.querySelectorAll('input').forEach(function(n){n.value='';});d.remove();});return d;
  }
  function confirmPrices(rows,bulk){
    if(state.busy||state.pending||!valid())return;if(!rows.length){status(w('noSelection'),true);return;}
    if(rows.some(function(r){return !canPrice(r);})){status(w('stale'),true);return;}
    var items=rows.map(function(r){return {item_id:r.item_id,price_jpy:r.edited_jpy==null?Number(r.suggested_jpy):r.edited_jpy};});
    if(items.some(function(p,i){return !Number.isSafeInteger(p.price_jpy)||p.price_jpy>2147483647||p.price_jpy<Number(rows[i].minimum_jpy)||p.price_jpy%100!==0;})){status(w('invalid'),true);return;}
    var run=state.run,selectedList=state.listId;
    if(bulk&&state.selected.size>rows.length){status(w('excluded')+' '+(state.selected.size-rows.length)+' '+w('count')+' / '+w('ready')+' '+rows.length+' '+w('count'));}
    var d=dialog(w('confirm'),'<p>'+esc(w('confirmText'))+'</p><p><strong>'+esc((state.lists.find(function(l){return String(l.id)===selectedList;})||{}).list_name||'')+' · '+items.length+' '+esc(w('count'))+'</strong></p><ul class="spl-confirm-items">'+rows.map(function(r,i){return '<li><span>'+esc(r.manufacturer_part_number||r.genuine_part_number)+(r.genuine_part_number?'<small>'+esc(r.genuine_part_number)+'</small>':'')+(r.cost_incomplete===true?'<small>'+esc(w(componentNote(r)||'costPartial'))+'</small>':'')+'</span><strong>'+esc(money(items[i].price_jpy))+'</strong></li>';}).join('')+'</ul>','save');
    if(!d)return;
    d.querySelector('[data-spl-confirm]').addEventListener('click',function(){if(state.busy||!valid()||run!==state.run||selectedList!==el('spl-list').value){el('spl-dialog-error').textContent=w('stale');return;}state.pending={operation_id:run,items:items};d.close();commit();},{once:true});
  }
  async function commit(){
    if(state.busy||!state.pending||!valid())return;var pending=state.pending;lock(true);status(w('loading'));
    try{var result=await rpc('commit',pending);if(state.pending!==pending)return;state.pending=null;state.selected.clear();status(w('saved')+' '+result.saved_count+' '+w('count'));state.busy=false;await load(false);status(w('saved')+' '+result.saved_count+' '+w('count'));
    }catch(e){if(!valid()){reset();return;}var code=String(e&&e.code||'');if(/^(22|23|40|42|P0)/.test(code)){state.pending=null;status(errorText(e),true);}else{status(w('unknown'),true);var retry=document.createElement('button');retry.type='button';retry.dataset.splRetry='1';retry.textContent=w('retry');retry.addEventListener('click',commit);el('spl-status').appendChild(retry);}}
    finally{if(valid())lock(false);}
  }
  function historyItem(x){
    var items=(x.items||[]).filter(function(i){return !x.result||(x.result.saved||[]).some(function(s){return String(s.item_id)===String(i.item_id);});});
    return '<li><details><summary>'+esc(new Date(x.created_at).toLocaleString())+' · '+esc(x.list_name)+' · '+esc(w(x.committed_at?'committed':'prepared'))+' '+esc(x.result?x.result.saved_count:x.selected_count)+' '+esc(w('count'))+'</summary><ul>'+items.map(function(i){var saved=x.result&&(x.result.saved||[]).find(function(s){return String(s.item_id)===String(i.item_id);});return '<li>'+esc(i.manufacturer_part_number||i.genuine_part_number||'—')+(saved?' · '+esc(money(saved.price_jpy)):'')+'</li>';}).join('')+'</ul></details></li>';
  }
  async function history(){if(state.busy||!valid())return;lock(true);try{var r=await rpc('history',{list_id:Number(state.listId)});el('spl-history').innerHTML='<h3>'+esc(w('history'))+'</h3>'+((r.history||[]).length?'<ul>'+r.history.map(historyItem).join('')+'</ul>':'<p>'+esc(w('historyEmpty'))+'</p>');}catch(e){status(errorText(e),true);}finally{lock(false);}}
  async function credentialCall(action,payload){
    if(!valid()||!root.isSystemAdmin())throw Error('session');
    var r=await root.sb.functions.invoke('sales-pricing-dks-fetch',{body:Object.assign({action:'credentials_'+action},payload||{}),signal:AbortSignal.timeout(35000)});
    if(!valid()||!root.isSystemAdmin())throw Error('session');
    if(r.error)throw r.error;if(!r.data||typeof r.data.configured!=='boolean')throw Error('invalid_response');return r.data;
  }
  async function credentialSettings(){
    if(state.busy||state.pending||!valid()||!root.isSystemAdmin())return;
    var epoch=state.epoch,info;lock(true);status(w('loading'));
    try{info=await credentialCall('status');}catch(e){if(valid()&&epoch===state.epoch)status(errorText(e),true);return;}finally{if(valid()&&epoch===state.epoch)lock(false);}
    if(!valid()||epoch!==state.epoch)return;status('');
    var d=dialog(w('settings'),'<p>'+esc(w('credentialHelp'))+'</p><p><strong>'+esc(w(info.configured?'stored':'notStored'))+'</strong>'+(info.updated_at?'<br>'+esc(new Date(info.updated_at).toLocaleString()):'')+'</p><label>'+esc(w('basicUser'))+'<input name="basic_username" type="password" value="daiko-system2" autocomplete="off" maxlength="255" required></label><label>'+esc(w('basicPassword'))+'<input name="basic_password" type="password" autocomplete="off" maxlength="255" required></label><label>'+esc(w('password'))+'<input name="password" type="password" autocomplete="off" maxlength="255" required></label>'+(info.configured?'<p><button type="button" class="btn-sm-edit spl-remove" data-spl-remove>'+esc(w('credentialRemove'))+'</button></p>':''),'credentialSave');
    if(!d)return;
    var saving=false;d.addEventListener('cancel',function(e){if(saving)e.preventDefault();});
    d.querySelector('[data-spl-confirm]').addEventListener('click',async function(){
      if(saving||state.busy||!valid()||!root.isSystemAdmin()||epoch!==state.epoch)return;
      if(!d.querySelector('form').reportValidity())return;
      var credentials={};['basic_username','basic_password','password'].forEach(function(k){credentials[k]=d.querySelector('[name="'+k+'"]').value;});
      if(Object.keys(credentials).some(function(k){return !credentials[k]||/[\r\n]/.test(credentials[k]);})||credentials.basic_username.includes(':')){el('spl-dialog-error').textContent=w('error');return;}
      saving=true;d.querySelectorAll('button,input').forEach(function(n){n.disabled=true;});
      await credentialMutation('save',info,credentials,d,epoch);
    });
    var remove=d.querySelector('[data-spl-remove]');if(remove)remove.addEventListener('click',function(){
      if(state.busy||!valid()||epoch!==state.epoch)return;d.close();
      var confirm=dialog(w('credentialRemove'),'<p>'+esc(w('credentialRemoveHelp'))+'</p>','credentialRemove');if(!confirm)return;
      confirm.querySelector('[data-spl-confirm]').addEventListener('click',function(){if(state.busy||!valid()||epoch!==state.epoch)return;confirm.querySelectorAll('button').forEach(function(n){n.disabled=true;});credentialMutation('remove',info,null,confirm,epoch);},{once:true});
    });
  }
  async function credentialMutation(action,info,credentials,d,epoch){
    var op=crypto.randomUUID(),ok=false;lock(true);status(w('loading'));
    // Clear input nodes before network work; the temporary object is cleared below.
    d.querySelectorAll('input').forEach(function(n){n.value='';});
    try{var result=await credentialCall(action,{operation_id:op,expected_revision:info.revision,credentials:credentials});ok=result.revision===op&&result.configured===(action==='save');}
    catch(e){if(valid()&&epoch===state.epoch){try{var check=await credentialCall('status');ok=check.revision===op&&check.configured===(action==='save');}catch(ignore){}}}
    finally{if(credentials)Object.keys(credentials).forEach(function(k){credentials[k]='';});if(d.open)d.close();if(valid()&&epoch===state.epoch){lock(false);status(w(ok?(action==='save'?'credentialSaved':'credentialRemoved'):'credentialUnknown'),!ok);}}
  }
  async function dksReviewResult(result){
    var data=result&&result.data,context=result&&result.error&&result.error.context;
    if(!data&&context&&typeof context.clone==='function'){
      try{var response=context.clone();if(typeof response.json==='function')data=await response.json();}catch(ignore){}
    }
    var keys={dks_tax_basis_unverified:'fetchTax',dks_gateway_rejected:'fetchGateway',dks_login_required:'fetchLogin',dks_login_layout_unverified:'fetchLayout',dks_search_layout_unverified:'fetchLayout',dks_layout_or_identity_unverified:'fetchIdentity',dks_oem_required:'fetchOem',dks_ambiguous_prices:'fetchAmbiguous',quote_not_saved:'fetchStore'};
    var reason=data&&(typeof data.reason==='string'?data.reason:data.error),httpStatus=Number(context&&context.status);
    var key=Object.prototype.hasOwnProperty.call(keys,reason)?keys[reason]:['credentials_not_configured','credentials_required'].includes(reason)?'credentialNeeded':[401,403].includes(httpStatus)||['unauthorized','forbidden','forbidden_origin'].includes(reason)?'fetchAccess':httpStatus===429||reason==='credential_rate_limit'?'fetchRateLimit':'fetchReview';
    var stop=[401,403,429].includes(httpStatus)||['unauthorized','forbidden','forbidden_origin','credentials_not_configured','credentials_required','credential_rate_limit','dks_gateway_rejected','dks_login_required','dks_login_layout_unverified'].includes(reason);
    return {key:key,stop:stop};
  }
  async function fetchMissing(){
    if(state.busy||state.pending||!valid()||!root.isSystemAdmin())return;
    if(document.querySelector('dialog[data-spl-dks],dialog[data-spl-dks-progress]'))return;
    var capturedRun=state.run,epoch=state.epoch,listId=state.listId;
    if(!dksCurrent(capturedRun,epoch,listId)){status(w('stale'),true);return;}
    var seen=new Set(),rows=filtered().filter(function(r){var id=Number(r.dkd_shohin_id);if(!canFetch(r)||!Number.isSafeInteger(id)||id<=0||seen.has(id))return false;seen.add(id);return true;});
    if(!rows.length){status(w('fetchNothing'),true);return;}
    var selectedIds=new Set(filtered().filter(function(r){return canFetch(r)&&seen.has(Number(r.dkd_shohin_id))&&state.selected.has(String(r.item_id));}).map(function(r){return Number(r.dkd_shohin_id);}));
    var hasVisibleSelection=filtered().some(function(r){return state.selected.has(String(r.item_id));});
    var d=dialog(w('credentials'),'<p>'+esc(w('fetchHelp'))+'</p><p><strong>'+esc((state.lists.find(function(l){return String(l.id)===String(listId);})||{}).list_name||'')+'</strong></p><label class="spl-dks-select-all"><input type="checkbox" data-spl-dks-all>'+esc(w('fetchAll'))+'</label><p data-spl-dks-count role="status" aria-live="polite"></p><ul class="spl-confirm-items spl-dks-targets">'+rows.map(function(r){return '<li><label class="spl-dks-target"><input type="checkbox" data-spl-dks-id="'+esc(r.dkd_shohin_id)+'" '+(!hasVisibleSelection||selectedIds.has(Number(r.dkd_shohin_id))?'checked':'')+'><span><strong>'+esc(r.manufacturer_part_number||r.genuine_part_number||'—')+'</strong><small>'+esc([r.manufacturer,r.genuine_part_number].filter(Boolean).join(' / '))+'</small></span></label></li>';}).join('')+'</ul>','fetch');
    if(!d)return;d.dataset.splDks='1';d.setAttribute('aria-label',w('credentials'));
    var inputs=Array.from(d.querySelectorAll('[data-spl-dks-id]')),all=d.querySelector('[data-spl-dks-all]'),confirm=d.querySelector('[data-spl-confirm]');
    function update(){var count=inputs.filter(function(n){return n.checked;}).length;all.checked=count===inputs.length;all.indeterminate=count>0&&count<inputs.length;confirm.disabled=!count;d.querySelector('[data-spl-dks-count]').textContent=w('fetchTargets')+' '+count+' / '+inputs.length+' '+w('count');}
    inputs.forEach(function(n){n.addEventListener('change',update);});all.addEventListener('change',function(){inputs.forEach(function(n){n.checked=all.checked;});update();});update();status('');
    confirm.addEventListener('click',function(){
      if(!d.open||state.busy||state.pending)return;
      if(!dksCurrent(capturedRun,epoch,listId)){el('spl-dialog-error').textContent=w('stale');return;}
      var ids=new Set(inputs.filter(function(n){return n.checked;}).map(function(n){return Number(n.dataset.splDksId);}));
      if(!ids.size){el('spl-dialog-error').textContent=w('fetchMissing');return;}
      d.close();fetchDksRows(rows.filter(function(r){return ids.has(Number(r.dkd_shohin_id));}),capturedRun,epoch,listId);
    });
  }
  function dksCurrent(run,epoch,listId){return valid()&&root.isSystemAdmin()&&!!run&&run===state.run&&epoch===state.epoch&&String(listId)===String(state.listId)&&el('spl-list')&&String(listId)===String(el('spl-list').value);}
  function dropDksProgress(job){clearTimeout(job.timer);if(state.dksProgress===job)state.dksProgress=null;if(job.dialog.open)job.dialog.close();}
  function dksCounts(job){var counts={fetched:0,held:0,failed:0,pending:0,working:0};job.items.forEach(function(item){counts[item.status]++;});return counts;}
  function dksSummary(job){var c=dksCounts(job);return ['fetched','held','failed','pending'].map(function(k){return w({fetched:'fetchFetched',held:'fetchOnHold',failed:'fetchError',pending:'fetchPending'}[k])+' '+c[k];}).join(' · ');}
  function renderDksProgress(job){
    if(state.dksProgress!==job||!valid())return;
    var d=job.dialog,c=dksCounts(job),done=c.fetched+c.held+c.failed;
    d.querySelector('h2').textContent=w(job.finished?'fetchResultTitle':'fetchProgressTitle');
    d.querySelector('[data-spl-fetch-stage]').textContent=w(job.message);
    d.querySelector('progress').value=done;d.querySelector('[data-spl-fetch-count]').textContent=w('fetchProcessed')+' '+done+' / '+job.items.length+' '+w('count');
    d.querySelector('[data-spl-fetch-elapsed]').textContent=w('fetchElapsed')+' '+Math.floor(((job.finishedAt||Date.now())-job.startedAt)/1000)+' '+w('fetchSeconds');
    d.querySelector('[data-spl-fetch-current]').textContent=!job.finished&&job.active>=0?w('fetchCurrent')+'：'+job.items[job.active].part:'';
    d.querySelector('[data-spl-fetch-totals]').textContent=dksSummary(job);
    d.querySelectorAll('[data-spl-fetch-result]').forEach(function(n,i){var item=job.items[i];n.dataset.status=item.status;n.querySelector('[data-spl-fetch-state]').textContent=w(item.status==='held'&&item.detail==='fetchIdentity'?'fetchUnmatched':{pending:'fetchPending',working:'fetchWorking',fetched:'fetchFetched',held:'fetchOnHold',failed:'fetchError'}[item.status]);n.querySelector('small').textContent=item.detail?w(item.detail):item.price!=null?money(item.price):'';});
    d.querySelector('[data-spl-confirm]').disabled=!job.finished;d.dataset.finished=String(job.finished);
  }
  function startDksProgress(rows,capturedRun,epoch,listId){
    var d=dialog(w('fetchProgressTitle'),'<section class="spl-fetch-progress"><p data-spl-fetch-stage role="status" aria-live="polite"></p><progress max="'+rows.length+'" value="0" aria-label="'+esc(w('fetchProcessed'))+'"></progress><div class="spl-fetch-counts"><strong data-spl-fetch-count role="status" aria-live="polite" aria-atomic="true"></strong><span data-spl-fetch-elapsed></span></div><p data-spl-fetch-current aria-live="polite"></p><p data-spl-fetch-totals></p></section><ol class="spl-fetch-results">'+rows.map(function(r){return '<li data-spl-fetch-result><strong>'+esc(r.manufacturer_part_number||r.genuine_part_number||'—')+'</strong><span data-spl-fetch-state></span><small></small></li>';}).join('')+'</ol>','close');
    if(!d)return null;d.dataset.splDksProgress='1';d.querySelector('h2').id='spl-fetch-progress-title';d.setAttribute('aria-labelledby','spl-fetch-progress-title');d.setAttribute('tabindex','-1');
    var job={dialog:d,items:rows.map(function(r){return {part:r.manufacturer_part_number||r.genuine_part_number||'—',status:'pending'};}),active:-1,message:'fetchChecking',startedAt:Date.now(),finished:false,timer:null,refreshEpoch:null};state.dksProgress=job;
    d.querySelector('[data-spl-cancel]').hidden=true;d.querySelector('[data-spl-confirm]').addEventListener('click',function(){if(job.finished)dropDksProgress(job);});
    d.addEventListener('cancel',function(e){if(!job.finished)e.preventDefault();});d.querySelector('form').addEventListener('submit',function(e){e.preventDefault();});
    d.addEventListener('close',function(){clearTimeout(job.timer);if(state.dksProgress===job)state.dksProgress=null;});
    function tick(){if(state.dksProgress!==job)return;var current=job.refreshEpoch==null?dksCurrent(capturedRun,epoch,listId):valid()&&root.isSystemAdmin()&&job.refreshEpoch===state.epoch&&String(listId)===String(state.listId)&&el('spl-list')&&String(listId)===String(el('spl-list').value);if(!current){dropDksProgress(job);return;}renderDksProgress(job);job.timer=setTimeout(tick,1000);}
    renderDksProgress(job);d.focus();job.timer=setTimeout(tick,1000);return job;
  }
  function finishDksProgress(job,message){clearTimeout(job.timer);job.finished=true;job.finishedAt=Date.now();job.active=-1;job.message=message;renderDksProgress(job);if(state.dksProgress===job)job.dialog.querySelector('[data-spl-confirm]').focus();}
  async function fetchDksRows(rows,capturedRun,epoch,listId){
    if(state.busy||state.pending||!dksCurrent(capturedRun,epoch,listId))return;
    var job=startDksProgress(rows,capturedRun,epoch,listId);if(!job)return;lock(true);status(w('fetchChecking'));
    try{
      var info=await credentialCall('status');if(!dksCurrent(capturedRun,epoch,listId))return;if(!info.configured){finishDksProgress(job,'credentialNeeded');status(w('credentialNeeded'),true);return;}
      for(var i=0;i<rows.length;i++){
        if(!dksCurrent(capturedRun,epoch,listId))return;
        job.active=i;job.items[i].status='working';job.message='fetchWaiting';renderDksProgress(job);status(w('fetchWaiting')+' '+(i+1)+' / '+rows.length);
        var r;
        try{r=await root.sb.functions.invoke('sales-pricing-dks-fetch',{body:{dkd_shohin_id:rows[i].dkd_shohin_id},signal:AbortSignal.timeout(105000)});}
        catch(e){r={error:e||{}};}
        if(!dksCurrent(capturedRun,epoch,listId))return;
        if(!r||typeof r!=='object')r={error:{}};
        if(!r.error&&r.data&&r.data.status==='fetched'){job.items[i].status='fetched';job.items[i].price=r.data.price_jpy;renderDksProgress(job);continue;}
        var review=await dksReviewResult(r);if(!dksCurrent(capturedRun,epoch,listId))return;
        job.items[i].status=r.error&&review.key==='fetchReview'?'failed':'held';job.items[i].detail=r.error&&review.key==='fetchReview'?'fetchRequestUnknown':review.key;renderDksProgress(job);
        if(review.stop){job.stopKey=review.key;break;}
      }
    }catch(e){if(dksCurrent(capturedRun,epoch,listId)){if(job.active<0){finishDksProgress(job,'fetchStartFailed');status(w('fetchStartFailed'),true);return;}job.items[job.active].status='failed';job.items[job.active].detail='fetchRequestUnknown';}}
    finally{if(valid()&&epoch===state.epoch)lock(false);if(!dksCurrent(capturedRun,epoch,listId)&&state.dksProgress===job)dropDksProgress(job);}
    if(dksCurrent(capturedRun,epoch,listId)){
      job.active=-1;job.message='fetchRefreshing';renderDksProgress(job);var refreshEpoch=state.epoch+1;job.refreshEpoch=refreshEpoch;await load(true,true);
      if(valid()&&state.epoch===refreshEpoch&&String(listId)===String(state.listId)&&state.dksProgress===job){var c=dksCounts(job),bad=!!(c.held||c.failed||c.pending),message=!state.run?'fetchRefreshFailed':c.pending?'fetchPartial':bad?'fetchFinishedWithIssues':'fetchComplete';finishDksProgress(job,message);status(w(message)+' '+dksSummary(job)+(job.stopKey?'：'+w(job.stopKey):''),bad||!state.run);}
      else if(state.dksProgress===job)dropDksProgress(job);
    }
  }
  function ecAllowed(){return valid()&&typeof root.canUseRakutenResearch==='function'&&root.canUseRakutenResearch()&&typeof root.canViewPriceResearchHistory==='function'&&root.canViewPriceResearchHistory();}
  function ecCurrent(job){return ecAllowed()&&state.ec===job&&String(job.listId)===String(state.listId)&&el('spl-list')&&String(job.listId)===String(el('spl-list').value);}
  function ecRender(){
    var e=el('spl-ec-status');if(!e)return;e.replaceChildren();var job=state.ec;
    if(el('spl-ec'))el('spl-ec').disabled=state.busy||!!state.pending||!!job;
    if(!job)return;e.textContent=w(job.message||'ecRunning')+(job.progress?' '+job.progress:'');
    var check=document.createElement('button');check.type='button';check.textContent=w('ecCheck');check.disabled=!!job.checking;check.addEventListener('click',function(){ecPoll(job);});e.appendChild(check);
  }
  async function ecRead(table,query){var result=await query(root.sb.from(table));if(!ecAllowed())throw Error('session');if(result.error)throw result.error;return result.data;}
  async function ecPreview(){
    if(state.busy||state.pending||state.ec||!ecAllowed())return;
    var listId=Number(state.listId),epoch=state.epoch,args={p_list_id:listId,p_provider_keys:root.getEcMallSelectedProviders(),p_seller_ids:root.getEcMallSellerIds(),p_include_used:root.getEcMallIncludeUsed(),p_commit:false,p_expected_token:null};
    lock(true);status(w('loading'));
    try{
      var running=await ecRead('ec_price_research_runs',function(q){return q.select('id').eq('status','running').limit(1);});if(running.length){status(w('ecOther'));return;}
      var result=await root.sb.rpc('import_ec_targets_from_cost_list',args);if(!ecAllowed()||epoch!==state.epoch)return;if(result.error)throw result.error;var p=result.data;
      var ids=Array.from(new Set((p.rows||[]).map(function(r){return Number(r.existing_target_id);}).filter(function(id){return id>0;}))),existing=[];
      for(var n=0;n<ids.length;n+=100){var chunk=ids.slice(n,n+100);existing=existing.concat(await ecRead('ec_price_research_targets',function(q){return q.select('id,dkd_shohin_id,enabled').in('id',chunk);}));}
      if(epoch!==state.epoch||String(listId)!==String(state.listId))return;
      var candidateRows=(p.rows||[]).filter(function(r){return r.status==='add'||r.reason==='list_duplicate'&&(p.rows||[]).some(function(a){return a.status==='add'&&Number(a.dkd_shohin_id)===Number(r.dkd_shohin_id);})||r.status==='duplicate'&&r.reason!=='disabled_target'&&existing.some(function(t){return t.enabled&&Number(t.id)===Number(r.existing_target_id)&&Number(t.dkd_shohin_id)===Number(r.dkd_shohin_id);});});
      var uniqueProducts=Array.from(new Set(candidateRows.map(function(r){return Number(r.dkd_shohin_id);})));if(!uniqueProducts.length){status(w('ecNothing'),true);return;}
      var skipped=(p.rows||[]).length-candidateRows.length;
      var d=dialog(w('ecTitle'),'<p>'+esc(w('ecHelp'))+'</p><p><strong>'+esc(p.list.list_name)+'</strong></p><p>'+esc(w('ecCounts'))+'：'+uniqueProducts.length+' / '+Number(p.counts.add)+' / '+skipped+'</p><ul class="spl-confirm-items">'+candidateRows.filter(function(r,i,a){return a.findIndex(function(x){return x.dkd_shohin_id===r.dkd_shohin_id;})===i;}).map(function(r){return '<li><span>'+esc(r.manufacturer_part_number||r.genuine_part_number)+(r.genuine_part_number?'<small>'+esc(r.genuine_part_number)+'</small>':'')+'</span></li>';}).join('')+'</ul><p>'+esc(w('ecScope'))+'</p>','ecStart');
      if(d)d.querySelector('[data-spl-confirm]').addEventListener('click',function(){if(state.busy||!ecAllowed()||epoch!==state.epoch||Number(el('spl-list').value)!==listId)return;d.close();ecStart(args,p,uniqueProducts,existing,epoch);},{once:true});status('');
    }catch(e){if(valid()&&epoch===state.epoch)status(errorText(e),true);}finally{if(valid()&&epoch===state.epoch)lock(false);}
  }
  async function ecStart(args,preview,products,existing,epoch){
    if(state.busy||!ecAllowed())return;lock(true);status(w('loading'));var targetIds=[],job;
    try{
      var added=[];if(preview.counts.add){var saved=await root.sb.rpc('import_ec_targets_from_cost_list',Object.assign({},args,{p_commit:true,p_expected_token:preview.token}));if(saved.error)throw saved.error;if(!saved.data||saved.data.inserted!==preview.counts.add||!Array.isArray(saved.data.targets)||saved.data.targets.length!==preview.counts.add)throw Error('unknown_add');added=saved.data.targets;}
      if(!ecAllowed()||epoch!==state.epoch)return;
      targetIds=Array.from(new Set(existing.concat(added).filter(function(t){return t.enabled&&products.includes(Number(t.dkd_shohin_id));}).map(function(t){return Number(t.id);}))).sort(function(a,b){return a-b;});
      if(!targetIds.length)throw Error('unknown_add');
      job={listId:args.p_list_id,requestId:crypto.randomUUID(),runId:null,message:'ecUnknown',checking:false};state.ec=job;
      var r=await root.sb.functions.invoke('ec-price-research-start',{body:{target_ids:targetIds,source_list_id:args.p_list_id,request_id:job.requestId,batch_size:5},signal:AbortSignal.timeout(35000)});
      if(!ecCurrent(job))return;if(r.error)throw r.error;
      if(r.data&&r.data.already_running){state.ec=null;status(w('ecOther'));return;}
      if(!r.data||!r.data.accepted||!r.data.run||!r.data.run.id)throw Error('unknown_start');
      job.runId=r.data.run.id;job.message='ecRunning';status('');await ecPoll(job);
    }catch(e){if(valid()&&epoch===state.epoch){if(job){status('');job.message='ecUnknown';ecRender();await ecPoll(job);}else status(/STALE|40001/.test(String(e.message||e.code))?w('stale'):w('ecAddUnknown'),true);}}
    finally{if(valid()&&epoch===state.epoch){lock(false);ecRender();}}
  }
  async function ecPoll(job){
    if(!ecCurrent(job)||job.checking)return;clearTimeout(state.ecTimer);
    if(state.busy||state.pending||Array.from(document.querySelectorAll('dialog[data-spl-owned]')).some(function(d){return d.open;})){state.ecTimer=setTimeout(function(){ecPoll(job);},10000);return;}
    job.checking=true;ecRender();
    try{
      var rows=await ecRead('ec_price_research_runs',function(q){q=q.select('id,status,target_count,success_count,failed_count,skipped_count').eq('requested_by',state.owner);return job.runId?q.eq('id',job.runId).limit(1):q.contains('settings',{request_id:job.requestId}).order('id',{ascending:false}).limit(1);});
      if(!ecCurrent(job))return;var run=rows[0];if(!run){job.message='ecUnknown';return;}job.runId=run.id;
      job.progress=Number(run.success_count||0)+Number(run.failed_count||0)+Number(run.skipped_count||0)+' / '+Number(run.target_count||0);
      if(run.status==='running'){job.message='ecRunning';state.ecTimer=setTimeout(function(){ecPoll(job);},10000);}
      else{state.ec=null;job.checking=false;var partial=run.status!=='completed'||Number(run.failed_count)>0||Number(run.skipped_count)>0;state.busy=false;await load(true,true);if(ecAllowed())status(w(partial?'ecPartial':'ecDone'),partial);}
    }catch(e){if(ecCurrent(job))job.message='ecUnknown';}
    finally{job.checking=false;if(valid())ecRender();}
  }
  root.DcatsSalesPricingLists={enter:enter,reset:reset,refresh:function(){if(valid()&&state.run)return load(true,true);}};
  // Account, permission and screen changes clear financial/credential UI. No
  // session is copied from another browser or persisted in browser storage.
  var screen=el('screen-sales-pricing-mgmt');
  if(screen)new MutationObserver(function(){if(!screen.classList.contains('active')||!valid())reset();}).observe(screen,{attributes:true,attributeFilter:['class']});
  root.addEventListener('pagehide',reset);
})(window);

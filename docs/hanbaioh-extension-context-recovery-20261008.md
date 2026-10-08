# 販売王連携の拡張接続切れ案内（v1.1.1138）

本人画像でcontent bridgeのruntime不在によるsendMessage例外を確認。
対応するPC拡張0.5.9は固定 `EXTENSION_CONTEXT_INVALIDATED` を返す。

D-CATSは送信前の端末照合、または未起動の設定画面要求でこの固定failureを
受けた場合だけHBR-11を表示する。設定パネルを閉じ、画面上部の［更新］で
ページを読み込み直す案内を日本語/英語/中国語で表示する。
無応答のHBR-01には「拡張cardの丸矢印→D-CATSの［更新］」の順序を明記。

進行中のlogin/export/売上の結果不明、再送抑止、本人確認、権限、
固定company/device、署名検証は維持。自動reload/自動Native再送は追加しない。

検証: workflowの128 node検証、build/response headers、
3言語×1280/390/320幅の47 headless UI検証成功。
新エラーはissuer/Native呼出0、ボタンのbusy解除、秘密本文の非表示を確認。
保存成功/403拒否/画面キャンセル/管理者以外の非表示も確認。

本人環境の修正版反映と実設定画面起動はまだ未確認。
Google接続成功は既存記録を保持し、再認証を反復しない。
DB/Edge/秘密/受付変更なし。バックアップ本登録・復旧は未完了。

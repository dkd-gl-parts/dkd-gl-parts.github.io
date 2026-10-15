# 販売王のバックアップ準備画面への入口

「バックアップ・CSV取込準備」は、選択したCSVに対応する専用画面を開く操作です。
通常のPC接続確認は、独立したD-CATS本人認証やGoogle許可を実行しません。
その結果だけから、専用画面で確認する項目まで確認済みであることを要求すると、
保存済みの設定がある場合でも専用画面へ到達できません。

画面を開く前には、拡張機能、現在の端末、会社・利用者の対応、選択したCSV、
署名付き準備要求を照合します。ブラウザの準備確認は既存の `prepare` 区分を使い、
Google許可や復旧状態の確認済み表示・`ready=true` を捏造しません。

実際のバックアップ開始には、PC側の `runProductionPreimportBackup` が独立した
D-CATS本人認証、現在のサーバー上の対応、Google設定・許可、バックアップ用
パスワード、2名の復旧設定、バックアップアダプタを再確認します。全項目が
確認できた後の明示的な開始操作まで、バックアップ実行器を生成しません。
この変更は取込受付、物理アダプタの有効化、署名期限、再送制御を変更しません。

検証は `scripts/verify-integration-readiness.js`、
`scripts/verify-hanbaioh-preimport-backup.js` と、連携本体の
`production-preimport-backup-controller.test.mjs` で行います。

# D-CATS の接続先設定

画面の接続先は `config/supabase-origin.json` の `origin` で設定します。既定値は現在の Supabase の URL です。ログインのストレージキーは、接続先の変更後も `sb-jqoeqximtwfpqwzngutj-auth-token` を使います。

Cloudflare 用の `node scripts/build-static-site.js` は、アプリ、HTML の CSP と事前接続、`_headers`、ScanFlow、コンシェルジュ、3D の URL 検証へこの値を反映して `dist` を生成します。GitHub Pages が直接配信する静的ファイルは、設定変更後に `node scripts/sync-supabase-origin.js --write` で更新し、生成結果を設定と一緒にコミットします。CSP の接続先と ScanFlow の認証パスはこの処理で同時に更新されます。

Cloudflare の API 取り次ぎは別の変更です。

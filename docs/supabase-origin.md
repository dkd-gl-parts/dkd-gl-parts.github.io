# D-CATS の接続先設定

画面の接続先は `config/supabase-origin.json` の `origin` で設定します。既定値は現在の Supabase の URL です。ログインのストレージキーは、接続先の変更後も `sb-jqoeqximtwfpqwzngutj-auth-token` を使います。

Cloudflare 用の `node scripts/build-static-site.js` は、アプリ、HTML の CSP と事前接続、`_headers`、ScanFlow、コンシェルジュ、3D の URL 検証へこの値を反映して `dist` を生成します。GitHub Pages が直接配信する静的ファイルは、設定変更後に `node scripts/sync-supabase-origin.js --write` で更新し、生成結果を設定と一緒にコミットします。CSP の接続先と ScanFlow の認証パスはこの処理で同時に更新されます。

## Cloudflare Pages の API 取り次ぎ

既存の本番CIはリポジトリのルートから `wrangler pages deploy dist --project-name=dcats` を実行します。ルートの `functions` を Wrangler がコンパイルし、`dist` は静的配信用に使います。

`_routes.json` は `dist` にコピーされ、`/rest/v1/`、`/auth/v1/`、`/storage/v1/`、`/functions/v1/` 配下だけで Functions を実行します。API のサービス結び付けがある場合は、受け取ったリクエストを `API` へ渡します。結び付けがない場合は JSON の 404 を返します。画面の接続先と静的配信用の `_headers` は従来どおりです。

// Remove the authorization code before loading or communicating with anything.
const query=new URLSearchParams(location.search);history.replaceState(null,'',location.pathname);
const state=query.get('state'),code=query.get('code');
if(/^[A-Za-z0-9_-]{43}$/.test(state||'')&&typeof code==='string'&&code.length<=4096&&code){const channel=new BroadcastChannel('scanflow-oauth-'+state);channel.postMessage({state,code});channel.close();document.getElementById('status').textContent='元のScanFlow画面で接続結果を確認してください。この画面は閉じられます。';}else document.getElementById('status').textContent='認証が完了していません。元のScanFlow画面で接続をやり直してください。';

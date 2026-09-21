import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidate=path.join(root,'docs');
const script=fs.readFileSync(path.join(candidate,'legacy-redirect.js'),'utf8');
const legacy='https://dkd-gl-parts.github.io';
const canonical='https://dcats.daiko-denki.co.jp';
const results=[];
function check(name,fn){fn();results.push({name,passed:true});}
function simulate(input,{originOverride,components}={}){
  const source=new URL(input); const calls=[];
  const location={origin:originOverride??source.origin,pathname:source.pathname,search:source.search,hash:source.hash,...components,replace:value=>calls.push(value)};
  const context=vm.createContext({window:{location},URL},{codeGeneration:{strings:false,wasm:false}});
  new vm.Script(script,{filename:'legacy-redirect.js'}).runInContext(context,{timeout:1000});
  return {source,location,calls};
}
const suffixes=[
  '/', '/index.html', '/auth/callback', '/orders/12011?tab=detail#stock',
  '/auth/callback?dcats_probe=synthetic&state=alpha%2Bbeta%3D#probe_fragment=fake',
  '//outside.invalid/path?q=1#fragment', '///outside.invalid/path',
  '/%2F%2Foutside.invalid/path', '/%5C%5Coutside.invalid/path',
  '/a%2Fb/%E6%97%A5%E6%9C%AC?x=%2f&x=%2F#%E7%94%BB%E9%9D%A2',
  '/a/../b?repeat=1&repeat=2&empty=', '/%2e%2e/b?probe=normalization',
  '/path?redirect=https%3A%2F%2Foutside.invalid%2F#https://outside.invalid/',
  '/?a=1+2&b=%20&c=%25&d=%252F#%252F',
  '/?encoded=%3Cscript%3Ealert(1)%3C%2Fscript%3E#%22%3E',
  '/a;b,c:@!$&\'()*+?empty=&flag#fragment?query-like',
  '/a\\b?probe=backslash-normalization', '/#probe_fragment='+'x'.repeat(4096),
];
for(const suffix of suffixes) check('URL preservation '+suffix.slice(0,100),()=>{
  const {source,calls}=simulate(legacy+suffix);
  assert.equal(calls.length,1); const target=new URL(calls[0]);
  assert.equal(target.origin,canonical); assert.equal(target.protocol,'https:');
  assert.equal(target.pathname,source.pathname); assert.equal(target.search,source.search); assert.equal(target.hash,source.hash);
  assert.equal(target.username,'');assert.equal(target.password,'');
});
for(const input of [canonical+'/?a=1#b','http://dkd-gl-parts.github.io/?a=1','https://dkd-gl-parts.github.io:444/','https://outside.invalid/','http://127.0.0.1:8000/']) check('Out-of-scope origin no-op '+input,()=>assert.deepEqual(simulate(input).calls,[]));
check('Raw double-slash path cannot replace origin',()=>{
  const r=simulate(legacy+'/',{components:{pathname:'//outside.invalid/escape',search:'?q=1',hash:'#h'}});
  assert.equal(new URL(r.calls[0]).origin,canonical);
  assert.equal(new URL(r.calls[0]).pathname,'//outside.invalid/escape');
});
const expectedCsp="default-src 'none'; script-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'; upgrade-insecure-requests";
for(const filename of ['index.html','404.html']){
  const html=fs.readFileSync(path.join(candidate,filename),'utf8');
  check(filename+' safe static HTML/CSP contract',()=>{
    assert.match(html,/^<!doctype html>/i);assert.match(html,/<html lang="ja">/);
    assert(html.includes('http-equiv="Content-Security-Policy" content="'+expectedCsp+'"'));
    assert(!/unsafe-inline|unsafe-eval|frame-ancestors|http-equiv="refresh"/i.test(html));
    assert(!/\s(?:on\w+|style)\s*=/i.test(html));
    assert(!/<(?:base|style|iframe|form|input|img|object|embed|link)\b/i.test(html));
    const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.equal(scripts.length,1);assert.equal(scripts[0][1],' src="/legacy-redirect.js" defer');assert.equal(scripts[0][2],'');
    assert(html.indexOf('http-equiv="Content-Security-Policy"')<html.indexOf('<script'));
    assert.match(html,/<meta name="referrer" content="no-referrer">/);
    const destinations=[...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map(m=>m[1]);
    assert.deepEqual(destinations,['/legacy-redirect.js',canonical+'/']);
    // On a deep-path 404, the script still resolves at the legacy site root.
    assert.equal(new URL(destinations[0],legacy+'/a/b/c').href,legacy+'/legacy-redirect.js');
  });
  check(filename+' JavaScript-disabled fallback contract',()=>{
    // Static contract, not a rendered-browser/no-script execution test.
    const withoutScript=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    assert.match(withoutScript,new RegExp('<a href="https://dcats\\.daiko-denki\\.co\\.jp/" rel="noreferrer">D-CATS を開く</a>'));
    assert.match(withoutScript,/<noscript><p>JavaScript が無効/);
    assert(withoutScript.includes('元の画面指定や URL の追加情報は引き継がれません。'));
    assert(!/http:\/\/|javascript:/i.test(withoutScript));
  });
}
check('Root and fallback 404 are byte-identical',()=>assert(fs.readFileSync(path.join(candidate,'index.html')).equals(fs.readFileSync(path.join(candidate,'404.html')))));
check('Redirect assets exist and docs has no CNAME',()=>{for(const name of ['.nojekyll','404.html','index.html','legacy-redirect.js'])assert(fs.statSync(path.join(candidate,name)).isFile());assert(!fs.existsSync(path.join(candidate,'CNAME')));});
check('No network, token store, DOM injection or history-push APIs',()=>{
  assert(!/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|cookie|innerHTML|document|eval|Function)\b/.test(script));
  assert(!/location\.(?:assign|href)\s*\(|history\.(?:pushState|replaceState)/.test(script));
});
const build=fs.readFileSync(path.join(root,'scripts/build-static-site.js'),'utf8');
check('Primary app build excludes legacy redirect docs',()=>{assert(!/['"]docs(?:\/|['"])/.test(build));assert(build.includes('path.join(root, "vendor")'));assert(build.includes('path.join(root, "assets")'));});
console.log(JSON.stringify({passed:results.length,failed:0,tests:results},null,2));

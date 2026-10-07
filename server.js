'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=Number(process.env.PORT||10000),ROOT=path.join(__dirname,'public'),PUBLIC_URL=process.env.PUBLIC_URL||'https://ggl-ak7e.onrender.com';
const states=new Map(),mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const okHost=req=>['ggl-ak7e.onrender.com','ggl.onrender.com','localhost','127.0.0.1'].includes((req.headers.host||'').split(':')[0].toLowerCase());
const sign=s=>crypto.createHmac('sha256',process.env.SESSION_SECRET||'dev-secret').update(s).digest('base64url');
function session(user){const p=Buffer.from(JSON.stringify({u:user,e:Date.now()+7*864e5})).toString('base64url');return p+'.'+sign(p)}
function user(req){try{const c=(req.headers.cookie||'').match(/(?:^|; )ggl_session=([^;]+)/)?.[1];if(!c)return null;const [p,s]=c.split('.');if(!p||s!==sign(p))return null;const x=JSON.parse(Buffer.from(p,'base64url'));return x.e>Date.now()?x.u:null}catch{return null}}
function send(res,code,type,body,extra={}){res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store',...extra});res.end(body)}
async function auth(req,res){
 const u=new URL(req.url,'https://ggl-ak7e.onrender.com');
 if(u.pathname==='/auth/google'){if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)return send(res,503,'text/plain','Gmail/Google girişi için Render Environment alanına GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET eklenmeli.');
  const state=crypto.randomBytes(24).toString('hex');states.set(state,Date.now()+600000);
  const q=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:PUBLIC_URL+'/auth/google/callback',response_type:'code',scope:'openid email profile',state});
  return send(res,302,'text/plain','',{'Location':'https://accounts.google.com/o/oauth2/v2/auth?'+q})}
 if(u.pathname==='/auth/google/callback'){const state=u.searchParams.get('state'),code=u.searchParams.get('code');if(!state||!code||!states.has(state)||states.get(state)<Date.now())return send(res,400,'text/plain','Geçersiz giriş isteği.');states.delete(state);
  const body=new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',redirect_uri:PUBLIC_URL+'/auth/google/callback',grant_type:'authorization_code'});
  const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!tr.ok)return send(res,502,'text/plain','Google token hatası.');
  const tok=await tr.json(),ur=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tok.access_token}});if(!ur.ok)return send(res,502,'text/plain','Google profil hatası.');
  const g=await ur.json();res.writeHead(302,{'Location':'/#lobby','Set-Cookie':'ggl_session='+session({sub:g.sub,email:g.email,name:g.name,picture:g.picture,verified:g.email_verified})+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800'});return res.end()}
}
http.createServer(async(req,res)=>{try{if(!okHost(req))return send(res,403,'text/plain','GGL only.');const u=new URL(req.url,'https://ggl-ak7e.onrender.com');
 if(u.pathname==='/health')return send(res,200,'application/json; charset=utf-8',JSON.stringify({ok:true,name:'GGL',uptime:process.uptime()}));
 if(u.pathname.startsWith('/auth/google'))return auth(req,res);
 if(u.pathname==='/api/me')return send(res,200,'application/json; charset=utf-8',JSON.stringify({authenticated:!!user(req),user:user(req)}));
 if(u.pathname==='/api/logout')return send(res,200,'application/json; charset=utf-8','{"ok":true}',{'Set-Cookie':'ggl_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'});
 let p=u.pathname==='/'?'/index.html':u.pathname;if(p.includes('..'))return send(res,400,'text/plain','Bad path');const f=path.join(ROOT,p);
 fs.readFile(f,(e,data)=>e?send(res,404,'text/plain','Not found'):send(res,200,mime[path.extname(f)]||'application/octet-stream',data,{'Cache-Control':path.extname(f)==='.html'?'no-store':'public,max-age=3600'}));
}catch(e){console.error(e);send(res,500,'text/plain','Server error')}}).listen(PORT,'0.0.0.0',()=>console.log('GGL on '+PORT));
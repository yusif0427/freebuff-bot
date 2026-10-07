'use strict';

const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {Pool}=require('pg');
const nodemailer=require('nodemailer');

const PORT=Number(process.env.PORT||10000);
const ROOT=path.join(__dirname,'public');
const PUBLIC_URL=process.env.PUBLIC_URL||'https://ggl-ak7e.onrender.com';
const SESSION_SECRET=process.env.SESSION_SECRET||'dev-secret-change-me';
const states=new Map();
const codes=new Map();
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const okHosts=new Set(['ggl-ak7e.onrender.com','ggl.onrender.com','localhost','127.0.0.1']);

const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}):null;
const usersMemory=new Map();

const transporter=(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS)
  ? nodemailer.createTransport({
      host:process.env.SMTP_HOST,
      port:Number(process.env.SMTP_PORT||587),
      secure:String(process.env.SMTP_SECURE||'false')==='true',
      auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}
    }):null;

async function db(q,params=[]){
  if(!pool)return null;
  return pool.query(q,params);
}
async function initDb(){
  if(!pool){
    console.log('DATABASE_URL yok: geçici memory auth aktif.');
    return;
  }
  await db(`
    CREATE TABLE IF NOT EXISTS users(
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('GGL database hazır.');
}

function json(res,code,data,extra={}){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(data));}
function text(res,code,body){res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(body);}
async function body(req){
  return await new Promise((resolve,reject)=>{
    let d='';
    req.on('data',c=>{d+=c;if(d.length>100000)req.destroy();});
    req.on('end',()=>{try{resolve(d?JSON.parse(d):{})}catch{reject(new Error('JSON'))}});
    req.on('error',reject);
  });
}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){
  const hash=crypto.scryptSync(password,salt,64).toString('hex');
  return salt+':'+hash;
}
function verifyPassword(password,stored){
  try{
    const [salt,hash]=stored.split(':');
    const got=crypto.scryptSync(password,salt,64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(got,'hex'),Buffer.from(hash,'hex'));
  }catch{return false}
}
function sign(s){return crypto.createHmac('sha256',SESSION_SECRET).update(s).digest('base64url')}
function makeSession(user){
  const p=Buffer.from(JSON.stringify({u:user,e:Date.now()+7*864e5})).toString('base64url');
  return p+'.'+sign(p);
}
function sessionUser(req){
  try{
    const c=(req.headers.cookie||'').match(/(?:^|; )ggl_session=([^;]+)/)?.[1];
    if(!c)return null;
    const [p,s]=c.split('.');
    if(!p||s!==sign(p))return null;
    const x=JSON.parse(Buffer.from(p,'base64url').toString());
    return x.e>Date.now()?x.u:null;
  }catch{return null}
}
function setSession(res,user){
  res.setHeader('Set-Cookie','ggl_session='+makeSession(user)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800');
}
function normEmail(v){return String(v||'').trim().toLowerCase()}
function validEmail(e){return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e)}
function validUsername(u){return /^[A-Za-z0-9_]{3,20}$/.test(u)}
function validPassword(p){return typeof p==='string'&&p.length>=8&&p.length<=128}
function challengeKey(email,purpose){return purpose+':'+email}
function randomCode(){return String(Math.floor(100000+Math.random()*900000))}
async function sendCode(email,code,purpose){
  if(!transporter)throw new Error('SMTP_NOT_CONFIGURED');
  const subject=purpose==='register'?'GGL kayıt doğrulama kodun':'GGL şifre sıfırlama kodun';
  await transporter.sendMail({
    from:process.env.EMAIL_FROM||process.env.SMTP_USER,
    to:email,
    subject,
    text:'GGL doğrulama kodun: '+code+'\\n\\nBu kod 10 dakika geçerlidir. Kodu kimseyle paylaşma.',
    html:'<div style="font-family:Arial;background:#08090c;color:#f2f5f8;padding:32px"><h1>GGL</h1><p>Doğrulama kodun:</p><div style="font-size:36px;font-weight:900;letter-spacing:8px;background:#11151c;padding:18px;border-radius:12px;display:inline-block">'+code+'</div><p style="color:#8994a3">Kod 10 dakika geçerlidir.</p></div>'
  });
}
async function findUserByEmail(email){
  if(pool){
    const r=await db('SELECT id,email,username,password_hash,created_at FROM users WHERE email=$1',[email]);
    return r.rows[0]||null;
  }
  for(const u of usersMemory.values())if(u.email===email)return u;
  return null;
}
async function findUserByUsername(username){
  if(pool){
    const r=await db('SELECT id,email,username,password_hash,created_at FROM users WHERE username=$1',[username]);
    return r.rows[0]||null;
  }
  for(const u of usersMemory.values())if(u.username.toLowerCase()===username.toLowerCase())return u;
  return null;
}
async function createUser(email,username,passwordHash){
  if(pool){
    const r=await db('INSERT INTO users(email,username,password_hash) VALUES($1,$2,$3) RETURNING id,email,username,created_at',[email,username,passwordHash]);
    return r.rows[0];
  }
  const id=String(usersMemory.size+1);
  const u={id,email,username,password_hash:passwordHash,created_at:new Date().toISOString()};
  usersMemory.set(id,u);
  return u;
}
async function updatePassword(email,passwordHash){
  if(pool){await db('UPDATE users SET password_hash=$1 WHERE email=$2',[passwordHash,email]);return;}
  const u=await findUserByEmail(email);if(u)u.password_hash=passwordHash;
}
function safeUser(u){return u?{id:String(u.id),email:u.email,username:u.username,created_at:u.created_at}:null}

async function googleLegacy(req,res){
  const u=new URL(req.url,PUBLIC_URL);
  if(u.pathname==='/auth/google')return text(res,410,'Bu giriş yöntemi kaldırıldı. GGL artık Gmail adresi + doğrulama kodu + kullanıcı adı + şifre sistemi kullanıyor.');
  return text(res,404,'Not found');
}

async function api(req,res,u){
  if(u.pathname==='/api/me'){
    const su=sessionUser(req);return json(res,200,{authenticated:!!su,user:su||null});
  }
  if(u.pathname==='/api/logout'){
    return json(res,200,{ok:true},{'Set-Cookie':'ggl_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'});
  }
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  let b;try{b=await body(req)}catch{return json(res,400,{error:'invalid_json'})}
  if(u.pathname==='/api/auth/request-code'){
    const email=normEmail(b.email),purpose=b.purpose==='reset'?'reset':'register';
    if(!validEmail(email))return json(res,400,{error:'Geçerli bir Gmail adresi yaz.'});
    const existing=await findUserByEmail(email);
    if(purpose==='register'&&existing)return json(res,409,{error:'Bu e-posta zaten kayıtlı. Giriş yap.'});
    if(purpose==='reset'&&!existing)return json(res,404,{error:'Bu e-posta ile kayıtlı hesap bulunamadı.'});
    const key=challengeKey(email,purpose),old=codes.get(key);
    if(old&&old.nextAt>Date.now())return json(res,429,{error:'Yeni kod istemeden önce biraz bekle.',retryAfter:Math.ceil((old.nextAt-Date.now())/1000)});
    const code=randomCode();
    codes.set(key,{hash:crypto.createHash('sha256').update(code).digest('hex'),expires:Date.now()+10*60e3,nextAt:Date.now()+30e3});
    try{await sendCode(email,code,purpose)}catch(e){
      console.error('MAIL ERROR',e.message);
      return json(res,503,{error:'Kod e-postası gönderilemedi. SMTP ayarları Render\'a eklenmeli.'});
    }
    return json(res,200,{ok:true,message:'Kod gönderildi.'});
  }
  if(u.pathname==='/api/auth/register'){
    const email=normEmail(b.email),code=String(b.code||'').trim(),username=String(b.username||'').trim();
    if(!validEmail(email)||!/^\\d{6}$/.test(code)||!validUsername(username)||!validPassword(b.password))
      return json(res,400,{error:'E-posta, 6 haneli kod, kullanıcı adı (3-20) ve en az 8 karakter şifre gerekli.'});
    const ch=codes.get(challengeKey(email,'register'));
    if(!ch||ch.expires<Date.now()||crypto.createHash('sha256').update(code).digest('hex')!==ch.hash)return json(res,400,{error:'Kod yanlış veya süresi dolmuş.'});
    if(await findUserByEmail(email))return json(res,409,{error:'Bu e-posta zaten kayıtlı.'});
    if(await findUserByUsername(username))return json(res,409,{error:'Bu kullanıcı adı alınmış.'});
    let u;try{u=await createUser(email,username,hashPassword(b.password));}catch(e){console.error(e);return json(res,500,{error:'Hesap oluşturulamadı.'})}
    codes.delete(challengeKey(email,'register'));setSession(res,safeUser(u));return json(res,201,{ok:true,user:safeUser(u)});
  }
  if(u.pathname==='/api/auth/login'){
    const email=normEmail(b.email),password=String(b.password||'');
    const u=await findUserByEmail(email);
    if(!u||!verifyPassword(password,u.password_hash))return json(res,401,{error:'E-posta veya şifre yanlış.'});
    setSession(res,safeUser(u));return json(res,200,{ok:true,user:safeUser(u)});
  }
  if(u.pathname==='/api/auth/reset'){
    const email=normEmail(b.email),code=String(b.code||'').trim();
    if(!validEmail(email)||!/^\\d{6}$/.test(code)||!validPassword(b.password))return json(res,400,{error:'E-posta, 6 haneli kod ve en az 8 karakter yeni şifre gerekli.'});
    const ch=codes.get(challengeKey(email,'reset'));
    if(!ch||ch.expires<Date.now()||crypto.createHash('sha256').update(code).digest('hex')!==ch.hash)return json(res,400,{error:'Kod yanlış veya süresi dolmuş.'});
    const u=await findUserByEmail(email);if(!u)return json(res,404,{error:'Hesap bulunamadı.'});
    await updatePassword(email,hashPassword(b.password));codes.delete(challengeKey(email,'reset'));setSession(res,safeUser({...u}));return json(res,200,{ok:true});
  }
  return json(res,404,{error:'not_found'});
}

const server=http.createServer(async(req,res)=>{
  try{
    const host=(req.headers.host||'').split(':')[0].toLowerCase();
    if(!okHosts.has(host))return text(res,403,'GGL only.');
    const u=new URL(req.url,PUBLIC_URL);
    if(u.pathname==='/health')return json(res,200,{ok:true,name:'GGL',auth:'email-code-password',uptime:process.uptime(),database:!!pool});
    if(u.pathname.startsWith('/api/'))return await api(req,res,u);
    if(u.pathname.startsWith('/auth/google'))return await googleLegacy(req,res);
    let p=u.pathname==='/'?'/index.html':u.pathname;if(p.includes('..'))return text(res,400,'Bad path');
    const file=path.join(ROOT,p);
    fs.readFile(file,(e,data)=>e?text(res,404,'Not found'):sendStatic(res,file,data));
  }catch(e){console.error(e);text(res,500,'Server error');}
});
function sendStatic(res,file,data){res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':path.extname(file)==='.html'?'no-store':'public,max-age=3600'});res.end(data)}
initDb().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log('GGL listening '+PORT))).catch(e=>{console.error(e);process.exit(1)});
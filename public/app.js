const $=id=>document.getElementById(id);
const auth=$('auth'),msg=$('authMsg');
const steps=['stepRegisterEmail','stepRegister','stepLogin','stepForgot'];
function show(name){steps.forEach(id=>$(id).hidden=id!==name);msg.textContent='';msg.className='msg'}
function notice(t,error=false){msg.textContent=t;msg.className='msg '+(error?'error':'ok')}
function openAuth(step='stepRegisterEmail'){auth.hidden=false;show(step)}
function closeAuth(){auth.hidden=true}
$('openLogin').onclick=()=>openAuth('stepLogin');
$('openRegister').onclick=()=>openAuth('stepRegisterEmail');
$('closeAuth').onclick=closeAuth;
auth.onclick=e=>{if(e.target===auth)closeAuth()};
$('toLogin').onclick=()=>show('stepLogin');
$('toRegister').onclick=()=>show('stepRegisterEmail');
$('forgot').onclick=()=>show('stepForgot');
$('backLogin').onclick=()=>show('stepLogin');
$('backRegEmail').onclick=()=>show('stepRegisterEmail');

async function api(url,data){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const j=await r.json().catch(()=>({error:'Sunucu yanıtı okunamadı.'}));
  if(!r.ok)throw new Error(j.error||'İşlem başarısız.');
  return j;
}
$('sendReg').onclick=async()=>{
  const email=$('regEmail').value.trim();
  if(!email){notice('Gmail adresini yaz.',true);return}
  $('sendReg').disabled=true;
  try{await api('/api/auth/request-code',{email,purpose:'register'});show('stepRegister');notice('Kod Gmail adresine gönderildi.');}
  catch(e){notice(e.message,true)}
  finally{$('sendReg').disabled=false}
};
$('finishRegister').onclick=async()=>{
  const data={email:$('regEmail').value.trim(),code:$('regCode').value.trim(),username:$('username').value.trim(),password:$('regPass').value};
  $('finishRegister').disabled=true;
  try{const r=await api('/api/auth/register',data);notice('Hesap oluşturuldu. Hoş geldin '+r.user.username+'!');setTimeout(()=>{closeAuth();loadMe()},600)}
  catch(e){notice(e.message,true)}
  finally{$('finishRegister').disabled=false}
};
$('login').onclick=async()=>{
  $('login').disabled=true;
  try{const r=await api('/api/auth/login',{email:$('loginEmail').value.trim(),password:$('loginPass').value});notice('Giriş başarılı.');setTimeout(()=>{closeAuth();loadMe()},350)}
  catch(e){notice(e.message,true)}
  finally{$('login').disabled=false}
};
$('sendReset').onclick=async()=>{
  $('sendReset').disabled=true;
  try{await api('/api/auth/request-code',{email:$('forgotEmail').value.trim(),purpose:'reset'});$('resetFields').hidden=false;notice('Şifre sıfırlama kodu e-postana gönderildi.')}
  catch(e){notice(e.message,true)}
  finally{$('sendReset').disabled=false}
};
$('resetPassword').onclick=async()=>{
  $('resetPassword').disabled=true;
  try{await api('/api/auth/reset',{email:$('forgotEmail').value.trim(),code:$('resetCode').value.trim(),password:$('newPass').value});notice('Şifren değiştirildi.');setTimeout(()=>show('stepLogin'),700)}
  catch(e){notice(e.message,true)}
  finally{$('resetPassword').disabled=false}
};
async function loadMe(){
  try{
    const r=await fetch('/api/me');const j=await r.json();const acc=$('account');
    if(j.authenticated){acc.textContent='Giriş: '+j.user.username+' • '+j.user.email;$('logout').hidden=false;$('openLogin').textContent=j.user.username}
    else{$('logout').hidden=true;$('openLogin').textContent='Giriş yap'}
  }catch{}
}
$('logout').onclick=async()=>{await fetch('/api/logout');location.reload()};

const c=$('aim'),x=c.getContext('2d'),sc=$('score');let w,h,s=0,t={x:100,y:100,r:27,vx:160,vy:110,last:0};
function fit(){w=c.clientWidth;h=c.clientHeight;c.width=w*devicePixelRatio;c.height=h*devicePixelRatio;x.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);t.x=Math.max(t.r,Math.min(w-t.r,t.x));t.y=Math.max(t.r,Math.min(h-t.r,t.y))}
function spawn(){t.x=40+Math.random()*(w-80);t.y=40+Math.random()*(h-80);t.r=20+Math.random()*15;t.vx=(Math.random()-.5)*260;t.vy=(Math.random()-.5)*190}
function loop(ms){const d=Math.min(.04,(ms-t.last)/1000||0);t.last=ms;t.x+=t.vx*d;t.y+=t.vy*d;if(t.x<t.r||t.x>w-t.r)t.vx*=-1;if(t.y<t.r||t.y>h-t.r)t.vy*=-1;x.clearRect(0,0,w,h);x.strokeStyle='#111821';for(let i=0;i<w;i+=50){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke()}for(let i=0;i<h;i+=50){x.beginPath();x.moveTo(0,i);x.lineTo(w,i);x.stroke()}x.fillStyle='#e6edf4';x.beginPath();x.arc(t.x,t.y,t.r,0,7);x.fill();x.fillStyle='#0c1015';x.beginPath();x.arc(t.x,t.y,t.r*.62,0,7);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(t.x,t.y,t.r*.28,0,7);x.fill();requestAnimationFrame(loop)}
c.onclick=e=>{const r=c.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;if(Math.hypot(mx-t.x,my-t.y)<=t.r){s+=100;sc.textContent=String(s).padStart(3,'0');spawn()}};
$('reset').onclick=()=>{s=0;sc.textContent='000';spawn()};
addEventListener('resize',fit);fit();spawn();requestAnimationFrame(loop);loadMe();
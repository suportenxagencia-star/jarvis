/* ============ VERSÃO WEB (Vercel): Supabase Auth + RPCs ============ */
const WEB={url:"https://oohiwxfqrddeozdkjrwv.supabase.co",key:"sb_publishable_5-zTC-YIzTpY4ZAC_JBtRg__mQyfT10"};
let SBC=null,WEBOK=false,WUSER=null,WEB_HAD=false;
const WEB_RECOVERY=/type=recovery/.test(location.hash);
const WEB_AUTHLINK=/access_token=|error_description=/.test(location.hash);

/* ditado pelo navegador (Chrome, Edge, Safari) */
function webDict(){
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return null;
  let rec=null,cbF=()=>{},cbP=()=>{},cbS=()=>{};
  return {onFinal(f){cbF=f},onPartial(f){cbP=f},onState(f){cbS=f},
    start(){return new Promise((res,rej)=>{rec=new R();rec.lang="pt-BR";rec.interimResults=true;rec.continuous=true;
      rec.onresult=e=>{let fin="",par="";for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)fin+=t;else par+=t}if(fin)cbF({text:fin.trim()});cbP({text:par})};
      rec.onerror=e=>{cbS({state:"idle"});if(e.error==="not-allowed"||e.error==="service-not-allowed")rej({code:"not_granted"})};
      rec.onend=()=>cbS({state:"idle"});
      rec.onstart=()=>{cbS({state:"listening"});res()};
      try{rec.start()}catch(err){rej(err)}})},
    stop(){try{rec&&rec.stop()}catch(e){}return Promise.resolve()}};
}
window.claude={use:async n=>n==="dictation"?webDict():null};

/* dados: o mesmo formato do app, enviado para funções seguras do Supabase */
function webVal(c,v){
  if(BOOLCOL.has(c))return !!v;
  if(JSONCOL.has(c))return v||(c==="history"?[]:{});
  if(v===undefined||v===null)return null;
  if(NULLABLE_EMPTY.has(c)&&v==="")return null;
  if(NUMCOL.has(c)){const n=Number(v);return isFinite(n)?n:null}
  return String(v);
}
function upsertSQL(col,rec){
  const m=MAP[col];const row={id:String(rec.id)};
  for(const [f,c] of Object.entries(m.c)){if(f in rec)row[c]=webVal(c,rec[f])}
  return JSON.stringify({op:"upsert",t:m.t,rec:row});
}
function deleteSQL(col,id){return JSON.stringify({op:"delete",t:MAP[col].t,id:String(id)})}
function webErr(e){
  const m=String(e&&e.message||"");const c=String(e&&e.code||"");
  if(/not_owner|not_authenticated|JWT|jwt/i.test(m)||["42501","28000","PGRST301","PGRST303"].includes(c))return {code:"auth",message:m};
  if(/fetch|network|load failed|timeout/i.test(m)||!c)return {code:"server_unavailable",message:m};
  return {code:"tool_error",message:m};
}
async function sbCall(sql){
  if(!SBC||!WEBOK)throw {code:"auth"};
  if(sql.includes("json_build_object('settings'")){
    const {data,error}=await SBC.rpc("jarvis_load");if(error)throw webErr(error);
    return {result:"@@J@@"+JSON.stringify(data)+"@@J@@"};
  }
  const ops=sql.replace(/;\s*$/,"").split(";\n").filter(Boolean).map(s=>JSON.parse(s));
  const {error}=await SBC.rpc("jarvis_exec",{ops});if(error)throw webErr(error);
  return {result:"ok"};
}
function sbFail(e){
  const code=e&&e.code||"server_unavailable";
  if(code==="auth"){SBS={state:"connect",msg:"Sua sessão expirou. Entre de novo para sincronizar."};schedule();if(LOCK.unlocked)lockNow();return}
  const map={
    server_unavailable:["offline","Sem internet ou o Supabase não respondeu. Suas alterações ficam guardadas e serão enviadas assim que voltar."],
    tool_error:["error","O Supabase recusou a operação"+(e&&e.message?": "+String(e.message).slice(0,160):".")+" Se o projeto estiver pausado, reative-o em supabase.com."],
    parse:["error",e&&e.message||"Resposta inesperada do Supabase."]
  };
  const [state,msg]=map[code]||map.server_unavailable;SBS={state,msg};schedule();
}
async function groqThink(turns,signal){
  if(!WEBOK)throw {code:"no_groq"};
  const messages=turns.map((t,i)=>({role:i===0?"system":t.role,content:t.content}));
  const payload={model:GROQ.model,reasoning_effort:"low",temperature:0.2,max_completion_tokens:1800,response_format:{type:"json_object"},messages};
  const {data:r,error}=await SBC.rpc("jarvis_groq",{payload});
  if(signal&&signal.aborted)throw {code:"cancelled"};
  if(error)throw {code:"groq_error",message:error.message};
  if(r.error)throw {code:"groq_error",message:r.error};
  if(r.status!==200){const m=r.body&&r.body.error&&r.body.error.message;throw {code:"groq_http",message:(r.status||"")+" "+(m||"")}}
  const content=r.body&&r.body.choices&&r.body.choices[0]&&r.body.choices[0].message&&r.body.choices[0].message.content;
  return parseLooseJSON(content);
}

/* ============ LOGIN WEB (Supabase Auth) ============ */
const webEmail=()=>{try{return localStorage.getItem("jarvis-email")||""}catch(e){return ""}};
function lockFromServer(){}
function lockNow(){
  LOCK.unlocked=false;LOCK.mode="login";LOCK.msg="";LOCK.err=false;LOCK.show=false;
  try{sessionStorage.removeItem("jarvis-unlocked")}catch(e){}
  if(typeof chatClose==="function"&&CHAT.open)chatClose();closeMenu();renderLock();
}
function lockChange(){LOCK.unlocked=false;LOCK.mode="change";LOCK.msg="";LOCK.err=false;closeMenu();renderLock()}
async function webLogout(){
  closeMenu();
  if(OUTBOX.length&&!confirm(`Há ${OUTBOX.length} alteração(ões) ainda não enviadas. Sair mesmo assim? Elas serão perdidas.`))return;
  try{await SBC.auth.signOut()}catch(e){}
  ["jarvis-cache-v1","jarvis-outbox-v1","jarvis-chat-v1"].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
  try{sessionStorage.removeItem("jarvis-unlocked")}catch(e){}
  location.replace(location.pathname);
}
function renderLock(){
  const el=document.getElementById("lock");
  document.body.classList.toggle("locked",!LOCK.unlocked);
  if(LOCK.unlocked){el.hidden=true;el.innerHTML="";return}
  el.hidden=false;
  const prevFocus=document.activeElement&&el.contains(document.activeElement)?document.activeElement.id:null;
  const keep={};el.querySelectorAll("input").forEach(i=>keep[i.id]=i.value);
  const M=LOCK.mode;
  const T={loading:["Verificando seu acesso…","Só um instante."],login:["Entrar no Jarvis","Use seu e-mail e senha."],signup:["Crie sua conta","A primeira conta criada vira a dona do Jarvis. Ninguém mais consegue entrar nos seus dados."],sent:["Confirme seu e-mail","Enviamos um link de confirmação para "+(LOCK.email||"o seu e-mail")+". Abra o e-mail, toque no link e depois volte aqui para entrar."],forgot:["Recuperar senha","Digite seu e-mail. Vamos mandar um link para criar uma senha nova."],"forgot-sent":["Veja seu e-mail","Se existir uma conta com "+(LOCK.email||"esse e-mail")+", chegou um link para criar uma senha nova. Abra o link neste aparelho."],newpass:["Crie uma senha nova","Mínimo de 8 caracteres, com letras e números."],change:["Alterar senha","Confirme a senha atual e escolha a nova."],denied:["Este Jarvis já tem dono","A conta que você usou não é a dona deste Jarvis. Entre com a conta dona."],error:["Não deu para abrir","Verifique a internet e recarregue a página."]}[M]||["",""];
  const wait=Math.max(0,Math.ceil((LOCK.waitUntil-Date.now())/1000));
  const dis=(wait||LOCK.busy)?"disabled":"";
  let form="",btn="",links="";
  if(M==="login"){form=lfield("lk-email","E-mail","email","username",keep["lk-email"]??(LOCK.email||webEmail()),dis)+lfield("lk-pass","Senha","password","current-password",keep["lk-pass"],dis);btn="Entrar";links=`<button type="button" class="lk-link" data-act="wa-mode" data-m="forgot">Esqueci a senha</button><button type="button" class="lk-link" data-act="wa-mode" data-m="signup">Criar conta</button>`}
  if(M==="signup"){form=lfield("lk-name","Seu nome","text","name",keep["lk-name"],dis)+lfield("lk-email","E-mail","email","username",keep["lk-email"],dis)+lfield("lk-pass","Senha","password","new-password",keep["lk-pass"],dis+' minlength="8"')+lfield("lk-pass2","Confirmar senha","password","new-password",keep["lk-pass2"],dis+' minlength="8"')+`<p class="lf-hint">Mínimo de 8 caracteres. Misture letras e números.</p>`;btn="Criar conta";links=`<button type="button" class="lk-link" data-act="wa-mode" data-m="login">Já tenho conta</button>`}
  if(M==="forgot"){form=lfield("lk-email","E-mail","email","username",keep["lk-email"]??(LOCK.email||webEmail()),dis);btn="Enviar link";links=`<button type="button" class="lk-link" data-act="wa-mode" data-m="login">Voltar</button>`}
  if(M==="newpass"){form=lfield("lk-pass","Nova senha","password","new-password",keep["lk-pass"],dis+' minlength="8"')+lfield("lk-pass2","Confirmar nova senha","password","new-password",keep["lk-pass2"],dis+' minlength="8"');btn="Salvar e entrar"}
  if(M==="change"){form=lfield("lk-old","Senha atual","password","current-password",keep["lk-old"],dis)+lfield("lk-pass","Nova senha","password","new-password",keep["lk-pass"],dis+' minlength="8"')+lfield("lk-pass2","Confirmar nova senha","password","new-password",keep["lk-pass2"],dis+' minlength="8"');btn="Salvar";links=`<button type="button" class="lk-link" data-act="wa-cancel">Cancelar</button>`}
  if(M==="sent"||M==="forgot-sent"){links=`<button type="button" class="btn acc lock-go" data-act="wa-mode" data-m="login">Ir para o login</button>`}
  if(M==="denied"){links=`<button type="button" class="btn acc lock-go" data-act="wa-mode" data-m="login">Usar outra conta</button>`}
  if(M==="error"){links=`<button type="button" class="btn acc lock-go" onclick="location.reload()">Recarregar</button>`}
  el.innerHTML=`<div class="lock-card ${LOCK.shake?"shake":""}">
   <div class="lock-av">${jarvis(70,"jv-lock")}</div>
   <h2>${saud()}${NAME?", "+esc(NAME):""}</h2>
   <b class="lock-t">${T[0]}</b>
   <p class="lock-s ${LOCK.err||wait?"bad":""}" role="status">${wait?`Muitas tentativas. Tente de novo em ${wait} s.`:esc(LOCK.msg||T[1])}</p>
   ${M==="loading"?'<div class="lock-spin" aria-hidden="true"></div>':form?`<form class="lock-form" id="lock-form" novalidate>${form}
     <button class="btn acc lock-go" type="submit" ${dis}>${LOCK.busy?'<span class="lock-mini"></span>':""}${btn}</button>
     <div class="lock-links wl">${links}</div></form>`:`<div class="lock-form"><div class="lock-links wl">${links}</div></div>`}
   ${M==="login"?`<p class="lock-foot">Bloqueio automático após ${LOCK_IDLE_MIN} min sem uso.</p>`:""}
  </div>`;
  LOCK.shake=false;
  const f=document.getElementById("lock-form");
  if(f&&f.tagName==="FORM"){f.addEventListener("submit",ev=>{ev.preventDefault();lockSubmit()});
    const target=(prevFocus&&document.getElementById(prevFocus))||[...f.querySelectorAll("input")].find(i=>!i.value)||f.querySelector("input");
    if(target&&!dis&&matchMedia("(hover:hover)").matches)setTimeout(()=>target.focus(),30);else if(target&&prevFocus)target.focus();
  }
  if(wait)setTimeout(renderLock,1000);
}
const pwOk=p=>p.length>=8&&/[A-Za-zÀ-ÿ]/.test(p)&&/[0-9]/.test(p);
function authMsg(e){
  const m=String(e&&e.message||"");
  if(/Invalid login credentials/i.test(m))return "E-mail ou senha incorretos.";
  if(/Email not confirmed/i.test(m))return "Seu e-mail ainda não foi confirmado. Abra o link que enviamos.";
  if(/already registered|already been registered/i.test(m))return "Esse e-mail já tem conta. Use Entrar.";
  if(/rate limit|too many/i.test(m))return "Muitas tentativas seguidas. Espere alguns minutos.";
  if(/Signups not allowed|signup is disabled/i.test(m))return "Criação de contas está desligada neste Supabase.";
  if(/weak|Password should/i.test(m))return "Senha fraca. Use pelo menos 8 caracteres com letras e números.";
  if(/fetch|network/i.test(m))return "Sem conexão. Verifique a internet.";
  return m||"Algo deu errado. Tente de novo.";
}
async function lockSubmit(){
  if(LOCK.busy||Date.now()<LOCK.waitUntil)return;
  const v=id=>{const i=document.getElementById(id);return i?i.value:""};
  const M=LOCK.mode,email=v("lk-email").trim().toLowerCase(),pass=v("lk-pass"),pass2=v("lk-pass2");
  const go=async fn=>{LOCK.busy=true;LOCK.err=false;renderLock();try{await fn()}finally{LOCK.busy=false;renderLock()}};
  if(M==="login"){
    if(!email||!pass)return lockFail("Preencha e-mail e senha.");
    return go(async()=>{
      const {data,error}=await SBC.auth.signInWithPassword({email,password:pass});
      if(error){LOCK.tries++;const p=document.getElementById("lk-pass");if(p)p.value="";
        if(LOCK.tries>=5){LOCK.waitUntil=Date.now()+30000*(LOCK.tries-4);LOCK.err=true;LOCK.msg="";LOCK.shake=true;return}
        LOCK.err=true;LOCK.shake=true;LOCK.msg=authMsg(error);return}
      LOCK.tries=0;LOCK.email=email;await webEnter(data.session);
    });
  }
  if(M==="signup"){
    const name=v("lk-name").trim();
    if(!name||!email)return lockFail("Preencha nome e e-mail.");
    if(!pwOk(pass))return lockFail("A senha precisa de 8+ caracteres, com letras e números.");
    if(pass!==pass2)return lockFail("As senhas não batem.");
    return go(async()=>{
      const {data,error}=await SBC.auth.signUp({email,password:pass,options:{data:{name},emailRedirectTo:location.origin+location.pathname}});
      if(error){LOCK.err=true;LOCK.shake=true;LOCK.msg=authMsg(error);return}
      if(data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length){LOCK.err=true;LOCK.msg="Esse e-mail já tem conta. Use Entrar.";return}
      LOCK.email=email;try{localStorage.setItem("jarvis-email",email)}catch(e){}
      if(data.session){await webEnter(data.session);return}
      LOCK.mode="sent";LOCK.msg="";
    });
  }
  if(M==="forgot"){
    if(!email)return lockFail("Digite seu e-mail.");
    return go(async()=>{
      const {error}=await SBC.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      if(error){LOCK.err=true;LOCK.msg=authMsg(error);return}
      LOCK.email=email;LOCK.mode="forgot-sent";LOCK.msg="";
    });
  }
  if(M==="newpass"||M==="change"){
    if(!pwOk(pass))return lockFail("A senha precisa de 8+ caracteres, com letras e números.");
    if(pass!==pass2)return lockFail("As senhas não batem.");
    return go(async()=>{
      if(M==="change"){
        const {data:{session}}=await SBC.auth.getSession();const em=session&&session.user.email;
        const {error:e1}=await SBC.auth.signInWithPassword({email:em,password:v("lk-old")});
        if(e1){LOCK.err=true;LOCK.shake=true;LOCK.msg="Senha atual incorreta.";const o=document.getElementById("lk-old");if(o)o.value="";return}
      }
      const {error}=await SBC.auth.updateUser({password:pass});
      if(error){LOCK.err=true;LOCK.msg=authMsg(error);return}
      const {data:{session}}=await SBC.auth.getSession();
      toast(M==="change"?"Senha alterada.":"Senha nova salva.");
      await webEnter(session);
    });
  }
}
async function webEnter(session){
  if(!session){LOCK.mode="login";return}
  WUSER=session.user;try{localStorage.setItem("jarvis-email",WUSER.email||"")}catch(e){}
  const meta=WUSER.user_metadata||{};const full=String(meta.name||meta.full_name||"").trim();
  FULLNAME=full||WUSER.email||"";NAME=full?full.split(/\s+/)[0]:"";
  const {data:cl,error}=await SBC.rpc("jarvis_claim");
  if(error){
    const er=webErr(error);
    if(er.code==="server_unavailable"&&WEB_HAD){WEBOK=true;MCP={web:true};lockOpen();sbFail(er);return}
    LOCK.err=true;LOCK.msg=authMsg(error);LOCK.mode="login";return;
  }
  if(cl!=="owner"){try{await SBC.auth.signOut()}catch(e){}LOCK.mode="denied";LOCK.msg="";return}
  WEBOK=true;MCP={web:true};
  lockOpen();
  await sbLoad();
}
async function boot(){
  WEB_HAD=loadCache();if(WEB_HAD)READY=true;
  LOCK.mode="loading";render();renderLock();
  if(!window.supabase||!window.supabase.createClient){LOCK.mode="error";renderLock();return}
  SBC=window.supabase.createClient(WEB.url,WEB.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"implicit",storageKey:"jarvis-web-auth"}});
  SBC.auth.onAuthStateChange(ev=>{if(ev==="PASSWORD_RECOVERY"){LOCK.unlocked=false;LOCK.mode="newpass";LOCK.msg="";renderLock()}});
  let session=null;try{({data:{session}}=await SBC.auth.getSession())}catch(e){}
  if(WEB_AUTHLINK){history.replaceState(null,"",location.pathname+"#painel");render()}
  if(WEB_RECOVERY&&session){LOCK.unlocked=false;LOCK.mode="newpass";renderLock();return}
  if(session&&(LOCK.unlocked||WEB_AUTHLINK)){await webEnter(session);renderLock()}
  else{
    LOCK.unlocked=false;LOCK.mode="login";
    if(!webEmail()){try{const {data}=await SBC.rpc("jarvis_has_owner");if(data===false)LOCK.mode="signup"}catch(e){}}
    renderLock();
  }
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&WEBOK&&LOCK.unlocked&&Date.now()-LASTSYNC>15000)sbLoad()});
  setInterval(()=>{if(document.visibilityState==="visible"&&WEBOK&&LOCK.unlocked&&!flushing)sbLoad()},90000);
}
document.addEventListener("click",ev=>{
  const el=ev.target.closest("[data-act]");if(!el)return;
  const a=el.dataset.act;
  if(a==="wa-mode"){LOCK.mode=el.dataset.m;LOCK.msg="";LOCK.err=false;LOCK.show=false;renderLock()}
  else if(a==="wa-cancel"){LOCK.unlocked=true;LOCK.msg="";LOCK.err=false;lockTouch();renderLock();render()}
  else if(a==="wa-logout"){webLogout()}
});

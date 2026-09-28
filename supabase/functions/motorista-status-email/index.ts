import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  try {
    const {email,nome,status,motivo} = await req.json();
    if (!email || !status) throw new Error("E-mail e status são obrigatórios");
    const key = Deno.env.get("BREVO_API_KEY");
    const sender = Deno.env.get("FAST_EMAIL_SENDER") || "fastservicoslog@gmail.com";
    if (!key) throw new Error("BREVO_API_KEY não configurada no Supabase");
    const aprovado = /aprovado|ativo/i.test(status);
    const assunto = aprovado ? "Cadastro aprovado — FAST Motorista" : /negado/i.test(status) ? "Cadastro precisa de atenção — FAST Motorista" : "Cadastro em análise — FAST Motorista";
    const detalhe = motivo ? `<p><b>Motivo informado:</b> ${String(motivo).replace(/[<>&]/g,"")}</p>` : "";
    const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>Olá, ${String(nome||"motorista").replace(/[<>&]/g,"")}.</h2><p>O status do seu cadastro no FAST Motorista foi atualizado para <b>${String(status).replace(/[<>&]/g,"")}</b>.</p>${detalhe}<p>${aprovado?"Seu acesso foi liberado. Abra o aplicativo e entre com seu e-mail e senha.":"Acompanhe seu e-mail e o aplicativo para as próximas orientações."}</p></div>`;
    const out = await fetch("https://api.brevo.com/v3/smtp/email", {method:"POST",headers:{"api-key":key,"content-type":"application/json"},body:JSON.stringify({sender:{email:sender,name:"FAST Serviços"},to:[{email,name:nome||"Motorista"}],subject:assunto,htmlContent:html})});
    if (!out.ok) throw new Error(`Brevo HTTP ${out.status}: ${await out.text()}`);
    return new Response(JSON.stringify({ok:true}), {headers:{...cors,"content-type":"application/json"}});
  } catch (error) {
    return new Response(JSON.stringify({ok:false,error:String(error?.message||error)}), {status:400,headers:{...cors,"content-type":"application/json"}});
  }
});

import 'server-only';
import nodemailer from 'nodemailer';

type Mail = {to:string; subject:string; text:string; html:string; debug?:Record<string,string>};

function escapeHtml(value:string) {
  return value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character] || character));
}

function studioUrl(path:string) {
  const origin=process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000';
  return new URL(path, origin).toString();
}

async function sendMail(mail:Mail) {
  if(process.env.EMAIL_TRANSPORT==='console' && process.env.NODE_ENV!=='production') {
    console.info('[studio-email]', JSON.stringify({to:mail.to,subject:mail.subject,...mail.debug}));
    return;
  }
  const host=process.env.SMTP_HOST?.trim();
  const port=Number(process.env.SMTP_PORT || 465);
  const user=process.env.SMTP_USER?.trim();
  const pass=process.env.SMTP_PASS;
  if(!host || !user || !pass || !Number.isInteger(port)) throw new Error('Studio email delivery is not configured.');
  const transport=nodemailer.createTransport({host,port,secure:port===465,auth:{user,pass}});
  await transport.sendMail({
    from:process.env.EMAIL_FROM?.trim() || `Inchframe Studio <${user}>`,
    replyTo:process.env.EMAIL_REPLY_TO?.trim() || user,
    to:mail.to,
    subject:mail.subject,
    text:mail.text,
    html:mail.html,
  });
}

function emailShell(content:string) {
  return `<!doctype html><html><body style="margin:0;background:#050705;color:#fbfaf2;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:42px 24px"><p style="color:#9cf21f;font-weight:800;letter-spacing:.1em">INCHFRAME STUDIO</p>${content}<p style="margin-top:34px;color:#9ca29a;font-size:13px">Directed AI-assisted video production by Unus Mundus LLC.</p></div></body></html>`;
}

export async function sendVerificationEmail(input:{email:string;displayName:string;token:string}) {
  const verifyUrl=studioUrl(`/api/auth/verify?token=${encodeURIComponent(input.token)}`);
  const name=escapeHtml(input.displayName);
  await sendMail({
    to:input.email,
    subject:'Verify your Inchframe Studio email',
    text:`Hi ${input.displayName},\n\nVerify your email to submit a project inquiry: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    html:emailShell(`<h1 style="font-size:34px;line-height:1.05">Verify your email.</h1><p style="color:#c7cbc4;line-height:1.6">Hi ${name}, confirm your address to submit a short project inquiry. No access code is needed.</p><p style="margin:28px 0"><a href="${verifyUrl}" style="display:inline-block;padding:15px 22px;border-radius:999px;background:#9cf21f;color:#081006;font-weight:800;text-decoration:none">Verify email →</a></p><p style="color:#9ca29a;font-size:13px">This link expires in 24 hours.</p>`),
    debug:{verifyUrl},
  });
}

export async function sendProjectAcceptedEmail(input:{email:string;displayName:string;projectId:string;projectTitle:string;accessCode:string}) {
  const projectUrl=studioUrl(`/portal/projects/${encodeURIComponent(input.projectId)}`);
  await sendMail({
    to:input.email,
    subject:`Your Inchframe Studio project is approved: ${input.projectTitle}`,
    text:`Hi ${input.displayName},\n\nWe would like to move forward with ${input.projectTitle}. Sign in at ${projectUrl} and enter this one-time project code: ${input.accessCode}\n\nThe code expires in 14 days. After you use it, the advanced project area stays unlocked for your account.`,
    html:emailShell(`<h1 style="font-size:34px;line-height:1.05">Your project is moving forward.</h1><p style="color:#c7cbc4;line-height:1.6">Hi ${escapeHtml(input.displayName)}, we reviewed <strong>${escapeHtml(input.projectTitle)}</strong> and would like to continue.</p><p style="color:#9ca29a">Your one-time project code</p><p style="font-size:26px;letter-spacing:.08em;font-weight:900;color:#9cf21f">${escapeHtml(input.accessCode)}</p><p style="margin:28px 0"><a href="${projectUrl}" style="display:inline-block;padding:15px 22px;border-radius:999px;background:#9cf21f;color:#081006;font-weight:800;text-decoration:none">Open advanced project area →</a></p><p style="color:#9ca29a;font-size:13px">The code expires in 14 days. Once redeemed, this project remains unlocked in your account.</p>`),
    debug:{projectUrl,projectCode:input.accessCode},
  });
}

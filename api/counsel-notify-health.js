export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const k=String(process.env.RESEND_API_KEY||'');
  const to=String(process.env.HIRAGUMI_NOTIFY_TO||'');
  return res.status(200).json({
    hasResendApiKey:!!k,
    resendKeyFormatOk:/^re_[A-Za-z0-9_-]{10,}$/.test(k),
    hasNotifyTo:!!to,
    notifyToFormatOk:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
  });
}
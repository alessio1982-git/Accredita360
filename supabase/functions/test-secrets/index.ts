import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
    const twilioFrom = Deno.env.get("TWILIO_FROM") ?? "";

    // Prova a inviare una mail di test per vedere l'errore esatto di Resend
    let resendError = null;
    let resendStatus = 0;
    let resendResult = null;
    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Accredita360 <noreply@accredita360s.com>",
            to: ["alessio.arlotta@gmail.com"],
            subject: "🔍 Test Diagnostico Resend API",
            html: "<p>Se ricevi questo messaggio, Resend funziona correttamente!</p>"
          })
        });
        resendStatus = res.status;
        const text = await res.text();
        try {
          resendResult = JSON.parse(text);
        } catch {
          resendResult = text;
        }
        if (!res.ok) {
          resendError = resendResult;
        }
      } catch (e) {
        resendError = String(e);
      }
    } else {
      resendError = "RESEND_API_KEY non configurata";
    }

    return new Response(JSON.stringify({
      success: true,
      resendKeyLength: resendKey.length,
      resendKeyPrefix: resendKey ? resendKey.substring(0, 7) : "None",
      resendStatus,
      resendResult,
      resendError,
      twilioSid,
      twilioTokenLength: twilioToken.length,
      twilioFrom
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

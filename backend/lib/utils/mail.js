// Sends email through Brevo's web API (no extra packages needed).
// Needs BREVO_API_KEY and MAIL_FROM (a sender address verified in Brevo).
export const mailConfigured = () => !!(process.env.BREVO_API_KEY && process.env.MAIL_FROM);

export const appUrl = () =>
	(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/+$/, "");

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const sendMail = async ({ to, subject, heading, body, buttonText, buttonUrl }) => {
	if (!mailConfigured()) {
		console.log("Email not configured (BREVO_API_KEY / MAIL_FROM missing); skipped email:", subject);
		return false;
	}
	const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111">
<h2 style="margin:0 0 12px">${escapeHtml(heading)}</h2>
<p style="line-height:1.5">${escapeHtml(body)}</p>
<p style="margin:24px 0"><a href="${escapeHtml(buttonUrl)}" style="background:#1d9bf0;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(buttonText)}</a></p>
<p style="font-size:12px;color:#666;line-height:1.5">If the button doesn't work, copy this link into your browser:<br>${escapeHtml(buttonUrl)}</p>
<p style="font-size:12px;color:#666">If you didn't ask for this, you can ignore this email.</p>
</div>`;
	try {
		const res = await fetch("https://api.brevo.com/v3/smtp/email", {
			method: "POST",
			headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
			body: JSON.stringify({
				sender: { email: process.env.MAIL_FROM, name: "Chrinnox" },
				to: [{ email: to }],
				subject,
				htmlContent: html,
			}),
		});
		if (!res.ok) {
			console.log("Brevo refused the email:", res.status, (await res.text()).slice(0, 300));
			return false;
		}
		return true;
	} catch (error) {
		console.log("Could not reach Brevo:", error.message);
		return false;
	}
};

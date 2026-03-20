import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify connection configuration
transporter.verify(function (error, success) {
    if (error) {
        console.error("Nodemailer transporter error:", error);
    } else {
        console.log("Nodemailer is ready to send messages");
    }
});

/**
 * Send a password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetLink - Link containing the reset token
 */
export async function sendPasswordResetEmail(to, resetLink) {
    const mailOptions = {
        from: `"Digital Learning Platform" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: 'Password Reset Request',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
                <h2 style="color: #4f46e5; text-align: center;">Reset Your Password</h2>
                <p>Hello,</p>
                <p>We received a request to reset the password for your account. Click the button below to choose a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #6b7280; font-size: 0.9em;">${resetLink}</p>
                <p style="margin-top: 30px; font-size: 0.9em; color: #6b7280;">This link will expire in 30 minutes. If you did not request a password reset, please ignore this email.</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
    }
}

// Email Service - Send invitation emails

import { Resend } from 'resend';
import { getFrontendUrl } from '../utils/environment.js';
import type { InvitationWithDetails } from '../types/connection.js';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const fromEmail = process.env.EMAIL_FROM || 'noreply@dbexplorer.com';
const fromName = process.env.EMAIL_FROM_NAME || 'DB Explorer';

export class EmailService {
  /**
   * Send invitation email
   */
  static async sendInvitationEmail(invitation: InvitationWithDetails): Promise<{ success: boolean; error?: string }> {
    if (!resend) {
      console.warn('RESEND_API_KEY not configured. Email sending is disabled.');
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    try {
      const frontendUrl = getFrontendUrl();
      
      // Handle both snake_case and camelCase field names (data comes camelCase from DataMapper)
      const invitedEmail = (invitation as any).invitedEmail || (invitation as any).invited_email;
      const expiresAt = (invitation as any).expiresAt || (invitation as any).expires_at;
      const invitedByUser = (invitation as any).invitedByUser || (invitation as any).invited_by_user;
      const token = (invitation as any).token;
      
      if (!invitedEmail) {
        console.error('Missing invited_email field in invitation:', invitation);
        return {
          success: false,
          error: 'Invalid invitation data: missing email address',
        };
      }

      if (!token) {
        console.error('Missing token field in invitation:', invitation);
        return {
          success: false,
          error: 'Invalid invitation data: missing token',
        };
      }

      const acceptUrl = `${frontendUrl}/invitations/accept?token=${token}`;
      const expirationDate = new Date(expiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const inviterName = invitedByUser?.fullName || invitedByUser?.full_name || invitedByUser?.email || 'Someone';
      const connectionName = invitation.connection.name;
      const role = invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1);

      // Log email details for debugging
      console.log('Sending invitation email:', {
        from: `${fromName} <${fromEmail}>`,
        to: invitedEmail,
        subject: `You've been invited to access ${connectionName}`,
      });

      const { error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: invitedEmail,
        subject: `You've been invited to access ${connectionName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Database Connection Invitation</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Database Connection Invitation</h1>
              </div>
              <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; margin-bottom: 20px;">
                  Hello,
                </p>
                <p style="font-size: 16px; margin-bottom: 20px;">
                  <strong>${inviterName}</strong> has invited you to access the database connection <strong>${connectionName}</strong> with the role of <strong>${role}</strong>.
                </p>
                <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 30px 0;">
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">
                    <strong>Connection:</strong> ${connectionName}<br>
                    <strong>Role:</strong> ${role}<br>
                    <strong>Expires:</strong> ${expirationDate}
                  </p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${acceptUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                    Accept Invitation
                  </a>
                </div>
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="font-size: 12px; color: #9ca3af; word-break: break-all; background: #f9fafb; padding: 10px; border-radius: 4px;">
                  ${acceptUrl}
                </p>
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>
              <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #9ca3af;">
                  This invitation will expire on ${expirationDate}.
                </p>
              </div>
            </body>
          </html>
        `,
        text: `
Hello,

${inviterName} has invited you to access the database connection "${connectionName}" with the role of ${role}.

Connection: ${connectionName}
Role: ${role}
Expires: ${expirationDate}

Accept this invitation by clicking the link below:
${acceptUrl}

If you didn't expect this invitation, you can safely ignore this email.

This invitation will expire on ${expirationDate}.
        `.trim(),
      });

      if (error) {
        console.error('Error sending invitation email:', error);
        console.error('Email details:', {
          from: `${fromName} <${fromEmail}>`,
          to: invitedEmail,
          errorDetails: error,
        });
        
        // Provide helpful error message for domain verification issues
        if (error.message?.includes('domain is not verified')) {
          return {
            success: false,
            error: `Domain verification required: The domain in "${fromEmail}" is not verified in Resend. For development, use "onboarding@resend.dev" or verify your domain at https://resend.com/domains`,
          };
        }
        
        return {
          success: false,
          error: error.message || 'Failed to send email',
        };
      }

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Error in sendInvitationEmail:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  }
}


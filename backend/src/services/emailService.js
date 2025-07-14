/**
 * Email Service
 * 
 * This service handles all email communications for the EasyParkNow platform.
 * It uses Nodemailer for sending emails and supports HTML templates for
 * different types of notifications.
 * 
 * Features:
 * - Welcome emails with email verification
 * - Password reset emails
 * - Booking confirmations
 * - Payment receipts
 * - Booking reminders
 * - HTML email templates
 */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Email transporter configuration
 * Uses Gmail SMTP but can be configured for other providers
 */
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // Use app-specific password for Gmail
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

/**
 * Email templates
 * HTML templates for different types of emails
 */
const emailTemplates = {
  welcome: {
    subject: 'Welcome to EasyParkNow - Verify Your Email',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to EasyParkNow</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to EasyParkNow!</h1>
          </div>
          <div class="content">
            <h2>Hi {{firstName}},</h2>
            <p>Thank you for joining EasyParkNow! We're excited to help you find the perfect parking spaces.</p>
            <p>To get started, please verify your email address by clicking the button below:</p>
            <a href="{{verificationLink}}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="{{verificationLink}}">{{verificationLink}}</a></p>
            <p>Once verified, you'll be able to:</p>
            <ul>
              <li>Search and book parking spaces</li>
              <li>Manage your bookings</li>
              <li>List your own parking space (if you're a host)</li>
              <li>Receive booking notifications</li>
            </ul>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Happy parking!</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 EasyParkNow. All rights reserved.</p>
            <p>This email was sent to {{email}}. If you didn't create an account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  'password-reset': {
    subject: 'EasyParkNow - Password Reset Request',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - EasyParkNow</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi {{firstName}},</h2>
            <p>We received a request to reset your password for your EasyParkNow account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="{{resetLink}}" class="button">Reset Password</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="{{resetLink}}">{{resetLink}}</a></p>
            <div class="warning">
              <strong>Important:</strong>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password won't change until you create a new one</li>
              </ul>
            </div>
            <p>If you continue to have problems, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 EasyParkNow. All rights reserved.</p>
            <p>This email was sent to {{email}}.</p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  'booking-confirmation': {
    subject: 'Booking Confirmed - EasyParkNow',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmed - EasyParkNow</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .booking-details { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Booking Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Hi {{firstName}},</h2>
            <p>Great news! Your parking booking has been confirmed.</p>
            
            <div class="booking-details">
              <h3>Booking Details</h3>
              <div class="detail-row">
                <strong>Booking ID:</strong>
                <span>{{bookingId}}</span>
              </div>
              <div class="detail-row">
                <strong>Location:</strong>
                <span>{{spaceAddress}}</span>
              </div>
              <div class="detail-row">
                <strong>Date & Time:</strong>
                <span>{{startTime}} - {{endTime}}</span>
              </div>
              <div class="detail-row">
                <strong>Vehicle:</strong>
                <span>{{vehicleReg}}</span>
              </div>
              <div class="detail-row">
                <strong>Total Cost:</strong>
                <span>£{{totalCost}}</span>
              </div>
            </div>

            <h3>What's Next?</h3>
            <ul>
              <li>Save this email for your records</li>
              <li>Arrive at the parking space at your scheduled time</li>
              <li>Follow the access instructions provided</li>
              <li>Use the app to start/stop your parking session</li>
            </ul>

            <h3>Access Instructions</h3>
            <p>{{accessInstructions}}</p>

            <p>Need to make changes? You can modify or cancel your booking through the app up to 1 hour before your start time.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 EasyParkNow. All rights reserved.</p>
            <p>Need help? Contact us at support@easyparkNow.com</p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  'payment-receipt': {
    subject: 'Payment Receipt - EasyParkNow',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Receipt - EasyParkNow</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .receipt { background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
          .total-row { font-weight: bold; font-size: 18px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💳 Payment Receipt</h1>
          </div>
          <div class="content">
            <h2>Hi {{firstName}},</h2>
            <p>Thank you for your payment. Here's your receipt:</p>
            
            <div class="receipt">
              <h3>Payment Details</h3>
              <div class="detail-row">
                <span>Payment ID:</span>
                <span>{{paymentId}}</span>
              </div>
              <div class="detail-row">
                <span>Date:</span>
                <span>{{paymentDate}}</span>
              </div>
              <div class="detail-row">
                <span>Method:</span>
                <span>{{paymentMethod}}</span>
              </div>
              <div class="detail-row">
                <span>Booking ID:</span>
                <span>{{bookingId}}</span>
              </div>
              <div class="detail-row">
                <span>Location:</span>
                <span>{{spaceAddress}}</span>
              </div>
              <div class="detail-row total-row">
                <span>Total Paid:</span>
                <span>£{{amount}}</span>
              </div>
            </div>

            <p>This receipt serves as proof of payment for your parking booking.</p>
            <p>If you need to request a refund or have any questions about this payment, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 EasyParkNow. All rights reserved.</p>
            <p>Keep this receipt for your records</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
};

/**
 * Replace template variables with actual data
 * @param {string} template - HTML template string
 * @param {object} data - Data to replace in template
 * @returns {string} - Processed template
 */
const processTemplate = (template, data) => {
  let processed = template;
  
  // Replace all {{variable}} placeholders with actual data
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, data[key] || '');
  });
  
  return processed;
};

/**
 * Send email function
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject (optional if using template)
 * @param {string} options.template - Template name
 * @param {object} options.data - Data for template variables
 * @param {string} options.html - Custom HTML (if not using template)
 * @param {string} options.text - Plain text version
 */
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    // Verify transporter configuration
    await transporter.verify();

    let emailOptions = {
      from: {
        name: 'EasyParkNow',
        address: process.env.EMAIL_USER
      },
      to: options.to
    };

    // Use template if specified
    if (options.template && emailTemplates[options.template]) {
      const template = emailTemplates[options.template];
      emailOptions.subject = options.subject || template.subject;
      emailOptions.html = processTemplate(template.html, { ...options.data, email: options.to });
    } else {
      // Use custom content
      emailOptions.subject = options.subject;
      emailOptions.html = options.html;
      emailOptions.text = options.text;
    }

    // Send email
    const result = await transporter.sendMail(emailOptions);
    
    console.log('Email sent successfully:', {
      messageId: result.messageId,
      to: options.to,
      subject: emailOptions.subject
    });

    return {
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    console.error('Email sending failed:', {
      error: error.message,
      to: options.to,
      template: options.template
    });

    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send welcome email with verification link
 */
const sendWelcomeEmail = async (user, verificationLink) => {
  return sendEmail({
    to: user.email,
    template: 'welcome',
    data: {
      firstName: user.firstName,
      verificationLink
    }
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (user, resetLink) => {
  return sendEmail({
    to: user.email,
    template: 'password-reset',
    data: {
      firstName: user.firstName,
      resetLink
    }
  });
};

/**
 * Send booking confirmation email
 */
const sendBookingConfirmationEmail = async (booking, user, space) => {
  return sendEmail({
    to: user.email,
    template: 'booking-confirmation',
    data: {
      firstName: user.firstName,
      bookingId: booking.id,
      spaceAddress: space.address,
      startTime: new Date(booking.startTime).toLocaleString(),
      endTime: new Date(booking.endTime).toLocaleString(),
      vehicleReg: booking.vehicleReg,
      totalCost: booking.totalCost.toFixed(2),
      accessInstructions: space.accessInstructions || 'No special instructions'
    }
  });
};

/**
 * Send payment receipt email
 */
const sendPaymentReceiptEmail = async (payment, user, booking, space) => {
  return sendEmail({
    to: user.email,
    template: 'payment-receipt',
    data: {
      firstName: user.firstName,
      paymentId: payment.id,
      paymentDate: new Date(payment.createdAt).toLocaleString(),
      paymentMethod: payment.paymentMethod || 'Card',
      bookingId: booking.id,
      spaceAddress: space.address,
      amount: payment.amount.toFixed(2)
    }
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendPaymentReceiptEmail
};

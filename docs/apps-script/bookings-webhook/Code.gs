const COL_NAME = 3;   // C
const COL_EMAIL = 4;  // D
const COL_PHONE = 5;  // E
const COL_ISSUE = 7;  // G
const COL_STATUS = 8; // H
const COL_SEND = 9;   // I
const COL_PAYMENT_STATUS = 10; // J
const COL_RAZORPAY_ORDER = 11; // K
const COL_RAZORPAY_PAYMENT = 12; // L
const COL_BOOKING_REF = 13; // M

const PAY_STATUS_PENDING = 'Pending';
const PAY_STATUS_NOT_REQUIRED = 'Not required';
const PAY_STATUS_PAID = 'Paid';

const SHEET_ID = '1zBWeTr-8X0ghQ7hi1HKmrkVpf9QOIDbxGLfZcj2XbUQ';

const DEFAULT_VISIT_FEE_INR = 199;
const COMPONENT_INSTALL_FEE_INR = 600;

function getVisitFeePaise(service, device) {
  const s = service ? String(service).trim() : '';
  const d = device ? String(device).trim() : '';

  if (!s || s === 'Corporate / AMC enquiry') return 0;

  if (s === 'Laptop or desktop servicing (cleaning)') {
    const map = {
      'Desktop PC': 599,
      'MacBook / Apple laptop': 999,
      'Gaming laptop': 999,
      'Windows laptop': 699,
      'All-in-one desktop': 1099,
      'Other': 699,
      'Other / not sure': 699,
    };
    const inr = map[d] || 699;
    return inr * 100;
  }

  if (s === 'Component install (RAM / SSD / GPU)') {
    return COMPONENT_INSTALL_FEE_INR * 100;
  }

  return DEFAULT_VISIT_FEE_INR * 100;
}

function resolveOrderAmountPaise(amountPaise, service, device) {
  let amount = Math.round(Number(amountPaise));
  if (amount >= 100) return amount;
  amount = Math.round(Number(getVisitFeePaise(service, device)));
  return amount >= 100 ? amount : 0;
}

function buildBookingKey(name, email, phone, date, time) {
  const raw = [String(name), String(email), String(phone), String(date), String(time)].join('|');
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '');
}

function decodeBookingKeyParts(bookingKey) {
  try {
    let pad = String(bookingKey);
    while (pad.length % 4 !== 0) {
      pad += '=';
    }
    const raw = Utilities.newBlob(Utilities.base64DecodeWebSafe(pad)).getDataAsString('UTF-8');
    const parts = raw.split('|');
    if (parts.length < 5) return null;
    return {
      name: parts[0],
      email: parts[1],
      phone: parts[2],
      date: parts[3],
      time: parts[4],
    };
  } catch (e) {
    return null;
  }
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function cellDateToIso(cellValue) {
  if (cellValue instanceof Date) {
    return cellValue.getFullYear() + '-' + pad2(cellValue.getMonth() + 1) + '-' + pad2(cellValue.getDate());
  }
  return String(cellValue).trim();
}

function timesLikelyMatch(cellValue, timeFromKey) {
  if (!timeFromKey) return true;
  return String(cellValue).trim() === String(timeFromKey).trim();
}

function rowMatchesBookingParts(sheet, row, parts) {
  const name = String(sheet.getRange(row, COL_NAME).getValue());
  const email = String(sheet.getRange(row, COL_EMAIL).getValue());
  const phone = String(sheet.getRange(row, COL_PHONE).getValue());
  const date = sheet.getRange(row, 1).getValue();
  const time = sheet.getRange(row, 2).getValue();
  return (
    name === parts.name &&
    email === parts.email &&
    phone === parts.phone &&
    cellDateToIso(date) === String(parts.date).trim() &&
    timesLikelyMatch(time, parts.time)
  );
}

function findBookingRow(sheet, bookingKey) {
  if (!bookingKey) return 0;
  const last = sheet.getLastRow();
  for (let r = last; r >= 2; r--) {
    const ref = sheet.getRange(r, COL_BOOKING_REF).getValue();
    if (String(ref) === String(bookingKey)) {
      return r;
    }
  }
  // Legacy rows before column M (ref embedded in column G)
  const needle = 'ref:' + bookingKey;
  for (let r = last; r >= 2; r--) {
    const issue = sheet.getRange(r, COL_ISSUE).getValue();
    if (String(issue).indexOf(needle) !== -1) {
      return r;
    }
  }
  const parts = decodeBookingKeyParts(bookingKey);
  if (parts) {
    for (let r = last; r >= 2; r--) {
      if (rowMatchesBookingParts(sheet, r, parts)) {
        return r;
      }
    }
  }
  return 0;
}

function getRazorpayCredentials() {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('RAZORPAY_KEY_SECRET');
  const keyId = props.getProperty('RAZORPAY_KEY_ID');
  if (!secret || !keyId) {
    throw new Error('Razorpay is not configured (Script properties: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)');
  }
  return { keyId: keyId, secret: secret };
}

function hmacSha256Hex(message, secret) {
  const bytes = Utilities.computeHmacSha256Signature(message, secret);
  return bytes
    .map(function (b) {
      const v = b < 0 ? b + 256 : b;
      const hex = v.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    })
    .join('');
}

function createRazorpayOrder(amountPaise, receipt, service, device) {
  const amount = resolveOrderAmountPaise(amountPaise, service, device);
  if (!amount) {
    throw new Error(
      'Invalid order amount. Use Run → testRazorpayOrderInEditor (not createRazorpayOrder). ' +
        'For live bookings, redeploy Code.gs and ensure create-order sends service + device. ' +
        'Got amount=' +
        amountPaise +
        ', service=' +
        service,
    );
  }

  const creds = getRazorpayCredentials();
  const auth = Utilities.base64Encode(creds.keyId + ':' + creds.secret);
  const payload = JSON.stringify({
    amount: amount,
    currency: 'INR',
    receipt: String(receipt).substring(0, 40),
  });
  const response = UrlFetchApp.fetch('https://api.razorpay.com/v1/orders', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/json',
    },
    payload: payload,
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Razorpay order failed (amount=' + amount + '): ' + body);
  }
  return JSON.parse(body);
}

function handleCreateOrder(data) {
  try {
    const service = data.service && String(data.service).trim();
    const device = data.device && String(data.device).trim();
    if (!service) {
      return jsonResponse({ error: 'Missing service (required to calculate visit fee)' });
    }

    const amountPaise = resolveOrderAmountPaise(null, service, device);
    if (!amountPaise) {
      return jsonResponse({
        error: 'No online payment for this service',
        hint: service,
      });
    }
    if (!data.bookingKey) {
      return jsonResponse({ error: 'Missing booking reference' });
    }

    const order = createRazorpayOrder(amountPaise, data.bookingKey, service, device);
    return jsonResponse({
      status: 'success',
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
    });
  } catch (e) {
    return jsonResponse({ error: String(e.message || e) });
  }
}

function handleVerifyPayment(sheet, data) {
  const creds = getRazorpayCredentials();
  const message = data.razorpay_order_id + '|' + data.razorpay_payment_id;
  const expected = hmacSha256Hex(message, creds.secret);
  if (expected !== data.razorpay_signature) {
    return jsonResponse({ error: 'Invalid payment signature' });
  }

  const row = findBookingRow(sheet, data.bookingKey);
  if (!row) {
    return jsonResponse({ error: 'Booking not found for payment update' });
  }

  sheet.getRange(row, COL_PAYMENT_STATUS).setValue(PAY_STATUS_PAID);
  sheet.getRange(row, COL_RAZORPAY_ORDER).setValue(data.razorpay_order_id || '');
  sheet.getRange(row, COL_RAZORPAY_PAYMENT).setValue(data.razorpay_payment_id || '');
  if (data.bookingKey && !sheet.getRange(row, COL_BOOKING_REF).getValue()) {
    sheet.getRange(row, COL_BOOKING_REF).setValue(data.bookingKey);
  }

  return jsonResponse({ status: 'success' });
}

function processStatusEmail(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== 'Bookings') return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  // ACTION 1: Checkbox is clicked
  if (col === COL_SEND && row > 1) {
    if (e.value === 'TRUE' || e.value === true) {
      const status = sheet.getRange(row, COL_STATUS).getValue();

      if (status && status.trim() !== '') {
        sendHtmlEmail(sheet, row, status);
      } else {
        sheet.getRange(row, col).uncheck();
        SpreadsheetApp.getUi().alert('Error: Please select a Status before sending an update.');
      }
    }
  }

  // ACTION 2: Status is changed
  if (col === COL_STATUS && row > 1) {
    if (e.value !== e.oldValue) {
      sheet.getRange(row, COL_SEND).uncheck();
    }
  }
}

function sendHtmlEmail(sheet, row, newStatus) {
  const name = sheet.getRange(row, COL_NAME).getValue();
  const email = sheet.getRange(row, COL_EMAIL).getValue();

  if (!email || email === '') return;

  const subject = `Repair Update: ${newStatus} - The Computer Care Company`;

  const htmlBody = `
    <div style="font-family: 'Inter', Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #0f172a; margin-top: 0;">Repair Status Update</h2>
      <p style="font-size: 16px; line-height: 1.5;">Hi ${name},</p>
      <p style="font-size: 16px; line-height: 1.5;">Your device's repair status has just been updated to:</p>
      
      <div style="background-color: #EEF2F7; padding: 16px 20px; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0; font-size: 18px; font-weight: 600; color: #2563eb; margin: 24px 0;">
        ${newStatus}
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: #475569;">If you have any questions, you can reply directly to this email or contact us via WhatsApp.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 24px 0;">
      <p style="font-size: 14px; color: #64748b; margin: 0;">
        Best regards,<br>
        <strong style="color: #0f172a;">The Computer Care Company</strong><br>
        Korattur, Chennai
      </p>
    </div>
  `;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: htmlBody,
    name: 'The Computer Care Company',
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getBookingsSheet() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName('Bookings');
  if (!sheet) sheet = spreadsheet.getSheets()[0];
  return sheet;
}

function appendBookingsRow(sheet, dateOnly, timeOnly, name, email, phone, address, issue, paymentMeta) {
  const meta = paymentMeta || {};
  const paymentStatus = meta.paymentStatus != null ? meta.paymentStatus : '';
  const razorpayOrder = meta.razorpayOrder || '';
  const razorpayPayment = meta.razorpayPayment || '';
  const bookingRef = meta.bookingRef || '';

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);

    sheet.appendRow([
      dateOnly,
      timeOnly,
      name,
      email,
      phone,
      address,
      issue,
      'Product Received',
      false,
      paymentStatus,
      razorpayOrder,
      razorpayPayment,
      bookingRef,
    ]);
    SpreadsheetApp.flush();

    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, COL_SEND).insertCheckboxes();
    sheet.getRange(2, COL_STATUS).copyTo(
      sheet.getRange(newRow, COL_STATUS),
      SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,
      false,
    );
  } catch (lockError) {
    // Proceed normally if lock fails
  } finally {
    lock.releaseLock();
  }
}

function paymentStatusForWizardBooking(service, device) {
  const amountPaise = getVisitFeePaise(service, device);
  if (!amountPaise) return PAY_STATUS_NOT_REQUIRED;
  return PAY_STATUS_PENDING;
}

function buildWizardIssue(data) {
  const parts = [];
  if (data.service) parts.push(String(data.service));
  if (data.device) parts.push(String(data.device));
  let issue = parts.length ? parts.join(' · ') : 'Website booking';
  if (data.notes && String(data.notes).trim()) {
    issue += ' — ' + String(data.notes).trim();
  }
  return issue;
}

function handleWebsiteWizardPost(sheet, data) {
  if (data.action === 'create-order') {
    return handleCreateOrder(data);
  }
  if (data.action === 'verify-payment') {
    return handleVerifyPayment(sheet, data);
  }

  if (data.triggerEvent === 'PING') {
    appendBookingsRow(
      sheet,
      new Date().toLocaleDateString('en-IN'),
      new Date().toLocaleTimeString('en-IN'),
      'WIZARD PING',
      'website',
      'N/A',
      'N/A',
      'Website wizard webhook OK',
    );
    return jsonResponse({ status: 'success' });
  }

  const name = (data.name && String(data.name).trim()) || '';
  const email = (data.email && String(data.email).trim()) || '';
  if (!name) return jsonResponse({ error: 'Missing name' });
  if (!email) return jsonResponse({ error: 'Missing email' });

  const dateOnly = (data.date && String(data.date).trim()) || new Date().toLocaleDateString('en-IN');
  const timeOnly = (data.time && String(data.time).trim()) || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  let address = (data.address && String(data.address).trim()) || 'N/A';
  const landmark = data.landmark && String(data.landmark).trim();
  if (landmark) address += ' · ' + landmark;

  const phone = (data.phone && String(data.phone).trim()) || 'N/A';
  const issue = buildWizardIssue(data);
  const bookingKey = buildBookingKey(name, email, phone, dateOnly, timeOnly);
  const service = data.service && String(data.service).trim();
  const device = data.device && String(data.device).trim();

  appendBookingsRow(sheet, dateOnly, timeOnly, name, email, phone, address, issue, {
    paymentStatus: paymentStatusForWizardBooking(service, device),
    bookingRef: bookingKey,
  });
  return jsonResponse({ status: 'success', bookingKey: bookingKey });
}

function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const rawData = e && e.postData ? e.postData.contents : 'No data received';
    const data = JSON.parse(rawData);

    const sheet = getBookingsSheet();

    if (data.source === 'website-wizard') {
      return handleWebsiteWizardPost(sheet, data);
    }

    if (data.triggerEvent === 'PING') {
      appendBookingsRow(
        sheet,
        new Date().toLocaleDateString('en-IN'),
        new Date().toLocaleTimeString('en-IN'),
        'PING TEST',
        'cal.com',
        'N/A',
        'N/A',
        'Webhook successful!',
      );
      return jsonResponse({ status: 'success' });
    }

    const p = data.payload || {};
    const attendee = p.attendees && p.attendees.length > 0 ? p.attendees[0] : {};
    const responses = p.responses || {};

    const name = attendee.name || 'N/A';
    const email = attendee.email || 'N/A';

    const fullDate = p.startTime ? new Date(p.startTime) : new Date();
    const dateOnly = fullDate.toLocaleDateString('en-IN');
    const timeOnly = fullDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const address = p.location || attendee.location || 'N/A';
    let phone = attendee.phoneNumber || 'N/A';

    let issue = 'Standard Diagnostics';
    for (const key in responses) {
      if (key.toLowerCase().includes('issue') || key.toLowerCase().includes('notes')) {
        const field = responses[key];
        issue = typeof field === 'object' && field !== null ? field.value : field;
      }
      if (key.toLowerCase().includes('phone')) {
        const field = responses[key];
        phone = typeof field === 'object' && field !== null ? field.value : field;
      }
    }

    appendBookingsRow(sheet, dateOnly, timeOnly, name, email, phone, address, issue);

    return jsonResponse({ status: 'success' });
  } catch (error) {
    const myEmail = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({
      to: myEmail,
      subject: '❌ Bookings Webhook Crash Report',
      body: 'The script crashed while trying to write to the sheet! \n\nError Message: ' + error.message,
    });

    return jsonResponse({ error: error.message });
  }
}

/** Apps Script: Run → testRazorpayOrderInEditor (do not run createRazorpayOrder directly). */
function testRazorpayOrderInEditor() {
  const order = createRazorpayOrder(
    19900,
    'editor_self_test',
    'Standard diagnostics / check-up',
    'Windows laptop',
  );
  Logger.log('order_id=%s amount=%s', order.id, order.amount);
}

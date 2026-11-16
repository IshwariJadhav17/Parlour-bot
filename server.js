require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// WhatsApp & Media Config
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'glamour_studio_verify_123';
const PAYMENT_QR_IMAGE_URL = process.env.PAYMENT_QR_IMAGE_URL;
const NAIL_MENU_IMAGE_URL = process.env.NAIL_MENU_IMAGE_URL || 'https://res.cloudinary.com/qmjp9axi/image/upload/f_png/nail_art_menu';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const STUDIO_PHONE = '+91 72765 08400';

// Google Sheets & Calendar Config
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const CSV_FILE_PATH = path.join(__dirname, 'bookings.csv');

// Ensure CSV file exists with headers
if (!fs.existsSync(CSV_FILE_PATH)) {
  fs.writeFileSync(
    CSV_FILE_PATH,
    'BookingID,CreatedAt,ClientName,Mobile,Category,Service,Date,TimeSlot,ServiceMode,Address,TotalRate,AdvancePaid,BalanceDue\n'
  );
}

// Initialize Google Auth (Sheets + Calendar)
let sheetsClient = null;
let calendarClient = null;

if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar'
      ]
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    calendarClient = google.calendar({ version: 'v3', auth });
    console.log('Google Sheets & Calendar clients initialized.');
  } catch (err) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
  }
}

const userSessions = {};

// Makeup Packages Catalog
const MAKEUP_PACKAGES = {
  pkg_bridal: {
    id: 'pkg_bridal',
    category: 'Makeup',
    title: 'Bridal Package',
    rate: 15000,
    rateDisplay: '₹15,000/- (Custom Quote)',
    description: 'Includes Bridal Makeup, Hairstyle, Draping, Lenses & Lashes. (Traveling charges & optional jewellery rent extra).'
  },
  pkg_hd: {
    id: 'pkg_hd',
    category: 'Makeup',
    title: 'HD Makeup (1 Look)',
    rate: 6000,
    rateDisplay: '₹6,000/-',
    description: 'Flawless HD Makeup for 1 Look including Hairstyle, Draping, Lenses & Lashes.'
  },
  pkg_luxury: {
    id: 'pkg_luxury',
    category: 'Makeup',
    title: 'Luxury Makeup (1 Look)',
    rate: 8000,
    rateDisplay: '₹8,000/-',
    description: 'Premium Luxury Makeup for 1 Look including Hairstyle, Draping, Lenses & Lashes.'
  },
  pkg_touchup: {
    id: 'pkg_touchup',
    category: 'Makeup',
    title: 'Per Touch-Up',
    rate: 1000,
    rateDisplay: '₹1,000/-',
    description: 'Includes Makeup correction, hair setting, and saree/dupatta draping.'
  }
};

// Nail Art Catalog
const NAIL_PACKAGES = {
  nail_hand: {
    id: 'nail_hand',
    category: 'Nail Art',
    title: 'Original Nails (Hand)',
    rate: 300,
    rateDisplay: '₹300/- (1 Hand)',
    description: 'Gel polish & nail art on natural hand nails (per hand).'
  },
  nail_foot: {
    id: 'nail_foot',
    category: 'Nail Art',
    title: 'Original Nails (Foot)',
    rate: 500,
    rateDisplay: '₹500/- (1 Foot)',
    description: 'Gel polish & nail art on natural foot nails (per foot).'
  },
  nail_presson: {
    id: 'nail_presson',
    category: 'Nail Art',
    title: 'Press On Nails',
    rate: 300,
    rateDisplay: '₹300/- (1 Hand)',
    description: 'Custom reusable Press-On Nails application (1 Hand).'
  },
  nail_extra: {
    id: 'nail_extra',
    category: 'Nail Art',
    title: 'Extra Nail Art',
    rate: 100,
    rateDisplay: '₹100/-',
    description: 'Add-on stones, chrome, glitter, or intricate hand-painted nail art.'
  },
  nail_ext_basic: {
    id: 'nail_ext_basic',
    category: 'Nail Art',
    title: 'Extensions (Basic)',
    rate: 1000,
    rateDisplay: '₹1,000/-',
    description: 'Classic Nail Extensions with single-tone gel finish.'
  },
  nail_ext_mid: {
    id: 'nail_ext_mid',
    category: 'Nail Art',
    title: 'Extensions (Medium Art)',
    rate: 1200,
    rateDisplay: '₹1,200/-',
    description: 'Nail Extensions with French tips, ombre, or glitter design.'
  },
  nail_ext_bridal: {
    id: 'nail_ext_bridal',
    category: 'Nail Art',
    title: 'Extensions (Bridal/3D)',
    rate: 1500,
    rateDisplay: '₹1,500/-',
    description: 'Luxury Bridal Nail Extensions with 3D art, stones & custom designs.'
  }
};

const FAQ_ANSWERS = {
  faq_included: '💄 *What is included in Makeup Packages?*\nOur Bridal, HD (₹6,000), and Luxury (₹8,000) packages include *Makeup, Hairstyle, Saree/Dupatta Draping, Lenses & Lashes*.',
  faq_travel: '🚗 *Home Visit & Traveling Charges:*\nYes, we offer doorstep home visits! Traveling charges are separate and depend on your location distance.',
  faq_jewellery: '👑 *Bridal Jewellery Rent:*\nOptional bridal jewellery sets are available on rent. Charges depend on the jewellery pieces and quantity selected.',
  faq_nails: '💅 *Nail Art & Extensions Pricing:*\n• Original Nails: ₹300 (1 Hand) / ₹500 (1 Foot)\n• Press On Nails: ₹300 (1 Hand)\n• Extra Art: ₹100\n• Nail Extensions: ₹1,000 / ₹1,200 / ₹1,500',
  faq_advance: '💳 *Booking & Advance Policy:*\n• *Makeup Packages:* ₹1,000 advance is required to lock your date & time slot.\n• *Nail Art Services:* No advance payment needed! Pay directly after your service.'
};

// Send WhatsApp API Request
async function sendWhatsAppMessage(payload) {
  try {
    await axios.post(
      `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('WhatsApp API Error:', error.response ? JSON.stringify(error.response.data) : error.message);
  }
}

// Check if a Date (YYYY-MM-DD) is Already Booked in CSV or Google Calendar
async function isDateBooked(isoDate) {
  // 1. Check local CSV file
  if (fs.existsSync(CSV_FILE_PATH)) {
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    if (csvContent.includes(isoDate)) {
      return true;
    }
  }

  // 2. Check Google Calendar for existing events on that date
  if (calendarClient && GOOGLE_CALENDAR_ID) {
    try {
      const response = await calendarClient.events.list({
        calendarId: GOOGLE_CALENDAR_ID,
        timeMin: `${isoDate}T00:00:00+05:30`,
        timeMax: `${isoDate}T23:59:59+05:30`,
        singleEvents: true
      });
      if (response.data.items && response.data.items.length > 0) {
        return true;
      }
    } catch (err) {
      console.error('Calendar availability check error:', err.message);
    }
  }

  return false;
}

// Save Booking to CSV, Google Sheets, and Google Calendar
async function recordConfirmedBooking(bookingId, data, advancePaid) {
  const totalAmount = data.package.rate;
  const balanceDue = Math.max(0, totalAmount - advancePaid);
  const createdAt = new Date().toISOString();

  const rowValues = [
    bookingId,
    createdAt,
    data.name,
    data.phone,
    data.package.category,
    data.package.title,
    data.isoDate,
    data.time,
    data.serviceMode,
    data.address,
    totalAmount,
    advancePaid,
    balanceDue
  ];

  // 1. Append to local CSV
  const escapedCsvRow = rowValues
    .map((val) => `"${String(val).replace(/"/g, '""')}"`)
    .join(',') + '\n';
  fs.appendFileSync(CSV_FILE_PATH, escapedCsvRow);

  // 2. Append to Google Sheet
  if (sheetsClient && GOOGLE_SHEET_ID) {
    try {
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: 'Sheet1!A:M',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] }
      });
    } catch (err) {
      console.error('Google Sheets append error:', err.message);
    }
  }

  // 3. Mark on Google Calendar
  if (calendarClient && GOOGLE_CALENDAR_ID) {
    const slotMap = {
      slot_10am: { start: '10:00:00', end: '12:00:00' },
      slot_12pm: { start: '12:30:00', end: '14:30:00' },
      slot_03pm: { start: '15:00:00', end: '17:00:00' },
      slot_05pm: { start: '17:30:00', end: '19:30:00' }
    };
    const times = slotMap[data.timeId] || { start: '10:00:00', end: '12:00:00' };

    try {
      await calendarClient.events.insert({
        calendarId: GOOGLE_CALENDAR_ID,
        requestBody: {
          summary: `${data.package.title} - ${data.name}`,
          location: data.address,
          description: `Booking ID: ${bookingId}\nClient: ${data.name}\nPhone: ${data.phone}\nService: ${data.package.title} (${data.package.rateDisplay})\nMode: ${data.serviceMode}\nAdvance Paid: ₹${advancePaid}/-`,
          start: { dateTime: `${data.isoDate}T${times.start}+05:30`, timeZone: 'Asia/Kolkata' },
          end: { dateTime: `${data.isoDate}T${times.end}+05:30`, timeZone: 'Asia/Kolkata' }
        }
      });
    } catch (err) {
      console.error('Google Calendar insert error:', err.message);
    }
  }
}

// Answer Custom Typed Questions
async function answerCustomQuestion(question) {
  if (GEMINI_API_KEY) {
    try {
      const prompt = `You are the polite WhatsApp assistant for "Amita's Makeover" beauty parlour. Answer the customer's question concisely in 2-3 sentences using ONLY these facts:
- Bridal Package includes Makeup, Hairstyle, Draping, Lenses & Lashes.
- HD Makeup (1 Look): ₹6,000/- | Luxury Makeup (1 Look): ₹8,000/- | Per Touch-Up: ₹1,000/-.
- Traveling charges are separate depending on location. Optional jewellery rent depends on quantity.
- Nail Art Menu: Original Nails (Hand) ₹300, Original Nails (Foot) ₹500, Press On Nails ₹300, Extra Art ₹100, Extensions ₹1000 / ₹1200 / ₹1500.
- Makeup bookings need ₹1,000 advance; Nail art needs zero advance.
Customer Question: "${question}"`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );
      const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return reply.trim();
    } catch (err) {
      console.error('Gemini fallback:', err.message);
    }
  }

  const q = question.toLowerCase();
  if (q.includes('price') || q.includes('rate') || q.includes('cost')) {
    return '✨ *Rates:* HD Makeup ₹6,000/- | Luxury Makeup ₹8,000/- | Touch-Up ₹1,000/- | Nail Art starts at ₹300/- & Extensions ₹1,000–₹1,500/-.';
  }
  if (q.includes('home') || q.includes('travel') || q.includes('visit')) {
    return '🏡 Yes! We offer both *Parlour Visits* and *Home Service* (traveling charges depend on your location).';
  }
  if (q.includes('jewel') || q.includes('rent')) {
    return '👑 Optional bridal jewellery is available on rent (charges depend on quantity).';
  }
  return `Thank you for your question! ✨ For custom inquiries, feel free to call our studio at *${STUDIO_PHONE}* or tap *Book Appointment* below.`;
}

// Generate Next 6 Months for Month Picker
function getUpcomingMonths() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    months.push({
      id: `month_${year}-${monthNum}`,
      title: label,
      description: i === 0 ? 'Current Month' : 'Available'
    });
  }
  return months;
}

// Generate Specific Days (1-10, 11-20, or 21-31) for Selected Month
function getDaysInRange(yearMonth, rangeCode) {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  let startDay = 1;
  let endDay = 10;
  if (rangeCode === 'range_11_20') {
    startDay = 11;
    endDay = 20;
  } else if (rangeCode === 'range_21_31') {
    startDay = 21;
    endDay = totalDaysInMonth;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = [];
  for (let day = startDay; day <= endDay; day++) {
    const dateObj = new Date(year, monthIndex, day);
    const isoDate = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
    const label = dateObj.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const isPast = dateObj < today;

    rows.push({
      id: `day_${isoDate}`,
      title: label,
      description: isPast ? 'Past Date' : 'Tap to check availability'
    });
  }
  return rows;
}

// Send Month Picker
async function sendMonthPicker(to) {
  await sendWhatsAppMessage({
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'Step 1: Select Month' },
      body: { text: 'Please choose the *Month* for your appointment:' },
      action: {
        button: 'Select Month',
        sections: [{ title: 'Available Months', rows: getUpcomingMonths() }]
      }
    }
  });
}

// Send Main Menu
async function sendMainMenu(to, customerName) {
  await sendWhatsAppMessage({
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: { type: 'text', text: "✨ AMITA'S MAKEOVER ✨" },
      body: { text: `Thank you, *${customerName}*! 🌸\nHow would you like to proceed today?` },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'menu_inquiry', title: 'Inquiry' } },
          { type: 'reply', reply: { id: 'menu_book', title: 'Book Appointment' } }
        ]
      }
    }
  });
}

// Send Service Category Menu
async function sendServiceCategoryMenu(to) {
  await sendWhatsAppMessage({
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: { type: 'text', text: "Amita's Makeover Services" },
      body: { text: 'Please choose which service category you would like to explore & book:' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'cat_nailart', title: 'Nail Art' } },
          { type: 'reply', reply: { id: 'cat_makeup', title: 'Makeup Packages' } }
        ]
      }
    }
  });
}

// Send Inquiry Menu
async function sendInquiryMenu(to) {
  await sendWhatsAppMessage({
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'Quick Inquiry & FAQs' },
      body: { text: 'Select a question below or choose *"Ask Another Question"* to type your own:' },
      action: {
        button: 'Select Question',
        sections: [
          {
            title: 'Common Questions',
            rows: [
              { id: 'faq_included', title: 'Makeup Inclusions', description: 'What is included in bridal/HD packages?' },
              { id: 'faq_travel', title: 'Home Visit & Travel', description: 'Do you travel to customer location?' },
              { id: 'faq_jewellery', title: 'Jewellery Rent', description: 'Is bridal jewellery available on rent?' },
              { id: 'faq_nails', title: 'Nail Art & Extensions', description: 'Rates for extensions, press-on & gel nails' },
              { id: 'faq_advance', title: 'Advance Payment Policy', description: 'When is advance payment required?' },
              { id: 'faq_custom', title: 'Ask Another Question', description: 'Type your own custom question' }
            ]
          }
        ]
      }
    }
  });
}

// Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Download CSV Endpoint (Open https://parlour-bot.onrender.com/bookings.csv to download all bookings)
app.get('/bookings.csv', (req, res) => {
  if (fs.existsSync(CSV_FILE_PATH)) {
    return res.download(CSV_FILE_PATH, 'Amitas_Makeover_Bookings.csv');
  }
  return res.status(404).send('No bookings recorded yet.');
});

// Privacy Policy Route
app.get('/privacy', (req, res) => {
  res.send("<h1>Privacy Policy - Amita's Makeover</h1><p>We collect customer name, phone number, and appointment details solely to schedule makeup and nail art bookings via WhatsApp.</p>");
});

// Incoming WhatsApp Messages Handler
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];
  if (!message) return;

  const from = message.from;
  let userInput = '';
  let interactiveId = '';

  if (message.type === 'text') {
    userInput = message.text.body.trim();
  } else if (message.type === 'interactive') {
    if (message.interactive.type === 'button_reply') {
      interactiveId = message.interactive.button_reply.id;
      userInput = message.interactive.button_reply.title;
    } else if (message.interactive.type === 'list_reply') {
      interactiveId = message.interactive.list_reply.id;
      userInput = message.interactive.list_reply.title;
    }
  } else if (message.type === 'location') {
    userInput = `Lat: ${message.location.latitude}, Lng: ${message.location.longitude} (${message.location.address || 'Pinned Location'})`;
  } else if (message.type === 'image') {
    userInput = '[Payment Screenshot Uploaded]';
  }

  const isGreeting = ['hi', 'hii', 'hiii', 'hello', 'hey', 'start', 'menu', 'restart'].includes(userInput.toLowerCase());
  const isFromAd = Boolean(message.referral);

  if (isGreeting || isFromAd || !userSessions[from]) {
    userSessions[from] = { step: 'ASK_NAME_AND_PHONE', data: {} };

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: {
        body: `✨ *Welcome to Amita's Makeover!* ✨\nThank you for reaching out${isFromAd ? ' from Instagram' : ''}! 💄💅\n\nBefore we begin, please enter your *Full Name* and *10-digit Mobile Number* in one message:\n\n_Example: Priya Sharma, 9876543210_`
      }
    });
    return;
  }

  const session = userSessions[from];

  // Validate & Save Name + 10-Digit Phone
  if (session.step === 'ASK_NAME_AND_PHONE') {
    const phoneMatch = userInput.match(/(\+91[\-\s]?)?[6-9]\d{9}/);
    if (!phoneMatch) {
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: `⚠️ Please enter a valid *10-digit Mobile Number* along with your *Full Name*:\n\n_Example: Priya Sharma, 9876543210_` }
      });
      return;
    }

    const phone = phoneMatch[0].replace(/\D/g, '').slice(-10);
    const name = userInput.replace(phoneMatch[0], '').replace(/[,\-\n:]+/g, ' ').trim();

    if (name.length < 2) {
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: `⚠️ Please include your *Full Name* along with your 10-digit number:\n\n_Example: Priya Sharma, 9876543210_` }
      });
      return;
    }

    session.data.name = name;
    session.data.phone = phone;
    session.step = 'MAIN_MENU';
    await sendMainMenu(from, session.data.name);
    return;
  }

  // Global Quick Buttons
  if (interactiveId === 'menu_inquiry') {
    session.step = 'INQUIRY_MENU';
    await sendInquiryMenu(from);
    return;
  }

  if (interactiveId === 'menu_book') {
    session.step = 'SELECT_CATEGORY';
    await sendServiceCategoryMenu(from);
    return;
  }

  // INQUIRY FLOW
  if (session.step === 'INQUIRY_MENU') {
    if (interactiveId === 'faq_custom') {
      session.step = 'INQUIRY_CUSTOM_TEXT';
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: '✍️ Please type your question below, and I will answer it right away:' }
      });
      return;
    }

    if (FAQ_ANSWERS[interactiveId]) {
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: FAQ_ANSWERS[interactiveId] },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'menu_inquiry', title: 'More Questions' } },
              { type: 'reply', reply: { id: 'menu_book', title: 'Book Appointment' } }
            ]
          }
        }
      });
      return;
    }
  }

  if (session.step === 'INQUIRY_CUSTOM_TEXT') {
    const answer = await answerCustomQuestion(userInput);
    session.step = 'INQUIRY_MENU';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: answer },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'menu_inquiry', title: 'Ask Another' } },
            { type: 'reply', reply: { id: 'menu_book', title: 'Book Appointment' } }
          ]
        }
      }
    });
    return;
  }

  // CATEGORY SELECTION (Nail Art vs Makeup Packages)
  if (session.step === 'SELECT_CATEGORY') {
    if (interactiveId === 'cat_nailart') {
      session.step = 'SELECT_PACKAGE';

      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'image',
        image: {
          link: NAIL_MENU_IMAGE_URL,
          caption: "💅 *Amita's Makeover – Nail Art Menu*\nCheck out our rates above and select your preferred service below!"
        }
      });

      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: 'Select Nail Art Service' },
          body: { text: 'Tap below to choose your Nail Art option (No advance required!):' },
          action: {
            button: 'Choose Nail Art',
            sections: [
              {
                title: 'Nail Art & Extensions',
                rows: Object.values(NAIL_PACKAGES).map((item) => ({
                  id: item.id,
                  title: item.title,
                  description: item.rateDisplay
                }))
              }
            ]
          }
        }
      });
      return;
    }

    if (interactiveId === 'cat_makeup') {
      session.step = 'SELECT_PACKAGE';

      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: 'Bridal & Makeup Packages' },
          body: { text: 'Select your preferred Makeup Package:' },
          action: {
            button: 'Choose Package',
            sections: [
              {
                title: 'Makeup Packages',
                rows: Object.values(MAKEUP_PACKAGES).map((pkg) => ({
                  id: pkg.id,
                  title: pkg.title,
                  description: pkg.rateDisplay
                }))
              }
            ]
          }
        }
      });
      return;
    }

    await sendServiceCategoryMenu(from);
    return;
  }

  // PACKAGE SELECTED -> SHOW MONTH PICKER
  if (session.step === 'SELECT_PACKAGE') {
    const selectedItem = MAKEUP_PACKAGES[interactiveId] || NAIL_PACKAGES[interactiveId];
    if (!selectedItem) {
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: 'Please select an option from the menu button above.' }
      });
      return;
    }

    session.data.package = selectedItem;
    session.step = 'SELECT_MONTH';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: {
        body: `✅ *Selected:* ${selectedItem.title}\n💰 *Rate:* ${selectedItem.rateDisplay}\n📋 *Details:* ${selectedItem.description}`
      }
    });

    await sendMonthPicker(from);
    return;
  }

  // MONTH SELECTED -> ASK DATE RANGE (1-10, 11-20, 21-31)
  if (session.step === 'SELECT_MONTH') {
    if (!interactiveId.startsWith('month_')) {
      await sendMonthPicker(from);
      return;
    }

    session.data.selectedMonth = interactiveId.replace('month_', ''); // e.g., "2026-12"
    session.data.selectedMonthLabel = userInput;
    session.step = 'SELECT_DATE_RANGE';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: { type: 'text', text: `Dates in ${userInput}` },
        body: { text: 'Which part of the month would you like to book?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'range_1_10', title: 'Dates 1 – 10' } },
            { type: 'reply', reply: { id: 'range_11_20', title: 'Dates 11 – 20' } },
            { type: 'reply', reply: { id: 'range_21_31', title: 'Dates 21 – 31' } }
          ]
        }
      }
    });
    return;
  }

  // DATE RANGE SELECTED -> SHOW SPECIFIC DAYS IN THAT RANGE
  if (session.step === 'SELECT_DATE_RANGE') {
    if (!interactiveId.startsWith('range_')) {
      await sendMonthPicker(from);
      return;
    }

    const dayRows = getDaysInRange(session.data.selectedMonth, interactiveId);
    session.step = 'SELECT_DAY';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: session.data.selectedMonthLabel },
        body: { text: 'Select your exact appointment date:' },
        action: {
          button: 'Pick Date',
          sections: [{ title: 'Dates', rows: dayRows }]
        }
      }
    });
    return;
  }

  // SPECIFIC DAY SELECTED -> CHECK CALENDAR & CSV AVAILABILITY
  if (session.step === 'SELECT_DAY') {
    if (!interactiveId.startsWith('day_')) {
      await sendMonthPicker(from);
      return;
    }

    const isoDate = interactiveId.replace('day_', ''); // YYYY-MM-DD
    const alreadyBooked = await isDateBooked(isoDate);

    if (alreadyBooked) {
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: `❌ *Date Unavailable (${userInput})*\n\nSorry! This date is already booked on our calendar. Please call our studio directly at *${STUDIO_PHONE}* for urgent inquiries or select another date below:`
          },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'retry_date', title: 'Pick Another Date' } },
              { type: 'reply', reply: { id: 'menu_inquiry', title: 'Inquiry' } }
            ]
          }
        }
      });
      session.step = 'DATE_UNAVAILABLE_RETRY';
      return;
    }

    session.data.isoDate = isoDate;
    session.data.date = userInput;
    session.step = 'SELECT_TIME';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Select Time Slot' },
        body: { text: `✅ *${session.data.date}* is available!\nNow choose your preferred time slot:` },
        action: {
          button: 'Pick Time Slot',
          sections: [
            {
              title: 'Available Slots',
              rows: [
                { id: 'slot_10am', title: '10:00 AM - 12:00 PM', description: 'Morning Slot' },
                { id: 'slot_12pm', title: '12:30 PM - 02:30 PM', description: 'Afternoon Slot' },
                { id: 'slot_03pm', title: '03:00 PM - 05:00 PM', description: 'Evening Slot' },
                { id: 'slot_05pm', title: '05:30 PM - 07:30 PM', description: 'Late Evening Slot' }
              ]
            }
          ]
        }
      }
    });
    return;
  }

  // RETRY DATE IF UNAVAILABLE
  if (session.step === 'DATE_UNAVAILABLE_RETRY') {
    session.step = 'SELECT_MONTH';
    await sendMonthPicker(from);
    return;
  }

  // TIME SELECTED -> ASK PARLOUR VISIT VS HOME VISIT (FIXED 20-CHAR BUTTON LIMIT!)
  if (session.step === 'SELECT_TIME') {
    session.data.time = userInput;
    session.data.timeId = interactiveId;
    session.step = 'SERVICE_LOCATION_TYPE';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Where would you like to take the service?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'loc_parlour', title: 'Visit Parlour' } },
            { type: 'reply', reply: { id: 'loc_home', title: 'Home Visit' } }
          ]
        }
      }
    });
    return;
  }

  // HANDLE PARLOUR VS HOME VISIT
  if (session.step === 'SERVICE_LOCATION_TYPE') {
    if (interactiveId === 'loc_home') {
      session.data.serviceMode = 'Home Service (Travel extra)';
      session.step = 'ASK_ADDRESS';

      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: '🏡 *Home Visit Selected!*\nPlease type your *complete address* or share your *WhatsApp Live Location*:' }
      });
      return;
    } else {
      session.data.serviceMode = 'Parlour Visit';
      session.data.address = "Amita's Makeover Studio";
      session.step = 'CONFIRM_BOOKING';
      await sendBookingSummaryForConfirmation(from, session.data);
      return;
    }
  }

  // SAVE HOME ADDRESS -> ASK CONFIRMATION
  if (session.step === 'ASK_ADDRESS') {
    session.data.address = userInput;
    session.step = 'CONFIRM_BOOKING';
    await sendBookingSummaryForConfirmation(from, session.data);
    return;
  }

  // CONFIRMATION -> ADVANCE PAYMENT ONLY FOR MAKEUP; INSTANT BILL + CALENDAR/SHEET/CSV FOR NAIL ART
  if (session.step === 'CONFIRM_BOOKING') {
    if (interactiveId === 'confirm_yes') {
      const isMakeup = session.data.package.category === 'Makeup';

      if (isMakeup) {
        session.step = 'AWAITING_PAYMENT';
        await sendWhatsAppMessage({
          messaging_product: 'whatsapp',
          to: from,
          type: 'image',
          image: {
            link: PAYMENT_QR_IMAGE_URL,
            caption: `💳 *Advance Payment Required: ₹1,000/-*\n\nTo confirm your *${session.data.package.title}* on *${session.data.date}*, please scan the QR code above via GPay, PhonePe, or Paytm and pay *₹1,000/-*.\n\nOnce paid, reply *"PAID"* or send a payment screenshot to lock your date on our calendar and receive your bill receipt! ✨`
          }
        });
      } else {
        const bookingId = 'AM-' + Math.floor(100000 + Math.random() * 900000);
        await recordConfirmedBooking(bookingId, session.data, 0);
        await sendFinalBillReceipt(from, bookingId, session.data, 0);
        delete userSessions[from];
      }
    } else {
      delete userSessions[from];
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: '❌ Booking cancelled. Send *Hi* anytime to start again!' }
      });
    }
    return;
  }

  // MAKEUP ADVANCE PAID -> RECORD IN CSV, SHEETS, CALENDAR & SEND BILL
  if (session.step === 'AWAITING_PAYMENT') {
    const bookingId = 'AM-' + Math.floor(100000 + Math.random() * 900000);
    await recordConfirmedBooking(bookingId, session.data, 1000);
    await sendFinalBillReceipt(from, bookingId, session.data, 1000);
    delete userSessions[from];
  }
});

// Send Booking Summary & Confirmation Buttons
async function sendBookingSummaryForConfirmation(to, data) {
  const isMakeup = data.package.category === 'Makeup';
  const summary =
    `📋 *Please Confirm Your Booking Details:*\n\n` +
    `👤 *Name:* ${data.name}\n` +
    `📞 *Phone:* ${data.phone}\n` +
    `✨ *Service:* ${data.package.title} (${data.package.rateDisplay})\n` +
    `📅 *Date:* ${data.date}\n` +
    `⏰ *Time:* ${data.time}\n` +
    `📍 *Location:* ${data.serviceMode} - ${data.address}\n` +
    `💳 *Advance:* ${isMakeup ? '₹1,000/- required' : '₹0/- (Pay after service)'}`;

  await sendWhatsAppMessage({
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: summary },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'confirm_yes',
              title: isMakeup ? 'Confirm & Pay ₹1000' : 'Confirm Booking'
            }
          },
          { type: 'reply', reply: { id: 'confirm_no', title: 'Cancel' } }
        ]
      }
    }
  });
}

// Send Final Bill Receipt + Thank You Note
async function sendFinalBillReceipt(to, bookingId, data, advancePaid) {
  const totalAmount = data.package.rate;
  const balanceDue = Math.max(0, totalAmount - advancePaid);
  const isBridal = data.package.id === 'pkg_bridal';

  const billReceipt = `
🧾 *AMITA'S MAKEOVER* 🧾
_Official Appointment & Billing Receipt_
--------------------------------------
*Booking ID:* ${bookingId}
*Client Name:* ${data.name}
*Mobile:* ${data.phone}
--------------------------------------
*Category:* ${data.package.category}
*Selected Service:* ${data.package.title}
*Date:* ${data.date}
*Time Slot:* ${data.time}
*Service Mode:* ${data.serviceMode}
*Address:* ${data.address}
--------------------------------------
*Service Rate:* ${isBridal ? 'As per Bridal Consultation' : `₹${totalAmount}/-`}
*Advance Paid:* ₹${advancePaid}/-
*Balance Payable:* ${isBridal ? 'To be settled at service' : `₹${balanceDue}/-`}
${data.serviceMode.includes('Home') ? '_*Note: Traveling charges extra as per location._\n' : ''}--------------------------------------
✅ *Booking Status:* CONFIRMED & BLOCKED ON CALENDAR

💖 *Thank You Note:*
Thank you so much for choosing *Amita's Makeover*, ${data.name}! 🌸 We are thrilled to be part of your special day and can't wait to glam you up. See you soon! ✨
  `.trim();

  await sendWhatsAppMessage({
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: billReceipt }
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Amita's Makeover WhatsApp Bot running on port ${PORT}`));

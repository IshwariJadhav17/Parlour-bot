require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration from Meta Developer Portal
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'glamour_studio_verify_123';
const PAYMENT_QR_IMAGE_URL = process.env.PAYMENT_QR_IMAGE_URL || 'PAYMENT_QR_IMAGE_URL';

// In-memory session store (Replace with MongoDB collection in production)
const userSessions = {};

// Parlour Packages Catalog
const PACKAGES = {
  pkg_glow: {
    id: 'pkg_glow',
    title: 'Signature Glow Package',
    rate: 1499,
    description: 'Includes O3+ Radiance Facial, Full Arms & Legs Waxing, Eyebrow Threading, and Hair Wash with Blow Dry.'
  },
  pkg_party: {
    id: 'pkg_party',
    title: 'HD Party Makeup & Hair',
    rate: 2999,
    description: 'Includes Waterproof HD Party Makeup, False Eyelashes, Saree/Dupatta Draping, and Custom Hair Styling.'
  },
  pkg_bridal: {
    id: 'pkg_bridal',
    title: 'Royal Bridal Package',
    rate: 12999,
    description: 'Includes Airbrush Bridal Makeup, Pre-Bridal Skin Prep (2 sessions), Bridal Hair Styling, Nail Art, and Draping.'
  },
  pkg_hair: {
    id: 'pkg_hair',
    title: 'Keratin & Hair Spa',
    rate: 2499,
    description: 'Includes L’Oréal Deep Nourishing Hair Spa, Split-End Trim, Keratin Protein Mask, and Scalp Massage.'
  }
};

// Helper: Send WhatsApp API Request
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
    console.error('WhatsApp API Error:', error.response ? error.response.data : error.message);
  }
}

// Helper: Generate Upcoming 7 Dates for Interactive Picker
function getUpcomingDates() {
  const dates = [];
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const label = d.toLocaleDateString('en-IN', options);
    dates.push({
      id: `date_${d.toISOString().split('T')[0]}`,
      title: label,
      description: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : 'Available'
    });
  }
  return dates;
}

// Webhook Verification (Required by Meta)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Incoming Messages Handler
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Acknowledge receipt immediately

  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (!message) return;

  const from = message.from; // Customer's WhatsApp phone number
  let userInput = '';
  let interactiveId = '';

  // Extract text or interactive button/list selection
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

  // Reset flow if user types "hi", "book", or "restart"
  if (['hi', 'hello', 'book', 'restart'].includes(userInput.toLowerCase()) || !userSessions[from]) {
    userSessions[from] = { step: 'ASK_NAME', data: {} };

    // STEP 1: Greeting Message & Ask Name
    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: {
        body: `✨ *Welcome to Glamour Studio Parlour!* ✨\n\nThank you for reaching out from our ad! We would love to pamper you.\n\nTo begin your appointment booking, please reply with your *Full Name*:`
      }
    });
    return;
  }

  const session = userSessions[from];

  // STEP 2: Save Name -> Ask Phone Number
  if (session.step === 'ASK_NAME') {
    session.data.name = userInput;
    session.step = 'ASK_PHONE';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: {
        body: `Nice to meet you, *${session.data.name}*! 🌸\n\nPlease enter your *10-digit Mobile Number* for booking updates:`
      }
    });
    return;
  }

  // STEP 3: Save Phone -> Show Packages List
  if (session.step === 'ASK_PHONE') {
    session.data.phone = userInput;
    session.step = 'SELECT_PACKAGE';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Glamour Studio Packages' },
        body: { text: 'Please select a beauty package from the menu below to view details and pricing:' },
        action: {
          button: 'View Packages',
          sections: [
            {
              title: 'Available Packages',
              rows: Object.values(PACKAGES).map((pkg) => ({
                id: pkg.id,
                title: pkg.title,
                description: `₹${pkg.rate}/-`
              }))
            }
          ]
        }
      }
    });
    return;
  }

  // STEP 4: Package Selected -> Show Description & Rate + Date Picker
  if (session.step === 'SELECT_PACKAGE') {
    const selectedPkg = PACKAGES[interactiveId];
    if (!selectedPkg) {
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: 'Please tap the *View Packages* button above to choose a valid package.' }
      });
      return;
    }

    session.data.package = selectedPkg;
    session.step = 'SELECT_DATE';

    // Send Package Description & Rate in INR
    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: {
        body: `✅ *Selected Package:* ${selectedPkg.title}\n💰 *Rate:* ₹${selectedPkg.rate}/-\n📋 *Includes:* ${selectedPkg.description}`
      }
    });

    // Send Date Picker List
    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Select Appointment Date' },
        body: { text: 'Choose your preferred date from the upcoming slots:' },
        action: {
          button: 'Pick a Date',
          sections: [{ title: 'Upcoming Dates', rows: getUpcomingDates() }]
        }
      }
    });
    return;
  }

  // STEP 5: Date Selected -> Ask Time Slot
  if (session.step === 'SELECT_DATE') {
    session.data.date = userInput;
    session.step = 'SELECT_TIME';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Select Time Slot' },
        body: { text: `Date selected: *${session.data.date}*\nNow choose your preferred time slot:` },
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

  // STEP 6: Time Selected -> Ask Parlour Visit vs Home Service
  if (session.step === 'SELECT_TIME') {
    session.data.time = userInput;
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
            { type: 'reply', reply: { id: 'loc_home', title: 'Home Visit (My Place)' } }
          ]
        }
      }
    });
    return;
  }

  // STEP 7: Handle Parlour vs Home Location
  if (session.step === 'SERVICE_LOCATION_TYPE') {
    if (interactiveId === 'loc_home') {
      session.data.serviceMode = 'Home Service';
      session.step = 'ASK_ADDRESS';

      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: {
          body: '🏡 *Home Service Selected!*\nPlease type your *complete home address* or share your *WhatsApp Live/Current Location*:'
        }
      });
      return;
    } else {
      session.data.serviceMode = 'Parlour Visit';
      session.data.address = 'Glamour Studio Parlour (Main Branch)';
      session.step = 'CONFIRM_BOOKING';
      await sendBookingSummaryForConfirmation(from, session.data);
      return;
    }
  }

  // STEP 7B: Save Customer Home Address -> Ask Confirmation
  if (session.step === 'ASK_ADDRESS') {
    session.data.address = userInput;
    session.step = 'CONFIRM_BOOKING';
    await sendBookingSummaryForConfirmation(from, session.data);
    return;
  }

  // STEP 8: Confirmation Received -> Send QR Scanner for ₹1,000 Advance
  if (session.step === 'CONFIRM_BOOKING') {
    if (interactiveId === 'confirm_yes') {
      session.step = 'AWAITING_PAYMENT';

      // Send QR Code Image with Instructions
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'image',
        image: {
          link: PAYMENT_QR_IMAGE_URL,
          caption: `💳 *Advance Payment Required: ₹1,000/-*\n\nPlease scan the QR code above using GPay, PhonePe, or Paytm to pay the *₹1,000 advance*.\n\nOnce paid, reply with *"PAID"* or send a screenshot of the payment to receive your official booking bill.`
        }
      });
    } else {
      delete userSessions[from];
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: '❌ Booking cancelled. Type *Hi* anytime to start a new booking!' }
      });
    }
    return;
  }

  // STEP 9: Payment Confirmed -> Generate & Send Official Bill Script
  if (session.step === 'AWAITING_PAYMENT') {
    const bookingId = 'GSP-' + Math.floor(100000 + Math.random() * 900000);
    const totalAmount = session.data.package.rate;
    const advancePaid = 1000;
    const balanceDue = totalAmount - advancePaid;

    const billReceipt = `
🧾 *GLAMOUR STUDIO PARLOUR* 🧾
_Official Appointment & Payment Receipt_
--------------------------------------
*Booking ID:* ${bookingId}
*Customer Name:* ${session.data.name}
*Phone:* ${session.data.phone}
--------------------------------------
*Package:* ${session.data.package.title}
*Date:* ${session.data.date}
*Time Slot:* ${session.data.time}
*Service Mode:* ${session.data.serviceMode}
*Location:* ${session.data.address}
--------------------------------------
*Total Package Rate:* ₹${totalAmount}/-
*Advance Paid (UPI):* ₹${advancePaid}/-
*Balance Payable at Service:* ₹${balanceDue}/-
--------------------------------------
✅ *Status:* CONFIRMED
Thank you for choosing Glamour Studio Parlour! ✨
    `.trim();

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: { body: billReceipt }
    });

    // Clear session after completion
    delete userSessions[from];
  }
});

// Helper: Send Summary & Confirmation Buttons
async function sendBookingSummaryForConfirmation(to, data) {
  const summary = `📋 *Please Confirm Your Appointment Details:*\n\n` +
    `👤 *Name:* ${data.name}\n` +
    `📞 *Phone:* ${data.phone}\n` +
    `💆‍♀️ *Package:* ${data.package.title} (₹${data.package.rate}/-)\n` +
    `📅 *Date:* ${data.date}\n` +
    `⏰ *Time:* ${data.time}\n` +
    `📍 *Location:* ${data.serviceMode} - ${data.address}`;

  await sendWhatsAppMessage({
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: summary },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'confirm_yes', title: 'Confirm & Pay ₹1000' } },
          { type: 'reply', reply: { id: 'confirm_no', title: 'Cancel' } }
        ]
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Glamour Studio WhatsApp Bot running on port ${PORT}`));

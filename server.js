require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration from Environment Variables
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'glamour_studio_verify_123';
const PAYMENT_QR_IMAGE_URL = process.env.PAYMENT_QR_IMAGE_URL;
const NAIL_MENU_IMAGE_URL = process.env.NAIL_MENU_IMAGE_URL || 'https://res.cloudinary.com/qmjp9axi/image/upload/f_png/nail_art_menu';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// In-memory session store
const userSessions = {};

// Makeup Packages Catalog (From Amita's Makeover Rate Card)
const MAKEUP_PACKAGES = {
  pkg_bridal: {
    id: 'pkg_bridal',
    category: 'Makeup',
    title: 'Bridal Package',
    rate: 15000, // Update base bridal rate if needed
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

// Nail Art Catalog (From Amita's Makeover Nail Art Menu)
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

// Preset Inquiry Answers
const FAQ_ANSWERS = {
  faq_included: '💄 *What is included in Makeup Packages?*\nOur Bridal, HD (₹6,000), and Luxury (₹8,000) packages include *Makeup, Hairstyle, Saree/Dupatta Draping, Lenses & Lashes*.',
  faq_travel: '🚗 *Home Visit & Traveling Charges:*\nYes, we offer doorstep home visits! Traveling charges are separate and depend on your location distance.',
  faq_jewellery: '👑 *Bridal Jewellery Rent:*\nOptional bridal jewellery sets are available on rent. Charges depend on the jewellery pieces and quantity selected.',
  faq_nails: '💅 *Nail Art & Extensions Pricing:*\n• Original Nails: ₹300 (1 Hand) / ₹500 (1 Foot)\n• Press On Nails: ₹300 (1 Hand)\n• Extra Art: ₹100\n• Nail Extensions: ₹1,000 / ₹1,200 / ₹1,500',
  faq_advance: '💳 *Booking & Advance Policy:*\n• *Makeup Packages:* ₹1,000 advance is required to lock your date & time slot.\n• *Nail Art Services:* No advance payment needed! Pay directly after your service.'
};

// Helper: Send WhatsApp Cloud API Message (v25.0)
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

// Helper: Answer Custom Typed Questions (Gemini AI + Smart Fallback)
async function answerCustomQuestion(question) {
  if (GEMINI_API_KEY) {
    try {
      const prompt = `You are the polite WhatsApp assistant for "Amita's Makeover" beauty parlour in Pune, Maharashtra. Answer the customer's question concisely in 2-3 sentences using ONLY these facts:
- Bridal Package includes Makeup, Hairstyle, Draping, Lenses & Lashes.
- HD Makeup (1 Look): ₹6,000/- | Luxury Makeup (1 Look): ₹8,000/- | Per Touch-Up (Makeup correction, hair, draping): ₹1,000/-.
- Traveling charges are separate depending on location. Optional jewellery rent depends on quantity.
- Nail Art Menu: Original Nails (Hand) ₹300 (1 Hand), Original Nails (Foot) ₹500 (1 Foot), Press On Nails ₹300 (1 Hand), Extra Art ₹100, Extensions ₹1000 / ₹1200 / ₹1500.
- Makeup bookings need ₹1,000 advance; Nail art needs zero advance.
Customer Question: "${question}"`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );
      const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return reply.trim();
    } catch (err) {
      console.error('Gemini fallback triggered:', err.message);
    }
  }

  // Smart Keyword Fallback if GEMINI_API_KEY is not set
  const q = question.toLowerCase();
  if (q.includes('price') || q.includes('rate') || q.includes('cost') || q.includes('charge')) {
    return '✨ Here are our rates:\n• *HD Makeup:* ₹6,000/-\n• *Luxury Makeup:* ₹8,000/-\n• *Touch-Up:* ₹1,000/-\n• *Nail Art:* Starts at ₹300/- & Extensions ₹1,000–₹1,500/-.';
  }
  if (q.includes('home') || q.includes('travel') || q.includes('location') || q.includes('visit')) {
    return '🏡 Yes! We provide both *Parlour Visits* and *Home Service*. Traveling charges for home visits depend on your location.';
  }
  if (q.includes('jewel') || q.includes('rent')) {
    return '👑 Yes, optional bridal jewellery is available on rent! Pricing depends on the jewellery quantity and set you choose.';
  }
  if (q.includes('nail') || q.includes('extension')) {
    return '💅 We offer Original Nails (₹300 Hand / ₹500 Foot), Press-On Nails (₹300), Extra Art (₹100), and Extensions (₹1,000 / ₹1,200 / ₹1,500) with *no advance required*!';
  }
  return 'Thank you for your question! ✨ Our team at *Amita’s Makeover* will be happy to assist you with custom bridal, makeup, and nail art requests. Tap below to explore our menu or book your slot!';
}

// Helper: Generate Next 7 Days
function getUpcomingDates() {
  const dates = [];
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push({
      id: `date_${d.toISOString().split('T')[0]}`,
      title: d.toLocaleDateString('en-IN', options),
      description: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : 'Available'
    });
  }
  return dates;
}

// Helper: Send Category Menu (Nail Art vs Makeup Packages)
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

// Helper: Send Inquiry FAQ List
async function sendInquiryMenu(to) {
  await sendWhatsAppMessage({
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'Quick Inquiry & FAQs' },
      body: { text: 'Select a question below to get instant details, or choose *"Ask Another Question"* to type your own:' },
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

  // Detect Greetings ("hi", "hii", "hello") or Instagram Ad Referral
  const isGreeting = ['hi', 'hii', 'hiii', 'hello', 'hey', 'start', 'menu', 'restart'].includes(userInput.toLowerCase());
  const isFromAd = Boolean(message.referral);

  if (isGreeting || isFromAd || !userSessions[from]) {
    userSessions[from] = { step: 'MAIN_MENU', data: {} };

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: { type: 'text', text: "✨ AMITA'S MAKEOVER ✨" },
        body: {
          text: `Welcome to *Amita’s Makeover*! 💄💅\nThank you for connecting with us${isFromAd ? ' from Instagram' : ''}.\n\nHow would you like to proceed today?`
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'menu_inquiry', title: 'Inquiry' } },
            { type: 'reply', reply: { id: 'menu_book', title: 'Book Appointment' } }
          ]
        }
      }
    });
    return;
  }

  const session = userSessions[from];

  // Global Quick Jump: If user taps "Book Appointment" or "Inquiry" at any stage
  if (interactiveId === 'menu_inquiry') {
    session.step = 'INQUIRY_MENU';
    await sendInquiryMenu(from);
    return;
  }

  if (interactiveId === 'menu_book') {
    session.step = 'ASK_NAME';
    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: { body: `Let's book your slot at *Amita's Makeover*! 🌸\n\nPlease enter your *Full Name*:` }
    });
    return;
  }

  // INQUIRY FLOW: Handle Selected FAQ or Custom Question Prompt
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

  // INQUIRY FLOW: Answer Custom Typed Question
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

  // BOOKING STEP 1: Save Name -> Ask Phone Number
  if (session.step === 'ASK_NAME') {
    session.data.name = userInput;
    session.step = 'ASK_PHONE';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: { body: `Thank you, *${session.data.name}*! ✨\n\nPlease enter your *10-digit Mobile Number*:` }
    });
    return;
  }

  // BOOKING STEP 2: Save Phone -> Show 2 Categories (Nail Art vs Makeup Packages)
  if (session.step === 'ASK_PHONE') {
    session.data.phone = userInput;
    session.step = 'SELECT_CATEGORY';
    await sendServiceCategoryMenu(from);
    return;
  }

  // BOOKING STEP 3: Category Selected -> Show Nail Art Menu Image + List OR Makeup Packages List
  if (session.step === 'SELECT_CATEGORY') {
    if (interactiveId === 'cat_nailart') {
      session.step = 'SELECT_PACKAGE';

      // 1. Send Nail Art Menu Image
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'image',
        image: {
          link: NAIL_MENU_IMAGE_URL,
          caption: "💅 *Amita's Makeover – Nail Art Menu*\nCheck out our rates above and select your preferred service from the menu below!"
        }
      });

      // 2. Send Selectable Nail Art Options List
      await sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: from,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: 'Select Nail Art Service' },
          body: { text: 'Tap below to choose your Nail Art or Extension option (No advance payment required!):' },
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
          body: { text: 'Select your preferred Makeup Package from Amita’s Makeover:' },
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

  // BOOKING STEP 4: Package/Nail Art Selected -> Show Details & Date Picker
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
    session.step = 'SELECT_DATE';

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: {
        body: `✅ *Selected:* ${selectedItem.title}\n💰 *Rate:* ${selectedItem.rateDisplay}\n📋 *Details:* ${selectedItem.description}`
      }
    });

    await sendWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Select Appointment Date' },
        body: { text: 'Please pick your preferred date:' },
        action: {
          button: 'Pick a Date',
          sections: [{ title: 'Upcoming Dates', rows: getUpcomingDates() }]
        }
      }
    });
    return;
  }

  // BOOKING STEP 5: Date Selected -> Ask Time Slot
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
        body: { text: `Date: *${session.data.date}*\nChoose your preferred time slot:` },
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

  // BOOKING STEP 6: Time Selected -> Ask Parlour Visit vs Home Service
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

  // BOOKING STEP 7: Handle Parlour vs Home Location
  if (session.step === 'SERVICE_LOCATION_TYPE') {
    if (interactiveId === 'loc_home') {
      session.data.serviceMode = 'Home Service (Travel extra as per location)';
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

  // BOOKING STEP 7B: Save Home Address -> Ask Confirmation
  if (session.step === 'ASK_ADDRESS') {
    session.data.address = userInput;
    session.step = 'CONFIRM_BOOKING';
    await sendBookingSummaryForConfirmation(from, session.data);
    return;
  }

  // BOOKING STEP 8: Confirmation -> Advance Payment ONLY for Makeup; Instant Bill for Nail Art!
  if (session.step === 'CONFIRM_BOOKING') {
    if (interactiveId === 'confirm_yes') {
      const isMakeup = session.data.package.category === 'Makeup';

      if (isMakeup) {
        // Makeup Package -> Require ₹1,000 Advance Payment
        session.step = 'AWAITING_PAYMENT';
        await sendWhatsAppMessage({
          messaging_product: 'whatsapp',
          to: from,
          type: 'image',
          image: {
            link: PAYMENT_QR_IMAGE_URL,
            caption: `💳 *Advance Payment Required: ₹1,000/-*\n\nTo confirm your *${session.data.package.title}*, please scan the QR code above via GPay, PhonePe, or Paytm and pay *₹1,000/-*.\n\nOnce paid, reply *"PAID"* or send a payment screenshot to receive your official bill receipt! ✨`
          }
        });
      } else {
        // Nail Art -> NO Advance Payment Needed -> Generate Bill Immediately
        await sendFinalBillReceipt(from, session.data, 0);
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

  // BOOKING STEP 9: Makeup Advance Paid -> Send Final Bill Receipt
  if (session.step === 'AWAITING_PAYMENT') {
    await sendFinalBillReceipt(from, session.data, 1000);
    delete userSessions[from];
  }
});

// Helper: Send Summary & Confirmation Buttons (Adapts button label for Makeup vs Nail Art)
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

// Helper: Generate & Send Official Bill Script + Thank You Note
async function sendFinalBillReceipt(to, data, advancePaid) {
  const bookingId = 'AM-' + Math.floor(100000 + Math.random() * 900000);
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
✅ *Booking Status:* CONFIRMED

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

// Privacy Policy Route for Meta App Review / Live Mode
app.get('/privacy', (req, res) => {
  res.send("<h1>Privacy Policy - Amita's Makeover</h1><p>We collect customer name, phone number, and appointment details solely to schedule makeup and nail art bookings via WhatsApp.</p>");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Amita's Makeover WhatsApp Bot running on port ${PORT}`));

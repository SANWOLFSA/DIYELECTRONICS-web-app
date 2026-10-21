// How-to content for the Help page. Also used (server-side) to ground the AI Help Assistant,
// so keep it accurate when features change.
export interface HelpTopic { id: string; title: string; steps: string[] }

export const HELP_TOPICS: HelpTopic[] = [
  { id: 'ai', title: 'Ask the AI repair assistant (SANWOLF)', steps: [
    'Open AI Assistant from the menu. Tap the name at the top to switch between SANWOLF (repairs), CODEFOX (code/firmware) and CIRCUITBEAR (circuit design).',
    'Type the device, model and what it is doing (e.g. "Samsung UA43TU7000 has sound but no picture"). Answers appear word by word.',
    'Tap + to take a photo with the camera, upload photos from your gallery, or upload a video (the AI looks at key frames). Add a question and send.',
    'When you name a board or model number, real board photos and listings found online (iFixit, Wikipedia, Wikimedia Commons) appear under the answer with their sources.',
    'Tap the expand icon (top right) for full screen. "New chat" starts over. AI answers can be wrong: always confirm with your meter and the service manual.',
  ] },
  { id: 'terms', title: 'Terms of Use (the rules for using the app)', steps: [
    'Open Terms of Use from the menu (under You), from the page footer, or from About. It starts with an "In plain words" summary, then the full numbered sections.',
    'In short: the app is free educational help provided as is, not professional advice; repairs are at your own risk; the AI is an automated tool that can be wrong, so check safety-critical steps and do not send it passwords or payment details; only work on devices you own or may repair; you are responsible for what you post; marketplace deals are between buyers and sellers.',
    'You must be 13 or older, and under 18 you need a parent or guardian\'s consent. One account per person.',
    'To report content or send a takedown notice, tap Report on it or email support with a link and what is wrong.',
  ] },
  { id: 'ownership-agreement', title: 'Ownership Agreement (Phone Tricks, FRP & unlock guides)', steps: [
    'Phone Tricks, and any video, guide or AI question about FRP, bypassing, unlocking, or Google / Samsung / iCloud account removal, first shows the Ownership Agreement. Tick the box and tap "Agree & Continue". You only do this once per device (it is also saved to your account when signed in).',
    '1. You will only use these guides on a phone or device you own, or one you have the owner\'s written permission to repair.',
    '2. You will never use them on a lost, stolen or found device. If you have a device that isn\'t yours, return it to the owner or the police.',
    '3. Guides and videos are posted by community members and belong to them. DIY Electronics does not make, check or endorse them, and isn\'t responsible for how they\'re used.',
    '4. Misusing these guides may be a crime in your country, and you alone are responsible for your actions.',
    '5. We may remove content and suspend accounts that break these rules, and we co-operate with lawful requests from authorities.',
    'DIY Electronics provides this help as-is and is not accountable for how you use it. When you upload an FRP or unlock video or guide, you confirm the agreement again and that you are sharing it only for device owners.',
  ] },
  { id: 'fix-format', title: 'How fixes are laid out (Solution A, B, C)', steps: [
    'Every fix in the app (device solutions, the AI diagnostic tool, Phone Tricks and AI chat answers) starts with Solution A: the easiest and most likely fix. Do its numbered steps in order.',
    'Each step has a bold action title and one or two plain sentences telling you exactly what to do, where to touch, what you should see, and why.',
    'If Solution A did not fix it, move down to "If A didn\'t work: Solution B", then "If B didn\'t work: Solution C".',
    'Still not fixed? Tap "Ask AI" under Solution C. The AI Assistant opens with your problem already typed in: add what happened at each step (or a photo) and press send. The AI will also tell you when a professional repair is the safer choice.',
    'Always read the red Safety box first and follow it.',
  ] },
  { id: 'circuit-map', title: 'Map a circuit (red-flashing parts to test)', steps: [
    'In the AI Assistant tap + then "Map circuit".',
    'Either type a board or model number (e.g. "Samsung UA43") or attach a clear photo of the board, then tap the map button. Add the fault if you know it.',
    'With a photo, the map is drawn on your own picture: parts to check flash red. With a board number, pick one of the web photos and tap "Map circuit on this photo".',
    'Tap a flashing part to see why it is suspect, what to measure and the expected value. The "Block diagram & power flow" tab shows how power flows through the board, with the same suspects flashing.',
    'Under the map, answer "Do you have a multimeter?". Yes: tap each flashing part for the dial position, where the red and black probes go and the reading to expect, then type your reading in the chat. No: you get checks you can do by looking, smelling and listening, plus "Find one nearby".',
    'Circuit maps are AI-generated and approximate. Discharge big capacitors before touching a power board.',
  ] },
  { id: 'multimeter', title: 'Multimeter Lab: test any component', steps: [
    'Open Theory & courses, then Multimeter (or go to /multimeter). "How it works" explains every dial position.',
    'Open "Test a component", pick a part (resistor, capacitor, diode, transistor, MOSFET, relay, fuse, battery...).',
    'The "See it" panel shows the meter dial set to the right position, which jacks to use, and the part with the red and black probes on the correct pins, step by step, with good and bad readings.',
    'Follow the safety step first: power off and discharge capacitors (except for tests marked as powered). "Practise this test" lets you try it on a simulated part.',
  ] },
  { id: 'book', title: 'Read the Theory book and take chapter exams', steps: [
    'Open Theory & courses and tap "Read as book". Swipe left or right to turn pages; the slider at the bottom jumps anywhere; your last page is remembered.',
    'The list icon opens the contents, the search icon finds any topic, term or formula (typos are fine), and the A–Z icon opens the glossary.',
    'Tap a dotted word to see its definition. Each chapter starts with an introduction and a "What is…?" question, and ends with a summary and the chapter exam.',
    'The language button (top bar) translates the book and exams into any language; it starts with your phone\'s language. The rest of the app stays in English.',
    'In an exam answer every question, then tap Finish to see your score, your answer, the correct answer and an explanation for each question. Retake any time; your best score is kept (and saved to your account when signed in).',
  ] },
  { id: 'upload', title: 'Upload a repair video, guide or teardown', steps: [
    'Videos: open a device page, go to the community videos section and tap "Share a video". Upload a file (MP4, WebM or MOV) or paste a YouTube/Vimeo link, add a title and description, and share.',
    'Guides and teardowns: open a device page or Guides and tap "Write a guide" (or "Teardown"). Add steps with photos; teardowns need at least one photo on every step. You can add an optional video. Save a draft or Publish.',
    'You are responsible for what you post. Repair videos are never blocked; only inappropriate pictures or videos (sexual content, assault, violence, hate) are removed after an admin reviews a report.',
  ] },
  { id: 'translate', title: 'Translate a video', steps: [
    'Uploaded videos: tap "Translate" in the top corner of the video and pick any language. The AI writes subtitles in that language (this takes a few seconds; short clips under about 18 MB work best on the free plan). Subtitles are saved so the next viewer gets them instantly.',
    'YouTube videos: tap "Translate" and pick a language: the video plays with YouTube captions in that language when YouTube offers them.',
    'Choose "Subtitles off" in the same menu to hide them.',
  ] },
  { id: 'report', title: 'Report a person, seller, listing or video', steps: [
    'Tap the Report button: on a community post (reports the person), in a seller\'s or shop\'s profile (tap the shop name on a listing), on a listing (in the "Request to buy" window), or on a video.',
    'Choose a reason, add details and tap Send report. Reports go only to admins, who review them by hand. Nothing is removed automatically.',
    'You can talk and joke about anything in posts and comments. Only inappropriate pictures or videos (sexual content, assault, violence, hate), scams and spam should be reported.',
  ] },
  { id: 'reviews', title: 'Leave a review', steps: [
    'In the Report window you can also give stars (1–5) and a comment. Reviews are public and show on the seller\'s profile or the listing.',
    'Buyers whose purchase request was accepted can also review the seller from the Requests tab of the Marketplace.',
    'One review per person for each seller, listing or person.',
  ] },
  { id: 'marketplace', title: 'Buy and sell parts', steps: [
    'Open Marketplace. Tap a listing and "Request to buy" to message the seller; no payment is taken in the app. Shop listings also have Directions, WhatsApp and Call buttons.',
    'To sell, open the Sell tab, create your seller profile and add listings. Companies can apply for a Verified badge, checked by hand.',
    'Always check the listing and talk to the seller before paying; use a payment method with buyer protection.',
  ] },
  { id: 'find-parts', title: 'Find a spare part or tool near you (any country)', steps: [
    'Tap the menu at the top left, then tap Marketplace (under Parts & tools).',
    'Tap the search box at the top and type the part number printed on the part, e.g. "6870C-0442B" or "470uF 25V". Part numbers work best. For tools, type the tool, e.g. "multimeter", and tap "Tools & meters".',
    'Tap "Nearest first". When your phone asks to share your location, tap Allow. If you would rather not, choose your country and type your town or region instead.',
    'Tap "Available in <your country>" to see only local shops plus overseas suppliers that ship to you. Listings say "Ships worldwide" or "Ships to <your country> from <country>".',
    'Optional: tap "New" or "Used / salvage" to pick the condition, and tick "Verified only" to see only shops our team has checked. Verified shops always show first.',
    'On a shop\'s listing tap Directions (opens Google Maps), WhatsApp (opens a message already saying which part you saw) or Call. Tap the shop name to see its address, opening hours, shipping countries, shopfront photo and map.',
    'Under AI answers, circuit maps, repair guides and component pages, a "Where to buy" box shows the nearest shops (or suppliers that ship to you) that stock the exact part mentioned. It only appears when a shop lists that part.',
    'If the AI asks you to measure something and you have no multimeter, tap "No multimeter? Find one nearby". A basic digital multimeter with a continuity beep is enough.',
  ] },
  { id: 'list-shop', title: 'List your shop or supply business (local or overseas)', steps: [
    'Prices: individuals selling their own item (e.g. one soldering iron or a kettle) list for free, forever. Shops and suppliers are on the Business plan, USD $20 per month. New shops start on a trial; no payment is taken in the app, our team contacts you about the plan.',
    'Tap the menu at the top left, then tap Marketplace. At the top of the page tap the "List your shop" button (or open Settings and tap "List your shop").',
    'Sign in if asked. Tap "Shop / supplier", then type the shop name and choose what you sell: new parts, used / salvage parts, or both.',
    'Tap the "Add" box next to Logo to upload your logo (optional), and the box next to Shopfront photo to upload a photo of your shop or warehouse entrance with the name visible.',
    'Type the street address and town, the state / province / region if you have one, and choose your country. Then tap "Find this address on the map", or stand inside the shop and tap "Use my current location". Check that the pin on the small map is on your shop.',
    'Type the phone and WhatsApp numbers in international format with the country code (for example +27 82 123 4567, +44 7700 900123, +86 138 0013 8000), your email and opening hours, and choose the currency for your prices.',
    'If you ship to other countries (for example an overseas supplier), tick "We ship to other countries", then tap Worldwide or add each country you ship to. Tick "We deliver / courier parts locally" if you do.',
    'Type your business registration number if you want the Verified badge (CIPC in South Africa, Companies House in the UK, EIN in the US, or your country\'s equivalent). Tap "Register shop".',
    'Tap "New listing" for every part or tool you stock. In "Part numbers / other names" type every number printed on the part, separated by commas (e.g. 6870C-0442B, T-con). In "Fits brands / models" type the models it fits. Choose the currency, add the price, the condition and a photo, then tap "Submit for review" (or "Publish listing" once verified).',
    'To get the Verified Shop badge, scroll to "Verified Shop badge" on the Sell tab and tap "Apply for the Verified badge". Our team checks your registration number on your country\'s company register, looks at the shopfront photo and phones the shop. Verified shops show first and their listings go live straight away.',
    'Featured listings and guide sponsorship are coming soon.',
  ] },
  { id: 'donate', title: 'Support the app (optional donations)', steps: [
    'Every feature is free. If you want to help with AI and hosting costs, open "Support the app" from the menu (or the Support link at the top on larger screens).',
    'Pick $2, $5, $10 or type your own amount: PayPal opens in a new tab and the payment goes directly to the app owner. You can also choose any amount or currency on PayPal.',
  ] },
  { id: 'account', title: 'Account, progress and settings', steps: [
    'Sign in with email or Google to save progress, scores, videos and guides to your account. Sessions end after about 5 hours for safety.',
    'My progress shows your saved guides, completed repairs and exam scores. Settings has dark mode and offline options.',
  ] },
];

/** Plain-text version for the AI Help Assistant. */
export const HELP_TEXT = HELP_TOPICS.map((t) => `## ${t.title}\n${t.steps.map((s) => `- ${s}`).join('\n')}`).join('\n\n');

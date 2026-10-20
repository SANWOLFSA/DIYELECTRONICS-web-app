// Languages for the app-wide translator, the Theory book and video subtitles (the languages Google
// Translate / Gemini support). `rtl` languages flip the reading direction.
export interface Language { code: string; name: string; native: string; rtl?: boolean }

export const LANGUAGES: Language[] = [
  ['af', 'Afrikaans', 'Afrikaans'], ['sq', 'Albanian', 'Shqip'], ['am', 'Amharic', 'አማርኛ'], ['ar', 'Arabic', 'العربية', 1], ['hy', 'Armenian', 'Հայերեն'],
  ['as', 'Assamese', 'অসমীয়া'], ['ay', 'Aymara', 'Aymar aru'], ['az', 'Azerbaijani', 'Azərbaycan'], ['bm', 'Bambara', 'Bamanankan'], ['eu', 'Basque', 'Euskara'],
  ['be', 'Belarusian', 'Беларуская'], ['bn', 'Bengali', 'বাংলা'], ['bho', 'Bhojpuri', 'भोजपुरी'], ['bs', 'Bosnian', 'Bosanski'], ['bg', 'Bulgarian', 'Български'],
  ['my', 'Burmese', 'မြန်မာ'], ['ca', 'Catalan', 'Català'], ['ceb', 'Cebuano', 'Cebuano'], ['ny', 'Chichewa', 'Chichewa'], ['zh-CN', 'Chinese (Simplified)', '简体中文'],
  ['zh-TW', 'Chinese (Traditional)', '繁體中文'], ['co', 'Corsican', 'Corsu'], ['hr', 'Croatian', 'Hrvatski'], ['cs', 'Czech', 'Čeština'], ['da', 'Danish', 'Dansk'],
  ['dv', 'Dhivehi', 'ދިވެހި', 1], ['doi', 'Dogri', 'डोगरी'], ['nl', 'Dutch', 'Nederlands'], ['en', 'English', 'English'], ['eo', 'Esperanto', 'Esperanto'],
  ['et', 'Estonian', 'Eesti'], ['ee', 'Ewe', 'Eʋegbe'], ['fil', 'Filipino', 'Filipino'], ['fi', 'Finnish', 'Suomi'], ['fr', 'French', 'Français'],
  ['fy', 'Frisian', 'Frysk'], ['gl', 'Galician', 'Galego'], ['ka', 'Georgian', 'ქართული'], ['de', 'German', 'Deutsch'], ['el', 'Greek', 'Ελληνικά'],
  ['gn', 'Guarani', 'Avañeʼẽ'], ['gu', 'Gujarati', 'ગુજરાતી'], ['ht', 'Haitian Creole', 'Kreyòl ayisyen'], ['ha', 'Hausa', 'Hausa'], ['haw', 'Hawaiian', 'ʻŌlelo Hawaiʻi'],
  ['he', 'Hebrew', 'עברית', 1], ['hi', 'Hindi', 'हिन्दी'], ['hmn', 'Hmong', 'Hmoob'], ['hu', 'Hungarian', 'Magyar'], ['is', 'Icelandic', 'Íslenska'],
  ['ig', 'Igbo', 'Igbo'], ['ilo', 'Ilocano', 'Ilokano'], ['id', 'Indonesian', 'Bahasa Indonesia'], ['ga', 'Irish', 'Gaeilge'], ['it', 'Italian', 'Italiano'],
  ['ja', 'Japanese', '日本語'], ['jv', 'Javanese', 'Basa Jawa'], ['kn', 'Kannada', 'ಕನ್ನಡ'], ['kk', 'Kazakh', 'Қазақ'], ['km', 'Khmer', 'ខ្មែរ'],
  ['rw', 'Kinyarwanda', 'Kinyarwanda'], ['gom', 'Konkani', 'कोंकणी'], ['ko', 'Korean', '한국어'], ['kri', 'Krio', 'Krio'], ['ku', 'Kurdish (Kurmanji)', 'Kurdî'],
  ['ckb', 'Kurdish (Sorani)', 'کوردی', 1], ['ky', 'Kyrgyz', 'Кыргызча'], ['lo', 'Lao', 'ລາວ'], ['la', 'Latin', 'Latina'], ['lv', 'Latvian', 'Latviešu'],
  ['ln', 'Lingala', 'Lingála'], ['lt', 'Lithuanian', 'Lietuvių'], ['lg', 'Luganda', 'Luganda'], ['lb', 'Luxembourgish', 'Lëtzebuergesch'], ['mk', 'Macedonian', 'Македонски'],
  ['mai', 'Maithili', 'मैथिली'], ['mg', 'Malagasy', 'Malagasy'], ['ms', 'Malay', 'Bahasa Melayu'], ['ml', 'Malayalam', 'മലയാളം'], ['mt', 'Maltese', 'Malti'],
  ['mi', 'Maori', 'Māori'], ['mr', 'Marathi', 'मराठी'], ['mni-Mtei', 'Meiteilon (Manipuri)', 'ꯃꯩꯇꯩꯂꯣꯟ'], ['lus', 'Mizo', 'Mizo ṭawng'], ['mn', 'Mongolian', 'Монгол'],
  ['ne', 'Nepali', 'नेपाली'], ['nso', 'Sepedi (Northern Sotho)', 'Sepedi'], ['no', 'Norwegian', 'Norsk'], ['or', 'Odia', 'ଓଡ଼ିଆ'], ['om', 'Oromo', 'Afaan Oromoo'],
  ['ps', 'Pashto', 'پښتو', 1], ['fa', 'Persian', 'فارسی', 1], ['pl', 'Polish', 'Polski'], ['pt', 'Portuguese', 'Português'], ['pa', 'Punjabi', 'ਪੰਜਾਬੀ'],
  ['qu', 'Quechua', 'Runa Simi'], ['ro', 'Romanian', 'Română'], ['ru', 'Russian', 'Русский'], ['sm', 'Samoan', 'Gagana Sāmoa'], ['sa', 'Sanskrit', 'संस्कृतम्'],
  ['gd', 'Scots Gaelic', 'Gàidhlig'], ['sr', 'Serbian', 'Српски'], ['st', 'Sesotho', 'Sesotho'], ['tn', 'Setswana', 'Setswana'], ['sn', 'Shona', 'chiShona'],
  ['sd', 'Sindhi', 'سنڌي', 1], ['si', 'Sinhala', 'සිංහල'], ['sk', 'Slovak', 'Slovenčina'], ['sl', 'Slovenian', 'Slovenščina'], ['so', 'Somali', 'Soomaali'],
  ['es', 'Spanish', 'Español'], ['su', 'Sundanese', 'Basa Sunda'], ['sw', 'Swahili', 'Kiswahili'], ['ss', 'Swati', 'siSwati'], ['sv', 'Swedish', 'Svenska'],
  ['tg', 'Tajik', 'Тоҷикӣ'], ['ta', 'Tamil', 'தமிழ்'], ['tt', 'Tatar', 'Татар'], ['te', 'Telugu', 'తెలుగు'], ['th', 'Thai', 'ไทย'],
  ['ti', 'Tigrinya', 'ትግርኛ'], ['ts', 'Tsonga (Xitsonga)', 'Xitsonga'], ['tr', 'Turkish', 'Türkçe'], ['tk', 'Turkmen', 'Türkmen'], ['ak', 'Twi (Akan)', 'Twi'],
  ['uk', 'Ukrainian', 'Українська'], ['ur', 'Urdu', 'اردو', 1], ['ug', 'Uyghur', 'ئۇيغۇرچە', 1], ['uz', 'Uzbek', 'Oʻzbek'], ['ve', 'Venda (Tshivenda)', 'Tshivenḓa'],
  ['vi', 'Vietnamese', 'Tiếng Việt'], ['cy', 'Welsh', 'Cymraeg'], ['xh', 'isiXhosa', 'isiXhosa'], ['yi', 'Yiddish', 'ייִדיש', 1], ['yo', 'Yoruba', 'Yorùbá'],
  ['zu', 'isiZulu', 'isiZulu'], ['nr', 'isiNdebele (South)', 'isiNdebele'],
].map(([code, name, native, rtl]) => ({ code: code as string, name: name as string, native: native as string, rtl: !!rtl }));

export const LANGUAGE_BY_CODE: Record<string, Language> = Object.fromEntries(LANGUAGES.map((l) => [l.code.toLowerCase(), l]));

/** Best match for a BCP-47 tag ("pt-BR" -> pt, "zh-HK" -> zh-TW). */
export function matchLanguage(tag: string | undefined | null): Language {
  const t = String(tag || 'en').toLowerCase();
  if (LANGUAGE_BY_CODE[t]) return LANGUAGE_BY_CODE[t];
  if (t.startsWith('zh')) return /tw|hk|mo|hant/.test(t) ? LANGUAGE_BY_CODE['zh-tw'] : LANGUAGE_BY_CODE['zh-cn'];
  if (t === 'iw') return LANGUAGE_BY_CODE.he;
  if (t === 'nb' || t === 'nn') return LANGUAGE_BY_CODE.no;
  if (t === 'tl') return LANGUAGE_BY_CODE.fil;
  return LANGUAGE_BY_CODE[t.split('-')[0]] || LANGUAGE_BY_CODE.en;
}

export const deviceLanguage = (): Language => matchLanguage(typeof navigator !== 'undefined' ? (navigator.languages?.[0] || navigator.language) : 'en');

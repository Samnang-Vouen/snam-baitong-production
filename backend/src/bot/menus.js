/**
 * MENU SERVICE: UI, Keyboards, and Localized Strings
 * Location: src/utils/menus.js
 */
const { Markup } = require('telegraf');

// --- CONSTANTS ---
const MAX_PUMP_TIME_MINS = 30;
const MAX_FERT_TIME_MINS = 15;
const TIME_SEP = " | ";
const DIVIDER = "\n" + "-".repeat(35) + "\n";

const KH_DAYS = ["ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍", "អាទិត្យ"];
const KH_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];

const ALL_PROVINCES = [
    { en: "Banteay Meanchey", kh: "បន្ទាយមានជ័យ", lat: 13.5859, lon: 102.9737 },
    { en: "Battambang", kh: "បាត់ដំបង", lat: 13.0957, lon: 103.2022 },
    { en: "Kampong Cham", kh: "កំពង់ចាម", lat: 11.9934, lon: 105.4645 },
    { en: "Kampong Chhnang", kh: "កំពង់ឆ្នាំង", lat: 12.2500, lon: 104.6667 },
    { en: "Kampong Speu", kh: "កំពង់ស្ពឺ", lat: 11.4533, lon: 104.5208 },
    { en: "Kampong Thom", kh: "កំពង់ធំ", lat: 12.7111, lon: 104.8887 },
    { en: "Kampot", kh: "កំពត", lat: 10.6104, lon: 104.1815 },
    { en: "Kandal", kh: "កណ្តាល", lat: 11.4833, lon: 104.9500 },
    { en: "Kep", kh: "កែប", lat: 10.4829, lon: 104.3167 },
    { en: "Koh Kong", kh: "កោះកុង", lat: 11.6153, lon: 102.9838 },
    { en: "Kratie", kh: "ក្រចេះ", lat: 12.4881, lon: 106.0167 },
    { en: "Mondulkiri", kh: "មណ្ឌលគីរី", lat: 12.4558, lon: 107.1881 },
    { en: "Oddar Meanchey", kh: "ឧត្តរមានជ័យ", lat: 14.1817, lon: 103.5176 },
    { en: "Pailin", kh: "ប៉ៃលិន", lat: 12.8489, lon: 102.6093 },
    { en: "Phnom Penh", kh: "ភ្នំពេញ", lat: 11.5564, lon: 104.9282 },
    { en: "Preah Vihear", kh: "ព្រះវិហារ", lat: 13.8073, lon: 104.9810 },
    { en: "Preah Sihanouk", kh: "ព្រះសីហនុ", lat: 10.6093, lon: 103.5296 },
    { en: "Prey Veng", kh: "ព្រៃវែង", lat: 11.4868, lon: 105.3253 },
    { en: "Pursat", kh: "ពោធិ៍សាត់", lat: 12.5333, lon: 103.9167 },
    { en: "Ratanakiri", kh: "រតនគិរី", lat: 13.7350, lon: 106.9873 },
    { en: "Siem Reap", kh: "សៀមរាប", lat: 13.3671, lon: 103.8448 },
    { en: "Stung Treng", kh: "ស្ទឹងត្រែង", lat: 13.5259, lon: 105.9683 },
    { en: "Svay Rieng", kh: "ស្វាយរៀង", lat: 11.0879, lon: 105.7993 },
    { en: "Takeo", kh: "តាកែវ", lat: 10.9908, lon: 104.7846 },
    { en: "Tboung Khmum", kh: "ត្បូងឃ្មុំ", lat: 11.8891, lon: 105.8760 }
];

const WEATHER_TRANS_KH = {
    "clear sky": "មេឃស្រឡះល្អ", "few clouds": "មានពពកតិចតួច",
    "scattered clouds": "មានពពកខ្លះ", "broken clouds": "មេឃមានពពកច្រើន",
    "overcast clouds": "មេឃអាប់អួរ", "light rain": "មានភ្លៀងរលឹមតិចៗ",
    "moderate rain": "មានភ្លៀងធ្លាក់មធ្យម", "heavy intensity rain": "មានភ្លៀងធ្លាក់ខ្លាំង",
    "very heavy rain": "មានភ្លៀងធ្លាក់ខ្លាំងណាស់", "thunderstorm": "មានភ្លៀងផ្គររន្ទះ",
    "mist": "មានអ័ព្ទ", "haze": "មានអ័ព្ទផ្សែង", "dust": "មានហុយដី"
};

const MenuService = {
    ALL_PROVINCES,
    KH_MONTHS,
    MAX_PUMP_TIME_MINS,
    MAX_FERT_TIME_MINS,

    getLanguageMenu() {
        return {
            text: "សូមជ្រើសរើសភាសា / Please choose your language:",
            keyboard: Markup.inlineKeyboard([
                [Markup.button.callback("ភាសាខ្មែរ 🇰🇭", "lang_kh"), Markup.button.callback("English 🇺🇸", "lang_en")]
            ])
        };
    },

    getProvinceMenu(isKhmer, page = 1) {
        const text = isKhmer ? `📍 **សូមជ្រើសរើសខេត្ត (ទំព័រ ${page})**` : `📍 **Select Province (Page ${page})**`;
        const perPage = 10;
        const startIdx = (page - 1) * perPage;
        const endIdx = startIdx + perPage;
        const buttons = [];

        for (let i = startIdx; i < Math.min(endIdx, ALL_PROVINCES.length); i += 2) {
            const row = [Markup.button.callback(isKhmer ? ALL_PROVINCES[i].kh : ALL_PROVINCES[i].en, `pvidx_${i}`)];
            if (i + 1 < endIdx && i + 1 < ALL_PROVINCES.length) {
                row.push(Markup.button.callback(isKhmer ? ALL_PROVINCES[i + 1].kh : ALL_PROVINCES[i + 1].en, `pvidx_${i + 1}`));
            }
            buttons.push(row);
        }

        const navRow = [];
        if (page > 1) navRow.push(Markup.button.callback(isKhmer ? "⬅️ មុន" : "⬅️ Back", `page_${page - 1}`));
        if (endIdx < ALL_PROVINCES.length) navRow.push(Markup.button.callback(isKhmer ? "បន្ទាប់ ➡️" : "Next ➡️", `page_${page + 1}`));
        if (navRow.length) buttons.push(navRow);

        return { text, keyboard: Markup.inlineKeyboard(buttons) };
    },

    getMainMenu(isKhmer) {
        const now = new Date();
        const timePart = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Phnom_Penh' });
        const text = isKhmer 
            ? `🌾 **ប្រព័ន្ធគ្រប់គ្រងកសិដ្ឋាន**\n🕒 បច្ចុប្បន្នភាព៖ ម៉ោង ${timePart}\n\nសូមជ្រើសរើសមុខងារខាងក្រោម៖`
            : `🌾 **Farm Management System**\n🕒 Last Update: ${timePart}\n\nPlease choose a function:`;

        const buttons = [
            [Markup.button.callback(isKhmer ? "📊 ស្ថានភាពដី" : "📊 Soil Status", "status")],
            [Markup.button.callback(isKhmer ? "🌦 អាកាសធាតុ" : "🌦 Weather", "weather")],
            [Markup.button.callback(isKhmer ? "💧 បញ្ជាការស្រោចស្រព" : "💧 Irrigation Control", "control")],
            [Markup.button.callback(isKhmer ? "🌿 ដាក់ជីដំណាំ" : "🌿 Crop Nutrition", "fertilizer")],
            [Markup.button.callback(isKhmer ? "📝 កំណត់ត្រាកសិកម្ម" : "📝 Farm Logbook", "logbook")],
            [Markup.button.callback(isKhmer ? "👤 ប្រវត្តិ" : "👤 Profile", "profile")],
            [Markup.button.callback(isKhmer ? "❓ ជំនួយ និងព័ត៌មាន" : "❓ Help & Info", "help_info")],
            [Markup.button.callback(isKhmer ? "⚙️ ប្តូរភាសា" : "⚙️ Change Settings", "back_to_lang")]
        ];

        return { text, keyboard: Markup.inlineKeyboard(buttons) };
    },

    getStatusKeyboard(isKhmer) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(isKhmer ? "🔧 ប្តូរឧបករណ៍" : "🔧 Change Device", "device_menu")
            ],
            [
                Markup.button.callback(isKhmer ? "⬅️ ត្រឡប់ក្រោយ" : "⬅️ Back", "back_to_main")
            ]
        ]);
    },

    getProfileKeyboard(isKhmer) {
        return Markup.inlineKeyboard([
            [Markup.button.callback(isKhmer ? "⬅️ ត្រឡប់ក្រោយ" : "⬅️ Back", "back_to_main")]
        ]);
    },

    getDevicePickerMenu(isKhmer, devices = [], selectedDevice = null) {
        const title = isKhmer ? "🔧 ជ្រើសរើសឧបករណ៍សិនស័រ" : "🔧 Select Sensor Device";
        const subtitle = selectedDevice
            ? (isKhmer ? `ឧបករណ៍បច្ចុប្បន្ន៖ ${selectedDevice}` : `Current device: ${selectedDevice}`)
            : (isKhmer ? "មិនមានឧបករណ៍បានជ្រើសរើស" : "No device selected");
        const text = `${title}${DIVIDER}${subtitle}`;

        const rows = [];
        for (const d of devices) {
            const label = d === selectedDevice
                ? (isKhmer ? `✅ ${d}` : `✅ ${d}`)
                : d;
            rows.push([Markup.button.callback(label, `dev_${d}`)]);
        }
        rows.push([Markup.button.callback(isKhmer ? "⬅️ ត្រឡប់ក្រោយ" : "⬅️ Back", "back_to_main")]);

        return { text, keyboard: Markup.inlineKeyboard(rows) };
    },

    formatStatusMessage(data, isKhmer, ctx = {}) {
        // Telegram UI-only: qualitative status layout (does not affect web API output)
        const safeNum = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };

        const pickFirst = (obj, keys) => {
            if (!obj || typeof obj !== 'object') return null;
            for (const k of keys) {
                if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
            }
            return null;
        };

        if (!data) {
            const msg = isKhmer ? '❌ មិនមានទិន្នន័យ' : '❌ No data';
            return `${isKhmer ? '📊 **ស្ថានភាពដី**' : '📊 **Soil Status**'}\n-----------------------------------\n${msg}`;
        }

        // Support multiple field conventions (Influx/SQL snapshots vary by measurement)
        const moisture = safeNum(pickFirst(data, ['moisture', 'soil_moisture', 'vwc']));
        const soilTemp = safeNum(pickFirst(data, ['soil_temp', 'soil_temperature', 'temperature', 'temp_soil']));
        const airTemp = safeNum(pickFirst(data, ['air_temp', 'air_temperature', 'temp_air']));
        const airHum = safeNum(pickFirst(data, ['air_humidity', 'humidity', 'hum_air']));

        const nitrogen = safeNum(pickFirst(data, ['nitrogen', 'n']));
        const phosphorus = safeNum(pickFirst(data, ['phosphorus', 'p']));
        const potassium = safeNum(pickFirst(data, ['potassium', 'k']));
        const salinityRaw = safeNum(pickFirst(data, ['salinity']));
        const ecRaw = safeNum(pickFirst(data, ['ec', 'conductivity']));

        const classifyMoisture = (m) => {
            if (m === null) return isKhmer ? 'មិនមានទិន្នន័យ' : 'No data';
            if (m < 25) return isKhmer ? 'ស្ងួត' : 'Dry';
            if (m <= 65) return isKhmer ? 'ធម្មតា' : 'Normal';
            return isKhmer ? 'សើមពេក' : 'Too wet';
        };
        const classifySoilTemp = (t) => {
            if (t === null) return isKhmer ? 'មិនមានទិន្នន័យ' : 'No data';
            if (t < 18) return isKhmer ? 'ត្រជាក់' : 'Cold';
            if (t <= 32) return isKhmer ? 'ធម្មតា' : 'Normal';
            return isKhmer ? 'ក្តៅ' : 'Hot';
        };
        const classifyAirTemp = (t) => {
            if (t === null) return isKhmer ? 'មិនមានទិន្នន័យ' : 'No data';
            if (t < 22) return isKhmer ? 'ត្រជាក់' : 'Cool';
            if (t <= 32) return isKhmer ? 'ធម្មតា' : 'Normal';
            return isKhmer ? 'ក្តៅ' : 'Slightly hot';
        };
        const classifyHumidity = (h) => {
            if (h === null) return isKhmer ? 'មិនមានទិន្នន័យ' : 'No data';
            if (h < 40) return isKhmer ? 'ទាប' : 'Low';
            if (h <= 70) return isKhmer ? 'មធ្យម' : 'Medium';
            return isKhmer ? 'ខ្ពស់' : 'High';
        };

        const classifyNpk = (v) => {
            if (v === null) return isKhmer ? 'ទាប' : 'Low';
            // Some devices report a small 0–50-ish scale; others mg/kg.
            if (v <= 60) {
                if (v < 15) return isKhmer ? 'ទាប' : 'Low';
                if (v <= 30) return isKhmer ? 'មធ្យម' : 'Medium';
                return isKhmer ? 'ខ្ពស់' : 'High';
            }
            // mg/kg-ish thresholds (broad, crop-agnostic)
            if (v < 20) return isKhmer ? 'ទាប' : 'Low';
            if (v <= 60) return isKhmer ? 'មធ្យម' : 'Medium';
            return isKhmer ? 'ខ្ពស់' : 'High';
        };

        const classifySalinity = (s) => {
            if (s === null) return isKhmer ? 'មធ្យម' : 'Medium';
            // If it looks like ppm (hundreds+), use ppm thresholds.
            if (s > 20) {
                if (s <= 800) return isKhmer ? 'ទាប' : 'Low';
                if (s <= 1200) return isKhmer ? 'មធ្យម' : 'Medium';
                return isKhmer ? 'ខ្ពស់' : 'High';
            }
            // Otherwise treat as dS/m-ish.
            if (s < 0.4) return isKhmer ? 'ទាប' : 'Low';
            if (s <= 1.0) return isKhmer ? 'មធ្យម' : 'Medium';
            return isKhmer ? 'ខ្ពស់' : 'High';
        };

        const classifyAbsorption = (m) => {
            if (m === null) return isKhmer ? 'មធ្យម' : 'Medium';
            if (m > 70) return isKhmer ? 'មិនល្អ' : 'Poor';
            if (m >= 25) return isKhmer ? 'ល្អ' : 'Good';
            return isKhmer ? 'មធ្យម' : 'Medium';
        };

        const classifySoilCondition = () => {
            if (data?.hardware_fault) return isKhmer ? 'មានបញ្ហា' : 'Issue';
            const m = classifyMoisture(moisture);
            const s = classifySalinity(salinityRaw);
            const okMoist = isKhmer ? (m === 'ធម្មតា') : (m === 'Normal');
            const okSal = isKhmer ? (s === 'មធ្យម' || s === 'ទាប') : (s === 'Medium' || s === 'Low');
            if (okMoist && okSal) return isKhmer ? 'ធម្មតា' : 'Normal';
            return isKhmer ? 'ត្រូវយកចិត្តទុកដាក់' : 'Attention';
        };

        const now = new Date();
        const dayNum = now.getDate();
        const yearNum = now.getFullYear();
        const timePart = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Phnom_Penh' });

        let timeStr;
        if (isKhmer) {
            const dayName = KH_DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
            const monthName = KH_MONTHS[now.getMonth()];
            // Requested style: "សុក្រ / 6 កុម្ភៈ / 2026 | 01:29 AM"
            timeStr = `${dayName} / ${dayNum} ${monthName} / ${yearNum}${TIME_SEP}${timePart}`;
        } else {
            const dayEn = now.toLocaleDateString('en-US', { weekday: 'long' });
            const monthEn = now.toLocaleDateString('en-US', { month: 'long' });
            timeStr = `${dayEn} / ${dayNum} ${monthEn} / ${yearNum}${TIME_SEP}${timePart}`;
        }

        const pumpIsOn = !!(ctx && ctx.session && ctx.session.pump_is_on);
        const fertIsOn = !!(ctx && ctx.session && ctx.session.fert_is_on);
        const pumpLastAt = (ctx && ctx.session && ctx.session.pump_last_action_at) ? new Date(ctx.session.pump_last_action_at) : null;
        const fertLastAt = (ctx && ctx.session && ctx.session.fert_last_action_at) ? new Date(ctx.session.fert_last_action_at) : null;

        const RECENT_MS = 6 * 60 * 60 * 1000; // 6 hours
        const isRecent = (d) => (d instanceof Date) && Number.isFinite(d.getTime()) && (Date.now() - d.getTime() <= RECENT_MS);

        const irrigationText = pumpIsOn
            ? (isKhmer ? 'ដំណើរការ' : 'Running')
            : (isRecent(pumpLastAt) ? (isKhmer ? 'បានធ្វើថ្មីៗនេះ' : 'Done recently') : (isKhmer ? 'ទំនេរ' : 'Idle'));

        const fertText = fertIsOn
            ? (isKhmer ? 'ដំណើរការ' : 'Running')
            : (isRecent(fertLastAt) ? (isKhmer ? 'បានធ្វើថ្មីៗនេះ' : 'Done recently') : (isKhmer ? 'មិនទាន់ធ្វើ' : 'Not yet'));

        const systemText = data?.hardware_fault
            ? (isKhmer ? 'មានបញ្ហា' : 'Issue detected')
            : (data ? (isKhmer ? 'ដំណើរការធម្មតា' : 'Normal') : (isKhmer ? 'មិនមានទិន្នន័យ' : 'No data'));

        const title = isKhmer ? '📊 ស្ថានភាពដី' : '📊 Soil Status';

        const sec1 = isKhmer ? '💧 ១. ស្ថានភាពទូទៅ' : '💧 1. General Conditions';
        const sec2 = isKhmer ? '🧬 ២. ស្ថានភាពជីវជាតិដី' : '🧬 2. Soil Nutrients';
        const sec3 = isKhmer ? '🌾 ៣. គុណភាពដី' : '🌾 3. Soil Quality';
        const sec4 = isKhmer ? '🌿 ៤. ការគ្រប់គ្រងដំណាំ' : '🌿 4. Crop Management';

        const genLines = isKhmer
            ? [
                `   🌱 សំណើមដី៖ ${classifyMoisture(moisture)}`,
                `   🌱 កម្តៅដី៖ ${classifySoilTemp(soilTemp)}`,
                `   🌱 អាកាសធាតុ៖ ${classifyAirTemp(airTemp)}`,
                `   🌱 សំណើមអាកាស៖ ${classifyHumidity(airHum)}`,
            ]
            : [
                `   🌱 Soil moisture: ${classifyMoisture(moisture)}`,
                `   🌱 Soil temperature: ${classifySoilTemp(soilTemp)}`,
                `   🌱 Weather: ${classifyAirTemp(airTemp)}`,
                `   🌱 Air humidity: ${classifyHumidity(airHum)}`,
            ];

        const nutrientLines = isKhmer
            ? [
                `   🌱 ជីអាសូត (N)៖ ${classifyNpk(nitrogen)}`,
                `   🌱 ជីផូស្វ័រ (P)៖ ${classifyNpk(phosphorus)}`,
                `   🌱 ជីប៉ូតាស្យូម (K)៖ ${classifyNpk(potassium)}`,
                '   ℹ️ ព័ត៌មានប៉ាន់ស្មានតាមការប្រើជី និងប្រវត្តិស្រែ',
            ]
            : [
                `   🌱 Nitrogen (N): ${classifyNpk(nitrogen)}`,
                `   🌱 Phosphorus (P): ${classifyNpk(phosphorus)}`,
                `   🌱 Potassium (K): ${classifyNpk(potassium)}`,
                '   ℹ️ Estimated from fertilizer use and field history',
            ];

        const qualityLines = isKhmer
            ? [
                `   🌱 សភាពដី៖ ${classifySoilCondition()}`,
                `   🌱 ជាតិប្រៃ៖ ${classifySalinity(salinityRaw)}`,
                `   🌱 ការស្រូបទឹក៖ ${classifyAbsorption(moisture)}`,
            ]
            : [
                `   🌱 Soil condition: ${classifySoilCondition()}`,
                `   🌱 Salinity: ${classifySalinity(salinityRaw)}`,
                `   🌱 Water absorption: ${classifyAbsorption(moisture)}`,
            ];

        const mgmtLines = isKhmer
            ? [
                `   🌱 ការស្រោចស្រព៖ ${irrigationText}`,
                `   🌱 ការដាក់ជី៖ ${fertText}`,
                `   🌱 ប្រព័ន្ធ៖ ${systemText}`,
            ]
            : [
                `   🌱 Irrigation: ${irrigationText}`,
                `   🌱 Fertilizer: ${fertText}`,
                `   🌱 System: ${systemText}`,
            ];

        const faultLine = data?.hardware_fault
            ? (isKhmer ? `⚠️ ចំណាំ៖ ${String(data.hardware_fault)}` : `⚠️ Note: ${String(data.hardware_fault)}`)
            : '';

        return [
            title,
            '-----------------------------------',
            sec1,
            ...genLines,
            '',
            sec2,
            ...nutrientLines,
            '',
            sec3,
            ...qualityLines,
            '',
            sec4,
            ...mgmtLines,
            '',
            `🕒 Update: ${timeStr}`,
            faultLine,
        ].filter(Boolean).join('\n');
    },

    getControlMenu(isKhmer, pumpIsOn, stopAt) {
        const title = isKhmer ? "💧 **បញ្ជាការស្រោចស្រព**" : "💧 **Irrigation Control**";

        const statusView = pumpIsOn 
            ? (isKhmer ? "🟢 **ម៉ូទ័រទឹកកំពុងដំណើរការ**" : "🟢 **PUMP IS ON**")
            : (isKhmer ? "🔴 **ម៉ូទ័រទឹក៖ ទំនេរ**" : "🔴 **PUMP: IDLE**");

        const btnText = pumpIsOn 
            ? (isKhmer ? "🔴 បិទម៉ូទ័រទឹក" : "🔴 STOP PUMP")
            : (isKhmer ? "🟢 បើកម៉ូទ័រទឹក" : "🟢 START PUMP");

        return {
            text: `${title}${DIVIDER}${statusView}`,
            keyboard: Markup.inlineKeyboard([
                [Markup.button.callback(btnText, pumpIsOn ? "pump_stop" : "pump_on")],
                [Markup.button.callback(isKhmer ? "🔧 ប្តូរឧបករណ៍" : "🔧 Change Device", "device_menu")],
                [Markup.button.callback(isKhmer ? "⬅️ ត្រឡប់ក្រោយ" : "⬅️ Back", "back_to_main")]
            ])
        };
    },

    getFertilizerMenu(isKhmer, fertIsOn, stopAt) {
        const title = isKhmer ? "🌿 **អាហារូបត្ថម្ភដំណាំ (ជី)**" : "🌿 **Crop Nutrition (Fertilizer)**";

        const statusView = fertIsOn 
            ? (isKhmer ? "🟢 **ម៉ូទ័រជីកំពុងដំណើរការ**" : "🟢 **FERTILIZER IS ON**")
            : (isKhmer ? "🔴 **ម៉ូទ័រជី៖ ទំនេរ**" : "🔴 **FERT PUMP: IDLE**");

        const btnText = fertIsOn 
            ? (isKhmer ? "🔴 បិទម៉ូទ័រជី" : "🔴 STOP FERTILIZER")
            : (isKhmer ? "🟢 បើកម៉ូទ័រជី" : "🟢 START FERTILIZER");

        return {
            text: `${title}${DIVIDER}${statusView}`,
            keyboard: Markup.inlineKeyboard([
                [Markup.button.callback(btnText, fertIsOn ? "fert_stop" : "fert_on")],
                [Markup.button.callback(isKhmer ? "🔧 ប្តូរឧបករណ៍" : "🔧 Change Device", "device_menu")],
                [Markup.button.callback(isKhmer ? "⬅️ ត្រឡប់ក្រោយ" : "⬅️ Back", "back_to_main")]
            ])
        };
    },

    formatWeatherMessage(wData, city, isKhmer) {
        if (!wData) return isKhmer ? "❌ មិនអាចទាញយកទិន្នន័យបានទេ" : "❌ Could not fetch weather.";

        const descRaw = (wData.desc || 'clear sky').toLowerCase();
        const desc = isKhmer ? (WEATHER_TRANS_KH[descRaw] || descRaw) : descRaw.charAt(0).toUpperCase() + descRaw.slice(1);
        const windKmh = Math.round((wData.wind || 0) * 3.6);

        let header = isKhmer ? `🌦 **អាកាសធាតុ | ${city}**` : `🌦 **Weather | ${city}**`;
        header += DIVIDER;
        
        const body = isKhmer 
            ? `🌈 ស្ថានភាព៖ **${desc}**\n\n🌡 សីតុណ្ហភាព៖ \`${wData.temp}°C\`\n\n💧 សំណើមអាកាស៖ \`${wData.humidity}%\`\n\n💨 ល្បឿនខ្យល់៖ \`${windKmh} គ.ម/ម៉\``
            : `🌈 Condition: **${desc}**\n\n🌡 Temp: \`${wData.temp}°C\`\n\n💧 Humidity: \`${wData.humidity}%\`\n\n💨 Wind Speed: \`${windKmh} km/h\``;

        let advice = "";
        if (windKmh > 18) {
            advice = isKhmer ? `\n\n💨 **ប្រយ័ត្ន៖** ខ្យល់បក់ខ្លាំង មិនគួរកសិករលាយថ្នាំបាញ់ឡើយ` : `\n\n💨 **Warning:** Strong wind. Not recommended for spraying`;
        } else if (descRaw.includes('rain') || descRaw.includes('thunderstorm')) {
            advice = isKhmer ? `\n\n⚠️ **យោបល់៖** ភ្លៀងអាចនឹងធ្លាក់ ផ្អាកការបាញ់ថ្នាំកសិកម្ម` : `\n\n⚠️ **Advice:** Rain expected. Postpone chemical spraying`;
        }

        return header + body + advice;
    },

    formatLogbookMonthlyMessage(historyData, isKhmer, monthName, currentY, page = 1, maxWeeks = null) {
        const weekLabel = isKhmer ? `សប្តាហ៍ទី ${page}` : `Week ${page}`;
        const header = isKhmer 
            ? `📊 **របាយការណ៍ ${monthName} ${currentY}**\n(${weekLabel})${DIVIDER}` 
            : `📊 **Report ${monthName} ${currentY}**\n(${weekLabel})${DIVIDER}`;
        
        let body = "";
        if (!historyData || historyData.length === 0) {
            body = isKhmer ? "📭 មិនមានទិន្នន័យសកម្មភាព" : "📭 No activity recorded.";
        } else {
            historyData.forEach(log => {
                const date = new Date(log._time);
                const timeStr = date.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: true, 
                    timeZone: 'Asia/Phnom_Penh' 
                });
                
                const dStr = isKhmer 
                    ? `ថ្ងៃទី ${date.getDate()} | ${timeStr}` 
                    : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} | ${timeStr}`;
                
                const activityText = isKhmer
                    ? (log.textKh ?? log.textEn ?? '—')
                    : (log.textEn ?? log.textKh ?? '—');
                body += `🔹 **${dStr}**\n└ ${activityText}\n\n`;
            });
        }

        const safeMax = Number.isFinite(maxWeeks) && maxWeeks > 0 ? Math.floor(maxWeeks) : null;
        const prevWeek = Math.max(1, page - 1);
        const nextWeek = safeMax ? Math.min(safeMax, page + 1) : (page + 1);

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback(isKhmer ? "⬅️ សប្តាហ៍មុន" : "⬅️ Prev Week", `week_${prevWeek}`),
                Markup.button.callback(isKhmer ? "សប្តាហ៍បន្ទាប់ ➡️" : "Next Week ➡️", `week_${nextWeek}`)
            ],
            [
                Markup.button.callback(isKhmer ? "⬅️ ខែមុន" : "⬅️ Last Month", "log_prev"),
                Markup.button.callback(isKhmer ? "ខែបន្ទាប់ ➡️" : "Next Month ➡️", "log_next")
            ],
            [Markup.button.callback(isKhmer ? "⬅️ ត្រឡប់ក្រោយ" : "⬅️ Back", "back_to_main")]
        ]);

        return { text: header + body, keyboard };
    },

    formatSoilHealthWeeklyMessage(weekEntry, isKhmer, monthName, currentY, page = 1, totalWeeks = 0) {
        const weekLabel = isKhmer ? `សប្តាហ៍ទី ${page}` : `Week ${page}`;
        const header = isKhmer
            ? `📝 **សង្ខេបសុខភាពដី | ${monthName} ${currentY}**\n(${weekLabel})${DIVIDER}`
            : `📝 **Soil Health Summary | ${monthName} ${currentY}**\n(${weekLabel})${DIVIDER}`;

        let body = "";
        if (!weekEntry) {
            body = isKhmer ? "📭 មិនមានទិន្នន័យសម្រាប់សប្តាហ៍នេះ" : "📭 No data available for this week.";
        } else {
            const period = `${weekEntry.startDate} → ${weekEntry.endDate}`;
            const status = weekEntry.analysis?.soilStatus || 'Unknown';
            const avg = weekEntry.averages || {};
            const issues = Array.isArray(weekEntry.analysis?.issues) ? weekEntry.analysis.issues : [];

            const genH = isKhmer ? "\n💧 **ស្ថានភាពទូទៅ**" : "\n💧 **General Conditions**";
            const genBody = isKhmer
                ? `\n   🌱 pH: \`${avg.ph ?? '—'}\`\n   🌱 សំណើមដី: \`${avg.moisture ?? '—'}%\`\n   🌱 កម្តៅដី: \`${avg.temperature ?? '—'}°C\``
                : `\n   🌱 pH: \`${avg.ph ?? '—'}\`\n   🌱 Soil Moisture: \`${avg.moisture ?? '—'}%\`\n   🌱 Soil Temperature: \`${avg.temperature ?? '—'}°C\``;

            const nutH = isKhmer ? "\n\n🧬 **ជីវជាតិដី (NPK)**" : "\n\n🧬 **Soil Nutrients (NPK)**";
            const nutBody = isKhmer
                ? `\n   🌱 N: \`${avg.nitrogen ?? '—'} mg/kg\`\n   🌱 P: \`${avg.phosphorus ?? '—'} mg/kg\`\n   🌱 K: \`${avg.potassium ?? '—'} mg/kg\``
                : `\n   🌱 N: \`${avg.nitrogen ?? '—'} mg/kg\`\n   🌱 P: \`${avg.phosphorus ?? '—'} mg/kg\`\n   🌱 K: \`${avg.potassium ?? '—'} mg/kg\``;

            const qualH = isKhmer ? "\n\n🌾 **គុណភាពដី**" : "\n\n🌾 **Soil Quality**";
            const qualBody = isKhmer
                ? `\n   🌱 ជាតិប្រៃ: \`${avg.salinity ?? '—'}\`\n   🌱 ចរន្តអគ្គិសនី (EC): \`${avg.ec ?? '—'} uS/cm\``
                : `\n   🌱 Salinity: \`${avg.salinity ?? '—'}\`\n   🌱 Conductivity (EC): \`${avg.ec ?? '—'} uS/cm\``;

            const statusLine = isKhmer
                ? `\n\n📌 ស្ថានភាពសុទ្ធសាធ៖ **${status}**`
                : `\n\n📌 Overall Status: **${status}**`;

            let issuesText = "";
            if (issues.length > 0) {
                const title = isKhmer ? "\n\n⚠️ បញ្ហាដែលត្រូវយកចិត្តទុកដាក់" : "\n\n⚠️ Issues to Watch";
                const list = issues.map(i => `- ${i.parameter}: ${i.issue}`).join("\n");
                issuesText = `${title}\n${list}`;
            }

            const periodLine = isKhmer
                ? `\n\n🗓 រយៈពេល៖ ${period}`
                : `\n\n🗓 Period: ${period}`;

            body = genH + genBody + nutH + nutBody + qualH + qualBody + statusLine + issuesText + periodLine;
        }

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback(isKhmer ? "⬅️ សប្តាហ៍មុន" : "⬅️ Prev Week", `week_${Math.max(1, page - 1)}`),
                Markup.button.callback(isKhmer ? "សប្តាហ៍បន្ទាប់ ➡️" : "Next Week ➡️", `week_${Math.min(totalWeeks || page + 1, page + 1)}`)
            ],
            [Markup.button.callback(isKhmer ? "⬅️ ត្រឡប់ក្រោយ" : "⬅️ Back", "back_to_main")]
        ]);

        return { text: header + body, keyboard };
    },

    formatCultivationHistoryWeeklyMessage(weekEntry, isKhmer, monthName, currentY, page = 1, totalWeeks = 0) {
        const weekLabel = isKhmer ? `សប្តាហ៍ទី ${page}` : `Week ${page}`;
        const header = isKhmer
            ? `🧑‍🌾 **ប្រវត្តិការដាំដុះ | ${monthName} ${currentY}**\n(${weekLabel})${DIVIDER}`
            : `🧑‍🌾 **Cultivation History | ${monthName} ${currentY}**\n(${weekLabel})${DIVIDER}`;

        let body = "";
        if (!weekEntry) {
            body = isKhmer ? "📭 មិនមានទិន្នន័យសម្រាប់សប្តាហ៍នេះ" : "📭 No data available for this week.";
        } else {
            const period = `${weekEntry.weekStart} → ${weekEntry.weekEnd}`;

            const mapStatus = (status, khLabels) => {
                switch (status) {
                    case 'appropriate':
                        return isKhmer ? khLabels.appropriate : 'Appropriate';
                    case 'warning':
                        return isKhmer ? khLabels.warning : 'Attention Needed';
                    case 'critical':
                        return isKhmer ? khLabels.critical : 'Critical';
                    case 'pending':
                    default:
                        return isKhmer ? khLabels.pending : 'No Data';
                }
            };

            const waterLabelKh = { appropriate: 'សមស្រប', warning: 'ត្រូវយកចិត្តទុកដាក់', critical: 'គ្រោះថ្នាក់', pending: 'មិនមានទិន្នន័យ' };
            const npkLabelKh = { appropriate: 'សមស្រប', warning: 'ត្រូវយកចិត្តទុកដាក់', critical: 'គ្រោះថ្នាក់', pending: 'មិនមានទិន្នន័យ' };

            const waterStatusText = mapStatus(weekEntry.wateringStatus, waterLabelKh);
            const npkStatusText = mapStatus(weekEntry.soilNutrientStatus, npkLabelKh);

            const waterH = isKhmer ? "\n💧 **ការស្រោចទឹក**" : "\n💧 **Watering**";
            const npkH = isKhmer ? "\n\n🧬 **ជីវជាតិដី (NPK)**" : "\n\n🧬 **Soil Nutrients (NPK)**";

            const waterBody = isKhmer ? `\n   ស្ថានភាព៖ **${waterStatusText}**` : `\n   Status: **${waterStatusText}**`;
            const npkBody = isKhmer ? `\n   ស្ថានភាព៖ **${npkStatusText}**` : `\n   Status: **${npkStatusText}**`;

            const hasDataLine = weekEntry.hasData
                ? (isKhmer ? "\n\n📌 មានទិន្នន័យសម្រាប់សប្តាហ៍នេះ" : "\n\n📌 Data available for this week")
                : (isKhmer ? "\n\n📌 មិនមានទិន្នន័យសម្រាប់សប្តាហ៍នេះ" : "\n\n📌 No sensor data for this week");

            const periodLine = isKhmer
                ? `\n\n🗓 រយៈពេល៖ ${period}`
                : `\n\n🗓 Period: ${period}`;

            body = waterH + waterBody + npkH + npkBody + hasDataLine + periodLine;
        }

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback(isKhmer ? "⬅️ សប្តាហ៍មុន" : "⬅️ Prev Week", `week_${Math.max(1, page - 1)}`),
                Markup.button.callback(isKhmer ? "សប្តាហ៍បន្ទាប់ ➡️" : "Next Week ➡️", `week_${Math.min(totalWeeks || page + 1, page + 1)}`)
            ],
            [Markup.button.callback(isKhmer ? "⬅️ ត្រឡប់ក្រោយ" : "⬅️ Back", "back_to_main")]
        ]);

        return { text: header + body, keyboard };
    },

    getHelpMenu(isKhmer) {
        return {
            keyboard: Markup.inlineKeyboard([
                [Markup.button.url(isKhmer ? "☎️ ជំនួយបច្គេកទេស" : "☎️ Tech Support", "https://t.me/SnamBaitong_Support")],
                [Markup.button.callback(isKhmer ? "⬅️ ត្រឡប់ក្រោយ" : "⬅️ Back", "back_to_main")]
            ])
        };
    }
};

module.exports = MenuService;
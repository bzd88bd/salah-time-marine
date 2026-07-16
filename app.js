"use strict";

/* ================================================
   Salah Time - Marine Edition
   Version 1.1
================================================ */

const APP = {

    calculationMethod: "AUTO",

    asrMethod: "HANAFI",

    language: "en",

    timeFormat: 24,

    autoLocation: true,

    shipMode: false,

    prayerAdjustment: {

        fajr: 0,

        dhuhr: 0,

        asr: 0,

        maghrib: 0,

        isha: 0

    }

};

const STATE = {

    latitude: null,

    longitude: null,

    country: "",

    city: "",

    timezone: "",

    prayerTimes: null,

    nextPrayer: null

};

const ui = {

    location:
        document.getElementById("location"),

    todayDate:
        document.getElementById("todayDate"),

    nextPrayer:
        document.getElementById("nextPrayerName"),

    countdown:
        document.getElementById("countdown"),

    fajr:
        document.getElementById("fajr"),

    sunrise:
        document.getElementById("sunrise"),

    dhuhr:
        document.getElementById("dhuhr"),

    asr:
        document.getElementById("asr"),

    maghrib:
        document.getElementById("maghrib"),

    isha:
        document.getElementById("isha"),

    hijri:
        document.getElementById("hijriDate"),

    calculation:
        document.getElementById("calculationMethod"),

    asrMethod:
        document.getElementById("asrMethod")

};

window.addEventListener("load", () => {

    initializeApp();

});

async function initializeApp() {

    if (typeof adhan === "undefined") {

        alert("Adhan.js failed to load.");

        return;

    }

    loadSettings();

    updateTodayDate();

    ui.asrMethod.textContent =
        APP.asrMethod;

    try {

    await getCurrentLocation();

    updateLocationInfo();

    calculatePrayerTimes();

    updateHijriDate();

    startCountdown();

}

catch (err) {

    console.error(err);

    ui.location.textContent =
        "Location unavailable";

}

}



/* ================================================
   Settings
================================================ */

function loadSettings() {

    const saved =
        localStorage.getItem("salahTimeSettings");

    if (!saved) return;

    try {

        Object.assign(APP, JSON.parse(saved));

    }

    catch (err) {

        console.error(err);

    }

}

function saveSettings() {

    localStorage.setItem(

        "salahTimeSettings",

        JSON.stringify(APP)

    );

}

/* ================================================
   GPS Location
================================================ */

async function getCurrentLocation() {

    return new Promise((resolve, reject) => {

        if (!navigator.geolocation) {

            reject("Geolocation not supported");

            return;

        }

        navigator.geolocation.getCurrentPosition(

            async position => {

                STATE.latitude =
                    position.coords.latitude;

                STATE.longitude =
                    position.coords.longitude;

                STATE.timezone =
                    Intl.DateTimeFormat()
                    .resolvedOptions()
                    .timeZone;

                await reverseGeocode();

                resolve();

            },

            error => reject(error),

            {

                enableHighAccuracy: true,

                timeout: 15000,

                maximumAge: 300000

            }

        );

    });

}

/* ================================================
   Reverse Geocode
================================================ */

async function reverseGeocode() {

    try {

        const response = await fetch(

            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${STATE.latitude}&lon=${STATE.longitude}`

        );

        const data =
            await response.json();

        STATE.country =
            data.address.country || "";

        STATE.city =

            data.address.city ||

            data.address.town ||

            data.address.village ||

            "";

    }

    catch {

        STATE.country = "";

        STATE.city = "";

    }

}

/* ================================================
   Update Location
================================================ */

function updateLocationInfo() {

    if (STATE.city) {

        ui.location.textContent =

            `${STATE.city}, ${STATE.country}`;

    }

    else if (STATE.country) {

        ui.location.textContent =
            STATE.country;

    }

    else {

        ui.location.textContent =

            `${STATE.latitude.toFixed(4)}, ${STATE.longitude.toFixed(4)}`;

    }

}





/* ================================================
   Calculation Method
================================================ */

function selectCalculationMethod() {

    if (APP.calculationMethod !== "AUTO") {

        return APP.calculationMethod;

    }

    const country =
        (STATE.country || "").toLowerCase();

    const karachiCountries = [

        "bangladesh",
        "india",
        "pakistan"

    ];

    if (karachiCountries.includes(country)) {

        return "KARACHI";

    }

    return "MWL";

}

function createCalculationParameters() {

    let params;

    switch (selectCalculationMethod()) {

        case "KARACHI":

            params =
                adhan.CalculationMethod.Karachi();

            break;

        default:

            params =
                adhan.CalculationMethod
                .MuslimWorldLeague();

    }

    params.madhab =

        APP.asrMethod === "HANAFI"

        ? adhan.Madhab.Hanafi

        : adhan.Madhab.Shafi;

    return params;

}

/* ================================================
   Prayer Times
================================================ */

function calculatePrayerTimes() {

    const coordinates =

        new adhan.Coordinates(

            STATE.latitude,

            STATE.longitude

        );

    STATE.prayerTimes =

        new adhan.PrayerTimes(

            coordinates,

            new Date(),

            createCalculationParameters()

        );

    updatePrayerTable();

    findNextPrayer();

    updateCalculationInfo();

}

function updateCalculationInfo() {

    ui.calculation.textContent =

        selectCalculationMethod();

}







/* ================================================
   Date & Time Format
================================================ */

function formatTime(date) {

    return date.toLocaleTimeString([], {

        hour: "2-digit",

        minute: "2-digit",

        hour12: false

    });

}


function updateTodayDate() {

    if (!ui.todayDate) return;

    ui.todayDate.textContent =

        new Date().toLocaleDateString(
            "en-US",
            {
                weekday:"long",
                year:"numeric",
                month:"long",
                day:"numeric"
            }
        );

}


/* ================================================
   Prayer Table
================================================ */

function updatePrayerTable() {

    if (!STATE.prayerTimes) return;


    ui.fajr.textContent =

        formatTime(
            STATE.prayerTimes.fajr
        );


    ui.sunrise.textContent =

        formatTime(
            STATE.prayerTimes.sunrise
        );


    ui.dhuhr.textContent =

        formatTime(
            STATE.prayerTimes.dhuhr
        );


    ui.asr.textContent =

        formatTime(
            STATE.prayerTimes.asr
        );


    ui.maghrib.textContent =

        formatTime(
            STATE.prayerTimes.maghrib
        );


    ui.isha.textContent =

        formatTime(
            STATE.prayerTimes.isha
        );


}


/* ================================================
   Next Prayer
================================================ */

function findNextPrayer() {

    if (!STATE.prayerTimes) return;

    const now = new Date();

    const prayers = [

        {
            name: "Fajr",
            time: STATE.prayerTimes.fajr
        },

        {
            name: "Sunrise",
            time: STATE.prayerTimes.sunrise
        },

        {
            name: "Dhuhr",
            time: STATE.prayerTimes.dhuhr
        },

        {
            name: "Asr",
            time: STATE.prayerTimes.asr
        },

        {
            name: "Maghrib",
            time: STATE.prayerTimes.maghrib
        },

        {
            name: "Isha",
            time: STATE.prayerTimes.isha
        }

    ];

    for (let prayer of prayers) {

        if (now < prayer.time) {

            STATE.nextPrayer = prayer;

            updateNextPrayer();

            return;

        }

    }

    // Tomorrow's Fajr

    const tomorrow = new Date();

    tomorrow.setDate(tomorrow.getDate() + 1);

    const coordinates = new adhan.Coordinates(
        STATE.latitude,
        STATE.longitude
    );

    const tomorrowPrayer = new adhan.PrayerTimes(
        coordinates,
        tomorrow,
        createCalculationParameters()
    );

    STATE.nextPrayer = {

        name: "Fajr",

        time: tomorrowPrayer.fajr

    };

    updateNextPrayer();

}

console.log("NOW:", new Date());
console.log("FAJR:", STATE.prayerTimes.fajr);
console.log("DHUHR:", STATE.prayerTimes.dhuhr);
console.log("ASR:", STATE.prayerTimes.asr);
console.log("ISHA:", STATE.prayerTimes.isha);

function updateNextPrayer() {

    if (!STATE.nextPrayer) return;


    ui.nextPrayer.textContent =

        STATE.nextPrayer.name;

}



/* ================================================
   Countdown
================================================ */

function updateCountdown() {

    if (!STATE.nextPrayer) return;

    const now = new Date();

    let diff = STATE.nextPrayer.time.getTime() - now.getTime();

    if (diff <= 0) {

        findNextPrayer();

        diff = STATE.nextPrayer.time.getTime() - new Date().getTime();

    }

    const hours = Math.floor(diff / 3600000);

    const minutes = Math.floor((diff % 3600000) / 60000);

    const seconds = Math.floor((diff % 60000) / 1000);

    ui.countdown.textContent =
        `${String(hours).padStart(2, "0")}:` +
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`;

}

function startCountdown() {

    updateCountdown();

    if (window.countdownTimer) {

        clearInterval(window.countdownTimer);

    }

    window.countdownTimer = setInterval(updateCountdown, 1000);

}

/* ================================================
   Hijri Date
================================================ */

function updateHijriDate() {

    if (!ui.hijri) return;


    const hijri =

        new Intl.DateTimeFormat(
            "en-TN-u-ca-islamic",
            {
                day:"numeric",
                month:"long",
                year:"numeric"
            }
        ).format(new Date());


    ui.hijri.textContent = hijri;

}


/* ================================================
   Refresh Button
================================================ */

const refreshButton =

    document.getElementById(
        "refreshLocation"
    );


if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        async () => {

            await getCurrentLocation();

            updateLocationInfo();

            calculatePrayerTimes();

        }
    );

}



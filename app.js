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

    nextPrayer: null,

    // GPS request management
    gpsRequestInProgress: false,

    // GPS success status
    gpsLastSuccess: false,

    // Current GPS status message
    gpsStatusMessage: "",

    // Last GPS error
    gpsLastError: null

};
const ui = {

    location:
        document.getElementById("location"),

    position:
        document.getElementById("position"),

    localTime:
        document.getElementById("localTime"),

    timeZone:
        document.getElementById("timeZone"),

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

    sunset:
        document.getElementById("sunset"),

    maghrib:
        document.getElementById("maghrib"),

    isha:
        document.getElementById("isha"),

    sunriseProhibited:
        document.getElementById("sunriseProhibited"),

    zawalProhibited:
        document.getElementById("zawalProhibited"),

    sunsetProhibited:
        document.getElementById("sunsetProhibited"),

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

/* ================================================
   Initialize App - GPS Reliability Version 1.9
================================================ */

async function initializeApp() {

    if (typeof adhan === "undefined") {

        alert("Adhan.js failed to load.");

        return;

    }

    loadSettings();

    updateTodayDate();

    updateShipTime();

    setInterval(updateShipTime, 1000);

    if (ui.asrMethod) {

        ui.asrMethod.textContent =
            APP.asrMethod;

    }

    /*
     * Restore Last Known Location
     */

    const hasLastLocation =
        loadLastKnownLocation();

    if (hasLastLocation) {

        updateLocationInfo();

        updateGPSStatus();

        calculatePrayerTimes();

        updateHijriDate();

        startCountdown();

    }

    /*
     * Try to Get Fresh GPS Location
     */

    try {

        await getCurrentLocation();

        updateLocationInfo();

        calculatePrayerTimes();

        updateHijriDate();

        startCountdown();

        updateLastLocationStatus();

    }

    catch (err) {

        console.error(
            "Location initialization error:",
            err
        );

        /*
         * Use Last Known Location
         */

        if (hasLastLocation) {

            updateLocationInfo();

            calculatePrayerTimes();

            updateHijriDate();

            startCountdown();

            updateLastLocationStatus();

        }

        else {

            if (ui.location) {

                ui.location.textContent =
                    "Location unavailable";

            }

            if (ui.position) {

                ui.position.textContent =
                    "--";

            }

            updateLastLocationStatus();

        }

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
   GPS Location - Version 2.1
================================================ */

async function getCurrentLocation() {

    const statusElement =
        document.getElementById("lastLocationStatus");

    function showStatus(message) {
        STATE.gpsStatusMessage = message;

        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    // Prevent simultaneous GPS requests
    if (STATE.gpsRequestInProgress) {
        throw new Error("GPS request already in progress");
    }

    // Check browser support
    if (!navigator.geolocation) {
        const error = new Error(
            "Geolocation is not supported by this browser."
        );

        STATE.gpsLastSuccess = false;
        STATE.gpsLastError = error;

        showStatus("🔴 GPS is not supported by this browser.");

        updateGPSStatus();

        throw error;
    }

    STATE.gpsRequestInProgress = true;
    STATE.gpsLastSuccess = false;
    STATE.gpsLastError = null;

    showStatus("📡 Requesting GPS location...");

    updateGPSStatus();

    try {

        // Request fresh GPS coordinates
        const position = await new Promise(
            (resolve, reject) => {

                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: true,
                        timeout: 30000,
                        maximumAge: 0
                    }
                );

            }
        );

        const latitude =
            position.coords.latitude;

        const longitude =
            position.coords.longitude;

        // Validate received coordinates
        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            throw new Error("Invalid GPS coordinates");
        }

        // Update application state
        STATE.latitude = latitude;
        STATE.longitude = longitude;

        STATE.timezone =
            Intl.DateTimeFormat()
                .resolvedOptions()
                .timeZone;

        STATE.gpsLastSuccess = true;
        STATE.gpsLastError = null;

        // Save successful GPS position
        localStorage.setItem(
            "lastKnownLocation",
            JSON.stringify({
                latitude: latitude,
                longitude: longitude,
                timezone: STATE.timezone,
                savedAt: new Date().toISOString()
            })
        );

        // Update location display
        updateLocationInfo();

        showStatus("🟢 GPS position received successfully.");

        updateGPSStatus();

        // Resolve GPS independently of reverse geocoding
        reverseGeocode()
            .then(() => {
                updateLocationInfo();
                updateCalculationInfo();
            })
            .catch(error => {
                console.warn(
                    "Reverse geocoding failed:",
                    error
                );
            });

        return position;

    } catch (error) {

        STATE.gpsLastSuccess = false;
        STATE.gpsLastError = error;

        console.error(
            "GPS request failed:",
            error
        );

        if (error.code === 1) {

            showStatus("🔴 GPS permission denied.");

        } else if (error.code === 2) {

            showStatus("🔴 GPS position unavailable.");

        } else if (error.code === 3) {

            showStatus("🟡 GPS request timed out.");

        } else {

            showStatus(
                "🔴 GPS error: " +
                (error.message || "Unknown error")
            );

        }

        updateGPSStatus();

        throw error;

    } finally {

        STATE.gpsRequestInProgress = false;

        updateGPSStatus();
    }
}
/* ================================================
   Last Known Location
================================================ */

function loadLastKnownLocation() {

    const saved =
        localStorage.getItem("lastKnownLocation");

    if (!saved) {

        return false;

    }

    try {

        const location =
            JSON.parse(saved);

        if (
            typeof location.latitude !== "number" ||
            typeof location.longitude !== "number"
        ) {

            return false;

        }

        STATE.latitude =
            location.latitude;

        STATE.longitude =
            location.longitude;

        STATE.timezone =
            location.timezone ||
            Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone;

        STATE.city = "";

        STATE.country = "";

        return true;

    }

    catch (error) {

        console.error(
            "Last known location error:",
            error
        );

        return false;

    }

}



/* ================================================
   Last Known Location Status
================================================ */

function getLastKnownLocationInfo() {

    const saved =
        localStorage.getItem("lastKnownLocation");

    if (!saved) {

        return null;

    }

    try {

        const location =
            JSON.parse(saved);

        if (!location.savedAt) {

            return null;

        }

        const savedTime =
            new Date(location.savedAt);

        if (isNaN(savedTime.getTime())) {

            return null;

        }

        const now =
            new Date();

        const diffMs =
            now.getTime() -
            savedTime.getTime();

        const diffMinutes =
            Math.floor(
                diffMs / 60000
            );

        return {

            savedAt: savedTime,

            minutesAgo: diffMinutes

        };

    }

    catch (error) {

        console.error(
            "Last location status error:",
            error
        );

        return null;

    }

}



/* ================================================
   Display Last GPS Update
================================================ */

/* ================================================
   GPS Status Display - Version 2.1
================================================ */

function updateLastLocationStatus() {
    const statusElement =
        document.getElementById("lastLocationStatus");

    if (!statusElement) return;

    // Do not overwrite the status while GPS is running.
    if (STATE.gpsRequestInProgress) {
        statusElement.textContent =
            STATE.gpsStatusMessage ||
            "📡 Requesting GPS location...";
        return;
    }

    // Preserve the most recent GPS error.
    if (STATE.gpsLastError) {
        statusElement.textContent =
            STATE.gpsStatusMessage ||
            "🔴 GPS request failed.";
        return;
    }

    const info = getLastKnownLocationInfo();

    if (!info) {
        statusElement.textContent =
            "GPS Update: No saved position.";
        return;
    }

    const minutes = info.minutesAgo;

    if (STATE.gpsLastSuccess) {
        statusElement.textContent =
            minutes < 1
                ? "🟢 GPS received: Just now"
                : `🟢 GPS received: ${minutes} min ago`;
        return;
    }

    if (minutes < 30) {
        statusElement.textContent =
            `🟡 Using saved position: ${minutes} min ago`;
    } else {
        const hours = Math.floor(minutes / 60);

        statusElement.textContent =
            hours < 1
                ? `🔴 GPS stale: ${minutes} min ago — saved position in use`
                : `🔴 GPS stale: ${hours} hr ago — saved position in use`;
    }
}




/* ================================================
   Reverse Geocode
================================================ */

async function reverseGeocode() {

    try {

        const url =
            `https://nominatim.openstreetmap.org/reverse` +
            `?format=jsonv2` +
            `&lat=${STATE.latitude}` +
            `&lon=${STATE.longitude}` +
            `&zoom=10` +
            `&addressdetails=1`;

        const response = await fetch(url, {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(
                `Reverse geocoding failed: ${response.status}`
            );
        }

        const data = await response.json();

        const address = data.address || {};

        STATE.country =
            address.country || "";

        STATE.city =
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.county ||
            address.state ||
            "";

        /*
         * Marine fallback
         * If no city/area is returned by Nominatim,
         * use offshore location instead of Unknown Location.
         */

        if (!STATE.city) {

            if (data.name) {

                STATE.city = data.name;

            }
            else if (data.display_name) {

                const firstPart =
                    data.display_name.split(",")[0].trim();

                if (firstPart) {

                    STATE.city = firstPart;

                }

            }

        }

    }

    catch (error) {

        console.error(
            "Reverse geocoding error:",
            error
        );

        STATE.country = "";
        STATE.city = "";

    }

}
/* ================================================
   Update Location
================================================ */

/* ================================================
   Update Location - GPS Aware Position Label
================================================ */

/* =========================================
   Update Location Information
   Version 1.6
========================================= */

function updateLocationInfo() {

    const positionLabel =
        document.getElementById("positionLabel");

    const hasPosition =
        Number.isFinite(STATE.latitude) &&
        Number.isFinite(STATE.longitude);

    const gpsAvailable =
        STATE.gpsLastSuccess === true;

    // Update position label
    if (positionLabel) {
        positionLabel.textContent = gpsAvailable
            ? "📍 Current Position"
            : "📍 Last Received Position";
    }

    // Display coordinates
    if (ui.position) {
        if (hasPosition) {
            ui.position.textContent =
                `${STATE.latitude.toFixed(4)}, ` +
                `${STATE.longitude.toFixed(4)}`;
        } else {
            ui.position.textContent =
                "Position unavailable";
        }
    }

    // Display nearest location
    if (ui.location) {
        if (STATE.city && STATE.country) {
            ui.location.textContent =
                `${STATE.city}, ${STATE.country}`;
        } else if (STATE.city) {
            ui.location.textContent = STATE.city;
        } else if (STATE.country) {
            ui.location.textContent = STATE.country;
        } else {
            ui.location.textContent = "Location unknown";
        }
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

    applyPrayerAdjustments();

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
function updateShipTime() {

    const now = new Date();


    if (ui.localTime) {

        ui.localTime.textContent =
            now.toLocaleTimeString([], {

                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false

            });

    }


    if (ui.timeZone) {

        const tz =
            STATE.timezone ||
            Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone;


        const offset =
            -now.getTimezoneOffset();


        const sign =
            offset >= 0 ? "+" : "-";


        const hours =
            String(
                Math.floor(Math.abs(offset) / 60)
            ).padStart(2,"0");


        const minutes =
            String(
                Math.abs(offset) % 60
            ).padStart(2,"0");


        ui.timeZone.textContent =
            `${tz} (UTC${sign}${hours}:${minutes})`;

    }

}

/* ================================================
   Prayer Table
================================================ */

/* ================================================
   Prayer Table and Prohibited Prayer Times
================================================ */

function updatePrayerTable() {

    if (!STATE.prayerTimes) return;

    const times = STATE.prayerTimes;

    // Display regular prayer times
    if (ui.fajr) {
        ui.fajr.textContent = formatTime(times.fajr);
    }

    if (ui.sunrise) {
        ui.sunrise.textContent = formatTime(times.sunrise);
    }

    if (ui.dhuhr) {
        ui.dhuhr.textContent = formatTime(times.dhuhr);
    }

    if (ui.asr) {
        ui.asr.textContent = formatTime(times.asr);
    }

    if (ui.maghrib) {
        ui.maghrib.textContent = formatTime(times.maghrib);
    }

    if (ui.isha) {
        ui.isha.textContent = formatTime(times.isha);
    }

    /*
     * Sunset
     *
     * Maghrib adjustment is removed to estimate
     * the astronomical sunset time.
     */

    const maghribAdjustment =
        Number(APP.prayerAdjustment?.maghrib || 0);

    const sunsetTime = new Date(
        times.maghrib.getTime() -
        maghribAdjustment * 60000
    );

    if (ui.sunset) {
        ui.sunset.textContent = formatTime(sunsetTime);
    }

    /*
     * Sunrise prohibition
     * Approximate precaution: sunrise to +15 minutes
     */

    const sunriseStart = new Date(times.sunrise);

    const sunriseEnd = new Date(
        sunriseStart.getTime() + 15 * 60000
    );

    if (ui.sunriseProhibited) {
        ui.sunriseProhibited.textContent =
            `${formatTime(sunriseStart)} – ${formatTime(sunriseEnd)}`;
    }

    /*
     * Zawal precaution
     * Approximate window: 5 minutes before Dhuhr
     * until Dhuhr begins.
     */

    const zawalEnd = new Date(times.dhuhr);

    const zawalStart = new Date(
        zawalEnd.getTime() - 5 * 60000
    );

    if (ui.zawalProhibited) {
        ui.zawalProhibited.textContent =
            `${formatTime(zawalStart)} – ${formatTime(zawalEnd)}`;
    }

    /*
     * Sunset precaution
     * Display an approximate 15-minute precautionary
     * window ending at sunset.
     */

    const sunsetStart = new Date(
        sunsetTime.getTime() - 15 * 60000
    );

    if (ui.sunsetProhibited) {
        ui.sunsetProhibited.textContent =
            `${formatTime(sunsetStart)} – ${formatTime(sunsetTime)}`;
    }

}


/* ================================================
   Next Prayer
================================================ */

/* ================================================
   Next Prayer - Version 2.5
================================================ */

function findNextPrayer() {
    if (!STATE.prayerTimes) return;

    const now = new Date();
    const times = STATE.prayerTimes;

    const prayers = [
        { name: "Fajr", time: times.fajr },
        { name: "Sunrise", time: times.sunrise },
        { name: "Dhuhr", time: times.dhuhr },
        { name: "Asr", time: times.asr },
        { name: "Maghrib", time: times.maghrib },
        { name: "Isha", time: times.isha }
    ];

    // Find the next prayer for today
    for (const prayer of prayers) {
        if (prayer.time > now) {
            STATE.nextPrayer = {
                name: prayer.name,
                time: prayer.time,
                dayLabel: "Today"
            };

            updateNextPrayer();
            updateCountdown();
            return;
        }
    }

    // All today's prayers have passed.
    // Calculate tomorrow's Fajr.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const coordinates = new adhan.Coordinates(
        STATE.latitude,
        STATE.longitude
    );

    const tomorrowPrayerTimes = new adhan.PrayerTimes(
        coordinates,
        tomorrow,
        createCalculationParameters()
    );

    let tomorrowFajr = new Date(tomorrowPrayerTimes.fajr);

    const fajrAdjustment = Number(
        APP.prayerAdjustment?.fajr || 0
    );

    tomorrowFajr = new Date(
        tomorrowFajr.getTime() + fajrAdjustment * 60000
    );

    STATE.nextPrayer = {
        name: "Fajr",
        time: tomorrowFajr,
        dayLabel: "Tomorrow"
    };

    updateNextPrayer();
    updateCountdown();
}
/* ================================================
   Update Next Prayer Card
   Version 2.4
================================================ */

function updateNextPrayer() {
    if (!STATE.nextPrayer) return;

    if (ui.nextPrayer) {
        const prayerName = STATE.nextPrayer.name;
        const dayLabel = STATE.nextPrayer.dayLabel;

        if (dayLabel === "Tomorrow") {
            ui.nextPrayer.textContent =
                `${prayerName} (Tomorrow)`;
        } else {
            ui.nextPrayer.textContent = prayerName;
        }
    }

    const prayerTimeElement =
        document.getElementById("nextPrayerTime");

    if (
        prayerTimeElement &&
        STATE.nextPrayer.time instanceof Date &&
        !isNaN(STATE.nextPrayer.time.getTime())
    ) {
        prayerTimeElement.textContent =
            formatTime(STATE.nextPrayer.time);
    }
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

    updateLastLocationStatus();


    if (window.countdownTimer) {

        clearInterval(window.countdownTimer);

    }


    window.countdownTimer =
        setInterval(() => {

            updateCountdown();

            updateLastLocationStatus();

        }, 1000);

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

/* ================================================
   Refresh Location - GPS Diagnostic
================================================ */

/* ================================================
   Refresh Location - Version 2.2
================================================ */

const refreshButton =
    document.getElementById("refreshLocation");

if (refreshButton) {

    refreshButton.addEventListener("click", async () => {

        // Prevent repeated clicks during a GPS request
        if (STATE.gpsRequestInProgress) {
            return;
        }

        const originalText = refreshButton.textContent;

        refreshButton.disabled = true;
        refreshButton.textContent = "Locating...";

        try {

            // Request a fresh GPS position
            await getCurrentLocation();

            // Update location-dependent information
            updateLocationInfo();
            calculatePrayerTimes();
            updateHijriDate();
            updateCalculationInfo();

            if (typeof updateQibla === "function") {
                updateQibla();
            }

            updateLastLocationStatus();
            updateGPSStatus();

        } catch (error) {

            console.warn(
                "Refresh location failed:",
                error
            );

            // Continue using the saved position if available
            const hasLastLocation =
                loadLastKnownLocation();

            if (
                hasLastLocation &&
                STATE.latitude !== null &&
                STATE.longitude !== null
            ) {

                updateLocationInfo();
                calculatePrayerTimes();
                updateHijriDate();
                updateCalculationInfo();

                if (typeof updateQibla === "function") {
                    updateQibla();
                }

                updateGPSStatus();

            } else {

                updateGPSStatus();
            }

            // Preserve the GPS error message
            updateLastLocationStatus();

        } finally {

            refreshButton.disabled = false;
            refreshButton.textContent = originalText;
        }
    });
}
/* ================================================
   Version 1.3 - Settings
================================================ */

const settingsPanel =
    document.getElementById("settingsPanel");

const openSettingsButton =
    document.getElementById("openSettings");

const closeSettingsButton =
    document.getElementById("closeSettings");

const saveSettingsButton =
    document.getElementById("saveSettings");

const calculationSelect =
    document.getElementById("calculationSelect");

const asrSelect =
    document.getElementById("asrSelect");

const timeFormatSelect =
    document.getElementById("timeFormatSelect");

const autoLocationToggle =
    document.getElementById("autoLocationToggle");


/* ================================================
   Open Settings
================================================ */

if (openSettingsButton) {

    openSettingsButton.addEventListener(
        "click",
        () => {

            if (!settingsPanel) return;

            settingsPanel.classList.add("active");

            loadSettingsIntoUI();

            settingsPanel.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }
    );

}


/* ================================================
   Close Settings
================================================ */

if (closeSettingsButton) {

    closeSettingsButton.addEventListener(
        "click",
        () => {

            if (!settingsPanel) return;

            settingsPanel.classList.remove("active");

        }
    );

}


/* ================================================
   Load APP Settings into UI
================================================ */

function loadSettingsIntoUI() {

    if (calculationSelect) {
        calculationSelect.value =
            APP.calculationMethod;
    }

    if (asrSelect) {
        asrSelect.value =
            APP.asrMethod;
    }

    if (timeFormatSelect) {
        timeFormatSelect.value =
            String(APP.timeFormat);
    }

    if (autoLocationToggle) {
        autoLocationToggle.checked =
            APP.autoLocation;
    }

    loadAdjustmentSettings();

}


/* ================================================
   Save Settings
================================================ */

if (saveSettingsButton) {

    saveSettingsButton.addEventListener(
        "click",
        () => {

            if (calculationSelect) {

                APP.calculationMethod =
                    calculationSelect.value;

            }


            if (asrSelect) {

                APP.asrMethod =
                    asrSelect.value;

            }


            if (timeFormatSelect) {

                APP.timeFormat =
                    Number(timeFormatSelect.value);

            }


            if (autoLocationToggle) {

                APP.autoLocation =
                    autoLocationToggle.checked;

            }


            saveSettings();


            /*
             * Update visible settings
             */

            if (ui.asrMethod) {

                ui.asrMethod.textContent =
                    APP.asrMethod;

            }


            /*
             * Recalculate prayer times
             */

            if (
                STATE.latitude !== null &&
                STATE.longitude !== null
            ) {

                calculatePrayerTimes();

                updateHijriDate();

                updateShipTime();

                startCountdown();

            }


            /*
             * Close Settings
             */

            if (settingsPanel) {

                settingsPanel.classList.remove(
                    "active"
                );

            }


            alert(
                "Settings saved successfully."
            );

        }
    );

}





/* ================================================
   Version 1.3 - Settings Open / Close
================================================ */

function openSettingsPanel() {

    const panel =
        document.getElementById("settingsPanel");

    if (!panel) return;

    panel.classList.add("active");

    loadSettingsIntoUI();

    panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


function closeSettingsPanel() {

    const panel =
        document.getElementById("settingsPanel");

    if (!panel) return;

    panel.classList.remove("active");

}



/* ================================================
   Version 1.3 - Settings Save
================================================ */

function saveSettingsPanel() {

    /* Calculation Method */

    const calculation =
        document.getElementById("calculationSelect");

    if (calculation) {
        APP.calculationMethod =
            calculation.value;
    }


    /* Asr Method */

    const asr =
        document.getElementById("asrSelect");

    if (asr) {
        APP.asrMethod =
            asr.value;
    }


    /* Time Format */

    const timeFormat =
        document.getElementById("timeFormatSelect");

    if (timeFormat) {
        APP.timeFormat =
            Number(timeFormat.value);
    }


    /* Automatic Location */

    const autoLocation =
        document.getElementById("autoLocationToggle");

    if (autoLocation) {
        APP.autoLocation =
            autoLocation.checked;
    }


    /* Save to localStorage */

    localStorage.setItem(
        "salahTimeSettings",
        JSON.stringify(APP)
    );


    /* Update visible Asr method */

    if (ui.asrMethod) {

        ui.asrMethod.textContent =
            APP.asrMethod;

    }


    /* Recalculate prayer times */

    if (
        STATE.latitude !== null &&
        STATE.longitude !== null
    ) {

        calculatePrayerTimes();
       updateQiblaBearing();

        updateHijriDate();

        updateShipTime();

        startCountdown();

    }


    /* Close Settings */

    const panel =
        document.getElementById("settingsPanel");

    if (panel) {

        panel.classList.remove("active");

    }


    alert("Settings saved successfully.");

}


/* ================================================
   Prayer Time Adjustment
   Version 1.3.1
================================================ */

function changePrayerAdjustment(prayer, amount) {

    if (!APP.prayerAdjustment) {

        APP.prayerAdjustment = {
            fajr: 0,
            dhuhr: 0,
            asr: 0,
            maghrib: 0,
            isha: 0
        };

    }

    APP.prayerAdjustment[prayer] =
        Number(APP.prayerAdjustment[prayer] || 0)
        + amount;

    updateAdjustmentDisplay(prayer);

}


/* ================================================
   Adjustment Display
================================================ */

function updateAdjustmentDisplay(prayer) {

    const element =
        document.getElementById(
            "adjust" +
            prayer.charAt(0).toUpperCase() +
            prayer.slice(1)
        );

    if (!element) return;

    const value =
        Number(APP.prayerAdjustment[prayer] || 0);

    element.textContent =
        value > 0
            ? `+${value} min`
            : `${value} min`;

}


/* ================================================
   Load Adjustment Values
================================================ */

function loadAdjustmentSettings() {

    if (!APP.prayerAdjustment) {

        APP.prayerAdjustment = {

            fajr: 0,
            dhuhr: 0,
            asr: 0,
            maghrib: 0,
            isha: 0

        };

    }

    [
        "fajr",
        "dhuhr",
        "asr",
        "maghrib",
        "isha"

    ].forEach(updateAdjustmentDisplay);

}


/* ================================================
   Apply Adjustments
================================================ */

function applyPrayerAdjustments() {

    if (!STATE.prayerTimes) return;

    const adjustments =
        APP.prayerAdjustment || {};

    [
        "fajr",
        "dhuhr",
        "asr",
        "maghrib",
        "isha"

    ].forEach(prayer => {

        const minutes =
            Number(adjustments[prayer]) || 0;

        if (minutes === 0) return;

        STATE.prayerTimes[prayer] =
            new Date(
                STATE.prayerTimes[prayer].getTime()
                +
                minutes * 60000
            );

    });

}



/* ================================================
   Version 1.4 - Qibla Compass
================================================ */

const qiblaPanel =
    document.getElementById("qiblaPanel");

const openQiblaButton =
    document.getElementById("openQibla");

const closeQiblaButton =
    document.getElementById("closeQibla");

const enableCompassButton =
    document.getElementById("enableCompass");

const qiblaBearingDisplay =
    document.getElementById("qiblaBearing");

const currentHeadingDisplay =
    document.getElementById("currentHeading");

const qiblaArrow =
    document.getElementById("qiblaArrow");

const qiblaStatus =
    document.getElementById("qiblaStatus");


let qiblaBearing = null;
let compassEnabled = false;


/* ================================================
   Kaaba Coordinates
================================================ */

const KAABA_LATITUDE =
    21.422487;

const KAABA_LONGITUDE =
    39.826206;


/* ================================================
   Calculate Qibla Bearing
================================================ */

function calculateQiblaBearing() {

    if (
        STATE.latitude === null ||
        STATE.longitude === null
    ) {

        return null;

    }

    const lat1 =
        STATE.latitude * Math.PI / 180;

    const lon1 =
        STATE.longitude * Math.PI / 180;

    const lat2 =
        KAABA_LATITUDE * Math.PI / 180;

    const lon2 =
        KAABA_LONGITUDE * Math.PI / 180;


    const deltaLon =
        lon2 - lon1;


    const y =
        Math.sin(deltaLon) *
        Math.cos(lat2);


    const x =
        Math.cos(lat1) *
        Math.sin(lat2)
        -
        Math.sin(lat1) *
        Math.cos(lat2) *
        Math.cos(deltaLon);


    let bearing =
        Math.atan2(y, x) *
        180 / Math.PI;


    bearing =
        (bearing + 360) % 360;


    return bearing;

}


/* ================================================
   Update Qibla Bearing
================================================ */

function updateQiblaBearing() {

    qiblaBearing =
        calculateQiblaBearing();

    if (qiblaBearing === null) {

        if (qiblaBearingDisplay) {

            qiblaBearingDisplay.textContent =
                "--°";

        }

        return;

    }


    if (qiblaBearingDisplay) {

        qiblaBearingDisplay.textContent =
            `${qiblaBearing.toFixed(1)}°`;

    }

}


/* ================================================
   Open Qibla
================================================ */

if (openQiblaButton) {

    openQiblaButton.addEventListener(
        "click",
        () => {

            if (!qiblaPanel) return;

            qiblaPanel.classList.add("active");

            updateQiblaBearing();

            qiblaPanel.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }
    );

}


/* ================================================
   Close Qibla
================================================ */

if (closeQiblaButton) {

    closeQiblaButton.addEventListener(
        "click",
        () => {

            if (!qiblaPanel) return;

            qiblaPanel.classList.remove("active");

        }
    );

}


/* ================================================
   Compass Permission
================================================ */

async function enableCompass() {

    try {

        if (
            typeof DeviceOrientationEvent !==
            "undefined" &&
            typeof DeviceOrientationEvent
                .requestPermission === "function"
        ) {

            const permission =
                await DeviceOrientationEvent
                    .requestPermission();

            if (permission !== "granted") {

                throw new Error(
                    "Compass permission denied"
                );

            }

        }

        window.addEventListener(
            "deviceorientation",
            handleCompass,
            true
        );

        compassEnabled = true;

       updateCompassStatus();

        if (qiblaStatus) {

            qiblaStatus.textContent =
                "🧭 Compass active";

        }

    }

    catch (error) {

        console.error(error);

        if (qiblaStatus) {

            qiblaStatus.textContent =
                "Compass permission unavailable";

        }

    }

}


/* ================================================
   Compass Heading
================================================ */

function handleCompass(event) {

    let heading = null;


    /* ============================================
       iPhone / iOS Compass
    ============================================ */

    if (
        typeof event.webkitCompassHeading === "number"
    ) {

        heading =
            event.webkitCompassHeading;

    }


    /* ============================================
       Other Devices
    ============================================ */

    else if (
        typeof event.alpha === "number"
    ) {

        heading =
            360 - event.alpha;

    }


    if (heading === null) return;


    heading =
        (heading + 360) % 360;


    /* ============================================
       Display Current Heading
    ============================================ */

    if (currentHeadingDisplay) {

        currentHeadingDisplay.textContent =
            `${heading.toFixed(1)}°`;

    }


    /* ============================================
       Rotate Compass Dial
       
       N / E / S / W will now follow
       the phone's physical orientation.
    ============================================ */

    const compassCircle =
        document.querySelector(".compassCircle");

    if (compassCircle) {

        compassCircle.style.transform =
            `rotate(${-heading}deg)`;

    }


    /* ============================================
       Keep Qibla Arrow Independent
       
       Arrow always points toward Qibla.
    ============================================ */

    /* ============================================
   Qibla Arrow
============================================ */

if (
    qiblaArrow &&
    qiblaBearing !== null
) {

    qiblaArrow.style.transform =
        `rotate(${qiblaBearing}deg)`;

}

}


if (enableCompassButton) {

    enableCompassButton.addEventListener(
        "click",
        enableCompass
    );

}


/* ================================================
   Version 1.5 - System Status
================================================ */

const systemStatusUI = {

    gps:
        document.getElementById("gpsStatus"),

    internet:
        document.getElementById("internetStatus"),

    compass:
        document.getElementById("compassStatus"),

    position:
        document.getElementById("positionStatus")

};


/* ================================================
   Status Helper
================================================ */

function setSystemStatus(element, text, good) {

    if (!element) return;

    element.textContent = text;

    element.classList.remove(
        "statusGood",
        "statusBad",
        "statusChecking"
    );

    element.classList.add(
        good ? "statusGood" : "statusBad"
    );

}


/* ================================================
   GPS / Position
================================================ */

/* ================================================
   GPS System Status - Version 2.2
================================================ */

function updateGPSStatus() {

    // GPS request is running
    if (STATE.gpsRequestInProgress) {

        setSystemStatus(
            systemStatusUI.gps,
            "🟡 Requesting",
            false
        );

        setSystemStatus(
            systemStatusUI.position,
            "🟡 Waiting",
            false
        );

        return;
    }

    // GPS successfully received
    if (STATE.gpsLastSuccess) {

        setSystemStatus(
            systemStatusUI.gps,
            "🟢 Position received",
            true
        );

        setSystemStatus(
            systemStatusUI.position,
            "🟢 Updated",
            true
        );

        return;
    }

    // Saved coordinates are available, but GPS
    // has not successfully updated the position
    if (
        STATE.latitude !== null &&
        STATE.longitude !== null
    ) {

        setSystemStatus(
            systemStatusUI.gps,
            "🟡 Saved position",
            false
        );

        setSystemStatus(
            systemStatusUI.position,
            "🟡 Last known",
            false
        );

        return;
    }

    // No GPS position available
    setSystemStatus(
        systemStatusUI.gps,
        "🔴 Unavailable",
        false
    );

    setSystemStatus(
        systemStatusUI.position,
        "🔴 Not updated",
        false
    );
}


/* ================================================
   Internet
================================================ */

function updateInternetStatus() {

    if (navigator.onLine) {

        setSystemStatus(
            systemStatusUI.internet,
            "🟢 Online",
            true
        );

    }

    else {

        setSystemStatus(
            systemStatusUI.internet,
            "🔴 Offline",
            false
        );

    }

}


/* ================================================
   Compass
================================================ */

function updateCompassStatus() {

    if (compassEnabled) {

        setSystemStatus(
            systemStatusUI.compass,
            "🟢 Available",
            true
        );

        return;

    }


    if (
        typeof DeviceOrientationEvent !==
        "undefined"
    ) {

        setSystemStatus(
            systemStatusUI.compass,
            "🟡 Ready",
            true
        );

    }

    else {

        setSystemStatus(
            systemStatusUI.compass,
            "🔴 Unavailable",
            false
        );

    }

}


/* ================================================
   All Status
================================================ */

function updateSystemStatus() {

    updateGPSStatus();

    updateInternetStatus();

    updateCompassStatus();

}


/* ================================================
   Internet Events
================================================ */

window.addEventListener(
    "online",
    updateInternetStatus
);

window.addEventListener(
    "offline",
    updateInternetStatus
);


/* ================================================
   Initial Status
================================================ */

updateSystemStatus();





/* ================================================
   Service Worker - Offline PWA
================================================ */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("./service-worker.js")
            .then(registration => {

                console.log(
                    "Service Worker registered:",
                    registration.scope
                );

            })
            .catch(error => {

                console.error(
                    "Service Worker registration failed:",
                    error
                );

            });

    });

}













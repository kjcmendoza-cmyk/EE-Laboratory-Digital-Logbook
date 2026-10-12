import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, onSnapshot, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyATXyz4bLskXvDHBAZrlbtg14e1_c12pPo",
    authDomain: "ee-laboratory-digital-logbook.firebaseapp.com",
    projectId: "ee-laboratory-digital-logbook",
    storageBucket: "ee-laboratory-digital-logbook.firebasestorage.app",
    messagingSenderId: "1065618016813",
    appId: "1:1065618016813:web:c579b08fa406ec449946a4",
    measurementId: "G-RT82Q2ZWPZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const checkInView = document.getElementById('checkInView');
const checkOutView = document.getElementById('checkOutView');
const currentPurpose = document.getElementById('currentPurpose');
const checkOutBtn = document.getElementById('checkOutBtn');
const logoutBtn = document.getElementById('logoutBtn');
const notifBanner = document.getElementById('notifBanner');

const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');

const statClass = document.getElementById('statClass');
const statLab = document.getElementById('statLab');
const statReview = document.getElementById('statReview');
const statTotal = document.getElementById('statTotal');

// Modals
const purposeModal = document.getElementById('purposeModal');
const openPurposeModalBtn = document.getElementById('openPurposeModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const confirmCheckInBtn = document.getElementById('confirmCheckInBtn');
const optionCards = document.querySelectorAll('.option-card');

const scheduleModal = document.getElementById('scheduleModal');
const viewScheduleBtn = document.getElementById('viewScheduleBtn');
const closeScheduleModalBtn = document.getElementById('closeScheduleModalBtn');
const scheduleListContainer = document.getElementById('scheduleListContainer');

const closeScheduleIcon = document.getElementById('closeScheduleIcon');
const dayPills = document.querySelectorAll('.day-pill');

// Global state variables
let allSchedules = [];
let selectedDay = getCurrentDayString();
let activeSessionId = null;
let isSystemLocked = false;
let currentUserData = null;

// Cooldown Configuration (60 seconds = 1 minute)
const COOLDOWN_SECONDS = 60;
let cooldownInterval = null;

function getCurrentDayString() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
}

// COOLDOWN LOGIC
function getRemainingCooldownSeconds() {
    if (!currentUserData) return 0;
    const lastAction = localStorage.getItem(`lastActionTime_${currentUserData.uid}`);
    if (!lastAction) return 0;
    const elapsed = Math.floor((Date.now() - parseInt(lastAction, 10)) / 1000);
    const remaining = COOLDOWN_SECONDS - elapsed;
    return remaining > 0 ? remaining : 0;
}

function updateCooldownUI() {
    const remaining = getRemainingCooldownSeconds();
    
    if (remaining > 0) {
        if (activeSessionId) {
            if (checkOutBtn) {
                checkOutBtn.disabled = true;
                checkOutBtn.style.opacity = "0.6";
                checkOutBtn.style.cursor = "not-allowed";
                checkOutBtn.textContent = `CHECK OUT (${remaining}s)`;
            }
        } else {
            if (openPurposeModalBtn && !isSystemLocked) {
                openPurposeModalBtn.disabled = true;
                openPurposeModalBtn.style.opacity = "0.6";
                openPurposeModalBtn.style.cursor = "not-allowed";
                openPurposeModalBtn.textContent = `PLEASE WAIT (${remaining}s)`;
            }
        }
    } else {
        if (checkOutBtn) {
            checkOutBtn.disabled = false;
            checkOutBtn.style.opacity = "1";
            checkOutBtn.style.cursor = "pointer";
            checkOutBtn.textContent = "CHECK OUT";
        }
        if (openPurposeModalBtn && !isSystemLocked) {
            openPurposeModalBtn.disabled = false;
            openPurposeModalBtn.style.opacity = "1";
            openPurposeModalBtn.style.cursor = "pointer";
            openPurposeModalBtn.textContent = "CHECK IN TO LABORATORY";
        }
    }
    return remaining;
}

function startCooldownTicker() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    
    const remaining = updateCooldownUI();
    if (remaining > 0) {
        cooldownInterval = setInterval(() => {
            const rem = updateCooldownUI();
            if (rem <= 0) {
                clearInterval(cooldownInterval);
                cooldownInterval = null;
            }
        }, 1000);
    }
}

// Modal Controls - Check In
if (openPurposeModalBtn) {
    openPurposeModalBtn.addEventListener('click', () => {
        if (isSystemLocked) {
            alert("Check-ins are currently locked by the administrator.");
            return;
        }
        const remaining = getRemainingCooldownSeconds();
        if (remaining > 0) {
            showNotification(`Please wait ${remaining}s before taking action again.`, "notif-red");
            return;
        }
        if (purposeModal) purposeModal.classList.remove('hidden');
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        if (purposeModal) purposeModal.classList.add('hidden');
    });
}

if (purposeModal) {
    purposeModal.addEventListener('click', (e) => {
        if (e.target === purposeModal) {
            purposeModal.classList.add('hidden');
        }
    });
}

// Option card selection logic
optionCards.forEach(card => {
    card.addEventListener('click', () => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
            radio.checked = true;
        }
        optionCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
    });
});

// Modal Controls - Schedule
function closeSchedule() {
    if (scheduleModal) scheduleModal.classList.add('hidden');
}

if (viewScheduleBtn) {
    viewScheduleBtn.addEventListener('click', () => {
        selectedDay = getCurrentDayString();
        updateDayPillsUI();
        renderScheduleTable();
        if (scheduleModal) scheduleModal.classList.remove('hidden');
    });
}

if (closeScheduleModalBtn) closeScheduleModalBtn.addEventListener('click', closeSchedule);
if (closeScheduleIcon) closeScheduleIcon.addEventListener('click', closeSchedule);

if (scheduleModal) {
    scheduleModal.addEventListener('click', (e) => {
        if (e.target === scheduleModal) closeSchedule();
    });
}

dayPills.forEach(pill => {
    pill.addEventListener('click', () => {
        selectedDay = pill.getAttribute('data-day');
        updateDayPillsUI();
        renderScheduleTable();
    });
});

function updateDayPillsUI() {
    dayPills.forEach(pill => {
        if (pill.getAttribute('data-day') === selectedDay) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
}

// Check if a class is currently ongoing
function checkIsOngoing(startTimeStr, endTimeStr, schedDay) {
    const currentDay = getCurrentDayString();
    if (schedDay !== currentDay && schedDay !== currentDay.substring(0, 3)) return false;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const parseMinutes = (timeStr) => {
        if (!timeStr) return 0;
        if (timeStr.includes('AM') || timeStr.includes('PM')) {
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            return hours * 60 + minutes;
        }
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const startTotal = parseMinutes(startTimeStr);
    const endTotal = parseMinutes(endTimeStr);
    
    return currentMinutes >= startTotal && currentMinutes <= endTotal;
}

// Render Schedule Table Content
function renderScheduleTable() {
    if (!scheduleListContainer) return;
    scheduleListContainer.innerHTML = '';
    
    const daySchedules = allSchedules.filter(s => s.day === selectedDay || s.day === selectedDay.substring(0, 3));
    daySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (daySchedules.length === 0) {
        scheduleListContainer.innerHTML = '<div class="empty-state">No class sessions scheduled</div>';
        return;
    }

    const formatTime = (timeStr) => {
        const [h, m] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(h), parseInt(m));
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    daySchedules.forEach(sched => {
        const isOngoing = checkIsOngoing(sched.startTime, sched.endTime, sched.day);
        
        const row = document.createElement('div');
        row.className = `schedule-row ${isOngoing ? 'ongoing' : ''}`;
        
        row.innerHTML = `
            <div class="col-time">${formatTime(sched.startTime)} - ${formatTime(sched.endTime)}</div>
            <div class="col-course">
                <span>${sched.subject}</span>
                ${isOngoing ? '<span class="ongoing-badge"><span class="pulse-dot"></span> ONGOING</span>' : ''}
            </div>
        `;
        scheduleListContainer.appendChild(row);
    });
}

// REAL-TIME: Listen to Schedules
function listenToSchedules() {
    const schedulesRef = collection(db, "schedules");
    onSnapshot(schedulesRef, (snapshot) => {
        allSchedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (scheduleModal && !scheduleModal.classList.contains('hidden')) {
            renderScheduleTable();
        }
    }, (err) => console.error("Schedules listener error:", err));
}

// REAL-TIME: Listen to lab stats for live dashboard updates
function listenToLabStats() {
    const sessionsRef = collection(db, "sessions");
    const q = query(sessionsRef, where("status", "==", "Inside"));
    
    onSnapshot(q, (snapshot) => {
        let classCount = 0;
        let labCount = 0;
        let reviewCount = 0;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.purpose === "Class") classCount++;
            else if (data.purpose === "Laboratory Work") labCount++;
            else if (data.purpose === "Review/Rest") reviewCount++;
        });

        if (statClass) statClass.textContent = classCount;
        if (statLab) statLab.textContent = labCount;
        if (statReview) statReview.textContent = reviewCount;
        if (statTotal) statTotal.textContent = `${snapshot.size} / 24`;
    }, (err) => console.error("Lab stats listener error:", err));
}

// REAL-TIME: Listen to current user's session status
function listenToUserStatus(uid) {
    const sessionsRef = collection(db, "sessions");
    const q = query(sessionsRef, where("uid", "==", uid), where("status", "==", "Inside"), limit(1));
    
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const sessionDoc = snapshot.docs[0];
            activeSessionId = sessionDoc.id;
            if (currentPurpose) currentPurpose.textContent = sessionDoc.data().purpose || "--";
            
            if (statusBadge) statusBadge.classList.add('inside');
            if (statusText) statusText.textContent = "CHECKED IN";
            if (checkInView) checkInView.classList.add('hidden');
            if (checkOutView) checkOutView.classList.remove('hidden');
        } else {
            activeSessionId = null;
            if (statusBadge) statusBadge.classList.remove('inside');
            if (statusText) statusText.textContent = "CHECKED OUT";
            if (checkOutView) checkOutView.classList.add('hidden');
            if (checkInView) checkInView.classList.remove('hidden');
        }
        startCooldownTicker();
    }, (err) => console.error("User status listener error:", err));
}

// REAL-TIME: Listen for admin lock status
function listenToSystemLock() {
    const systemStatusRef = doc(db, "settings", "systemStatus");
    onSnapshot(systemStatusRef, (docSnap) => {
        isSystemLocked = docSnap.exists() && docSnap.data().isLocked;
        
        if (openPurposeModalBtn) {
            if (isSystemLocked) {
                openPurposeModalBtn.textContent = "🔒 CHECK-INS TEMPORARILY LOCKED";
                openPurposeModalBtn.style.backgroundColor = "#94a3b8";
                openPurposeModalBtn.style.cursor = "not-allowed";
                openPurposeModalBtn.disabled = true;
                if (purposeModal) purposeModal.classList.add('hidden');
            } else {
                openPurposeModalBtn.style.backgroundColor = "";
                openPurposeModalBtn.disabled = false;
                updateCooldownUI();
            }
        }
    }, (err) => console.error("System lock listener error:", err));
}

// REAL-TIME: Listen for operating hours
function listenToOperatingHours() {
    const hoursRef = doc(db, "settings", "operatingHours");
    onSnapshot(hoursRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        if (data.open && data.close) {
            const formatTime = (timeStr) => {
                const [h, m] = timeStr.split(':');
                const date = new Date();
                date.setHours(parseInt(h), parseInt(m));
                return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            };
            const operatingHoursText = document.getElementById('operatingHoursText');
            if (operatingHoursText) {
                operatingHoursText.textContent = `${formatTime(data.open)} – ${formatTime(data.close)}`;
            }
        }
    }, (err) => console.error("Operating hours listener error:", err));
}

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserData = user;
        const fallbackName = user.email ? user.email.split('@')[0] : "Student";
        const displayName = user.displayName || fallbackName;

        if (userName) userName.textContent = `Hello, ${displayName}!`;
        if (userInfo) userInfo.textContent = user.email || "Logged In";

        if (userAvatar) {
            const initials = displayName.substring(0, 2).toUpperCase();
            userAvatar.textContent = initials;
        }

        listenToUserStatus(user.uid);
        listenToLabStats();
        listenToSystemLock();
        listenToOperatingHours();
        listenToSchedules();
    } else {
        window.location.href = 'login.html';
    }
});

// Check-In Action
if (confirmCheckInBtn) {
    confirmCheckInBtn.addEventListener('click', async () => {
        if (!currentUserData) {
            alert("User profile is still initializing. Please try again in a moment.");
            return;
        }

        if (isSystemLocked) {
            alert("Check-ins are currently locked by the administrator.");
            if (purposeModal) purposeModal.classList.add('hidden');
            return;
        }

        const remaining = getRemainingCooldownSeconds();
        if (remaining > 0) {
            showNotification(`Please wait ${remaining}s before checking in again.`, "notif-red");
            if (purposeModal) purposeModal.classList.add('hidden');
            return;
        }

        const selectedRadio = document.querySelector('input[name="labPurpose"]:checked');
        if (!selectedRadio) {
            alert("Please select a purpose.");
            return;
        }
        const purpose = selectedRadio.value;

        try {
            confirmCheckInBtn.disabled = true;
            const sessionData = {
                uid: currentUserData.uid,
                email: currentUserData.email || "",
                name: currentUserData.displayName || (currentUserData.email ? currentUserData.email.split('@')[0] : "Student"),
                purpose: purpose,
                status: "Inside",
                checkInTime: serverTimestamp()
            };
            
            await addDoc(collection(db, "sessions"), sessionData);
            
            // Record timestamp for 1 min cooldown
            localStorage.setItem(`lastActionTime_${currentUserData.uid}`, Date.now().toString());
            
            showNotification("Checked In Successfully", "notif-green");
            if (purposeModal) purposeModal.classList.add('hidden');
            
            startCooldownTicker();
        } catch (error) {
            console.error("Check-in error:", error);
            alert("Error checking in. Please check your connection.");
        } finally {
            confirmCheckInBtn.disabled = false;
        }
    });
}

// Check-Out Action
if (checkOutBtn) {
    checkOutBtn.addEventListener('click', async () => {
        if (!activeSessionId) {
            alert("No active session found to check out.");
            return;
        }

        const remaining = getRemainingCooldownSeconds();
        if (remaining > 0) {
            showNotification(`Please wait ${remaining}s before checking out again.`, "notif-red");
            return;
        }

        try {
            checkOutBtn.disabled = true;
            const sessionRef = doc(db, "sessions", activeSessionId);
            await updateDoc(sessionRef, {
                status: "Out",
                checkOutTime: serverTimestamp()
            });

            // Record timestamp for 1 min cooldown
            localStorage.setItem(`lastActionTime_${currentUserData.uid}`, Date.now().toString());

            showNotification("Checked Out Successfully", "notif-red");
            startCooldownTicker();
        } catch (error) {
            console.error("Check-out error:", error);
            alert("Error checking out.");
        } finally {
            checkOutBtn.disabled = false;
        }
    });
}

function showNotification(msg, colorClass) {
    if (!notifBanner) return;
    notifBanner.textContent = msg;
    notifBanner.className = `notification ${colorClass} show-notif`;
    setTimeout(() => {
        notifBanner.classList.remove('show-notif');
    }, 2500);
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
}
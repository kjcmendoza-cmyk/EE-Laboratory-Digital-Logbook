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

// Global schedule variables
let allSchedules = [];
let selectedDay = getCurrentDayString();

function getCurrentDayString() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
}

let activeSessionId = null;
let isSystemLocked = false;
let currentUserData = null;

// Modal Controls - Check In
if (openPurposeModalBtn) {
    openPurposeModalBtn.addEventListener('click', () => {
        if (isSystemLocked) {
            alert("Check-ins are currently locked by the administrator.");
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

// Fixed option card selection logic
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

// Fixed Day Pill Logic (uses element reference instead of e.target)
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
    if (schedDay !== getCurrentDayString()) return false;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    
    const [endH, endM] = endTimeStr.split(':').map(Number);
    const endTotal = endH * 60 + endM;
    
    return currentMinutes >= startTotal && currentMinutes <= endTotal;
}

// Render the Table Content
function renderScheduleTable() {
    if (!scheduleListContainer) return;
    scheduleListContainer.innerHTML = '';
    
    const daySchedules = allSchedules.filter(s => s.day === selectedDay);
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
            <div class="col-time">
                ${formatTime(sched.startTime)} -<br>${formatTime(sched.endTime)}
            </div>
            <div class="col-course">
                <span>${sched.subject}</span>
                ${isOngoing ? '<span class="ongoing-badge">ONGOING</span>' : ''}
            </div>
        `;
        scheduleListContainer.appendChild(row);
    });
}

// REAL-TIME: Listen to Schedules added by Admin
function listenToSchedules() {
    const schedulesRef = collection(db, "schedules");
    onSnapshot(schedulesRef, (snapshot) => {
        allSchedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (scheduleModal && !scheduleModal.classList.contains('hidden')) {
            renderScheduleTable();
        }
    }, (err) => console.error("Schedules listener error:", err));
}

// REAL-TIME: Listen to all lab stats for live dashboard updates
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
    }, (err) => console.error("User status listener error:", err));
}

// REAL-TIME: Listen for admin lock status (Does not hard-disable DOM button)
function listenToSystemLock() {
    const systemStatusRef = doc(db, "settings", "systemStatus");
    onSnapshot(systemStatusRef, (docSnap) => {
        isSystemLocked = docSnap.exists() && docSnap.data().isLocked;
        
        if (openPurposeModalBtn) {
            if (isSystemLocked) {
                openPurposeModalBtn.textContent = "🔒 CHECK-INS TEMPORARILY LOCKED";
                openPurposeModalBtn.style.backgroundColor = "#94a3b8";
                openPurposeModalBtn.style.cursor = "not-allowed";
                if (purposeModal) purposeModal.classList.add('hidden');
            } else {
                openPurposeModalBtn.textContent = "CHECK IN TO LABORATORY";
                openPurposeModalBtn.style.backgroundColor = "";
                openPurposeModalBtn.style.cursor = "";
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

// Auth State Listener - Initializes real-time listeners only after user is verified
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

        // Initialize real-time data after authentication
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

        const selectedRadio = document.querySelector('input[name="labPurpose"]:checked');
        if (!selectedRadio) {
            alert("Please select a purpose.");
            return;
        }
        const purpose = selectedRadio.value;

        try {
            const sessionData = {
                uid: currentUserData.uid,
                email: currentUserData.email || "",
                name: currentUserData.displayName || (currentUserData.email ? currentUserData.email.split('@')[0] : "Student"),
                purpose: purpose,
                status: "Inside",
                checkInTime: serverTimestamp()
            };
            
            await addDoc(collection(db, "sessions"), sessionData);
            showNotification("Checked In Successfully", "notif-green");
            if (purposeModal) purposeModal.classList.add('hidden');
        } catch (error) {
            console.error("Check-in error:", error);
            alert("Error checking in. Please check your connection.");
        }
    });
}

// Check-Out Action with Feedback
if (checkOutBtn) {
    checkOutBtn.addEventListener('click', async () => {
        if (!activeSessionId) {
            alert("No active session found to check out.");
            return;
        }
        try {
            const sessionRef = doc(db, "sessions", activeSessionId);
            await updateDoc(sessionRef, {
                status: "Out",
                checkOutTime: serverTimestamp()
            });
            showNotification("Checked Out Successfully", "notif-red");
        } catch (error) {
            console.error("Check-out error:", error);
            alert("Error checking out.");
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
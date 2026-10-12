import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, onSnapshot, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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

const purposeModal = document.getElementById('purposeModal');
const openPurposeModalBtn = document.getElementById('openPurposeModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const confirmCheckInBtn = document.getElementById('confirmCheckInBtn');
const optionCards = document.querySelectorAll('.option-card');

let activeSessionId = null;
let isSystemLocked = false;
let currentUserData = null;

// Modal Trigger Control
openPurposeModalBtn.addEventListener('click', () => {
    purposeModal.classList.remove('hidden');
});
closeModalBtn.addEventListener('click', () => {
    purposeModal.classList.add('hidden');
});
purposeModal.addEventListener('click', (e) => {
    if (e.target === purposeModal) {
        purposeModal.classList.add('hidden');
    }
});
optionCards.forEach(card => {
    card.addEventListener('click', () => {
        optionCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    });
});

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
    });
}

// REAL-TIME: Listen to current user's session status (Updates UI instantly if Admin forces checkout)
function listenToUserStatus(uid) {
    const sessionsRef = collection(db, "sessions");
    const q = query(sessionsRef, where("uid", "==", uid), where("status", "==", "Inside"), limit(1));
    
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const sessionDoc = snapshot.docs[0];
            activeSessionId = sessionDoc.id;
            currentPurpose.textContent = sessionDoc.data().purpose;
            
            statusBadge.classList.add('inside');
            statusText.textContent = "CHECKED IN";
            checkInView.classList.add('hidden');
            checkOutView.classList.remove('hidden');
        } else {
            activeSessionId = null;
            statusBadge.classList.remove('inside');
            statusText.textContent = "CHECKED OUT";
            checkOutView.classList.add('hidden');
            checkInView.classList.remove('hidden');
        }
    });
}

// REAL-TIME: Listen for admin lock status
function listenToSystemLock() {
    const systemStatusRef = doc(db, "settings", "systemStatus");
    onSnapshot(systemStatusRef, (docSnap) => {
        isSystemLocked = docSnap.exists() && docSnap.data().isLocked;
        
        if (isSystemLocked) {
            openPurposeModalBtn.disabled = true;
            openPurposeModalBtn.textContent = "🔒 CHECK-INS TEMPORARILY LOCKED";
            openPurposeModalBtn.style.backgroundColor = "#94a3b8";
            openPurposeModalBtn.style.cursor = "not-allowed";
        } else {
            openPurposeModalBtn.disabled = false;
            openPurposeModalBtn.textContent = "CHECK IN TO LABORATORY";
            openPurposeModalBtn.style.backgroundColor = "";
            openPurposeModalBtn.style.cursor = "";
        }
    });
}

// Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserData = user;
        const displayName = user.displayName || user.email.split('@')[0];
        userName.textContent = `Hello, ${displayName}!`;
        userInfo.textContent = user.email;

        const initials = displayName.substring(0, 2).toUpperCase();
        userAvatar.textContent = initials;

        // Initialize real-time listeners
        listenToUserStatus(user.uid);
        listenToLabStats();
        listenToSystemLock();
    } else {
        window.location.href = 'login.html';
    }
});

// Check-In Action
confirmCheckInBtn.addEventListener('click', async () => {
    if (isSystemLocked) {
        alert("Check-ins are currently locked by the administrator.");
        purposeModal.classList.add('hidden');
        return;
    }

    const selectedRadio = document.querySelector('input[name="labPurpose"]:checked');

    try {
        const sessionData = {
            uid: currentUserData.uid,
            email: currentUserData.email,
            name: currentUserData.displayName || currentUserData.email,
            purpose: purpose,
            status: "Inside", // Standardized String
            checkInTime: serverTimestamp()
        };
        
        await addDoc(collection(db, "sessions"), sessionData);
        
        showNotification("Checked In Successfully", "notif-green");
        purposeModal.classList.add('hidden');
        
    } catch (error) {
        console.error("Check-in error:", error);
        alert("Error checking in. Please check your connection.");
    }
});

// Check-Out Action
checkOutBtn.addEventListener('click', async () => {
    if (!activeSessionId) return;
    
    try {
        const sessionRef = doc(db, "sessions", activeSessionId);
        await updateDoc(sessionRef, {
            status: "Out", // Standardized String matching admin
            checkOutTime: serverTimestamp()
        });
        
        showNotification("Checked Out Successfully", "notif-red");
        
    } catch (error) {
        console.error("Check-out error:", error);
        alert("Error checking out.");
    }
});

function showNotification(msg, colorClass) {
    notifBanner.textContent = msg;
    notifBanner.className = `notification ${colorClass} show-notif`;
    setTimeout(() => {
        notifBanner.classList.remove('show-notif');
    }, 2500);
}

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});
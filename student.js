import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// Integrated Firebase Configuration
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

// Modal Elements
const purposeModal = document.getElementById('purposeModal');
const openPurposeModalBtn = document.getElementById('openPurposeModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const purposeBtns = document.querySelectorAll('.btn-purpose');

let activeSessionId = null;
let currentUserData = null;

// Modal Trigger Control
openPurposeModalBtn.addEventListener('click', () => {
    purposeModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    purposeModal.classList.add('hidden');
});

// Close modal if clicking outside modal box
purposeModal.addEventListener('click', (e) => {
    if (e.target === purposeModal) {
        purposeModal.classList.add('hidden');
    }
});

// Authentication State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserData = user;
        const displayName = user.displayName || user.email.split('@')[0];
        userName.textContent = `Hello, ${displayName}!`;
        userInfo.textContent = user.email;

        // Generate Avatar Initials
        const initials = displayName.substring(0, 2).toUpperCase();
        userAvatar.textContent = initials;

        checkCurrentStatus(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

// Smart UI: Check if student is inside
async function checkCurrentStatus(uid) {
    const sessionsRef = collection(db, "sessions");
    const q = query(sessionsRef, where("uid", "==", uid), where("status", "==", "Inside"), limit(1));
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        // User is Inside
        const sessionDoc = querySnapshot.docs[0];
        activeSessionId = sessionDoc.id;
        currentPurpose.textContent = sessionDoc.data().purpose;
        
        statusBadge.classList.add('inside');
        statusText.textContent = "CHECKED IN";
        checkInView.classList.add('hidden');
        checkOutView.classList.remove('hidden');
    } else {
        // User is Outside
        statusBadge.classList.remove('inside');
        statusText.textContent = "CHECKED OUT";
        checkOutView.classList.add('hidden');
        checkInView.classList.remove('hidden');
    }
}

// Handle Check-In via Modal Buttons
purposeBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const purpose = e.currentTarget.getAttribute('data-purpose');
        try {
            const sessionData = {
                uid: currentUserData.uid,
                email: currentUserData.email,
                name: currentUserData.displayName || currentUserData.email,
                purpose: purpose,
                status: "Inside",
                checkInTime: serverTimestamp()
            };
            
            const docRef = await addDoc(collection(db, "sessions"), sessionData);
            activeSessionId = docRef.id;
            
            showNotification("Checked In Successfully", "notif-green");
            
            // Close Modal & Switch UI
            purposeModal.classList.add('hidden');
            currentPurpose.textContent = purpose;
            
            statusBadge.classList.add('inside');
            statusText.textContent = "CHECKED IN";
            
            checkInView.classList.add('hidden');
            checkOutView.classList.remove('hidden');
            
        } catch (error) {
            console.error("Check-in error:", error);
            alert("Error checking in. Please check your connection.");
        }
    });
});

// Handle Check-Out
checkOutBtn.addEventListener('click', async () => {
    if (!activeSessionId) return;
    
    try {
        const sessionRef = doc(db, "sessions", activeSessionId);
        await updateDoc(sessionRef, {
            status: "Checked Out",
            checkOutTime: serverTimestamp()
        });
        
        activeSessionId = null;
        showNotification("Checked Out Successfully", "notif-red");
        
        // Switch UI Context
        statusBadge.classList.remove('inside');
        statusText.textContent = "CHECKED OUT";
        
        checkOutView.classList.add('hidden');
        checkInView.classList.remove('hidden');
        
    } catch (error) {
        console.error("Check-out error:", error);
        alert("Error checking out.");
    }
});

// Flash notification helper
function showNotification(msg, colorClass) {
    notifBanner.textContent = msg;
    notifBanner.className = `notification ${colorClass} show-notif`;
    setTimeout(() => {
        notifBanner.classList.remove('show-notif');
    }, 2500);
}

// Handle Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});
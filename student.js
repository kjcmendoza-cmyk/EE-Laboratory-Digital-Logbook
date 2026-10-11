import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// Integrated Firebase Configuration from provided screenshot
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
const checkInView = document.getElementById('checkInView');
const checkOutView = document.getElementById('checkOutView');
const currentPurpose = document.getElementById('currentPurpose');
const checkOutBtn = document.getElementById('checkOutBtn');
const logoutBtn = document.getElementById('logoutBtn');
const notifBanner = document.getElementById('notifBanner');
const purposeBtns = document.querySelectorAll('.btn-purpose');

let activeSessionId = null;
let currentUserData = null;

// Authentication State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userInfo.textContent = `Logged in as: ${user.email}`;
        currentUserData = user;
        checkCurrentStatus(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

// Smart UI: Check if student is already inside
async function checkCurrentStatus(uid) {
    const sessionsRef = collection(db, "sessions");
    const q = query(sessionsRef, where("uid", "==", uid), where("status", "==", "Inside"), limit(1));
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        // User is Inside
        const sessionDoc = querySnapshot.docs[0];
        activeSessionId = sessionDoc.id;
        currentPurpose.textContent = sessionDoc.data().purpose;
        
        checkInView.classList.add('hidden');
        checkOutView.classList.remove('hidden');
    } else {
        // User is Outside
        checkOutView.classList.add('hidden');
        checkInView.classList.remove('hidden');
    }
}

// Handle Check-In
purposeBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const purpose = e.target.getAttribute('data-purpose');
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
            
            // Switch UI Context
            currentPurpose.textContent = purpose;
            checkInView.classList.add('hidden');
            checkOutView.classList.remove('hidden');
            
        } catch (error) {
            console.error("Check-in error:", error);
            alert("Error checking in. Please check connection.");
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
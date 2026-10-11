import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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
const rosterBody = document.getElementById('rosterBody');
const headcountDisplay = document.getElementById('headcount');
const logoutBtn = document.getElementById('logoutBtn');

// Security: Ensure only logged-in users see this
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    }
});

// 1. REAL-TIME LIVE ROSTER (onSnapshot)
const sessionsRef = collection(db, "sessions");
const activeSessionsQuery = query(sessionsRef, where("status", "==", "Inside"));

onSnapshot(activeSessionsQuery, (snapshot) => {
    rosterBody.innerHTML = ''; // Clear table
    
    // 2. LIVE HEADCOUNT
    headcountDisplay.textContent = snapshot.size;

    if (snapshot.empty) {
        rosterBody.innerHTML = `<tr><td colspan="5" class="empty-state">The laboratory is currently empty.</td></tr>`;
        return;
    }

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const sessionId = docSnap.id;
        
        // Format Timestamp (handles cases where serverTimestamp hasn't resolved locally yet)
        let timeString = "Just now";
        if (data.checkInTime) {
            const date = data.checkInTime.toDate();
            timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // Construct Row
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${data.name}</strong></td>
            <td>${data.email}</td>
            <td>${timeString}</td>
            <td><span class="badge">${data.purpose}</span></td>
            <td>
                <button class="btn-override" data-id="${sessionId}">Force Check-Out</button>
            </td>
        `;
        rosterBody.appendChild(tr);
    });

    // Attach event listeners to newly created override buttons
    document.querySelectorAll('.btn-override').forEach(button => {
        button.addEventListener('click', handleManualOverride);
    });
});

// 3. MANUAL OVERRIDE CHECK-OUT
async function handleManualOverride(e) {
    const sessionId = e.target.getAttribute('data-id');
    const confirmAction = confirm("Are you sure you want to manually check out this student?");
    
    if (confirmAction) {
        try {
            const sessionRef = doc(db, "sessions", sessionId);
            await updateDoc(sessionRef, {
                status: "Checked Out",
                checkOutTime: serverTimestamp(),
                overrideByAdmin: true // Audit trail for forced checkouts
            });
        } catch (error) {
            console.error("Error during manual override:", error);
            alert("Failed to check out student. Please try again.");
        }
    }
}

// Handle Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});
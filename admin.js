import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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

const rosterBody = document.getElementById('rosterBody');
const logoutBtn = document.getElementById('logoutBtn');
const saveHoursBtn = document.getElementById('saveHoursBtn');

const mClass = document.getElementById('metric-class');
const mLab = document.getElementById('metric-lab');
const mReview = document.getElementById('metric-review');
const mOccupants = document.getElementById('metric-occupants');
const mLogsToday = document.getElementById('metric-logs');
const mRegistered = document.getElementById('metric-registered');

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    }
});

function getPurposeClass(purpose) {
    if (purpose === 'Class') return 'class';
    if (purpose === 'Laboratory Work') return 'lab';
    if (purpose === 'Review/Rest') return 'review';
    return '';
}

const sessionsRef = collection(db, "sessions");

onSnapshot(sessionsRef, (snapshot) => {
    rosterBody.innerHTML = ''; 
    
    let activeClass = 0, activeLab = 0, activeReview = 0;
    let totalOccupants = 0;
    let logsToday = 0;
    
    const todayStr = new Date().toISOString().split('T')[0];

    // Sort to show active occupants first, or based on timestamp
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    docs.sort((a, b) => (b.checkInTime?.toMillis() || 0) - (a.checkInTime?.toMillis() || 0));

    docs.forEach((data) => {
        const sessionId = data.id;
        
        let checkInStr = "—";
        let checkOutStr = "—";
        let dateStr = "—";
        
        if (data.checkInTime) {
            const d = data.checkInTime.toDate();
            checkInStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            dateStr = d.toISOString().split('T')[0];
        }
        if (data.checkOutTime) {
            const d = data.checkOutTime.toDate();
            checkOutStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const isToday = (dateStr === todayStr);
        if (isToday) logsToday++;

        const isInside = data.status === "Inside";
        
        if (isInside) {
            totalOccupants++;
            if (data.purpose === 'Class') activeClass++;
            if (data.purpose === 'Laboratory Work') activeLab++;
            if (data.purpose === 'Review/Rest') activeReview++;
        }

        const statusHTML = isInside 
            ? `<span class="status in">IN LAB</span>` 
            : `<span class="status out">OUT</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${data.name}</strong></td>
            <td>${data.email}</td>
            <td>${data.course || 'BS EE'}</td>
            <td>${data.yearLevel || 'N/A'}</td>
            <td><span class="badge ${getPurposeClass(data.purpose)}">${data.purpose}</span></td>
            <td>${checkInStr}</td>
            <td>${checkOutStr}</td>
            <td>${statusHTML}</td>
            <td>
                ${isInside ? `<button class="btn-edit btn-override" data-id="${sessionId}">Checkout</button>` : `<button class="btn-edit">Edit</button>`}
            </td>
        `;
        rosterBody.appendChild(tr);
    });

    mClass.textContent = activeClass;
    mLab.textContent = activeLab;
    mReview.textContent = activeReview;
    mOccupants.textContent = totalOccupants;
    mLogsToday.textContent = logsToday;

    document.querySelectorAll('.btn-override').forEach(button => {
        button.addEventListener('click', handleManualOverride);
    });
});

async function fetchRegisteredCount() {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    mRegistered.textContent = snapshot.size;
}
fetchRegisteredCount();

async function handleManualOverride(e) {
    const sessionId = e.target.getAttribute('data-id');
    const confirmAction = confirm("Force checkout this student? Their app UI will instantly update.");
    
    if (confirmAction) {
        try {
            const sessionRef = doc(db, "sessions", sessionId);
            await updateDoc(sessionRef, {
                status: "Out",
                checkOutTime: serverTimestamp(),
                overrideByAdmin: true 
            });
        } catch (error) {
            console.error("Error during manual override:", error);
            alert("Failed to check out student.");
        }
    }
}

saveHoursBtn.addEventListener('click', async () => {
    const openTime = document.getElementById('openTime').value;
    const closeTime = document.getElementById('closeTime').value;
    
    try {
        const settingsRef = doc(db, "settings", "operatingHours");
        await updateDoc(settingsRef, {
            open: openTime,
            close: closeTime,
            updatedAt: serverTimestamp()
        });
        alert("Operating hours saved successfully.");
    } catch (error) {
        console.error("Error saving hours:", error);
        alert("Failed to save operating hours. Make sure the document exists.");
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});
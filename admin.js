import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, updateDoc, doc, query, where, onSnapshot, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Applied configuration from image_c539df.png
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

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ hd: "addu.edu.ph" });

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const rosterBody = document.getElementById('roster-body');
const liveHeadcount = document.getElementById('live-headcount');
let unsubscribeSnapshot = null;

// --- AUTH LOGIC ---
document.getElementById('login-btn').addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { console.error(error); }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (!user.email.endsWith('@addu.edu.ph')) {
            document.getElementById('login-error').innerText = "Access denied. Ateneo email required.";
            await signOut(auth);
            return;
        }
        
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        document.getElementById('admin-name').innerText = user.displayName;
        
        startLiveListener();
    } else {
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        if (unsubscribeSnapshot) unsubscribeSnapshot(); 
    }
});

// --- REAL-TIME LISTENER (onSnapshot) ---
function startLiveListener() {
    const q = query(
        collection(db, "sessions"), 
        where("status", "==", "Inside"),
        orderBy("timeIn", "desc") 
    );

    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        rosterBody.innerHTML = ""; 
        liveHeadcount.innerText = snapshot.size; 

        if (snapshot.empty) {
            rosterBody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:#999;'>No students currently inside.</td></tr>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const sessionId = docSnap.id;
            
            let timeString = "Just now";
            if (data.timeIn && data.timeIn.toDate) {
                timeString = data.timeIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            let badgeClass = "rest";
            if (data.purpose === "Laboratory Work") badgeClass = "lab";
            if (data.purpose === "Class") badgeClass = "class";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: 500;">${data.name}</td>
                <td style="color: #666; font-size: 14px;">${data.email}</td>
                <td style="font-weight: 500;">${timeString}</td>
                <td><span class="badge ${badgeClass}">${data.purpose}</span></td>
                <td><button class="btn-override" data-id="${sessionId}">Force Check-Out</button></td>
            `;
            rosterBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-override').forEach(btn => {
            btn.addEventListener('click', forceCheckout);
        });
    });
}

// --- MANUAL OVERRIDE LOGIC ---
async function forceCheckout(e) {
    const sessionId = e.target.getAttribute('data-id');
    const confirmAction = confirm("Are you sure you want to force check-out this student?");
    
    if (confirmAction) {
        try {
            const sessionRef = doc(db, "sessions", sessionId);
            await updateDoc(sessionRef, {
                timeOut: serverTimestamp(),
                status: "Checked Out",
                override: true 
            });
        } catch (error) {
            console.error("Error forcing check-out: ", error);
            alert("Failed to check out student. Check permissions.");
        }
    }
}
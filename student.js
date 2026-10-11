// ... (Keep your existing Firebase imports and initialization here) ...

// DOM Elements for Dashboard[cite: 1]
const studentName = document.getElementById('student-name');
const toastMsg = document.getElementById('toast-msg');
const preCheckinBtn = document.getElementById('pre-checkin-btn');
const checkoutBtn = document.getElementById('checkout-btn');
const statusDisplay = document.getElementById('status-display');
const purposeModal = document.getElementById('purpose-modal');

let activeSessionId = null;[cite: 1]

// --- AUTH PROTECTOR ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        studentName.innerText = user.displayName.split(' ')[0]; // Shows first name[cite: 1]
        checkCurrentStatus(user);[cite: 1]
    } else {
        // Redirect to login if not authenticated
        window.location.href = "login.html";
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));[cite: 1]

// --- CONTEXT-AWARE SMART UI ---[cite: 1]
async function checkCurrentStatus(user) {
    const q = query(
        collection(db, "sessions"), 
        where("email", "==", user.email),
        where("status", "==", "Inside")
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        // Student is inside
        activeSessionId = querySnapshot.docs[0].id;
        preCheckinBtn.classList.add('hidden');
        checkoutBtn.classList.remove('hidden');
        statusDisplay.innerText = "● CURRENTLY INSIDE";
        statusDisplay.style.color = "#48BB78"; 
        statusDisplay.style.backgroundColor = "#E6FFFA";
    } else {
        // Student is outside
        activeSessionId = null;
        checkoutBtn.classList.add('hidden');
        preCheckinBtn.classList.remove('hidden');
        statusDisplay.innerText = "● CHECKED OUT";
        statusDisplay.style.color = "var(--text-muted)";
        statusDisplay.style.backgroundColor = "#EDF2F7";
    }
}

// --- MODAL LOGIC ---[cite: 1]
preCheckinBtn.addEventListener('click', () => {
    purposeModal.classList.remove('hidden');
});

document.getElementById('close-modal-btn').addEventListener('click', () => {
    purposeModal.classList.add('hidden');
});

// --- CHECK-IN LOGIC ---[cite: 1]
document.querySelectorAll('.purpose-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const purpose = e.target.getAttribute('data-purpose');
        const user = auth.currentUser;
        
        if (!user) return;

        try {
            await addDoc(collection(db, "sessions"), {
                name: user.displayName,
                email: user.email,
                purpose: purpose,
                timeIn: serverTimestamp(),
                timeOut: null,
                status: "Inside"
            });
            
            showToast("Checked In Successfully!", "green");
            purposeModal.classList.add('hidden');
            checkCurrentStatus(user);
        } catch (error) {
            console.error("Error checking in: ", error);
        }
    });
});

// --- CHECK-OUT LOGIC ---[cite: 1]
checkoutBtn.addEventListener('click', async () => {
    if (!activeSessionId) return;

    try {
        const sessionRef = doc(db, "sessions", activeSessionId);
        await updateDoc(sessionRef, {
            timeOut: serverTimestamp(),
            status: "Checked Out"
        });

        showToast("Checked Out!", "red");
        checkCurrentStatus(auth.currentUser);
    } catch (error) {
        console.error("Error checking out: ", error);
    }
});

// --- INSTANT VISUAL CONFIRMATION ---[cite: 1]
function showToast(message, colorClass) {
    toastMsg.innerText = message;
    toastMsg.className = `toast ${colorClass}`;
    setTimeout(() => {
        toastMsg.className = 'toast hidden';
    }, 2500);
}

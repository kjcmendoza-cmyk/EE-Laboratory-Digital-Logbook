import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, getDocs, deleteDoc, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const schedulesRef = collection(db, "schedules");

// Filter Elements
const searchInput = document.getElementById('searchInput');
const filterCourse = document.getElementById('filterCourse');
const filterYear = document.getElementById('filterYear');
const filterStatus = document.getElementById('filterStatus');
const filterPurpose = document.getElementById('filterPurpose');
const filterDate = document.getElementById('filterDate');

let allSessionDocs = []; 

[searchInput, filterCourse, filterYear, filterStatus, filterPurpose, filterDate].forEach(el => {
    if (el) el.addEventListener('input', renderTable);
});

onSnapshot(sessionsRef, (snapshot) => {
    allSessionDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderTable();
});

function renderTable() {
    if (!rosterBody) return;
    rosterBody.innerHTML = ''; 
    
    let activeClass = 0, activeLab = 0, activeReview = 0;
    let totalOccupants = 0, logsToday = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const courseVal = filterCourse ? filterCourse.value : 'all';
    const yearVal = filterYear ? filterYear.value : 'all';
    const statusVal = filterStatus ? filterStatus.value : 'all';
    const purposeVal = filterPurpose ? filterPurpose.value : 'all';
    const dateVal = filterDate ? filterDate.value : '';

    let filteredDocs = allSessionDocs.sort((a, b) => (b.checkInTime?.toMillis() || 0) - (a.checkInTime?.toMillis() || 0));

    filteredDocs.forEach((data) => {
        let dateStr = data.checkInTime ? data.checkInTime.toDate().toISOString().split('T')[0] : "—";
        const isToday = (dateStr === todayStr);
        const isInside = data.status === "Inside";

        if (isToday) logsToday++;
        if (isInside) {
            totalOccupants++;
            if (data.purpose === 'Class') activeClass++;
            if (data.purpose === 'Laboratory Work') activeLab++;
            if (data.purpose === 'Review/Rest') activeReview++;
        }

        if (searchTerm && !data.name?.toLowerCase().includes(searchTerm) && !data.email?.toLowerCase().includes(searchTerm)) return;
        if (courseVal !== 'all' && (data.course || 'BS EE') !== courseVal) return;
        if (yearVal !== 'all' && (data.yearLevel || 'N/A') !== yearVal) return;
        if (statusVal !== 'all' && data.status !== statusVal) return;
        if (purposeVal !== 'all' && data.purpose !== purposeVal) return;
        if (dateVal && dateStr !== dateVal) return;

        let checkInStr = data.checkInTime ? data.checkInTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
        let checkOutStr = data.checkOutTime ? data.checkOutTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
        
        const statusHTML = isInside ? `<span class="status in">IN LAB</span>` : `<span class="status out">OUT</span>`;

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
                ${isInside ? `<button class="btn-edit btn-override" data-id="${data.id}">Checkout</button>` : `<button class="btn-edit">Edit</button>`}
            </td>
        `;
        rosterBody.appendChild(tr);
    });

    if (mClass) mClass.textContent = activeClass;
    if (mLab) mLab.textContent = activeLab;
    if (mReview) mReview.textContent = activeReview;
    if (mOccupants) mOccupants.textContent = totalOccupants;
    if (mLogsToday) mLogsToday.textContent = logsToday;

    document.querySelectorAll('.btn-override').forEach(button => {
        button.addEventListener('click', handleManualOverride);
    });
}

async function fetchRegisteredCount() {
    try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        if (mRegistered) mRegistered.textContent = snapshot.size;
    } catch (e) {
        console.error("Error fetching registered count:", e);
    }
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

// ----------------------------------------------------
// SCHEDULE MANAGER LOGIC
// ----------------------------------------------------
const scheduleDay = document.getElementById('scheduleDay');
const scheduleSubject = document.getElementById('scheduleSubject');
const scheduleStart = document.getElementById('scheduleStart');
const scheduleEnd = document.getElementById('scheduleEnd');
const addScheduleBtn = document.getElementById('addScheduleBtn');
const scheduleBody = document.getElementById('scheduleBody');

if (addScheduleBtn) {
    addScheduleBtn.addEventListener('click', async () => {
        const day = scheduleDay.value;
        const subject = scheduleSubject.value.trim();
        const start = scheduleStart.value;
        const end = scheduleEnd.value;

        if (!subject || !start || !end) {
            alert("Please fill in all schedule fields.");
            return;
        }

        try {
            await addDoc(schedulesRef, {
                day: day,
                subject: subject,
                startTime: start,
                endTime: end,
                createdAt: serverTimestamp()
            });
            scheduleSubject.value = '';
            scheduleStart.value = '';
            scheduleEnd.value = '';
            alert("Schedule added successfully!");
        } catch (error) {
            console.error("Error adding schedule:", error);
            alert("Failed to add schedule.");
        }
    });
}

// Listen for schedules real-time
onSnapshot(query(schedulesRef, orderBy('day')), (snapshot) => {
    if (!scheduleBody) return;
    scheduleBody.innerHTML = '';
    
    const daysOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
    
    let schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    schedules.sort((a, b) => {
        if (daysOrder[a.day] !== daysOrder[b.day]) return daysOrder[a.day] - daysOrder[b.day];
        return a.startTime.localeCompare(b.startTime);
    });

    schedules.forEach(sched => {
        const formatTime = (timeStr) => {
            const [h, m] = timeStr.split(':');
            const date = new Date();
            date.setHours(parseInt(h), parseInt(m));
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        };

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${sched.day}</strong></td>
            <td>${sched.subject}</td>
            <td>${formatTime(sched.startTime)}</td>
            <td>${formatTime(sched.endTime)}</td>
            <td>
                <button class="btn-edit btn-delete-sched" data-id="${sched.id}" style="color: #c53030; border-color: #feb2b2;">Delete</button>
            </td>
        `;
        scheduleBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-delete-sched').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm("Are you sure you want to delete this schedule?")) {
                const id = e.target.getAttribute('data-id');
                await deleteDoc(doc(db, "schedules", id));
            }
        });
    });
});

// ----------------------------------------------------
// TAB SWITCHING LOGIC
// ----------------------------------------------------
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const target = tab.getAttribute('data-target');
        if (target) {
            document.getElementById(target).classList.add('active');
        }
    });
});


if (saveHoursBtn) {
    saveHoursBtn.addEventListener('click', async () => {
        const openTime = document.getElementById('openTime').value;
        const closeTime = document.getElementById('closeTime').value;
        
        try {
            const settingsRef = doc(db, "settings", "operatingHours");
            await setDoc(settingsRef, {
                open: openTime,
                close: closeTime,
                updatedAt: serverTimestamp()
            }, { merge: true });
            alert("Operating hours saved successfully.");
        } catch (error) {
            console.error("Error saving hours:", error);
            alert("Failed to save operating hours.");
        }
    });
}

const exportBtn = document.getElementById('exportBtn');

if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        const snapshot = await getDocs(sessionsRef);
        if (snapshot.empty) {
            alert("No records to export.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Date,Student Name,Email,Course,Year Level,Purpose,Check In,Check Out,Status\n";

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const dateStr = data.checkInTime ? data.checkInTime.toDate().toISOString().split('T')[0] : "—";
            const checkInStr = data.checkInTime ? data.checkInTime.toDate().toLocaleTimeString() : "—";
            const checkOutStr = data.checkOutTime ? data.checkOutTime.toDate().toLocaleTimeString() : "—";
            
            const row = [
                dateStr,
                `"${data.name || ''}"`,
                data.email || '',
                data.course || 'BS EE',
                data.yearLevel || 'N/A',
                data.purpose || '',
                checkInStr,
                checkOutStr,
                data.status || ''
            ];
            csvContent += row.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ee_lab_logs_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

const resetBtn = document.getElementById('resetBtn');

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        const confirmDelete = confirm("⚠️ WARNING: This will permanently delete ALL attendance logs. Are you sure you want to proceed?");
        
        if (confirmDelete) {
            try {
                const snapshot = await getDocs(sessionsRef);
                const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, "sessions", docSnap.id)));
                await Promise.all(deletePromises);
                alert("All logs have been successfully reset.");
            } catch (error) {
                console.error("Error resetting logs:", error);
                alert("Failed to reset logs.");
            }
        }
    });
}

const lockBtn = document.getElementById('lockBtn');
let isLocked = false;

const systemStatusRef = doc(db, "settings", "systemStatus");
onSnapshot(systemStatusRef, (docSnap) => {
    if (docSnap.exists()) {
        isLocked = docSnap.data().isLocked;
        if (lockBtn) {
            lockBtn.innerHTML = isLocked ? "🔓 Unlock Check-Ins" : "🔒 Lock Check-Ins";
            lockBtn.className = isLocked ? "btn btn-danger-outline" : "btn btn-warning";
        }
    }
});

if (lockBtn) {
    lockBtn.addEventListener('click', async () => {
        try {
            await setDoc(systemStatusRef, {
                isLocked: !isLocked,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error("Error toggling lock:", error);
            alert("Failed to update lock status.");
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
}
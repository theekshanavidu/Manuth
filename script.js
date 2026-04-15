const firebaseConfig = {
    apiKey: "AIzaSyDCHAjfss1000E6jh9y8ZGBFENnV-JM1sI",
    authDomain: "nifty-oxide-371302.firebaseapp.com",
    projectId: "nifty-oxide-371302",
    storageBucket: "nifty-oxide-371302.firebasestorage.app",
    messagingSenderId: "989665311513",
    appId: "1:989665311513:web:d574563ecd532b9a34e388"
};

// Initialize Firebase using compat API
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const resultContainer = document.getElementById('resultContainer');
    const shortLinkInput = document.getElementById('shortLink');
    const copyBtn = document.getElementById('copyBtn');
    const openBtn = document.getElementById('openBtn');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const monthFilter = document.getElementById('monthFilter');

    let history = []; 
    let unsubscribeHistory = null;

    const currentDate = new Date();
    const currentMonthVal = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    monthFilter.value = currentMonthVal;

    const renderHistory = () => {
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-state">No conversion history yet.</div>';
            return;
        }

        history.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            
            let dateStr = "Just now";
            if (item.timestamp) {
                // Formatting timestamp from Firebase Document
                const dateVal = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
                dateStr = dateVal.toLocaleString();
            }
            
            const thumbUrl = item.videoId ? `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg` : 'https://via.placeholder.com/100x56?text=No+Thumb';

            li.innerHTML = `
                <img src="${thumbUrl}" class="history-thumbnail" alt="Thumb">
                <div class="history-item-info">
                    <a href="${item.shortUrl}" target="_blank" class="history-item-title">${item.shortUrl}</a>
                    <span class="history-item-date">${dateStr}</span>
                </div>
                <div class="history-actions">
                    <button class="copy-mini" onclick="copyToClipboard('${item.shortUrl}')" title="Copy"><i class="fas fa-copy"></i></button>
                    <button class="copy-mini" onclick="deleteHistory('${item.id}')" title="Delete"><i class="fas fa-times"></i></button>
                </div>
            `;
            historyList.appendChild(li);
        });
    };

    const loadHistoryForMonth = (monthVal) => {
        if (unsubscribeHistory) {
            unsubscribeHistory();
        }
        
        historyList.innerHTML = '<div class="empty-state">Loading...</div>';

        const year = parseInt(monthVal.split('-')[0]);
        const month = parseInt(monthVal.split('-')[1]) - 1; 

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 1);

        unsubscribeHistory = db.collection("youtube_history")
            .where("timestamp", ">=", startOfMonth)
            .where("timestamp", "<", endOfMonth)
            .orderBy("timestamp", "desc")
            .limit(100)
            .onSnapshot((snapshot) => {
                history = [];
                snapshot.forEach((doc) => {
                    history.push({ id: doc.id, ...doc.data() });
                });
                renderHistory();
            }, (error) => {
                console.error("Error fetching history:", error);
                if(error.message && error.message.includes('index')) {
                    console.warn("Index needed, check console connection.");
                }
            });
    };

    monthFilter.addEventListener('change', (e) => {
        if (e.target.value) {
            loadHistoryForMonth(e.target.value);
        }
    });

    // Start by loading the current month
    loadHistoryForMonth(currentMonthVal);

    window.deleteHistory = async (id) => {
        try {
            await db.collection("youtube_history").doc(id).delete();
            showToast('Item deleted successfully!');
        } catch (e) {
            console.error("Error deleting document: ", e);
            showToast('Failed to delete item');
        }
    };

    window.copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy', err);
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("Copy");
            textArea.remove();
            showToast('Copied to clipboard!');
        }
    };

    const showToast = (message) => {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'var(--success)';
        toast.style.color = 'white';
        toast.style.padding = '0.75rem 1.5rem';
        toast.style.borderRadius = '30px';
        toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        toast.style.zIndex = '1000';
        toast.style.fontWeight = '500';
        toast.style.animation = 'fadeInUp 0.3s ease-out';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    const extractVideoId = (url) => {
        let videoId = null;
        try {
            const embedMatch = url.match(/(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/i);
            if (embedMatch && embedMatch[1]) {
                videoId = embedMatch[1];
            } else {
                const urlObj = new URL(url);
                if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
                    videoId = urlObj.searchParams.get('v');
                } else if (urlObj.hostname === 'youtu.be') {
                    videoId = urlObj.pathname.substring(1);
                }
            }
        } catch (e) {}
        
        if (!videoId) {
            const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
            const match = url.match(regex);
            if (match && match[1]) {
                videoId = match[1];
            }
        }
        return videoId;
    };

    const handleConversion = async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showToast('Please enter a URL first');
            return;
        }

        const videoId = extractVideoId(url);
        
        if (videoId) {
            const shortUrl = `https://youtu.be/${videoId}`;
            shortLinkInput.value = shortUrl;
            resultContainer.classList.remove('hidden');
            
            // Limit duplicate saves side-by-side
            if (history.length === 0 || history[0].videoId !== videoId) {
                try {
                    await db.collection("youtube_history").add({
                        originalUrl: url,
                        videoId: videoId,
                        shortUrl: shortUrl,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    showToast('Saved to database!');
                } catch (e) {
                    console.error("Error adding document: ", e);
                    showToast('Failed to save to database');
                }
            }
        } else {
            showToast('Invalid YouTube URL');
            resultContainer.classList.add('hidden');
        }
    };

    convertBtn.addEventListener('click', handleConversion);

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleConversion();
        }
    });

    copyBtn.addEventListener('click', () => {
        if (shortLinkInput.value) {
            copyToClipboard(shortLinkInput.value);
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
        }
    });

    openBtn.addEventListener('click', () => {
        if (shortLinkInput.value) {
            window.open(shortLinkInput.value, '_blank');
        }
    });

    clearHistoryBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear your entire database history?')) {
            try {
                const querySnapshot = await db.collection("youtube_history").get();
                const batch = db.batch();
                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                showToast('All history cleared!');
            } catch (e) {
                console.error("Error clearing history: ", e);
                showToast('Failed to clear history');
            }
        }
    });
});

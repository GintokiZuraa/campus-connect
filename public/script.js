// Global variables
let map;
let univMarker;
let userMarkers = new Map();
let userPolylines = new Map();
let universityData = null;
let allUsers = [];
let myLocationId = null;
let isEditing = false;

const API_BASE_URL = window.location.origin;

function getUserId() {
    let userId = localStorage.getItem('campus_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('campus_user_id', userId);
    }
    return userId;
}

const currentUserId = getUserId();

function initMap() {
    map = L.map('map').setView([-2.5, 118.0], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function formatDistance(km) {
    if (km < 1) return `${(km * 1000).toFixed(0)} m`;
    return `${km.toFixed(0)} km`;
}

async function loadData() {
    try {
        showStatus('Memuat data dari server...', 'loading');
        
        const [locationsRes, statsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/locations`),
            fetch(`${API_BASE_URL}/api/stats`)
        ]);
        
        const locationsData = await locationsRes.json();
        const statsData = await statsRes.json();
        
        if (locationsData.success) {
            universityData = locationsData.university;
            allUsers = locationsData.data;
            
            // Find user's own location
            const myLocation = allUsers.find(u => u.user_id === currentUserId);
            myLocationId = myLocation ? myLocation.id : null;
            
            // Update UI
            updateUniversityInfo();
            updateStats(statsData.data);
            drawAllLocations();
            renderUserList();
            updateFormState();
            
            showStatus(`✅ Data berhasil dimuat (${allUsers.length} mahasiswa)`, 'success');
            setTimeout(() => {
                document.getElementById('status').innerHTML = '';
            }, 3000);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showStatus('❌ Gagal memuat data dari server', 'error');
    }
}

function updateFormState() {
    const nameInput = document.getElementById('nameInput');
    const originInput = document.getElementById('originInput');
    const instagramInput = document.getElementById('instagramInput');
    const aboutInput = document.getElementById('aboutInput');
    const addBtn = document.getElementById('addBtn');
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    
    if (myLocationId) {
        const myLocation = allUsers.find(u => u.id === myLocationId);
        if (myLocation) {
            nameInput.value = myLocation.name;
            originInput.value = myLocation.origin_city;
            instagramInput.value = myLocation.instagram || '';
            aboutInput.value = myLocation.about_me || '';
            nameInput.disabled = true;
            originInput.disabled = true;
            instagramInput.disabled = true;
            aboutInput.disabled = true;
            addBtn.style.display = 'none';
            editBtn.style.display = 'block';
            deleteBtn.style.display = 'block';
        }
    } else {
        nameInput.disabled = false;
        originInput.disabled = false;
        instagramInput.disabled = false;
        aboutInput.disabled = false;
        nameInput.value = '';
        originInput.value = '';
        instagramInput.value = '';
        aboutInput.value = '';
        addBtn.style.display = 'block';
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
    }
}

function updateUniversityInfo() {
    if (universityData) {
        document.getElementById('univ-name').textContent = universityData.name;
        document.getElementById('univ-coords').textContent = 
            `📍 ${universityData.lat.toFixed(4)}, ${universityData.lng.toFixed(4)}`;
        
        if (!univMarker) {
            univMarker = L.marker([universityData.lat, universityData.lng])
                .bindPopup(`<b>${universityData.name}</b><br>🎓 Titik Kumpul Pusat`)
                .addTo(map);
        }
    }
}

function updateStats(stats) {
    document.getElementById('total-users').textContent = stats.total_users;
    const uniqueCities = new Set(allUsers.map(u => u.origin_city.toLowerCase()));
    document.getElementById('total-cities').textContent = uniqueCities.size;
}

function drawAllLocations() {
    if (!universityData) return;
    
    userMarkers.forEach(marker => map.removeLayer(marker));
    userPolylines.forEach(line => map.removeLayer(line));
    userMarkers.clear();
    userPolylines.clear();
    
    allUsers.forEach(user => {
        drawUserLocation(user);
    });
    
    if (allUsers.length > 0) {
        const bounds = L.latLngBounds([universityData.lat, universityData.lng]);
        allUsers.forEach(user => {
            bounds.extend([user.latitude, user.longitude]);
        });
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function drawUserLocation(user) {
    if (!universityData) return;
    
    const userLat = parseFloat(user.latitude);
    const userLng = parseFloat(user.longitude);
    const isOwnLocation = user.user_id === currentUserId;
    
    const polyline = L.polyline(
        [[universityData.lat, universityData.lng], [userLat, userLng]],
        {
            color: isOwnLocation ? '#4caf50' : '#e74c3c',
            weight: isOwnLocation ? 3 : 2,
            opacity: 0.6,
            dashArray: isOwnLocation ? null : '5, 5'
        }
    ).addTo(map);
    
    const distance = calculateDistance(
        universityData.lat, universityData.lng,
        userLat, userLng
    );
    
    const markerColor = isOwnLocation ? 'green' : 'red';
    
    let popupContent = `
        <b>${user.name}</b> ${isOwnLocation ? '(Anda)' : ''}<br>
        📍 ${user.origin_city}<br>
        📏 ${formatDistance(distance)} dari ${universityData.name}
    `;
    
    if (user.instagram) {
        const instaHandle = user.instagram.replace('@', '');
        popupContent += `<br>📸 <a href="https://instagram.com/${instaHandle}" target="_blank">@${instaHandle}</a>`;
    }
    
    if (user.about_me) {
        popupContent += `<br>💬 "${user.about_me}"`;
    }
    
    const marker = L.marker([userLat, userLng], {
        icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${markerColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        })
    }).bindPopup(popupContent).addTo(map);
    
    userMarkers.set(user.id, marker);
    userPolylines.set(user.id, polyline);
}

function renderUserList() {
    const container = document.getElementById('list-container');
    const countSpan = document.getElementById('user-count');
    
    countSpan.textContent = `(${allUsers.length})`;
    
    if (allUsers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 12px;">👥</div>
                <p>Belum ada data</p>
                <p style="font-size: 12px; margin-top: 8px;">Tambahkan lokasi pertama Anda!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    allUsers.forEach(user => {
        const distance = calculateDistance(
            universityData.lat, universityData.lng,
            user.latitude, user.longitude
        );
        
        const isOwnLocation = user.user_id === currentUserId;
        
        html += `
            <div class="user-item" style="${isOwnLocation ? 'border: 2px solid #4caf50;' : ''}">
                <div class="user-info">
                    <div class="user-name">
                        ${user.name}
                        ${isOwnLocation ? '<span class="own-location-badge">Anda</span>' : ''}
                    </div>
                    <div class="user-origin">📍 ${user.origin_city}</div>
                    <div class="user-distance">📏 ${formatDistance(distance)} dari kampus</div>
                    ${user.instagram ? `<div style="font-size: 12px; color: #e1306c; margin-top: 4px;">📸 ${user.instagram}</div>` : ''}
                    ${user.about_me ? `<div style="font-size: 12px; color: #666; margin-top: 4px; font-style: italic;">💬 "${user.about_me}"</div>` : ''}
                </div>
                ${isOwnLocation ? `
                    <div class="user-actions">
                        <button onclick="startEdit()" style="background: #2196f3;">✏️ Edit</button>
                        <button onclick="deleteMyLocation()" style="background: #f44336;">🗑️ Hapus</button>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function saveLocation() {
    const nameInput = document.getElementById('nameInput');
    const originInput = document.getElementById('originInput');
    const instagramInput = document.getElementById('instagramInput');
    const aboutInput = document.getElementById('aboutInput');
    
    const name = nameInput.value.trim();
    const origin = originInput.value.trim();
    const instagram = instagramInput.value.trim();
    const about = aboutInput.value.trim();
    
    if (!name || !origin) {
        showStatus('❌ Mohon isi Nama dan Kota Asal', 'error');
        return;
    }
    
    const btn = document.getElementById('addBtn');
    const btnText = document.getElementById('btn-text');
    btn.disabled = true;
    btnText.innerHTML = '<span class="loading-spinner"></span> Mencari lokasi...';
    
    try {
        const searchQuery = `${origin}, Indonesia`;
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
        
        const geocodeRes = await fetch(geocodeUrl);
        const geocodeData = await geocodeRes.json();
        
        if (geocodeData.length === 0) {
            throw new Error(`Kota "${origin}" tidak ditemukan`);
        }
        
        const lat = parseFloat(geocodeData[0].lat);
        const lon = parseFloat(geocodeData[0].lon);
        const displayAddress = geocodeData[0].display_name;
        
        showStatus('📍 Lokasi ditemukan! Menyimpan ke database...', 'loading');
        
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `${API_BASE_URL}/api/locations/${myLocationId}` : `${API_BASE_URL}/api/locations`;
        
        const saveRes = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                origin_city: origin,
                latitude: lat,
                longitude: lon,
                display_address: displayAddress,
                user_id: currentUserId,
                instagram: instagram || null,
                about_me: about || null
            })
        });
        
        const saveData = await saveRes.json();
        
        if (!saveData.success) {
            throw new Error(saveData.error || 'Gagal menyimpan data');
        }
        
        showStatus(`Berhasil ${isEditing ? 'mengupdate' : 'menambahkan'} lokasi!`, 'success');
        
        isEditing = false;
        await loadData();
        
        setTimeout(() => {
            map.setView([lat, lon], 10);
        }, 500);
        
    } catch (error) {
        console.error('Error saving location:', error);
        showStatus(`${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = '➕ Tambahkan Lokasi';
    }
}

// Start editing
window.startEdit = function() {
    isEditing = true;
    const nameInput = document.getElementById('nameInput');
    const originInput = document.getElementById('originInput');
    const instagramInput = document.getElementById('instagramInput');
    const aboutInput = document.getElementById('aboutInput');
    const addBtn = document.getElementById('addBtn');
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    nameInput.disabled = false;
    originInput.disabled = false;
    instagramInput.disabled = false;
    aboutInput.disabled = false;
    addBtn.style.display = 'block';
    editBtn.style.display = 'none';
    deleteBtn.style.display = 'none';
    cancelBtn.style.display = 'block';
    
    document.getElementById('btn-text').textContent = '💾 Update Lokasi';
};

window.cancelEdit = function() {
    isEditing = false;
    updateFormState();
    document.getElementById('cancelBtn').style.display = 'none';
};

window.deleteMyLocation = async function() {
    if (!confirm('Apakah Anda yakin ingin menghapus lokasi Anda?')) {
        return;
    }
    
    try {
        showStatus('🗑️ Menghapus data...', 'loading');
        
        const res = await fetch(`${API_BASE_URL}/api/locations/${myLocationId}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Gagal menghapus data');
        }
        
        showStatus('✅ Data berhasil dihapus', 'success');
        
        myLocationId = null;
        await loadData();
        
        setTimeout(() => {
            document.getElementById('status').innerHTML = '';
        }, 3000);
        
    } catch (error) {
        console.error('Error deleting location:', error);
        showStatus(`${error.message}`, 'error');
    }
};

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = '';
    
    if (type === 'success') {
        statusEl.classList.add('status-success');
    } else if (type === 'error') {
        statusEl.classList.add('status-error');
    } else if (type === 'loading') {
        statusEl.classList.add('status-loading');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadData();
    
    document.getElementById('addBtn').addEventListener('click', saveLocation);
    document.getElementById('editBtn').addEventListener('click', startEdit);
    document.getElementById('deleteBtn').addEventListener('click', deleteMyLocation);
    document.getElementById('cancelBtn').addEventListener('click', cancelEdit);
    
    const inputs = ['nameInput', 'originInput', 'instagramInput', 'aboutInput'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveLocation();
        });
    });
});